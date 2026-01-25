import { AgentState } from "../state";
import { createZhipuLLM } from "../../utils/llm";
import {
  createToolCallEvent,
  createMessageContentEvent,
} from "../events/chat-event-types";
import { v4 as uuidv4 } from 'uuid';

const llm = createZhipuLLM(0.7);

const MEDICINE_PROMPT = `你是一位药品咨询顾问。用户询问药品相关问题。

用户问题: {query}

请提供：
1. 药品的基本信息
2. 用法用量建议
3. 注意事项

注意：
- 提供准确的药品信息
- 强调遵医嘱，不可自行用药
- 严重情况需咨询医生
- 语气专业、关切`;

export async function medicineInfo(state: typeof AgentState.State) {
  const emitter = state.eventEmitter;
  const { conversationId, messages, extractedInfo } = state;
  const lastMessage = messages[messages.length - 1];
  const userQuery = lastMessage.content;
  const medicineName = extractedInfo?.medicineName || '相关药品';

  const messageId = state.messageId || `msg_${Date.now()}`;
  const toolId = `tool_${uuidv4()}`;

  // 发送工具调用开始事件
  emitter.emit('tool:call', createToolCallEvent(
    conversationId,
    toolId,
    'medicine_info',
    messageId,
    'running',
    { input: { medicineName } }
  ));

  const prompt = MEDICINE_PROMPT.replace('{query}', userQuery);

  // 使用LLM原生流式输出
  let fullContent = '';
  let chunkIndex = 0;
  let isFirst = true;

  const stream = await llm.stream([
    { role: "user", content: prompt },
  ]);

  for await (const chunk of stream) {
    const delta = typeof chunk.content === 'string' ? chunk.content : '';
    if (delta) {
      fullContent += delta;
      emitter.emit('message:content', createMessageContentEvent(
        conversationId,
        messageId,
        delta,
        chunkIndex++,
        isFirst,
        false
      ));
      isFirst = false;
    }
  }

  // 发送结束标记
  emitter.emit('message:content', createMessageContentEvent(
    conversationId,
    messageId,
    '',
    chunkIndex,
    false,
    true
  ));

  const info = fullContent;
  console.log('💊 Medicine info completed');

  // 发送工具调用完成事件
  emitter.emit('tool:call', createToolCallEvent(
    conversationId,
    toolId,
    'medicine_info',
    messageId,
    'completed',
    { output: { info }, duration: 500 }
  ));

  return {
    branchResult: info,
    messageId,
  };
}
