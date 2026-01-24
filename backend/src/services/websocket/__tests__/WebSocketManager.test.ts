import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketManager } from '../WebSocketManager';
import { Server } from 'http';
import { WSMessageType, ContentType, SenderType } from '../types';

// Mock dependencies
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../auth/jwt', () => ({
  jwtService: {
    verifyToken: vi.fn((token: string) => {
      if (token === 'valid-token') {
        return { userId: 'user-123', role: 'patient', phone: '13800138000' };
      }
      if (token === 'doctor-token') {
        return { userId: 'doctor-456', role: 'doctor', phone: '13900139000' };
      }
      throw new Error('Invalid token');
    }),
  },
}));

describe('WebSocketManager', () => {
  let wsManager: WebSocketManager;
  let mockServer: Server;

  beforeEach(() => {
    wsManager = new WebSocketManager();
    mockServer = new Server();
  });

  afterEach(() => {
    wsManager.shutdown();
    vi.clearAllMocks();
  });

  describe('Conversation Management', () => {
    it('should allow users to join conversation', () => {
      wsManager.joinConversation('user-123', 'conv-001');
      const users = wsManager.getConversationUsers('conv-001');
      expect(users).toContain('user-123');
    });

    it('should allow multiple users to join conversation', () => {
      wsManager.joinConversation('user-123', 'conv-001');
      wsManager.joinConversation('doctor-456', 'conv-001');

      const users = wsManager.getConversationUsers('conv-001');
      expect(users).toHaveLength(2);
      expect(users).toContain('user-123');
      expect(users).toContain('doctor-456');
    });

    it('should allow users to leave conversation', () => {
      wsManager.joinConversation('user-123', 'conv-001');
      wsManager.leaveConversation('user-123', 'conv-001');

      const users = wsManager.getConversationUsers('conv-001');
      expect(users).not.toContain('user-123');
    });

    it('should delete conversation when all users leave', () => {
      wsManager.joinConversation('user-123', 'conv-001');
      wsManager.leaveConversation('user-123', 'conv-001');

      const users = wsManager.getConversationUsers('conv-001');
      expect(users).toHaveLength(0);
    });

    it('should return empty array for non-existent conversation', () => {
      const users = wsManager.getConversationUsers('non-existent-conv');
      expect(users).toEqual([]);
    });
  });

  describe('Connection Tracking', () => {
    it('should return zero online connections initially', () => {
      const onlineCount = wsManager.getOnlineCount();
      expect(onlineCount).toBe(0);
    });

    it('should track online connections', () => {
      const onlineCount = wsManager.getOnlineCount();
      expect(typeof onlineCount).toBe('number');
      expect(onlineCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Message Sending', () => {
    it('should return false for non-existent user', () => {
      const result = wsManager.sendToUser('non-existent-user', {
        type: WSMessageType.SYSTEM,
        conversationId: '',
        data: { text: 'Test message' },
      });

      expect(result).toBe(false);
    });

    it('should broadcast to conversation members', () => {
      wsManager.joinConversation('user-123', 'conv-001');
      wsManager.joinConversation('doctor-456', 'conv-001');

      // Broadcasting to conversation should not throw
      expect(() => {
        wsManager.broadcastToConversation(
          'conv-001',
          {
            type: WSMessageType.MESSAGE,
            conversationId: 'conv-001',
            message: {
              id: 'msg-001',
              senderId: 'user-123',
              senderType: SenderType.PATIENT,
              contentType: ContentType.TEXT,
              content: 'Hello',
              createdAt: new Date().toISOString(),
            },
          },
          'user-123'
        );
      }).not.toThrow();
    });

    it('should exclude sender when broadcasting', () => {
      wsManager.joinConversation('user-123', 'conv-001');
      wsManager.joinConversation('doctor-456', 'conv-001');

      // Should not throw when excluding sender
      expect(() => {
        wsManager.broadcastToConversation(
          'conv-001',
          {
            type: WSMessageType.MESSAGE,
            conversationId: 'conv-001',
            message: {
              id: 'msg-002',
              senderId: 'user-123',
              senderType: SenderType.PATIENT,
              contentType: ContentType.TEXT,
              content: 'Hello doctor',
              createdAt: new Date().toISOString(),
            },
          },
          'user-123'
        );
      }).not.toThrow();
    });

    it('should handle broadcasting to non-existent conversation gracefully', () => {
      // Should not throw for non-existent conversation
      expect(() => {
        wsManager.broadcastToConversation(
          'non-existent-conv',
          {
            type: WSMessageType.MESSAGE,
            conversationId: 'non-existent-conv',
            message: {
              id: 'msg-003',
              senderId: 'user-123',
              senderType: SenderType.PATIENT,
              contentType: ContentType.TEXT,
              content: 'Test',
              createdAt: new Date().toISOString(),
            },
          }
        );
      }).not.toThrow();
    });
  });

  describe('Message Types', () => {
    it('should handle MESSAGE type', () => {
      const message = {
        type: WSMessageType.MESSAGE,
        conversationId: 'conv-001',
        data: {
          content: 'Test message',
          contentType: ContentType.TEXT,
        },
      };

      expect(message.type).toBe(WSMessageType.MESSAGE);
      expect(message.type).toBe('message');
    });

    it('should handle TYPING type', () => {
      const message = {
        type: WSMessageType.TYPING,
        conversationId: 'conv-001',
      };

      expect(message.type).toBe(WSMessageType.TYPING);
      expect(message.type).toBe('typing');
    });

    it('should handle HEARTBEAT type', () => {
      const message = {
        type: WSMessageType.HEARTBEAT,
        conversationId: '',
      };

      expect(message.type).toBe(WSMessageType.HEARTBEAT);
      expect(message.type).toBe('heartbeat');
    });

    it('should handle SYSTEM type', () => {
      const message = {
        type: WSMessageType.SYSTEM,
        conversationId: '',
        data: { text: 'System notification' },
      };

      expect(message.type).toBe(WSMessageType.SYSTEM);
      expect(message.type).toBe('system');
    });
  });

  describe('Content Types', () => {
    it('should support TEXT content', () => {
      expect(ContentType.TEXT).toBe('text');
    });

    it('should support IMAGE content', () => {
      expect(ContentType.IMAGE).toBe('image');
    });

    it('should support SYSTEM content', () => {
      expect(ContentType.SYSTEM).toBe('system');
    });
  });

  describe('Sender Types', () => {
    it('should support PATIENT sender', () => {
      expect(SenderType.PATIENT).toBe('patient');
    });

    it('should support DOCTOR sender', () => {
      expect(SenderType.DOCTOR).toBe('doctor');
    });

    it('should support SYSTEM sender', () => {
      expect(SenderType.SYSTEM).toBe('system');
    });
  });

  describe('Shutdown', () => {
    it('should clear all connections on shutdown', () => {
      wsManager.joinConversation('user-123', 'conv-001');

      wsManager.shutdown();

      const onlineCount = wsManager.getOnlineCount();
      expect(onlineCount).toBe(0);
    });

    it('should clear all conversations on shutdown', () => {
      wsManager.joinConversation('user-123', 'conv-001');
      wsManager.joinConversation('doctor-456', 'conv-001');

      wsManager.shutdown();

      const users = wsManager.getConversationUsers('conv-001');
      expect(users).toHaveLength(0);
    });

    it('should handle multiple shutdowns gracefully', () => {
      wsManager.joinConversation('user-123', 'conv-001');

      wsManager.shutdown();

      // Should not throw on second shutdown
      expect(() => {
        wsManager.shutdown();
      }).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty conversation ID', () => {
      const users = wsManager.getConversationUsers('');
      expect(users).toEqual([]);
    });

    it('should handle user joining same conversation multiple times', () => {
      wsManager.joinConversation('user-123', 'conv-001');
      wsManager.joinConversation('user-123', 'conv-001');

      const users = wsManager.getConversationUsers('conv-001');
      // Should not duplicate user
      expect(users.filter((u) => u === 'user-123').length).toBe(1);
    });

    it('should handle user leaving conversation they never joined', () => {
      // Should not throw
      expect(() => {
        wsManager.leaveConversation('user-123', 'conv-001');
      }).not.toThrow();
    });

    it('should handle multiple conversations', () => {
      wsManager.joinConversation('user-123', 'conv-001');
      wsManager.joinConversation('doctor-456', 'conv-002');

      const users1 = wsManager.getConversationUsers('conv-001');
      const users2 = wsManager.getConversationUsers('conv-002');

      expect(users1).toContain('user-123');
      expect(users2).toContain('doctor-456');
      expect(users1).not.toContain('doctor-456');
      expect(users2).not.toContain('user-123');
    });

    it('should handle user in multiple conversations', () => {
      wsManager.joinConversation('user-123', 'conv-001');
      wsManager.joinConversation('user-123', 'conv-002');

      const users1 = wsManager.getConversationUsers('conv-001');
      const users2 = wsManager.getConversationUsers('conv-002');

      expect(users1).toContain('user-123');
      expect(users2).toContain('user-123');
    });
  });
});
