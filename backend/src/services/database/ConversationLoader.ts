import type { BaseMessage } from '@langchain/core/messages';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { messageRepository } from './MessageRepository';
import { isSupabaseConfigured } from './supabaseClient';

/**
 * 从数据库加载对话历史
 *
 * @param conversationId 会话 ID
 * @param limit 加载消息数量限制（默认 20 = 10轮对话）
 * @returns BaseMessage 数组
 */
export async function loadConversationHistory(
  conversationId: string,
  limit: number = 20
): Promise<BaseMessage[]> {
  try {
    if (!isSupabaseConfigured()) {
      console.log('[ConversationLoader] Supabase not configured, returning empty array');
      return [];
    }

    const messages = await messageRepository.findByConversationId(conversationId, limit);
    
    if (messages.length === 0) {
      console.log(`[ConversationLoader] No history found for conversation ${conversationId}`);
      return [];
    }

    console.log(`[ConversationLoader] Loaded ${messages.length} messages for conversation ${conversationId}`);
    
    return messages.map((msg) => toBaseMessage({
      role: msg.senderId === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
      image_urls: msg.metadata?.imageUrl ? [msg.metadata.imageUrl] : [],
    }));
  } catch (error) {
    console.error('[ConversationLoader] Failed to load history:', error);
    return [];
  }
}

/**
 * 将数据库消息转换为 LangChain BaseMessage
 */
function toBaseMessage(dbMessage: any): BaseMessage {
  const { role, content, image_urls } = dbMessage;

  switch (role) {
    case 'user':
      return new HumanMessage({
        content,
        additional_kwargs: { imageUrls: image_urls || [] },
      });
    case 'assistant':
      return new AIMessage({ content });
    case 'system':
      return new SystemMessage({ content });
    default:
      throw new Error(`Unknown message role: ${role}`);
  }
}

/**
 * 估算消息的 token 数量
 * 简单规则:中文 1字 ≈ 1.5 token,英文 1词 ≈ 1 token
 */
function estimateTokens(messages: BaseMessage[]): number {
  return messages.reduce((total, msg) => {
    const content = typeof msg.content === 'string' ? msg.content : '';
    // 简化估算:每个字符算 1.5 token
    return total + Math.ceil(content.length * 1.5);
  }, 0);
}

/**
 * 对话历史截断策略
 *
 * @param messages 原始消息列表
 * @param maxTokens 最大 token 数
 * @returns 截断后的消息列表
 */
export function truncateHistory(
  messages: BaseMessage[],
  maxTokens: number = 4000
): BaseMessage[] {
  // 1. 如果消息数量少,直接返回
  if (messages.length <= 20) {
    const tokens = estimateTokens(messages);
    if (tokens <= maxTokens) {
      return messages;
    }
  }

  // 2. 保留最新的 20 条消息
  const recentMessages = messages.slice(-20);
  const estimatedTokens = estimateTokens(recentMessages);

  // 3. 如果仍然超长,只保留最新 6 条（3 轮对话）
  if (estimatedTokens > maxTokens) {
    const latest = messages.slice(-6);

    // 如果还是太长,添加摘要提示
    if (estimateTokens(latest) > maxTokens) {
      // TODO: 在 Phase 后续版本实现摘要功能
      return latest;
    }

    return latest;
  }

  return recentMessages;
}
