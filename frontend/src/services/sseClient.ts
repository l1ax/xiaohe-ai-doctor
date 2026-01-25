import { EventSourceParserStream } from 'eventsource-parser/stream';
import { ChatEvent, parseServerEvent, ChatEventType } from '../machines/chatMachine';

export type SSEEventHandler = (event: ChatEventType) => void;

export interface SSEConfig {
  url: string;
  conversationId: string;
  message?: string;
  onEvent?: SSEEventHandler;
  onError?: (error: Error) => void;
  onClose?: () => void;
  onOpen?: () => void;
}

/**
 * SSE Client using fetch + eventsource-parser
 * This replaces the native EventSource to avoid automatic reconnection issues
 */
export class SSEClient {
  private config: SSEConfig;
  private abortController: AbortController | null = null;
  private isConnected: boolean = false;
  private isManualClose: boolean = false;

  constructor(config: SSEConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.isConnected) {
      console.warn('[SSE] Already connected');
      return;
    }

    const url = new URL(this.config.url);
    if (this.config.conversationId) {
      url.searchParams.set('conversationId', this.config.conversationId);
    }
    if (this.config.message) {
      url.searchParams.set('message', this.config.message);
    }

    this.abortController = new AbortController();
    this.isManualClose = false;

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      this.isConnected = true;
      console.log('[SSE] Connection established');
      this.config.onOpen?.();

      // Parse the SSE stream
      const eventStream = response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream());

      const reader = eventStream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            console.log('[SSE] Stream ended');
            break;
          }

          if (value) {
            this.handleParsedEvent(value);
          }
        }
      } catch (error) {
        if (this.isManualClose) {
          console.log('[SSE] Connection closed by user');
        } else {
          throw error;
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      if (this.isManualClose) {
        console.log('[SSE] Connection closed manually');
        return;
      }

      // Check if it's an abort error
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[SSE] Request aborted');
        return;
      }

      console.error('[SSE] Connection error:', error);
      this.config.onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isConnected = false;
      if (!this.isManualClose) {
        this.config.onClose?.();
      }
    }
  }

  private handleParsedEvent(parsedEvent: { event?: string; data?: string; id?: string }): void {
    const { event: eventType, data: eventData } = parsedEvent;

    // Skip empty data or heartbeat without meaningful content
    if (!eventData) {
      if (eventType === 'heartbeat') {
        console.log('[SSE] Heartbeat received');
      }
      return;
    }

    try {
      const data = JSON.parse(eventData);
      
      // Handle connected event
      if (eventType === 'connected') {
        console.log('[SSE] Connected:', data);
        return;
      }

      // Handle heartbeat
      if (eventType === 'heartbeat') {
        console.log('[SSE] Heartbeat received');
        return;
      }

      // Create ChatEvent and parse it
      const chatEvent: ChatEvent = {
        type: eventType || 'message',
        data: data,
      };

      const parsedChatEvent = parseServerEvent(chatEvent);
      if (parsedChatEvent) {
        this.config.onEvent?.(parsedChatEvent);
      }
    } catch (error) {
      console.error('[SSE] Failed to parse event:', error, { eventType, eventData });
    }
  }

  close(): void {
    this.isManualClose = true;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isConnected = false;
    console.log('[SSE] Connection closed manually');
  }

  getConnected(): boolean {
    return this.isConnected;
  }
}

// ============ SSE 客户端管理器 ============

class SSEClientManager {
  private clients: Map<string, SSEClient> = new Map();
  private defaultUrl: string = '';

  setDefaultUrl(url: string): void {
    this.defaultUrl = url;
  }

  createClient(config: Partial<SSEConfig> & { conversationId: string }): SSEClient {
    const url = config.url || this.defaultUrl;
    const client = new SSEClient({
      url,
      ...config,
    });
    this.clients.set(config.conversationId, client);
    return client;
  }

  getClient(conversationId: string): SSEClient | undefined {
    return this.clients.get(conversationId);
  }

  removeClient(conversationId: string): void {
    const client = this.clients.get(conversationId);
    if (client) {
      client.close();
      this.clients.delete(conversationId);
    }
  }

  closeAll(): void {
    this.clients.forEach((client) => client.close());
    this.clients.clear();
  }
}

export const sseClientManager = new SSEClientManager();
