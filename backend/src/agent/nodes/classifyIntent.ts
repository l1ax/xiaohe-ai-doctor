import { AgentState } from "../state";
import { UserIntent } from "../types";
import { createZhipuLLM } from "../../utils/llm";
import {
  createConversationStatusEvent,
  createMessageStatusEvent,
  createMessageContentEvent,
} from "../events/chat-event-types";
import { v4 as uuidv4 } from 'uuid';

const llm = createZhipuLLM(0);

const INTENT_PROMPT = `你是一个医疗健康助手的意图识别模块。分析用户输入，判断用户的意图类型。

意图类型：
- symptom_consult: 用户描述症状，寻求健康建议（如"我头疼怎么办"）
- general_qa: 通用医疗健康知识问答（如"什么是高血压"）
- hospital_recommend: 用户询问医院推荐（如"北京哪家医院心内科好"）
- medicine_info: 用户咨询药品信息（如"布洛芬怎么吃"）

用户输入: {input}

请返回 JSON 格式（仅返回JSON，不要其他内容）:
{
  "intent": "意图类型",
  "entities": {
    "symptoms": ["症状1", "症状2"],  // 如果是症状咨询
    "location": "地点",              // 如果是医院推荐
    "medicineName": "药品名"         // 如果是药品咨询
  }
}`;

export async function classifyIntent(state: typeof AgentState.State) {
  const emitter = state.eventEmitter;
  const { conversationId, messages } = state;
  const lastMessage = messages[messages.length - 1];
  const userInput = lastMessage.content;

  // 生成消息 ID
  const messageId = state.messageId || `msg_${Date.now()}`;

  // 发送对话状态 - 处理中 (使用工厂函数)
  emitter.emit('conversation:status', createConversationStatusEvent(
    conversationId,
    'processing',
    { previousStatus: 'sending', message: '正在分析您的问题...' }
  ));

  // 发送消息状态 - 发送中 (使用工厂函数)
  emitter.emit('message:status', createMessageStatusEvent(
    conversationId,
    messageId,
    'sending',
    'assistant'
  ));

  const prompt = INTENT_PROMPT.replace('{input}', userInput);

  const response = await llm.invoke([
    { role: "user", content: prompt },
  ]);

  let result: { intent: UserIntent; entities: any };

  try {
    const content = (response.content as string).trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      result = JSON.parse(jsonMatch[0]);
    } else {
      result = JSON.parse(content);
    }
  } catch (error) {
    console.error('Intent parse error:', error);
    result = { intent: 'general_qa', entities: {} };
  }

  console.log('✅ Intent classified:', result.intent);

  // 发送意图识别事件
  emitter.emit('agent:intent', {
    type: 'agent:intent',
    data: {
      intent: result.intent,
      entities: {
        ...result.entities,
        conversationId,
        userMessage: userInput,
      },
      timestamp: new Date().toISOString(),
    },
  });

  return {
    userIntent: result.intent,
    extractedInfo: result.entities,
    messageId,
  };
}
