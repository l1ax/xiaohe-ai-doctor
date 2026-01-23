import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'http';
import { SSEHandler } from '../SSEHandler';
import { SSEEventData } from '../types';

class MockResponse extends ServerResponse {
  private chunks: string[] = [];
  public writableEnded = false;

  constructor(req: IncomingMessage) {
    super(req);
  }

  override write(chunk: any): boolean {
    if (typeof chunk === 'string') {
      this.chunks.push(chunk);
    } else if (Buffer.isBuffer(chunk)) {
      this.chunks.push(chunk.toString('utf-8'));
    }
    return true;
  }

  override end(): this {
    this.writableEnded = true;
    return this;
  }

  get output(): string {
    return this.chunks.join('');
  }

  get headers() {
    return this.getHeaders();
  }

  reset(): void {
    this.chunks = [];
    this.writableEnded = false;
  }
}

describe('SSEHandler', () => {
  let sseHandler: SSEHandler;

  beforeEach(() => {
    sseHandler = SSEHandler.getInstance();
    sseHandler.closeAllConnections();
  });

  afterEach(() => {
    sseHandler.closeAllConnections();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SSEHandler.getInstance();
      const instance2 = SSEHandler.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('handleConnection', () => {
    it('should set correct SSE headers', () => {
      const mockReq = new IncomingMessage(null as any);
      const mockRes = new MockResponse(mockReq);

      sseHandler.handleConnection(mockReq, mockRes, 'conv-123');

      expect(mockRes.headers['content-type']).toBe('text/event-stream');
      expect(mockRes.headers['cache-control']).toBe('no-cache, no-transform');
      expect(mockRes.headers['connection']).toBe('keep-alive');
      expect(mockRes.headers['x-accel-buffering']).toBe('no');
    });

    it('should send connected event', () => {
      const mockReq = new IncomingMessage(null as any);
      const mockRes = new MockResponse(mockReq);

      sseHandler.handleConnection(mockReq, mockRes, 'conv-123');

      const output = mockRes.output;
      expect(output).toContain('event: connected');
      expect(output).toContain('conv-123');
      expect(output).toContain('timestamp');
    });
  });

  describe('event broadcasting', () => {
    it('should broadcast events to multiple clients', () => {
      const mockReq1 = new IncomingMessage(null as any);
      const mockRes1 = new MockResponse(mockReq1);
      const mockReq2 = new IncomingMessage(null as any);
      const mockRes2 = new MockResponse(mockReq2);

      sseHandler.handleConnection(mockReq1, mockRes1, 'conv-1');
      sseHandler.handleConnection(mockReq2, mockRes2, 'conv-2');

      mockRes1.reset();
      mockRes2.reset();

      const eventData: SSEEventData = {
        type: 'content',
        data: { delta: 'Hello' },
      };

      sseHandler.broadcastEvent(eventData);

      expect(mockRes1.output).toContain('event: content');
      expect(mockRes1.output).toContain('Hello');
      expect(mockRes2.output).toContain('event: content');
      expect(mockRes2.output).toContain('Hello');
    });
  });

  describe('connection management', () => {
    it('should track active connection count', () => {
      const mockReq1 = new IncomingMessage(null as any);
      const mockRes1 = new MockResponse(mockReq1);
      const mockReq2 = new IncomingMessage(null as any);
      const mockRes2 = new MockResponse(mockReq2);

      expect(sseHandler.getActiveConnectionCount()).toBe(0);

      sseHandler.handleConnection(mockReq1, mockRes1, 'conv-1');
      expect(sseHandler.getActiveConnectionCount()).toBe(1);

      sseHandler.handleConnection(mockReq2, mockRes2, 'conv-2');
      expect(sseHandler.getActiveConnectionCount()).toBe(2);

      sseHandler.closeAllConnections();
      expect(sseHandler.getActiveConnectionCount()).toBe(0);
    });

    it('should close connection on request close', () => {
      const mockReq = new IncomingMessage(null as any);
      const mockRes = new MockResponse(mockReq);

      sseHandler.handleConnection(mockReq, mockRes, 'conv-123');

      expect(sseHandler.getActiveConnectionCount()).toBe(1);

      mockReq.emit('close');

      // Give time for cleanup
      setTimeout(() => {
        expect(sseHandler.getActiveConnectionCount()).toBe(0);
        expect(mockRes.writableEnded).toBe(true);
      }, 10);
    });
  });

  describe('sendToConversation', () => {
    it('should send event only to specific conversation', () => {
      const mockReq1 = new IncomingMessage(null as any);
      const mockRes1 = new MockResponse(mockReq1);
      const mockReq2 = new IncomingMessage(null as any);
      const mockRes2 = new MockResponse(mockReq2);

      sseHandler.handleConnection(mockReq1, mockRes1, 'conv-1');
      sseHandler.handleConnection(mockReq2, mockRes2, 'conv-2');

      mockRes1.reset();
      mockRes2.reset();

      const eventData: SSEEventData = {
        type: 'content',
        data: { delta: 'Private message' },
      };

      sseHandler.sendToConversation('conv-1', eventData);

      expect(mockRes1.output).toContain('event: content');
      expect(mockRes1.output).toContain('Private message');
      expect(mockRes2.output).toBe('');
    });
  });
});
