import { AgentState } from "../state";
import { createConversationEndEvent } from "../events/chat-event-types";

/**
 * 综合各分支结果，生成最终回复
 * MVP阶段直接返回分支结果，后续可优化为多分支结果整合
 */
export async function synthesizeResponse(state: typeof AgentState.State) {
  const { userIntent, conversationId, eventEmitter, messageId, startTime } = state;

  console.log(`✅ Final response synthesized for intent: ${userIntent}`);

  // 计算对话持续时间
  const duration = startTime ? Date.now() - startTime : 0;

  // 发送会话结束事件
  eventEmitter.emit('conversation:end', createConversationEndEvent(
    conversationId,
    messageId || `msg_${Date.now()}`,
    duration,
    2 // user + assistant
  ));

  // 不需要返回messages，因为分支节点（如consultation）已经通过SSE发送了消息
  return {};
}
