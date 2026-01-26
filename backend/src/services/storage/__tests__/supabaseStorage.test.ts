import { describe, it, expect, beforeEach, vi } from 'vitest';

// 在导入模块之前设置环境变量
vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('SUPABASE_SERVICE_KEY', 'test-service-key');

// 使用 vi.hoisted 来确保 mock 函数可以在 vi.mock 中使用
const { mockUpload, mockGetPublicUrl, mockRemove, mockFrom, MockStorageClient } = vi.hoisted(() => {
  const mockUpload = vi.fn();
  const mockGetPublicUrl = vi.fn();
  const mockRemove = vi.fn();
  const mockFrom = vi.fn(() => ({
    upload: mockUpload,
    getPublicUrl: mockGetPublicUrl,
    remove: mockRemove,
  }));

  // 创建一个类构造函数
  class MockStorageClient {
    from() {
      return mockFrom();
    }
  }

  return { mockUpload, mockGetPublicUrl, mockRemove, mockFrom, MockStorageClient };
});

// Mock @supabase/storage-js
vi.mock('@supabase/storage-js', () => ({
  StorageClient: MockStorageClient,
}));

import { SupabaseStorageService } from '../supabaseStorage';

describe('SupabaseStorageService', () => {
  let storageService: SupabaseStorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    storageService = new SupabaseStorageService();
    
    // 重置 mockFrom 返回的 bucket
    mockFrom.mockReturnValue({
      upload: mockUpload,
      getPublicUrl: mockGetPublicUrl,
      remove: mockRemove,
    });
  });

  describe('uploadImage', () => {
    it('should successfully upload image and return URL', async () => {
      const fileBuffer = Buffer.from('test image content');
      const userId = 'user123';
      const conversationId = 'conv456';
      const filename = 'test.jpg';
      const contentType = 'image/jpeg';

      const mockPath = 'user123/conv456/1234567890_test.jpg';
      const mockPublicUrl = 'https://test.supabase.co/storage/v1/object/public/medical-images/user123/conv456/1234567890_test.jpg';

      mockUpload.mockResolvedValue({
        data: { path: mockPath },
        error: null,
      });

      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: mockPublicUrl },
      });

      // Mock Date.now to return a fixed timestamp
      const mockTimestamp = 1234567890;
      vi.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      const result = await storageService.uploadImage(
        fileBuffer,
        userId,
        conversationId,
        filename,
        contentType
      );

      expect(result).toEqual({
        url: mockPublicUrl,
        path: mockPath,
      });

      expect(mockUpload).toHaveBeenCalledWith(
        `${userId}/${conversationId}/${mockTimestamp}_${filename}`,
        fileBuffer,
        {
          contentType,
          upsert: false,
        }
      );

      expect(mockGetPublicUrl).toHaveBeenCalledWith(
        `${userId}/${conversationId}/${mockTimestamp}_${filename}`
      );

      vi.restoreAllMocks();
    });

    it('should throw error when upload fails', async () => {
      const fileBuffer = Buffer.from('test image content');
      const userId = 'user123';
      const conversationId = 'conv456';
      const filename = 'test.jpg';
      const contentType = 'image/jpeg';

      const mockError = { message: 'Upload failed', statusCode: 400 };
      mockUpload.mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        storageService.uploadImage(fileBuffer, userId, conversationId, filename, contentType)
      ).rejects.toThrow('Upload failed: Upload failed');

      expect(mockUpload).toHaveBeenCalled();
    });
  });

  describe('getPublicUrl', () => {
    it('should return public URL for given path', () => {
      const path = 'user123/conv456/1234567890_test.jpg';
      const mockPublicUrl = 'https://test.supabase.co/storage/v1/object/public/medical-images/user123/conv456/1234567890_test.jpg';

      mockGetPublicUrl.mockReturnValue({
        data: { publicUrl: mockPublicUrl },
      });

      const url = storageService.getPublicUrl(path);

      expect(url).toBe(mockPublicUrl);
      expect(mockGetPublicUrl).toHaveBeenCalledWith(path);
    });
  });

  describe('deleteImage', () => {
    it('should successfully delete image', async () => {
      const path = 'user123/conv456/1234567890_test.jpg';

      mockRemove.mockResolvedValue({
        data: null,
        error: null,
      });

      await storageService.deleteImage(path);

      expect(mockRemove).toHaveBeenCalledWith([path]);
    });

    it('should throw error when delete fails', async () => {
      const path = 'user123/conv456/1234567890_test.jpg';
      const mockError = { message: 'Delete failed', statusCode: 404 };

      mockRemove.mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(storageService.deleteImage(path)).rejects.toThrow(
        'Delete failed: Delete failed'
      );

      expect(mockRemove).toHaveBeenCalledWith([path]);
    });
  });
});
