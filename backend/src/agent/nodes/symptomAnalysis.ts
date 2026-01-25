import { AgentState } from "../state";
import { createZhipuLLM } from "../../utils/llm";
import {
  createToolCallEvent,
  createMessageContentEvent,
  createMessageMetadataEvent,
} from "../events/chat-event-types";
import { v4 as uuidv4 } from 'uuid';

const llm = createZhipuLLM(0.7);

const SYMPTOM_PROMPT = `你是一位专业的医疗健康顾问。用户描述了一些症状，请进行专业分析。

用户症状: {query}

请提供：
1. 可能的原因分析
2. 初步建议
3. 是否需要就医的判断

注意：
- 提供专业建议，但要通俗易懂
- 强调这只是参考，严重情况需就医
- 语气温和、关切`;

export async function symptomAnalysis(state: typeof AgentState.State) {
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
    'symptom_analysis',
    messageId,
    'running',
    { input: { query: userQuery } }
  ));

  const prompt = SYMPTOM_PROMPT.replace('{query}', userQuery);

  const response = await llm.invoke([
    { role: "user", content: prompt },
  ]);

  const analysis = response.content as string;
  console.log('🩺 Symptom analysis completed');

  // 发送工具调用完成事件
  emitter.emit('tool:call', createToolCallEvent(
    conversationId,
    toolId,
    'symptom_analysis',
    messageId,
    'completed',
    { output: { analysis }, duration: 500 }
  ));

  // 流式发送内容
  const words = analysis.split('');
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

  // 发送元数据
  emitter.emit('message:metadata', createMessageMetadataEvent(
    conversationId,
    messageId,
    undefined,
    [
      { type: 'transfer_to_doctor', label: '咨询人工医生', data: { action: 'transfer' } },
      { type: 'book_appointment', label: '预约挂号', data: { action: 'booking' } },
    ],
    {
      symptoms: [],
      possibleConditions: [],
      suggestions: [],
      urgencyLevel: 'low',
    }
  ));

  return {
    branchResult: analysis,
    messageId,
  };
}
