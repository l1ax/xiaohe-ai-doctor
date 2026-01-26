import { StorageClient } from '@supabase/storage-js';

// Bucket 名称
const BUCKET_NAME = 'medical-images';

/**
 * Supabase Storage 服务
 *
 * 用于上传、获取和删除医疗图片
 */
export class SupabaseStorageService {
  private client: StorageClient | null = null;
  private bucket: any = null;

  constructor() {
    // 在构造函数中读取环境变量，便于测试时覆盖
    const SUPABASE_URL = process.env.SUPABASE_URL || '';
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

    // 验证环境变量
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      console.warn(
        'WARNING: SUPABASE_URL or SUPABASE_SERVICE_KEY not configured. SupabaseStorageService will not be available.'
      );
    } else {
      const storageUrl = `${SUPABASE_URL}/storage/v1`;
      this.client = new StorageClient(storageUrl, {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      });
      this.bucket = this.client.from(BUCKET_NAME);
    }
  }

  /**
   * 上传图片到 Supabase Storage
   * @param fileBuffer 图片文件 Buffer
   * @param userId 用户 ID
   * @param conversationId 会话 ID
   * @param filename 文件名
   * @param contentType 文件类型（如 image/jpeg）
   * @returns 包含公开 URL 和路径的对象
   * @throws 上传失败时抛出错误
   */
  async uploadImage(
    fileBuffer: Buffer,
    userId: string,
    conversationId: string,
    filename: string,
    contentType: string
  ): Promise<{ url: string; path: string }> {
    if (!this.bucket) {
      throw new Error('Storage client not initialized. Please check SUPABASE credentials.');
    }

    // 生成文件路径: {userId}/{conversationId}/{timestamp}_{filename}
    const timestamp = Date.now();
    const path = `${userId}/${conversationId}/${timestamp}_${filename}`;

    try {
      const { data, error } = await this.bucket.upload(path, fileBuffer, {
        contentType,
        upsert: false,
      });

      if (error) {
        throw error;
      }

      // 获取公开访问 URL
      const {
        data: { publicUrl },
      } = this.bucket.getPublicUrl(path);

      return {
        url: publicUrl,
        path: data?.path || path,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : (error as any)?.message || 'Unknown error';
      throw new Error(`Upload failed: ${message}`);
    }
  }

  /**
   * 获取图片的公开访问 URL
   * @param path 文件路径
   * @returns 公开访问 URL
   */
  getPublicUrl(path: string): string {
    if (!this.bucket) {
      throw new Error('Storage client not initialized. Please check SUPABASE credentials.');
    }

    const {
      data: { publicUrl },
    } = this.bucket.getPublicUrl(path);

    return publicUrl;
  }

  /**
   * 删除图片
   * @param path 文件路径
   * @throws 删除失败时抛出错误
   */
  async deleteImage(path: string): Promise<void> {
    if (!this.bucket) {
      throw new Error('Storage client not initialized. Please check SUPABASE credentials.');
    }

    try {
      const { error } = await this.bucket.remove([path]);

      if (error) {
        throw error;
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : (error as any)?.message || 'Unknown error';
      throw new Error(`Delete failed: ${message}`);
    }
  }
}
