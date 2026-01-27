import { describe, it, expect, beforeEach, vi } from 'vitest';
import { recognizeImage } from '../imageRecognition';
import { ImageRecognitionConfig } from '../types';

describe('ImageRecognition', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('recognizeImage', () => {
    it('should successfully recognize symptom image', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '图片显示皮肤出现红色斑块，大小约2cm，表面有轻微脱屑，位于手臂外侧。',
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const config: ImageRecognitionConfig = {
        intent: 'symptom_consult',
      };

      const result = await recognizeImage('https://example.com/symptom.jpg', config);

      expect(result).toEqual({
        description: '图片显示皮肤出现红色斑块，大小约2cm，表面有轻微脱屑，位于手臂外侧。',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: expect.stringContaining('Bearer'),
          }),
        })
      );
    });

    it('should use different prompt for medicine recognition', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: '药品名称：阿莫西林胶囊，规格：0.25g，生产厂家：XX制药有限公司',
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const config: ImageRecognitionConfig = {
        intent: 'medicine_info',
      };

      const result = await recognizeImage('https://example.com/medicine.jpg', config);

      expect(result).toEqual({
        description: '药品名称：阿莫西林胶囊，规格：0.25g，生产厂家：XX制药有限公司',
      });

      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      const textContent = requestBody.messages[0].content.find(
        (item: any) => item.type === 'text'
      )?.text;
      expect(textContent).toContain('药品名称');
      expect(textContent).toContain('规格和剂量');
    });

    it('should throw error when API fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      const config: ImageRecognitionConfig = {
        intent: 'symptom_consult',
      };

      await expect(
        recognizeImage('https://example.com/symptom.jpg', config)
      ).rejects.toThrow();
    });

    it('should throw error when network request fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const config: ImageRecognitionConfig = {
        intent: 'symptom_consult',
      };

      await expect(
        recognizeImage('https://example.com/symptom.jpg', config)
      ).rejects.toThrow('Network error');
    });
  });
});
