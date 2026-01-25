/**
 * WebSocket 服务封装
 */

export interface ChatMessage {
  id: string;
  senderId: string;
  senderType: 'patient' | 'doctor';
  content: string;
  createdAt: string;
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
      const wsUrl = `${this.url}?token=${this.token}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        console.log('WebSocket connected');
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.handleDisconnect();
      };
    });
  }

  join(conversationId: string): void {
    this.send({ type: 'join', conversationId });
  }

  leave(conversationId: string): void {
    this.send({ type: 'leave', conversationId });
  }

  sendMessage(conversationId: string, content: string): void {
    this.send({
      type: 'message',
      conversationId,
      data: { content, contentType: 'text' },
    });
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

  private send(data: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private handleMessage(data: Record<string, unknown>): void {
    switch (data.type) {
      case 'message':
        this.messageHandlers.forEach((h) => h(data.message as ChatMessage));
        break;
      case 'system':
        this.systemHandlers.forEach((h) => h((data.data as { text?: string })?.text || ''));
        break;
      case 'typing':
        this.typingHandlers.forEach((h) => h((data.data as { senderId?: string })?.senderId || ''));
        break;
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
