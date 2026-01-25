/**
 * 消息存储服务（MVP 阶段使用内存存储）
 */

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'patient' | 'doctor';
  content: string;
  createdAt: string;
}

class MessageStore {
  private messages: Map<string, Message> = new Map();

  addMessage(message: Message): void {
    this.messages.set(message.id, message);
  }

  getMessagesByConversation(conversationId: string): Message[] {
    return Array.from(this.messages.values())
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  getMessageById(id: string): Message | undefined {
    return this.messages.get(id);
  }

  clear(): void {
    this.messages.clear();
  }
}

export const messageStore = new MessageStore();
