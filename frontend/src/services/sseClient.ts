import { EventSourceParserStream } from 'eventsource-parser/stream';
import { ChatEvent, parseServerEvent, ChatEventType } from '../machines/chatMachine';
import { userStore } from '../store/userStore';

export type SSEEventHandler = (event: ChatEventType) => void;

export interface SSEConfig {
  url: string;
  method?: 'GET' | 'POST';
  conversationId: string;
  message?: string;
  imageUrls?: string[];
  onEvent?: SSEEventHandler;
  onError?: (error: Error) => void;
  onClose?: () => void;
  onOpen?: () => void;
}

/**
 * SSE Client using fetch + eventsource-parser
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

    const { method = 'POST', conversationId, message, imageUrls } = this.config;
    
    let fetchOptions: RequestInit;
    let fetchUrl: string = this.config.url;
    
    if (method === 'POST') {
      const token = userStore.accessToken;
      if (!token) {
        throw new Error('未登录，请先登录');
      }

      this.abortController = new AbortController();
      fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          conversationId,
          message,
          imageUrls,
        }),
        signal: this.abortController.signal,
      };
    } else {
      const url = new URL(this.config.url);
      if (conversationId) {
        url.searchParams.set('conversationId', conversationId);
      }
      if (message) {
        url.searchParams.set('message', message);
      }
      fetchUrl = url.toString();
      
      this.abortController = new AbortController();
      fetchOptions = {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        signal: this.abortController.signal,
      };
    }

    this.isManualClose = false;

    try {
      const response = await fetch(fetchUrl, fetchOptions);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      this.isConnected = true;
      this.config.onOpen?.();

      const eventStream = response.body
        .pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream());

      const reader = eventStream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          if (value) {
            this.handleParsedEvent(value);
          }
        }
      } catch (error) {
        if (!this.isManualClose) {
          console.error('[SSE] Read loop error:', error);
          throw error;
        }
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      if (this.isManualClose) {
        return;
      }

      if (error instanceof Error && error.name === 'AbortError') {
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

    if (!eventData) {
      return;
    }

    try {
      const data = JSON.parse(eventData);
      
      if (eventType === 'connected' || eventType === 'heartbeat') {
        return;
      }

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
