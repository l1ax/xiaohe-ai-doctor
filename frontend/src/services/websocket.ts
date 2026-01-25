/**
 * WebSocket 服务封装
 */

export interface ChatMessage {
  id: string;
  consultationId?: string;
  senderId: string;
  senderType: 'patient' | 'doctor';
  content: string;
  contentType?: 'text' | 'image' | 'audio';
  imageUrl?: string;
  createdAt: string;
  isRead?: boolean;
}

export type MessageHandler = (message: ChatMessage) => void;
export type SystemHandler = (text: string) => void;
export type TypingHandler = (senderId: string) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private messageHandlers: Set<MessageHandler> = new Set();
  private systemHandlers: Set<SystemHandler> = new Set();
  private typingHandlers: Set<TypingHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${this.url}?token=${this.token}`;
        console.log('Connecting to WebSocket:', wsUrl);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          console.log('WebSocket connected successfully');
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(JSON.parse(event.data));
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          console.error('Failed to connect to:', wsUrl);
          reject(new Error(`WebSocket connection failed: ${wsUrl}`));
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket disconnected', { code: event.code, reason: event.reason });
          this.handleDisconnect();
        };
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  join(conversationId: string): void {
    console.log('[WebSocketService] 📥 发送 join', { conversationId });
    this.send({ type: 'join', conversationId });
  }

  leave(conversationId: string): void {
    this.send({ type: 'leave', conversationId });
  }

  sendMessage(conversationId: string, content: string): void {
    const payload = {
      type: 'message',
      conversationId,
      data: { content, contentType: 'text' },
    };
    console.log('[WebSocketService] 📤 发送消息', payload);
    this.send(payload);
  }

  sendTyping(conversationId: string, isTyping: boolean): void {
    this.send({ type: 'typing', conversationId, isTyping });
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onSystem(handler: SystemHandler): () => void {
    this.systemHandlers.add(handler);
    return () => this.systemHandlers.delete(handler);
  }

  onTyping(handler: TypingHandler): () => void {
    this.typingHandlers.add(handler);
    return () => this.typingHandlers.delete(handler);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private send(data: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const payload = JSON.stringify(data);
      console.log('[WebSocketService] 🔌 实际发送', { data, payload });
      this.ws.send(payload);
    } else {
      console.warn('[WebSocketService] ⚠️ WebSocket 未连接', {
        readyState: this.ws?.readyState,
      });
    }
  }

  private handleMessage(data: Record<string, unknown>): void {
    console.log('[WebSocketService] 📨 收到原始消息', data);
    
    switch (data.type) {
      case 'message':
        console.log('[WebSocketService] 📨 处理消息类型', {
          message: data.message,
          handlersCount: this.messageHandlers.size,
        });
        this.messageHandlers.forEach((h) => h(data.message as ChatMessage));
        break;
      case 'system':
        console.log('[WebSocketService] 📨 处理系统消息', data.data);
        this.systemHandlers.forEach((h) => h((data.data as { text?: string })?.text || ''));
        break;
      case 'typing':
        console.log('[WebSocketService] 📨 处理输入状态', data.data);
        this.typingHandlers.forEach((h) => h((data.data as { senderId?: string })?.senderId || ''));
        break;
      default:
        console.warn('[WebSocketService] ⚠️ 未知消息类型', data);
    }
  }

  private handleDisconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    }
  }
}
