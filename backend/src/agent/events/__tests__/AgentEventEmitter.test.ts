import { describe, it, expect, beforeEach } from 'vitest';
import { AgentEventEmitter, globalAgentEventEmitter } from '../AgentEventEmitter';
import { AgentEvent, ThinkingEvent, IntentEvent, ToolCallEvent, ContentEvent, MetadataEvent, DoneEvent, ErrorEvent } from '../types';

describe('AgentEventEmitter', () => {
  let emitter: AgentEventEmitter;

  beforeEach(() => {
    emitter = new AgentEventEmitter();
  });

  describe('emitThinking', () => {
    it('should emit agent:thinking event with correct data', () => {
      const events: AgentEvent[] = [];
      emitter.on('agent:thinking', (event) => { events.push(event); });

      emitter.emitThinking('Processing request...');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('agent:thinking');
      expect((events[0] as ThinkingEvent).data.message).toBe('Processing request...');
      expect(events[0].data.timestamp).toBeDefined();
    });

    it('should also emit wildcard event', () => {
      const wildcardEvents: AgentEvent[] = [];
      emitter.on('*', (event) => { wildcardEvents.push(event); });

      emitter.emitThinking('Thinking...');

      expect(wildcardEvents).toHaveLength(1);
      expect(wildcardEvents[0].type).toBe('agent:thinking');
    });
  });

  describe('emitIntent', () => {
    it('should emit agent:intent event with correct data', () => {
      const events: AgentEvent[] = [];
      emitter.on('agent:intent', (event) => { events.push(event); });

      emitter.emitIntent('symptom_consult', { symptom: 'headache' });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('agent:intent');
      expect((events[0] as IntentEvent).data.intent).toBe('symptom_consult');
      expect((events[0] as IntentEvent).data.entities).toEqual({ symptom: 'headache' });
      expect(events[0].data.timestamp).toBeDefined();
    });

    it('should also emit wildcard event', () => {
      const wildcardEvents: AgentEvent[] = [];
      emitter.on('*', (event) => { wildcardEvents.push(event); });

      emitter.emitIntent('hospital_recommend', { location: 'Beijing' });

      expect(wildcardEvents).toHaveLength(1);
      expect(wildcardEvents[0].type).toBe('agent:intent');
    });
  });

  describe('emitToolCall', () => {
    it('should emit agent:tool_call event with running status', () => {
      const events: AgentEvent[] = [];
      emitter.on('agent:tool_call', (event) => { events.push(event); });

      emitter.emitToolCall('web_search', 'running', { input: 'query' });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('agent:tool_call');
      expect((events[0] as ToolCallEvent).data.tool).toBe('web_search');
      expect((events[0] as ToolCallEvent).data.status).toBe('running');
      expect((events[0] as ToolCallEvent).data.input).toBe('query');
      expect(events[0].data.timestamp).toBeDefined();
    });

    it('should emit agent:tool_call event with completed status', () => {
      const events: AgentEvent[] = [];
      emitter.on('agent:tool_call', (event) => { events.push(event); });

      emitter.emitToolCall('coze_knowledge', 'completed', {
        input: 'query',
        output: 'result'
      });

      expect(events).toHaveLength(1);
      expect((events[0] as ToolCallEvent).data.status).toBe('completed');
      expect((events[0] as ToolCallEvent).data.output).toBe('result');
    });

    it('should emit agent:tool_call event with failed status', () => {
      const events: AgentEvent[] = [];
      emitter.on('agent:tool_call', (event) => { events.push(event); });

      emitter.emitToolCall('ocr', 'failed', { error: 'OCR failed' });

      expect(events).toHaveLength(1);
      expect((events[0] as ToolCallEvent).data.status).toBe('failed');
      expect((events[0] as ToolCallEvent).data.error).toBe('OCR failed');
    });

    it('should also emit wildcard event', () => {
      const wildcardEvents: AgentEvent[] = [];
      emitter.on('*', (event) => { wildcardEvents.push(event); });

      emitter.emitToolCall('hospital_query', 'completed');

      expect(wildcardEvents).toHaveLength(1);
      expect(wildcardEvents[0].type).toBe('agent:tool_call');
    });
  });

  describe('emitContent', () => {
    it('should emit agent:content event with correct data', () => {
      const events: AgentEvent[] = [];
      emitter.on('agent:content', (event) => { events.push(event); });

      emitter.emitContent('Hello, ');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('agent:content');
      expect((events[0] as ContentEvent).data.delta).toBe('Hello, ');
      expect(events[0].data.timestamp).toBeDefined();
    });

    it('should also emit wildcard event', () => {
      const wildcardEvents: AgentEvent[] = [];
      emitter.on('*', (event) => { wildcardEvents.push(event); });

      emitter.emitContent('World!');

      expect(wildcardEvents).toHaveLength(1);
      expect(wildcardEvents[0].type).toBe('agent:content');
    });
  });

  describe('emitMetadata', () => {
    it('should emit agent:metadata event with sources', () => {
      const events: AgentEvent[] = [];
      emitter.on('agent:metadata', (event) => { events.push(event); });

      const metadata = {
        sources: [
          { title: 'Source 1', url: 'https://example.com', snippet: 'Snippet 1' }
        ]
      };

      emitter.emitMetadata(metadata);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('agent:metadata');
      expect((events[0] as MetadataEvent).data.sources).toEqual(metadata.sources);
      expect(events[0].data.timestamp).toBeDefined();
    });

    it('should emit agent:metadata event with medicalAdvice', () => {
      const events: AgentEvent[] = [];
      emitter.on('agent:metadata', (event) => { events.push(event); });

      const metadata = {
        medicalAdvice: {
          symptoms: ['headache', 'fever'],
          possibleConditions: ['cold', 'flu'],
          suggestions: ['rest', 'drink water'],
          urgencyLevel: 'low' as const
        }
      };

      emitter.emitMetadata(metadata);

      expect(events).toHaveLength(1);
      expect((events[0] as MetadataEvent).data.medicalAdvice).toEqual(metadata.medicalAdvice);
    });

    it('should emit agent:metadata event with actions', () => {
      const events: AgentEvent[] = [];
      emitter.on('agent:metadata', (event) => { events.push(event); });

      const metadata = {
        actions: [
          { type: 'transfer_to_doctor' as const, label: 'Talk to Doctor' },
          { type: 'book_appointment' as const, label: 'Book Now', data: { id: 123 } }
        ]
      };

      emitter.emitMetadata(metadata);

      expect(events).toHaveLength(1);
      expect((events[0] as MetadataEvent).data.actions).toEqual(metadata.actions);
    });

    it('should also emit wildcard event', () => {
      const wildcardEvents: AgentEvent[] = [];
      emitter.on('*', (event) => { wildcardEvents.push(event); });

      emitter.emitMetadata({ sources: [] });

      expect(wildcardEvents).toHaveLength(1);
      expect(wildcardEvents[0].type).toBe('agent:metadata');
    });
  });

  describe('emitDone', () => {
    it('should emit agent:done event with correct data', () => {
      const events: AgentEvent[] = [];
      emitter.on('agent:done', (event) => { events.push(event); });

      emitter.emitDone('conv-123', 'msg-456');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('agent:done');
      expect((events[0] as DoneEvent).data.conversationId).toBe('conv-123');
      expect((events[0] as DoneEvent).data.messageId).toBe('msg-456');
      expect(events[0].data.timestamp).toBeDefined();
    });

    it('should emit agent:done event without messageId', () => {
      const events: AgentEvent[] = [];
      emitter.on('agent:done', (event) => { events.push(event); });

      emitter.emitDone('conv-123');

      expect(events).toHaveLength(1);
      expect((events[0] as DoneEvent).data.conversationId).toBe('conv-123');
      expect((events[0] as DoneEvent).data.messageId).toBeUndefined();
    });

    it('should also emit wildcard event', () => {
      const wildcardEvents: AgentEvent[] = [];
      emitter.on('*', (event) => { wildcardEvents.push(event); });

      emitter.emitDone('conv-123');

      expect(wildcardEvents).toHaveLength(1);
      expect(wildcardEvents[0].type).toBe('agent:done');
    });
  });

  describe('emitError', () => {
    it('should emit agent:error event with correct data', () => {
      const events: AgentEvent[] = [];
      emitter.on('agent:error', (event) => { events.push(event); });

      emitter.emitError('Something went wrong', 'ERR_001');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('agent:error');
      expect((events[0] as ErrorEvent).data.error).toBe('Something went wrong');
      expect((events[0] as ErrorEvent).data.code).toBe('ERR_001');
      expect(events[0].data.timestamp).toBeDefined();
    });

    it('should emit agent:error event without code', () => {
      const events: AgentEvent[] = [];
      emitter.on('agent:error', (event) => { events.push(event); });

      emitter.emitError('Error occurred');

      expect(events).toHaveLength(1);
      expect((events[0] as ErrorEvent).data.error).toBe('Error occurred');
      expect((events[0] as ErrorEvent).data.code).toBeUndefined();
    });

    it('should also emit wildcard event', () => {
      const wildcardEvents: AgentEvent[] = [];
      emitter.on('*', (event) => { wildcardEvents.push(event); });

      emitter.emitError('Test error');

      expect(wildcardEvents).toHaveLength(1);
      expect(wildcardEvents[0].type).toBe('agent:error');
    });
  });

  describe('wildcard events', () => {
    it('should receive all event types on wildcard listener', () => {
      const wildcardEvents: AgentEvent[] = [];
      emitter.on('*', (event) => { wildcardEvents.push(event); });

      emitter.emitThinking('Thinking');
      emitter.emitIntent('symptom_consult', {});
      emitter.emitToolCall('web_search', 'running');
      emitter.emitContent('Hello');
      emitter.emitMetadata({ sources: [] });
      emitter.emitDone('conv-1');
      emitter.emitError('Error');

      expect(wildcardEvents).toHaveLength(7);
      expect(wildcardEvents.map(e => e.type)).toEqual([
        'agent:thinking',
        'agent:intent',
        'agent:tool_call',
        'agent:content',
        'agent:metadata',
        'agent:done',
        'agent:error'
      ]);
    });
  });

  describe('event listener management', () => {
    it('should support on() method', () => {
      const events: AgentEvent[] = [];
      const listener = (event: AgentEvent) => { events.push(event); };

      emitter.on('agent:thinking', listener);
      emitter.emitThinking('Test');

      expect(events).toHaveLength(1);
    });

    it('should support once() method', () => {
      const events: AgentEvent[] = [];
      emitter.once('agent:thinking', (event) => { events.push(event); });

      emitter.emitThinking('Test 1');
      emitter.emitThinking('Test 2');

      expect(events).toHaveLength(1);
    });

    it('should support off() method', () => {
      const events: AgentEvent[] = [];
      const listener = (event: AgentEvent) => { events.push(event); };

      emitter.on('agent:thinking', listener);
      emitter.emitThinking('Test 1');
      emitter.off('agent:thinking', listener);
      emitter.emitThinking('Test 2');

      expect(events).toHaveLength(1);
    });

    it('should support removeAllListeners() method', () => {
      const events: AgentEvent[] = [];
      emitter.on('agent:thinking', (event) => { events.push(event); });
      emitter.on('agent:content', (event) => { events.push(event); });

      emitter.emitThinking('Test 1');
      emitter.removeAllListeners('agent:thinking');
      emitter.emitThinking('Test 2');
      emitter.emitContent('Hello');

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('agent:thinking');
      expect(events[1].type).toBe('agent:content');
    });

    it('should support removeAllListeners() without eventType', () => {
      const events: AgentEvent[] = [];
      emitter.on('agent:thinking', (event) => { events.push(event); });
      emitter.on('agent:content', (event) => { events.push(event); });

      emitter.emitThinking('Test 1');
      emitter.removeAllListeners();
      emitter.emitThinking('Test 2');
      emitter.emitContent('Hello');

      expect(events).toHaveLength(1);
    });

    it('should support getListenerCount() method', () => {
      const listener1 = () => {};
      const listener2 = () => {};

      emitter.on('agent:thinking', listener1);
      emitter.on('agent:thinking', listener2);

      expect(emitter.getListenerCount('agent:thinking')).toBe(2);
    });
  });

  describe('max listeners', () => {
    it('should have maxListeners set to 50', () => {
      expect(emitter.getMaxListeners()).toBe(50);
    });
  });

  describe('globalAgentEventEmitter', () => {
    it('should export a singleton instance', () => {
      expect(globalAgentEventEmitter).toBeInstanceOf(AgentEventEmitter);
    });

    it('should be the same instance across imports', () => {
      const emitter1 = globalAgentEventEmitter;
      const events: AgentEvent[] = [];
      emitter1.on('agent:thinking', (event) => { events.push(event); });
      emitter1.emitThinking('Test');

      expect(events).toHaveLength(1);
    });
  });
});
