import type { AgentStateType } from '../state';
import { createConversationEndEvent } from '../events/chat-event-types';

/**
 * 最终响应节点 - 处理 ReAct 循环完成后的收尾工作
 *
 * 职责：
 * - 发送会话结束事件
 * - 处理 fallback 响应（如果有）
 * - 结束对话流程
 */
export async function finalResponse(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const {
    conversationId,
    messageId,
    startTime,
    eventEmitter,
    fallbackResponse,
    messages,
  } = state;

  // 计算对话持续时间
  const duration = startTime ? Date.now() - startTime : 0;

  // 发送会话结束事件
  if (eventEmitter) {
    // 先发送 agent:done 事件，触发 MessageWriter 保存助手消息
    eventEmitter.emitDone(conversationId, messageId);

    // 再发送会话结束事件（用于 SSE 通知前端）
    eventEmitter.emit(
      'conversation:end',
      createConversationEndEvent(
        conversationId,
        messageId || `msg_${Date.now()}`,
        duration,
        messages.length
      )
    );
  }

  console.log(`✅ Conversation ${conversationId} completed, duration: ${duration}ms`);

  // 如果有 fallback 响应，返回它
  if (fallbackResponse) {
    return { fallbackResponse };
  }

  // 不需要返回 messages，因为 reactLoop 中的工具（如 finish）已经通过 SSE 发送了消息
  return {};
}
