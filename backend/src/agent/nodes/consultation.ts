import { AgentState } from "../state";
import { createZhipuLLM } from "../../utils/llm";
import {
  createToolCallEvent,
  createMessageContentEvent,
} from "../events/chat-event-types";
import { v4 as uuidv4 } from 'uuid';

const llm = createZhipuLLM(0.7);

const CONSULTATION_PROMPT = `你是一位专业的医疗健康顾问助手。请回答用户的医疗健康问题。

用户问题: {query}

要求：
- 提供专业、准确的医学知识
- 语言通俗易懂
- 必要时提醒用户就医
- 涉及用药时强调遵医嘱`;

export async function consultation(state: typeof AgentState.State) {
  const emitter = state.eventEmitter;
  const { conversationId, messages } = state;
  const lastMessage = messages[messages.length - 1];
  const userQuery = lastMessage.content;

  const messageId = state.messageId || `msg_${Date.now()}`;
  const toolId = `tool_${uuidv4()}`;

  // 发送工具调用开始事件
  emitter.emit('tool:call', createToolCallEvent(
    conversationId,
    toolId,
    'consultation',
    messageId,
    'running',
    { input: { query: userQuery } }
  ));

  const prompt = CONSULTATION_PROMPT.replace('{query}', userQuery);

  const response = await llm.invoke([
    { role: "user", content: prompt },
  ]);

  const answer = response.content as string;
  console.log('💬 Consultation completed');

  // 发送工具调用完成事件
  emitter.emit('tool:call', createToolCallEvent(
    conversationId,
    toolId,
    'consultation',
    messageId,
    'completed',
    { output: { answer }, duration: 500 }
  ));

  // 流式发送内容
  const words = answer.split('');
  words.forEach((char, index) => {
    emitter.emit('message:content', createMessageContentEvent(
      conversationId,
      messageId,
      char,
      index,
      index === 0,
      index === words.length - 1
    ));
  });

  return {
    branchResult: answer,
    messageId,
  };
}
