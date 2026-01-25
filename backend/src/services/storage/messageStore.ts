export interface Message {
  id: string;
  consultationId: string;
  senderId: string;
  senderType: 'patient' | 'doctor';
  content: string;
  createdAt: string;
}

class MessageStore {
  private messages: Map<string, Message> = new Map();

  addMessage(message: Message): Message {
    this.messages.set(message.id, message);
    return message;
  }

  getByConsultationId(consultationId: string): Message[] {
    return Array.from(this.messages.values())
      .filter((m) => m.consultationId === consultationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  clear(): void {
    this.messages.clear();
  }
}

export const messageStore = new MessageStore();
