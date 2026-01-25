import { ChatEvent, parseServerEvent, ChatEventType } from '../machines/chatMachine';

export type SSEEventHandler = (event: ChatEventType) => void;

export interface SSEConfig {
  url: string;
  conversationId: string;
  message?: string;
  onEvent?: SSEEventHandler;
  onError?: (error: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onOpen?: () => void;
  retryInterval?: number;
  maxRetries?: number;
}

interface RetryConfig {
  maxRetries: number;
  currentRetries: number;
  interval: number;
}

export class SSEClient {
  private eventSource: EventSource | null = null;
  private config: SSEConfig;
  private retryConfig: RetryConfig;
  private isConnected: boolean = false;
  private isManualClose: boolean = false;
  private handlers: Map<string, Set<SSEEventHandler>> = new Map();

  constructor(config: SSEConfig) {
    this.config = {
      retryInterval: 3000,
      maxRetries: 5,
      ...config,
    };
    this.retryConfig = {
      maxRetries: this.config.maxRetries || 5,
      currentRetries: 0,
      interval: this.config.retryInterval || 3000,
    };
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.config.url);
      if (this.config.conversationId) {
        url.searchParams.set('conversationId', this.config.conversationId);
      }
      if (this.config.message) {
        url.searchParams.set('message', this.config.message);
      }

      try {
        this.eventSource = new EventSource(url.toString());
        this.isManualClose = false;

        this.eventSource.onopen = () => {
          console.log('[SSE] Connection established');
          this.isConnected = true;
          this.retryConfig.currentRetries = 0;
          this.config.onOpen?.();
          resolve();
        };

        this.eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const chatEvent: ChatEvent = {
              type: data.type || event.type,
              data: data,
            };
            const parsedEvent = parseServerEvent(chatEvent);
            if (parsedEvent) {
              this.handleEvent(parsedEvent);
              this.config.onEvent?.(parsedEvent);
            }
          } catch (error) {
            console.error('[SSE] Failed to parse event:', error);
          }
        };

        // 处理新事件类型
        this.eventSource.addEventListener('conversation_status', (event: MessageEvent) => {
          this.handleCustomEvent('conversation_status', event);
        });

        this.eventSource.addEventListener('message_status', (event: MessageEvent) => {
          this.handleCustomEvent('message_status', event);
        });

        this.eventSource.addEventListener('message_content', (event: MessageEvent) => {
          this.handleCustomEvent('message_content', event);
        });

        this.eventSource.addEventListener('message_metadata', (event: MessageEvent) => {
          this.handleCustomEvent('message_metadata', event);
        });

        this.eventSource.addEventListener('tool_call', (event: MessageEvent) => {
          this.handleCustomEvent('tool_call', event);
        });

        this.eventSource.addEventListener('conversation_end', (event: MessageEvent) => {
          this.handleCustomEvent('conversation_end', event);
        });

        this.eventSource.addEventListener('heartbeat', () => {
          console.log('[SSE] Heartbeat received');
        });

        this.eventSource.addEventListener('connected', (event: MessageEvent) => {
          const data = JSON.parse(event.data);
          console.log('[SSE] Connected:', data);
        });

        this.eventSource.onerror = (error) => {
          console.error('[SSE] Connection error:', error);
          this.config.onError?.(error);
          this.handleError();
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  private handleCustomEvent(eventType: string, event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      const chatEvent: ChatEvent = {
        type: eventType,
        data: data,
      };
      const parsedEvent = parseServerEvent(chatEvent);
      if (parsedEvent) {
        this.handleEvent(parsedEvent);
        this.config.onEvent?.(parsedEvent);
      }
    } catch (error) {
      console.error(`[SSE] Failed to parse ${eventType} event:`, error);
    }
  }

  private handleEvent(event: ChatEventType): void {
    // 广播到所有注册的处理器
    this.handlers.forEach((handlerSet) => {
      handlerSet.forEach((handler) => {
        try {
          handler(event);
        } catch (error) {
          console.error('[SSE] Handler error:', error);
        }
      });
    });
  }

  private handleError(): void {
    if (this.isManualClose) return;

    if (this.retryConfig.currentRetries < this.retryConfig.maxRetries) {
      this.retryConfig.currentRetries++;
      console.log(`[SSE] Retrying connection (${this.retryConfig.currentRetries}/${this.retryConfig.maxRetries})...`);
      setTimeout(() => {
        this.connect().catch(console.error);
      }, this.retryConfig.interval);
    } else {
      console.error('[SSE] Max retries reached, giving up');
    }
  }

  // 注册事件处理器
  on(eventType: string, handler: SSEEventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    // 返回取消注册函数
    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  // 发送消息到服务器
  send(_data: any): void {
    // SSE 是单向的，无法发送数据
    // 如果需要发送数据，请使用 POST API
    console.warn('[SSE] Cannot send data through SSE connection');
  }

  // 手动关闭连接
  close(): void {
    this.isManualClose = true;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      console.log('[SSE] Connection closed manually');
    }
  }

  // 获取连接状态
  getConnected(): boolean {
    return this.isConnected;
  }

  // 获取连接 ID
  getConnectionId(): string | null {
    // 可以从 connected 事件中获取
    return null;
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
