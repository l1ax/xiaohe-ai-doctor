import { ImageRecognitionConfig, ImageRecognitionResult } from './types';
import { RECOGNITION_PROMPTS } from './prompts';

const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
const MODEL = 'glm-4v';

interface ZhipuApiResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * 识别图片内容
 * @param imageUrl 图片 URL
 * @param config 识别配置
 * @returns 识别结果
 */
export async function recognizeImage(
  imageUrl: string,
  config: ImageRecognitionConfig
): Promise<ImageRecognitionResult> {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    throw new Error('ZHIPU_API_KEY environment variable is not set');
  }

  // 获取对应意图的 prompt
  // 如果意图是 hospital_recommend，使用通用 prompt
  const prompt =
    config.customPrompt ||
    (config.intent === 'hospital_recommend'
      ? RECOGNITION_PROMPTS.general_qa
      : RECOGNITION_PROMPTS[config.intent]);

  // 构建多模态消息
  const messages = [
    {
      role: 'user' as const,
      content: [
        {
          type: 'text' as const,
          text: prompt,
        },
        {
          type: 'image_url' as const,
          image_url: {
            url: imageUrl,
          },
        },
      ],
    },
  ];

  const response = await fetch(ZHIPU_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Zhipu API error: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as ZhipuApiResponse;

  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid response format from Zhipu API');
  }

  return {
    description: data.choices[0].message.content,
  };
}
