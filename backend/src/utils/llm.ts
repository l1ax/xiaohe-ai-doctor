import { ChatOpenAI } from "@langchain/openai";
import { AgentEventEmitter } from '../agent/events/AgentEventEmitter';
import { createMessageContentEvent } from '../agent/events/chat-event-types';

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

/**
 * 流式 LLM 响应
 * 使用 llm.stream() 实现真正的流式输出
 * 
 * @param llm LLM 实例
 * @param prompt 提示词
 * @param conversationId 会话 ID
 * @param messageId 消息 ID
 * @param eventEmitter 事件发射器
 * @returns 完整的响应内容
 */
export async function streamLLMResponse(
  llm: ChatOpenAI,
  prompt: string,
  conversationId: string,
  messageId: string,
  eventEmitter: AgentEventEmitter
): Promise<string> {
  const stream = await llm.stream(prompt);
  let fullContent = '';
  let chunkIndex = 0;
  
  for await (const chunk of stream) {
    const delta = typeof chunk.content === 'string' ? chunk.content : '';
    if (delta) {
      fullContent += delta;
      eventEmitter.emit('message:content', createMessageContentEvent(
        conversationId,
        messageId,
        delta,
        chunkIndex++,
        chunkIndex === 1,  // isFirst
        false              // isLast - 流式过程中都是 false
      ));
    }
  }
  
  // 发送最后一个标记 isLast=true 的空事件，表示流式结束
  eventEmitter.emit('message:content', createMessageContentEvent(
    conversationId,
    messageId,
    '',
    chunkIndex,
    false,
    true  // isLast
  ));
  
  return fullContent;
}
