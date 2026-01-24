import { StorageClient } from '@supabase/storage-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// Bucket 名称
const BUCKET_NAME = 'xiaohe-uploads';

/**
 * 存储服务
 *
 * 用于上传图片到 Supabase Storage
 */
export class StorageService {
  private client: StorageClient | null = null;

  constructor() {
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
      const storageUrl = `${SUPABASE_URL}/storage/v1`;
      this.client = new StorageClient(storageUrl, {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      });
    }
  }

  /**
   * 上传文件
   */
  async uploadFile(
    file: Buffer,
    fileName: string,
    contentType: string,
    path: string = ''
  ): Promise<{ url: string; path: string }> {
    if (!this.client) {
      throw new Error('Storage client not initialized. Please check SUPABASE credentials.');
    }

    const fullPath = path ? `${path}/${fileName}` : fileName;

    try {
      const { data, error } = await this.client
        .from(BUCKET_NAME)
        .upload(fullPath, file, {
          contentType,
          upsert: false,
        });

      if (error) {
        throw error;
      }

      // 获取公开 URL
      const {
        data: { publicUrl },
      } = this.client.from(BUCKET_NAME).getPublicUrl(fullPath);

      return {
        url: publicUrl,
        path: fullPath,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Upload failed: ${message}`);
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(path: string): Promise<void> {
    if (!this.client) {
      throw new Error('Storage client not initialized');
    }

    try {
      const { error } = await this.client.from(BUCKET_NAME).remove([path]);

      if (error) {
        throw error;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Delete failed: ${message}`);
    }
  }

  /**
   * 检查服务是否可用
   */
  isAvailable(): boolean {
    return this.client !== null;
  }
}

export const storageService = new StorageService();
