import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadConversationHistory, truncateHistory } from '../ConversationLoader';
import type { BaseMessage } from '@langchain/core/messages';

describe('ConversationLoader', () => {
  describe('loadConversationHistory', () => {
    it('should load recent messages from database', async () => {
      const conversationId = 'test-conv-1';

      const messages = await loadConversationHistory(conversationId);

      expect(Array.isArray(messages)).toBe(true);
    });

    it('should return empty array for non-existent conversation', async () => {
      const messages = await loadConversationHistory('non-existent');

      expect(messages).toEqual([]);
    });

    it('should limit to 20 messages (10 rounds)', async () => {
      // 该测试需要 mock Supabase,暂时跳过实现
      // 在集成环境中测试
    });
  });

  describe('truncateHistory', () => {
    it('should keep messages if under token limit', () => {
      const messages: BaseMessage[] = [
        { role: 'user', content: '你好' } as any,
        { role: 'assistant', content: '你好!' } as any,
      ];

      const truncated = truncateHistory(messages, 10000);

      expect(truncated.length).toBe(2);
    });

    it('should truncate when exceeding token limit', () => {
      const messages: BaseMessage[] = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: '这是一个很长的消息'.repeat(100),
      })) as any;

      const truncated = truncateHistory(messages, 4000);

      expect(truncated.length).toBeLessThan(messages.length);
    });

    it('should keep at least recent 6 messages', () => {
      const messages: BaseMessage[] = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: '这是一个超级超级超级长的消息'.repeat(1000),
      })) as any;

      const truncated = truncateHistory(messages, 100);

      expect(truncated.length).toBeGreaterThanOrEqual(6);
    });
  });
});
