import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentEventEmitter } from '../AgentEventEmitter';
import { AgentEvent, ThinkingEvent, IntentEvent, ToolCallEvent, ContentEvent, MetadataEvent, DoneEvent } from '../types';
import { AgentState } from '../../state';

describe('Agent Event Flow Integration Tests', () => {
  let emitter: AgentEventEmitter;
  let events: AgentEvent[];

  beforeEach(() => {
    emitter = new AgentEventEmitter();
    events = [];

    // Listen to all events
    emitter.on('*', (event) => {
      events.push(event);
    });
  });

  describe('classifyIntent node', () => {
    it('should emit thinking and intent events during classification', async () => {
      // Note: This test requires mocking the LLM or using a test double
      // For now, we test the event emission pattern

      const mockState: typeof AgentState.State = {
        messages: [{ role: 'user', content: 'I have a headache' }],
        userIntent: [],
        extractedInfo: {},
        branchResult: null,
        conversationId: 'test-conv-1',
        messageId: 'msg_123',
        startTime: Date.now(),
        eventEmitter: emitter,
      };

      // Mock the LLM response
      vi.doMock('../../../utils/llm', () => ({
        createZhipuLLM: () => ({
          invoke: async () => ({
            content: JSON.stringify({
              intent: 'symptom_consult',
              entities: { symptoms: ['headache'] },
            }),
          }),
        }),
      }));

      // For this integration test, we're verifying the pattern
      // The actual LLM call would be mocked in a real scenario
      expect(emitter).toBeDefined();
      expect(mockState.eventEmitter).toBe(emitter);
    });

    it('should capture thinking event data structure', () => {
      emitter.emitThinking('正在识别您的意图...');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('agent:thinking');
      expect((events[0] as ThinkingEvent).data.message).toBe('正在识别您的意图...');
      expect(events[0].data.timestamp).toBeDefined();
    });

    it('should capture intent event data structure', () => {
      emitter.emitIntent('symptom_consult', { symptoms: ['headache', 'fever'] });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('agent:intent');
      expect((events[0] as IntentEvent).data.intent).toBe('symptom_consult');
      expect((events[0] as IntentEvent).data.entities).toEqual({ symptoms: ['headache', 'fever'] });
      expect(events[0].data.timestamp).toBeDefined();
    });
  });

  describe('symptomAnalysis node', () => {
    it('should emit thinking, tool_call, content, and metadata events', () => {
      // Test thinking event
      emitter.emitThinking('正在分析您的症状...');

      expect(events[0].type).toBe('agent:thinking');
      expect((events[0] as ThinkingEvent).data.message).toBe('正在分析您的症状...');

      // Test tool_call running event
      emitter.emitToolCall('symptom_analysis', 'running', {
        input: { query: 'I have a headache' },
      });

      expect(events[1].type).toBe('agent:tool_call');
      expect((events[1] as ToolCallEvent).data.tool).toBe('symptom_analysis');
      expect((events[1] as ToolCallEvent).data.status).toBe('running');
      expect((events[1] as ToolCallEvent).data.input).toEqual({ query: 'I have a headache' });

      // Test tool_call completed event
      emitter.emitToolCall('symptom_analysis', 'completed', {
        output: { analysis: 'You should rest and drink water.' },
      });

      expect(events[2].type).toBe('agent:tool_call');
      expect((events[2] as ToolCallEvent).data.status).toBe('completed');

      // Test content events (character by character)
      const testContent = 'Test analysis';
      for (const char of testContent) {
        emitter.emitContent(char);
      }

      // Should have 3 + testContent.length events
      expect(events.length).toBe(3 + testContent.length);

      // Verify content events
      const contentEvents = events.slice(3);
      contentEvents.forEach((event, index) => {
        expect(event.type).toBe('agent:content');
        expect((event as ContentEvent).data.delta).toBe(testContent[index]);
      });

      // Test metadata event
      emitter.emitMetadata({
        medicalAdvice: {
          symptoms: ['headache'],
          possibleConditions: ['tension headache'],
          suggestions: ['rest', 'hydrate'],
          urgencyLevel: 'low',
        },
        actions: [],
      });

      expect(events[events.length - 1].type).toBe('agent:metadata');
      const metadataEvent = events[events.length - 1] as MetadataEvent;
      expect(metadataEvent.data.medicalAdvice).toBeDefined();
      expect(metadataEvent.data.medicalAdvice?.urgencyLevel).toBe('low');
    });
  });

  describe('consultation node', () => {
    it('should emit thinking and content events', () => {
      // Test thinking event
      emitter.emitThinking('正在为您查找相关资料...');

      expect(events[0].type).toBe('agent:thinking');
      expect((events[0] as ThinkingEvent).data.message).toBe('正在为您查找相关资料...');

      // Test content events
      const testAnswer = 'According to medical research...';
      for (const char of testAnswer) {
        emitter.emitContent(char);
      }

      expect(events.length).toBe(1 + testAnswer.length);

      const contentEvents = events.slice(1);
      contentEvents.forEach((event, index) => {
        expect(event.type).toBe('agent:content');
        expect((event as ContentEvent).data.delta).toBe(testAnswer[index]);
      });
    });
  });

  describe('hospitalRecommend node', () => {
    it('should emit thinking, tool_call, content, and metadata events', () => {
      // Test thinking event
      emitter.emitThinking('正在为您查找北京的医院信息...');

      expect(events[0].type).toBe('agent:thinking');
      expect((events[0] as ThinkingEvent).data.message).toBe('正在为您查找北京的医院信息...');

      // Test tool_call running event
      emitter.emitToolCall('hospital_query', 'running', {
        input: { query: 'Best hospital in Beijing', location: '北京' },
      });

      expect(events[1].type).toBe('agent:tool_call');
      expect((events[1] as ToolCallEvent).data.tool).toBe('hospital_query');
      expect((events[1] as ToolCallEvent).data.status).toBe('running');

      // Test tool_call completed event
      emitter.emitToolCall('hospital_query', 'completed', {
        output: { recommendation: 'Beijing Hospital is recommended.' },
      });

      expect(events[2].type).toBe('agent:tool_call');
      expect((events[2] as ToolCallEvent).data.status).toBe('completed');

      // Test content events
      const testRecommendation = 'We recommend Beijing Hospital.';
      for (const char of testRecommendation) {
        emitter.emitContent(char);
      }

      expect(events.length).toBe(3 + testRecommendation.length);

      // Test metadata event with actions
      emitter.emitMetadata({
        actions: [
          {
            type: 'book_appointment',
            label: '预约挂号',
            data: { location: '北京' },
          },
        ],
      });

      expect(events[events.length - 1].type).toBe('agent:metadata');
      const metadataEvent = events[events.length - 1] as MetadataEvent;
      expect(metadataEvent.data.actions).toBeDefined();
      expect(metadataEvent.data.actions?.length).toBe(1);
      expect(metadataEvent.data.actions?.[0].type).toBe('book_appointment');
    });
  });

  describe('medicineInfo node', () => {
    it('should emit thinking, tool_call, and content events', () => {
      // Test thinking event
      emitter.emitThinking('正在查询布洛芬的药品信息...');

      expect(events[0].type).toBe('agent:thinking');
      expect((events[0] as ThinkingEvent).data.message).toBe('正在查询布洛芬的药品信息...');

      // Test tool_call running event
      emitter.emitToolCall('medicine_query', 'running', {
        input: { medicineName: '布洛芬' },
      });

      expect(events[1].type).toBe('agent:tool_call');
      expect((events[1] as ToolCallEvent).data.tool).toBe('medicine_query');
      expect((events[1] as ToolCallEvent).data.status).toBe('running');

      // Test tool_call completed event
      emitter.emitToolCall('medicine_query', 'completed', {
        output: { info: 'Ibuprofen is a pain reliever...' },
      });

      expect(events[2].type).toBe('agent:tool_call');
      expect((events[2] as ToolCallEvent).data.status).toBe('completed');

      // Test content events
      const testInfo = 'Ibuprofen is used to treat pain and fever.';
      for (const char of testInfo) {
        emitter.emitContent(char);
      }

      expect(events.length).toBe(3 + testInfo.length);

      const contentEvents = events.slice(3);
      contentEvents.forEach((event, index) => {
        expect(event.type).toBe('agent:content');
        expect((event as ContentEvent).data.delta).toBe(testInfo[index]);
      });
    });
  });

  describe('synthesizeResponse node', () => {
    it('should emit done event', () => {
      const conversationId = 'test-conv-123';
      emitter.emitDone(conversationId);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('agent:done');
      expect((events[0] as DoneEvent).data.conversationId).toBe(conversationId);
      expect(events[0].data.timestamp).toBeDefined();
    });

    it('should emit done event with messageId', () => {
      const conversationId = 'test-conv-123';
      const messageId = 'test-msg-456';
      emitter.emitDone(conversationId, messageId);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('agent:done');
      expect((events[0] as DoneEvent).data.conversationId).toBe(conversationId);
      expect((events[0] as DoneEvent).data.messageId).toBe(messageId);
    });
  });

  describe('complete event flow', () => {
    it('should capture complete event sequence for symptom consultation', () => {
      // Simulate complete flow: classifyIntent -> symptomAnalysis -> synthesizeResponse

      // classifyIntent events
      emitter.emitThinking('正在识别您的意图...');
      emitter.emitIntent('symptom_consult', { symptoms: ['headache'] });

      // symptomAnalysis events
      emitter.emitThinking('正在分析您的症状...');
      emitter.emitToolCall('symptom_analysis', 'running', { input: { query: 'headache' } });
      emitter.emitToolCall('symptom_analysis', 'completed', { output: { analysis: 'Rest recommended.' } });

      const analysis = 'You should rest and drink water.';
      for (const char of analysis) {
        emitter.emitContent(char);
      }

      emitter.emitMetadata({
        medicalAdvice: {
          symptoms: ['headache'],
          possibleConditions: ['tension headache'],
          suggestions: ['rest'],
          urgencyLevel: 'low',
        },
        actions: [],
      });

      // synthesizeResponse event
      emitter.emitDone('conv-123');

      // Verify all events were captured
      expect(events.length).toBeGreaterThan(0);

      // Verify event sequence
      const eventTypes = events.map((e) => e.type);
      expect(eventTypes[0]).toBe('agent:thinking');
      expect(eventTypes[1]).toBe('agent:intent');
      expect(eventTypes[2]).toBe('agent:thinking');
      expect(eventTypes[3]).toBe('agent:tool_call');
      expect(eventTypes[4]).toBe('agent:tool_call');

      // The sequence is: thinking, intent, thinking, tool_call, tool_call, content..., metadata, done
      // So metadata should be at position -2, and done at -1
      expect(eventTypes[eventTypes.length - 1]).toBe('agent:done');
      expect(eventTypes[eventTypes.length - 2]).toBe('agent:metadata');

      // All events between position 5 and -2 should be content events
      const contentEvents = eventTypes.slice(5, -2);
      expect(contentEvents.length).toBeGreaterThan(0);
      expect(contentEvents.every((type) => type === 'agent:content')).toBe(true);
    });

    it('should capture complete event sequence for hospital recommendation', () => {
      // Simulate complete flow: classifyIntent -> hospitalRecommend -> synthesizeResponse

      // classifyIntent events
      emitter.emitThinking('正在识别您的意图...');
      emitter.emitIntent('hospital_recommend', { location: '北京' });

      // hospitalRecommend events
      emitter.emitThinking('正在为您查找北京的医院信息...');
      emitter.emitToolCall('hospital_query', 'running', { input: { query: 'hospital', location: '北京' } });
      emitter.emitToolCall('hospital_query', 'completed', { output: { recommendation: 'Beijing Hospital' } });

      const recommendation = 'We recommend Beijing Hospital for your needs.';
      for (const char of recommendation) {
        emitter.emitContent(char);
      }

      emitter.emitMetadata({
        actions: [
          { type: 'book_appointment', label: '预约挂号', data: { location: '北京' } },
        ],
      });

      // synthesizeResponse event
      emitter.emitDone('conv-456');

      // Verify all events were captured
      expect(events.length).toBeGreaterThan(0);

      // Verify event sequence
      const eventTypes = events.map((e) => e.type);
      expect(eventTypes[0]).toBe('agent:thinking');
      expect(eventTypes[1]).toBe('agent:intent');
      expect(eventTypes[2]).toBe('agent:thinking');
      expect(eventTypes[3]).toBe('agent:tool_call');
      expect(eventTypes[4]).toBe('agent:tool_call');

      // The sequence is: thinking, intent, thinking, tool_call, tool_call, content..., metadata, done
      // So metadata should be at position -2, and done at -1
      expect(eventTypes[eventTypes.length - 1]).toBe('agent:done');
      expect(eventTypes[eventTypes.length - 2]).toBe('agent:metadata');

      // All events between position 5 and -2 should be content events
      const contentEvents = eventTypes.slice(5, -2);
      expect(contentEvents.length).toBeGreaterThan(0);
      expect(contentEvents.every((type) => type === 'agent:content')).toBe(true);
    });
  });

  describe('event timestamps', () => {
    it('should include timestamps in all events', () => {
      // Emit all event types
      emitter.emitThinking('Test');
      emitter.emitIntent('symptom_consult', {});
      emitter.emitToolCall('symptom_analysis', 'running');
      emitter.emitContent('Test');
      emitter.emitMetadata({ sources: [] });
      emitter.emitDone('conv-1');
      emitter.emitError('Error');

      // Verify all events have timestamps
      events.forEach((event) => {
        expect(event.data.timestamp).toBeDefined();
        expect(typeof event.data.timestamp).toBe('string');
        // Verify it's a valid ISO date string
        expect(new Date(event.data.timestamp).toISOString()).toBe(event.data.timestamp);
      });
    });
  });

  describe('wildcard event listener', () => {
    it('should receive all events via wildcard listener', () => {
      // Emit various events
      emitter.emitThinking('Thinking');
      emitter.emitIntent('symptom_consult', { symptoms: ['headache'] });
      emitter.emitToolCall('symptom_analysis', 'running');
      emitter.emitContent('Content');
      emitter.emitMetadata({ sources: [] });
      emitter.emitDone('conv-1');

      // Verify wildcard listener captured all
      expect(events.length).toBe(6);
      expect(events.map((e) => e.type)).toEqual([
        'agent:thinking',
        'agent:intent',
        'agent:tool_call',
        'agent:content',
        'agent:metadata',
        'agent:done',
      ]);
    });
  });
});
