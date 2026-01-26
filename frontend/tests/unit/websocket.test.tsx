import { describe, it, expect } from 'vitest';
import { WebSocketService, ChatMessage, MessageHandler, SystemHandler, TypingHandler } from '../../src/services/websocket';

describe('WebSocketService', () => {
  it('should export WebSocketService class', () => {
    expect(typeof WebSocketService).toBe('function');
  });

  it('should export ChatMessage interface', () => {
    const message: ChatMessage = {
      id: 'msg_1',
      senderId: 'user_1',
      senderType: 'patient',
      content: 'Hello',
      createdAt: new Date().toISOString(),
    };
    expect(message.id).toBe('msg_1');
    expect(message.senderType).toBe('patient');
  });

  it('should export handler types', () => {
    const messageHandler: MessageHandler = (msg) => expect(msg).toBeDefined();
    const systemHandler: SystemHandler = (text) => expect(typeof text).toBe('string');
    const typingHandler: TypingHandler = (id) => expect(typeof id).toBe('string');

    messageHandler({} as ChatMessage);
    systemHandler('test');
    typingHandler('user_1');
  });
});
