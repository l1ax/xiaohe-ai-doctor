import { ChatOpenAI } from "@langchain/openai";

export function createZhipuLLM(temperature: number = 0.7) {
  if (!process.env.ZHIPU_API_KEY) {
    throw new Error('ZHIPU_API_KEY is not set in environment variables');
  }
  
  return new ChatOpenAI({
    model: "glm-4.5-airx",
    apiKey: process.env.ZHIPU_API_KEY,
    temperature,
    configuration: {
      baseURL: process.env.ZHIPU_BASE_URL || "https://open.bigmodel.cn/api/paas/v4",
    },
  });
}
