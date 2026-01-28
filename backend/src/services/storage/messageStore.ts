export interface Message {
  id: string;
  consultationId: string;
  senderId: string;
  senderType: 'patient' | 'doctor';
  content: string;
  contentType?: 'text' | 'image' | 'audio';
  imageUrl?: string;
  createdAt: string;
  isRead?: boolean;
  readAt?: string;
}

class MessageStore {
  private messages: Map<string, Message> = new Map();

  addMessage(message: Message): Message {
    const messageWithDefaults = {
      ...message,
      isRead: message.isRead ?? false,
    };
    this.messages.set(messageWithDefaults.id, messageWithDefaults);
    return messageWithDefaults;
  }

  getByConsultationId(consultationId: string): Message[] {
    return Array.from(this.messages.values())
      .filter((m) => m.consultationId === consultationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  markAsRead(messageId: string): Message | undefined {
    const message = this.messages.get(messageId);
    if (message && !message.isRead) {
      message.isRead = true;
      message.readAt = new Date().toISOString();
    }
    return message;
  }

  markMultipleAsRead(messageIds: string[]): void {
    const now = new Date().toISOString();
    for (const messageId of messageIds) {
      const message = this.messages.get(messageId);
      if (message && !message.isRead) {
        message.isRead = true;
        message.readAt = now;
      }
    }
  }

  /**
   * 标记某问诊中非自己发送的消息为已读
   */
  markConsultationAsRead(consultationId: string, userId: string): number {
    const now = new Date().toISOString();
    let count = 0;
    for (const message of this.messages.values()) {
      if (
        message.consultationId === consultationId &&
        message.senderId !== userId &&
        !message.isRead
      ) {
        message.isRead = true;
        message.readAt = now;
        count++;
      }
    }
    return count;
  }

  /**
   * 获取用户未读消息数（按问诊分组）
   */
  getUnreadCounts(userId: string): Map<string, number> {
    const counts = new Map<string, number>();
    for (const message of this.messages.values()) {
      if (message.senderId !== userId && !message.isRead) {
        const current = counts.get(message.consultationId) || 0;
        counts.set(message.consultationId, current + 1);
      }
    }
    return counts;
  }

  /**
   * 获取用户总未读消息数
   */
  getTotalUnreadCount(userId: string): number {
    let count = 0;
    for (const message of this.messages.values()) {
      if (message.senderId !== userId && !message.isRead) {
        count++;
      }
    }
    return count;
  }

  clear(): void {
    this.messages.clear();
  }
}

export const messageStore = new MessageStore();
