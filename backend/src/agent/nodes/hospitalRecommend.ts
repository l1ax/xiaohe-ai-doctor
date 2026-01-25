import { AgentState } from "../state";
import { createZhipuLLM } from "../../utils/llm";
import {
  createToolCallEvent,
  createMessageContentEvent,
  createMessageMetadataEvent,
} from "../events/chat-event-types";
import { v4 as uuidv4 } from 'uuid';

const llm = createZhipuLLM(0.7);

const HOSPITAL_PROMPT = `你是一位医疗咨询顾问。用户想要咨询医院推荐。

用户需求: {query}

请提供：
1. 根据用户需求推荐合适的医院科室
2. 就医建议

注意：
- MVP阶段只提供通用建议和科室推荐
- 告知用户可通过平台预约功能查看具体医院
- 语气专业、友好`;

export async function hospitalRecommend(state: typeof AgentState.State) {
  const emitter = state.eventEmitter;
  const { conversationId, messages, extractedInfo } = state;
  const lastMessage = messages[messages.length - 1];
  const userQuery = lastMessage.content;
  const location = extractedInfo?.location || '您的地区';

  const messageId = state.messageId || `msg_${Date.now()}`;
  const toolId = `tool_${uuidv4()}`;

  // 发送工具调用开始事件
  emitter.emit('tool:call', createToolCallEvent(
    conversationId,
    toolId,
    'hospital_recommend',
    messageId,
    'running',
    { input: { query: userQuery, location } }
  ));

  const prompt = HOSPITAL_PROMPT.replace('{query}', userQuery);

  const response = await llm.invoke([
    { role: "user", content: prompt },
  ]);

  const recommendation = response.content as string;
  console.log('🏥 Hospital recommendation completed');

  // 发送工具调用完成事件
  emitter.emit('tool:call', createToolCallEvent(
    conversationId,
    toolId,
    'hospital_recommend',
    messageId,
    'completed',
    { output: { recommendation }, duration: 500 }
  ));

  // 流式发送内容
  const words = recommendation.split('');
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
      { type: 'book_appointment', label: '预约挂号', data: { location } },
    ],
    undefined
  ));

  return {
    branchResult: recommendation,
    messageId,
  };
}
