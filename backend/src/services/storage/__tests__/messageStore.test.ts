import { describe, it, expect, beforeEach } from 'vitest';
import { messageStore, Message } from '../messageStore';

describe('MessageStore', () => {
  beforeEach(() => {
    messageStore.clear();
  });

  it('should add a message', () => {
    const message: Message = {
      id: 'msg_1',
      conversationId: 'conv_123',
      senderId: 'user_1',
      senderType: 'patient',
      content: 'Hello',
      createdAt: new Date().toISOString(),
    };
    messageStore.addMessage(message);
    const messages = messageStore.getMessagesByConversation('conv_123');
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hello');
  });

  it('should get messages by conversation', () => {
    const msg1: Message = {
      id: 'msg_1',
      conversationId: 'conv_123',
      senderId: 'user_1',
      senderType: 'patient',
      content: 'Hello',
      createdAt: new Date().toISOString(),
    };
    const msg2: Message = {
      id: 'msg_2',
      conversationId: 'conv_123',
      senderId: 'user_2',
      senderType: 'doctor',
      content: 'Hi there',
      createdAt: new Date().toISOString(),
    };
    messageStore.addMessage(msg1);
    messageStore.addMessage(msg2);
    const messages = messageStore.getMessagesByConversation('conv_123');
    expect(messages).toHaveLength(2);
  });

  it('should clear all messages', () => {
    const message: Message = {
      id: 'msg_1',
      conversationId: 'conv_123',
      senderId: 'user_1',
      senderType: 'patient',
      content: 'Hello',
      createdAt: new Date().toISOString(),
    };
    messageStore.addMessage(message);
    messageStore.clear();
    const messages = messageStore.getMessagesByConversation('conv_123');
    expect(messages).toHaveLength(0);
  });
});
