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

  clear(): void {
    this.messages.clear();
  }
}

export const messageStore = new MessageStore();
