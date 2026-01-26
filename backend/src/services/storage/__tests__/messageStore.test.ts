import { describe, it, expect, beforeEach } from 'vitest';
import { messageStore, Message } from '../messageStore';

describe('messageStore', () => {
  beforeEach(() => {
    messageStore.clear();
  });

  it('should add and retrieve messages by consultationId', () => {
    const message: Message = {
      id: 'msg1',
      consultationId: 'consult1',
      senderId: 'user1',
      senderType: 'patient',
      content: 'Hello doctor',
      createdAt: '2026-01-25T10:00:00Z',
    };

    messageStore.addMessage(message);
    const messages = messageStore.getByConsultationId('consult1');

    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(message);
  });

  it('should return empty array for non-existent consultation', () => {
    const messages = messageStore.getByConsultationId('non-existent');
    expect(messages).toEqual([]);
  });

  it('should clear all messages', () => {
    const message: Message = {
      id: 'msg1',
      consultationId: 'consult1',
      senderId: 'user1',
      senderType: 'patient',
      content: 'Hello',
      createdAt: '2026-01-25T10:00:00Z',
    };

    messageStore.addMessage(message);
    messageStore.clear();
    const messages = messageStore.getByConsultationId('consult1');

    expect(messages).toEqual([]);
  });
});
