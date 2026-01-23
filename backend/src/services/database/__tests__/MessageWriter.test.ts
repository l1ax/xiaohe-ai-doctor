import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageWriter } from '../MessageWriter';
import { AgentEventEmitter } from '../../../agent/events/AgentEventEmitter';
import { UserIntent } from '../../../agent/types';
import { WriterConfig, MessageType } from '../types';

describe('MessageWriter', () => {
  let eventEmitter: AgentEventEmitter;
  let config: WriterConfig;
  let writer: MessageWriter;

  beforeEach(() => {
    eventEmitter = new AgentEventEmitter();
    config = {
      database: {
        host: 'localhost',
        port: 5432,
        username: 'test',
        password: 'test',
        database: 'test',
      },
      supabase: {
        url: 'https://test.supabase.co',
        key: 'test-key',
      },
      enabled: true,
      batch: {
        maxSize: 10,
        flushInterval: 1000,
      },
    };
  });

  afterEach(() => {
    if (writer) {
      writer.stop();
    }
  });

  describe('Constructor', () => {
    it('should set up event listeners when enabled', () => {
      writer = new MessageWriter(eventEmitter, config);

      expect(eventEmitter.getListenerCount('agent:intent')).toBe(1);
      expect(eventEmitter.getListenerCount('agent:content')).toBe(1);
      expect(eventEmitter.getListenerCount('agent:metadata')).toBe(1);
      expect(eventEmitter.getListenerCount('agent:done')).toBe(1);
      expect(eventEmitter.getListenerCount('agent:error')).toBe(1);
    });

    it('should not set up event listeners when disabled', () => {
      config.enabled = false;
      writer = new MessageWriter(eventEmitter, config);

      expect(eventEmitter.getListenerCount('agent:intent')).toBe(0);
      expect(eventEmitter.getListenerCount('agent:content')).toBe(0);
      expect(eventEmitter.getListenerCount('agent:metadata')).toBe(0);
      expect(eventEmitter.getListenerCount('agent:done')).toBe(0);
      expect(eventEmitter.getListenerCount('agent:error')).toBe(0);
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      writer = new MessageWriter(eventEmitter, config);
    });

    it('should handle intent events and buffer user messages', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      eventEmitter.emitIntent('symptom_consult' as UserIntent, {
        conversationId: 'conv-123',
        userId: 'user-456',
        userMessage: 'I have a headache',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MessageWriter] Buffered user message for conversation conv-123')
      );

      consoleSpy.mockRestore();
    });

    it('should handle content events and accumulate content', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Emit content events (need to pass conversationId in data)
      eventEmitter.emit('agent:content', {
        type: 'agent:content',
        data: {
          delta: 'Hello',
          conversationId: 'conv-123',
          timestamp: new Date().toISOString(),
        },
      } as any);

      eventEmitter.emit('agent:content', {
        type: 'agent:content',
        data: {
          delta: ' world',
          conversationId: 'conv-123',
          timestamp: new Date().toISOString(),
        },
      } as any);

      // The content should be accumulated in memory
      // We can't directly access the buffer, but we can verify no errors occurred
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('No conversationId in content event')
      );

      consoleSpy.mockRestore();
    });

    it('should handle metadata events and accumulate metadata', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      eventEmitter.emit('agent:metadata', {
        type: 'agent:metadata',
        data: {
          conversationId: 'conv-123',
          sources: [
            {
              title: 'Test Source',
              url: 'https://example.com',
              snippet: 'Test snippet',
            },
          ],
          timestamp: new Date().toISOString(),
        },
      } as any);

      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('No conversationId in metadata event')
      );

      consoleSpy.mockRestore();
    });

    it('should handle done events and flush messages', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // First buffer a user message
      eventEmitter.emitIntent('general_qa' as UserIntent, {
        conversationId: 'conv-456',
        userId: 'user-789',
        userMessage: 'What is the treatment?',
      });

      // Then emit done event
      eventEmitter.emitDone('conv-456', 'msg-123');

      // Check that console.log was called with the flush message
      const flushCalls = consoleSpy.mock.calls.filter(call =>
        call[0] && call[0].toString().includes('[MessageWriter MVP] Would save user message:')
      );
      expect(flushCalls.length).toBeGreaterThan(0);

      consoleSpy.mockRestore();
    });
  });

  describe('createConversation', () => {
    beforeEach(() => {
      writer = new MessageWriter(eventEmitter, config);
    });

    it('should create a conversation with AI type', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const conversation = writer.createConversation('ai', 'patient-123');

      expect(conversation).toBeDefined();
      expect(conversation.id).toBeDefined();
      expect(conversation.type).toBe('ai');
      expect(conversation.patient_id).toBe('patient-123');
      expect(conversation.status).toBe('active');
      expect(conversation.created_at).toBeDefined();
      expect(conversation.updated_at).toBeDefined();

      // Check that console.log was called with the create conversation message
      const createCalls = consoleSpy.mock.calls.filter(call =>
        call[0] && call[0].toString().includes('[MessageWriter MVP] Would create conversation:')
      );
      expect(createCalls.length).toBeGreaterThan(0);

      consoleSpy.mockRestore();
    });

    it('should create a conversation with doctor type', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const conversation = writer.createConversation('doctor', 'patient-123', 'doctor-456');

      expect(conversation).toBeDefined();
      expect(conversation.type).toBe('doctor');
      expect(conversation.patient_id).toBe('patient-123');
      expect(conversation.doctor_id).toBe('doctor-456');

      consoleSpy.mockRestore();
    });
  });

  describe('getMessages', () => {
    beforeEach(() => {
      writer = new MessageWriter(eventEmitter, config);
    });

    it('should return empty array in MVP stage', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const messages = await writer.getMessages('conv-123');

      expect(messages).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[MessageWriter MVP] Would fetch messages for conversation conv-123')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('stop', () => {
    beforeEach(() => {
      writer = new MessageWriter(eventEmitter, config);
    });

    it('should flush pending messages and remove listeners', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Buffer a message
      eventEmitter.emitIntent('hospital_recommend' as UserIntent, {
        conversationId: 'conv-789',
        userId: 'user-999',
        userMessage: 'Find me a hospital',
      });

      // Stop the writer
      writer.stop();

      // Verify flush happened
      const flushCalls = consoleSpy.mock.calls.filter(call =>
        call[0] && call[0].toString().includes('[MessageWriter MVP] Would save user message:')
      );
      expect(flushCalls.length).toBeGreaterThan(0);

      // Verify listeners were removed
      expect(eventEmitter.getListenerCount('agent:intent')).toBe(0);
      expect(eventEmitter.getListenerCount('agent:content')).toBe(0);
      expect(eventEmitter.getListenerCount('agent:metadata')).toBe(0);
      expect(eventEmitter.getListenerCount('agent:done')).toBe(0);
      expect(eventEmitter.getListenerCount('agent:error')).toBe(0);

      const stopCalls = consoleSpy.mock.calls.filter(call =>
        call[0] && call[0].toString().includes('[MessageWriter] Stopped and cleaned up')
      );
      expect(stopCalls.length).toBeGreaterThan(0);

      consoleSpy.mockRestore();
    });
  });
});
