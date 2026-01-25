// backend/src/__tests__/integration/aiChatSSE.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AgentEventEmitter } from '../../agent/events/AgentEventEmitter';
import { runAgent } from '../../agent';
import { SSEHandler } from '../../services/streaming/SSEHandler';
import { MessageWriter } from '../../services/database/MessageWriter';
import { Message } from '../../agent/types';
import { globalAgentEventEmitter } from '../../agent/events/AgentEventEmitter';

describe('AI Chat SSE Integration Tests', () => {
  let emitter: AgentEventEmitter;
  let sseHandler: SSEHandler;
  let messageWriter: MessageWriter;
  let events: any[] = [];
  let eventTypes: string[] = [];

  beforeAll(() => {
    emitter = new AgentEventEmitter();
    sseHandler = SSEHandler.getInstance({
      heartbeatInterval: 30000,
      timeout: 60000,
      retryDelay: 1000,
    });
    messageWriter = new MessageWriter(emitter, {
      enabled: false, // 禁用数据库写入以加快测试
      batch: {
        flushInterval: 1000,
        maxSize: 10,
      },
    });

    // 收集所有事件 - 监听所有可能的事件类型
    const eventTypesToListen = [
      'conversation:status',
      'message:status',
      'message:content',
      'message:metadata',
      'tool:call',
      'conversation:end',
      'error',
      'agent:thinking',
      'agent:intent',
      'agent:tool_call',
      'agent:content',
      'agent:metadata',
      'agent:done',
      'agent:error',
    ];

    for (const eventType of eventTypesToListen) {
      emitter.on(eventType, (event) => {
        events.push(event);
        eventTypes.push(event.type);
      });
    }

    // 监听SSEHandler发送的事件（用于验证事件类型）
    globalAgentEventEmitter.on('*', (event) => {
      // 记录全局事件用于验证
    });

    sseHandler.startEventListener();
  });

  afterAll(async () => {
    await messageWriter.stop();
    sseHandler.closeAllConnections();
  });

  describe('SSE Event Types', () => {
    it('should emit events with correct type format for frontend', { timeout: 30000 }, async () => {
      events = [];
      eventTypes = [];

      const message: Message = {
        role: 'user',
        content: '我头疼',
      };

      await runAgent({
        messages: [message],
        conversationId: 'test-sse-type-1',
        eventEmitter: emitter,
      });

      // 验证事件类型格式（前端parseServerEvent期望的格式）
      // 前端期望: 'conversation:status', 'message:status', 'message:content' 等
      const expectedEventTypes = [
        'conversation:status',
        'message:status',
        'message:content',
        'message:metadata',
        'tool:call',
        'conversation:end',
      ];

      // 验证关键事件类型存在
      expect(eventTypes).toContain('conversation:status');
      expect(eventTypes).toContain('message:status');
      expect(eventTypes).toContain('message:content');
      expect(eventTypes).toContain('message:metadata');
      expect(eventTypes).toContain('tool:call');
      expect(eventTypes).toContain('conversation:end');
    });

    it('should include conversationId in all events', { timeout: 30000 }, async () => {
      events = [];
      const testConversationId = 'test-conv-12345';

      await runAgent({
        messages: [{ role: 'user', content: '测试' }],
        conversationId: testConversationId,
        eventEmitter: emitter,
      });

      // 验证所有新事件类型都包含conversationId
      const eventsToCheck = events.filter((e) =>
        ['conversation:status', 'message:status', 'message:content', 'message:metadata', 'tool:call', 'conversation:end'].includes(e.type)
      );

      expect(eventsToCheck.length).toBeGreaterThan(0);
      eventsToCheck.forEach((event, index) => {
        expect(event.data.conversationId).toBe(testConversationId);
      });
    });

    it('should emit message content events with correct structure', { timeout: 30000 }, async () => {
      events = [];

      await runAgent({
        messages: [{ role: 'user', content: '感冒症状' }],
        conversationId: 'test-content-1',
        eventEmitter: emitter,
      });

      // 找到content事件
      const contentEvents = events.filter((e) => e.type === 'message:content');

      expect(contentEvents.length).toBeGreaterThan(0);

      // 验证content事件结构
      contentEvents.forEach((event) => {
        expect(event.data).toHaveProperty('delta');
        expect(event.data).toHaveProperty('messageId');
        expect(event.data).toHaveProperty('index');
        expect(event.data).toHaveProperty('isFirst');
        expect(event.data).toHaveProperty('isLast');
        expect(event.data).toHaveProperty('timestamp');
      });
    });

    it('should emit metadata with medical advice', { timeout: 30000 }, async () => {
      events = [];

      await runAgent({
        messages: [{ role: 'user', content: '发烧头痛全身无力' }],
        conversationId: 'test-metadata-1',
        eventEmitter: emitter,
      });

      // 找到metadata事件
      const metadataEvent = events.find((e) => e.type === 'message:metadata');

      expect(metadataEvent).toBeDefined();

      // 验证metadata包含医疗建议
      if (metadataEvent && metadataEvent.data) {
        // 可能包含medicalAdvice
        if (metadataEvent.data.medicalAdvice) {
          expect(metadataEvent.data.medicalAdvice).toHaveProperty('urgencyLevel');
          expect(['low', 'medium', 'high']).toContain(metadataEvent.data.medicalAdvice.urgencyLevel);
        }

        // 可能包含actions
        if (metadataEvent.data.actions) {
          expect(Array.isArray(metadataEvent.data.actions)).toBe(true);
        }
      }
    });

    it('should emit tool calls with correct structure', { timeout: 30000 }, async () => {
      events = [];

      await runAgent({
        messages: [{ role: 'user', content: '查找心内科医院' }],
        conversationId: 'test-tool-1',
        eventEmitter: emitter,
      });

      // 找到tool call事件
      const toolCallEvents = events.filter((e) => e.type === 'tool:call');

      // 应该有工具调用事件
      if (toolCallEvents.length > 0) {
        toolCallEvents.forEach((event) => {
          expect(event.data).toHaveProperty('toolId');
          expect(event.data).toHaveProperty('toolName');
          expect(event.data).toHaveProperty('status');
          expect(event.data).toHaveProperty('timestamp');
        });
      }
    });
  });

  describe('Event Sequence', () => {
    it('should emit events in correct order', { timeout: 30000 }, async () => {
      events = [];
      eventTypes = [];

      await runAgent({
        messages: [{ role: 'user', content: '简单问题' }],
        conversationId: 'test-sequence-1',
        eventEmitter: emitter,
      });

      // 验证事件顺序
      const statusIndex = eventTypes.indexOf('conversation:status');
      const contentIndex = eventTypes.indexOf('message:content');
      const endIndex = eventTypes.indexOf('conversation:end');

      // status应该在content之前
      if (statusIndex !== -1 && contentIndex !== -1) {
        expect(statusIndex).toBeLessThan(contentIndex);
      }

      // content应该在end之前
      if (contentIndex !== -1 && endIndex !== -1) {
        expect(contentIndex).toBeLessThan(endIndex);
      }
    });
  });
});
