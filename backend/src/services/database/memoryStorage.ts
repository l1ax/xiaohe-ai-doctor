/**
 * In-Memory Storage
 *
 * 内存级别的对话和消息存储
 * 用于开发环境或 Supabase 不可用时的备用方案
 * 注意：进程重启后数据会丢失
 */

import { Conversation, Message } from './types';

interface MemoryStore {
  conversations: Map<string, Conversation>;
  messages: Map<string, Message[]>; // conversation_id -> messages
}

// 全局内存存储
const store: MemoryStore = {
  conversations: new Map(),
  messages: new Map(),
};

/**
 * 获取所有对话（按用户ID过滤）
 */
export function getConversations(patientId: string): Conversation[] {
  const all = Array.from(store.conversations.values());
  return all
    .filter(c => c.patient_id === patientId)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

/**
 * 获取单个对话
 */
export function getConversation(id: string): Conversation | null {
  return store.conversations.get(id) || null;
}

/**
 * 创建或更新对话
 */
export function saveConversation(conversation: Conversation): void {
  store.conversations.set(conversation.id, conversation);
}

/**
 * 更新对话的 updated_at
 */
export function touchConversation(id: string): void {
  const conv = store.conversations.get(id);
  if (conv) {
    conv.updated_at = new Date().toISOString();
    store.conversations.set(id, conv);
  }
}

/**
 * 删除对话及其消息
 */
export function deleteConversation(id: string): boolean {
  store.messages.delete(id);
  return store.conversations.delete(id);
}

/**
 * 获取对话的所有消息
 */
export function getMessages(conversationId: string): Message[] {
  return store.messages.get(conversationId) || [];
}

/**
 * 添加消息
 */
export function addMessage(message: Message): void {
  const messages = store.messages.get(message.conversation_id) || [];
  messages.push(message);
  store.messages.set(message.conversation_id, messages);
  
  // 更新对话的 updated_at
  touchConversation(message.conversation_id);
}

/**
 * 批量添加消息
 */
export function addMessages(messages: Message[]): void {
  for (const msg of messages) {
    addMessage(msg);
  }
}

/**
 * 更新消息内容和元数据
 */
export function updateMessage(id: string, updates: Partial<Pick<Message, 'content' | 'metadata'>>): boolean {
  for (const [convId, messages] of store.messages) {
    const msgIndex = messages.findIndex(m => m.id === id);
    if (msgIndex >= 0) {
      const msg = messages[msgIndex];
      if (updates.content !== undefined) {
        msg.content = updates.content;
      }
      if (updates.metadata !== undefined) {
        msg.metadata = { ...msg.metadata, ...updates.metadata };
      }
      touchConversation(convId);
      return true;
    }
  }
  return false;
}

/**
 * 清空所有数据（用于测试）
 */
export function clearAll(): void {
  store.conversations.clear();
  store.messages.clear();
}

/**
 * 获取存储统计
 */
export function getStats(): { conversationCount: number; messageCount: number } {
  let messageCount = 0;
  store.messages.forEach(msgs => {
    messageCount += msgs.length;
  });
  return {
    conversationCount: store.conversations.size,
    messageCount,
  };
}

console.log('[MemoryStorage] In-memory storage initialized');
