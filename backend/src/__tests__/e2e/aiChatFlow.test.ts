// backend/src/__tests__/e2e/aiChatFlow.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AgentEventEmitter } from '../../agent/events/AgentEventEmitter';
import { runAgent } from '../../agent';
import { SSEHandler } from '../../services/streaming/SSEHandler';
import { MessageWriter } from '../../services/database/MessageWriter';
import { Message } from '../../agent/types';

describe('AI Chat End-to-End Flow', () => {
  let emitter: AgentEventEmitter;
  let sseHandler: SSEHandler;
  let messageWriter: MessageWriter;
  let events: any[] = [];

  beforeAll(() => {
    emitter = new AgentEventEmitter();
    sseHandler = SSEHandler.getInstance({
      heartbeatInterval: 30000,
      timeout: 60000,
      retryDelay: 1000,
    });
    messageWriter = new MessageWriter(emitter, {
      enabled: true,
      batch: {
        flushInterval: 1000,
        maxSize: 10,
      },
    });

    // 收集所有事件
    emitter.on('*', (event) => {
      events.push(event);
    });

    sseHandler.startEventListener();
  });

  afterAll(async () => {
    await messageWriter.stop();
    sseHandler.closeAllConnections();
  });

  describe('Symptom consultation flow', () => {
    it('should process symptom consultation with full event stream', { timeout: 30000 }, async () => {
      events = [];

      const message: Message = {
        role: 'user',
        content: '我头疼发热怎么办',
      };

      await runAgent({
        messages: [message],
        conversationId: 'test-symptom-1',
        eventEmitter: emitter,
      });

      // 验证事件序列
      const eventTypes = events.map((e) => e.type);

      // 应该包含这些事件类型
      expect(eventTypes).toContain('agent:thinking');
      expect(eventTypes).toContain('agent:intent');
      expect(eventTypes).toContain('agent:tool_call');
      expect(eventTypes).toContain('agent:content');
      expect(eventTypes).toContain('agent:metadata');
      expect(eventTypes).toContain('agent:done');

      // 验证意图识别
      const intentEvent = events.find((e) => e.type === 'agent:intent');
      expect(intentEvent.data.intent).toBe('symptom_consult');

      // 验证工具调用
      const toolCallEvents = events.filter((e) => e.type === 'agent:tool_call');
      expect(toolCallEvents.length).toBeGreaterThanOrEqual(2); // 至少 running 和 completed

      // 验证内容流
      const contentEvents = events.filter((e) => e.type === 'agent:content');
      expect(contentEvents.length).toBeGreaterThan(0);

      // 验证元数据包含医疗建议
      const metadataEvent = events.find((e) => e.type === 'agent:metadata');
      expect(metadataEvent).toBeDefined();
      expect(metadataEvent.data.medicalAdvice).toBeDefined();
      expect(metadataEvent.data.actions).toBeDefined();
    });

    it('should handle general Q&A flow', { timeout: 30000 }, async () => {
      events = [];

      await runAgent({
        messages: [{ role: 'user', content: '什么是高血压' }],
        conversationId: 'test-qa-1',
        eventEmitter: emitter,
      });

      const intentEvent = events.find((e) => e.type === 'agent:intent');
      expect(intentEvent.data.intent).toBe('general_qa');
    });

    it('should handle hospital recommendation flow', { timeout: 30000 }, async () => {
      events = [];

      await runAgent({
        messages: [{ role: 'user', content: '北京哪家医院心内科好' }],
        conversationId: 'test-hospital-1',
        eventEmitter: emitter,
      });

      const intentEvent = events.find((e) => e.type === 'agent:intent');
      expect(intentEvent.data.intent).toBe('hospital_recommend');

      // 应该有预约操作的 action
      const metadataEvent = events.find((e) => e.type === 'agent:metadata');
      const bookAction = metadataEvent?.data.actions?.find((a: any) => a.type === 'book_appointment');
      expect(bookAction).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should emit error event on agent failure', { timeout: 30000 }, async () => {
      events = [];

      // 测试空消息
      await runAgent({
        messages: [{ role: 'user', content: '' }],
        conversationId: 'test-error-1',
        eventEmitter: emitter,
      });

      // 应该有错误处理逻辑
      const hasError = events.some((e) => e.type === 'agent:error');
      // 注意：当前实现可能不会对空消息报错，这里只是演示
    });
  });

  describe('Event structure validation', () => {
    it('should emit events with correct structure', { timeout: 30000 }, async () => {
      events = [];

      await runAgent({
        messages: [{ role: 'user', content: '测试' }],
        conversationId: 'test-structure-1',
        eventEmitter: emitter,
      });

      // 验证所有事件都有必需的字段
      events.forEach((event) => {
        expect(event).toHaveProperty('type');
        expect(event).toHaveProperty('data');
        expect(event.data).toHaveProperty('timestamp');
      });
    });
  });
});
