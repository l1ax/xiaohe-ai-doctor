import { ChatOpenAI } from "@langchain/openai";

export function createZhipuLLM(temperature: number = 0.7) {
  return new ChatOpenAI({
    model: "glm-4-flash",
    apiKey: process.env.ZHIPU_API_KEY,
    temperature,
    configuration: {
      baseURL: process.env.ZHIPU_BASE_URL || "https://open.bigmodel.cn/api/paas/v4",
    },
  });
}
