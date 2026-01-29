/**
 * 全局 WebSocket 单例服务
 *
 * 解决问题：多个页面各自创建 WebSocket 连接导致频繁重连
 *
 * 设计：
 * 1. 单例模式：整个应用只有一个 WebSocket 连接
 * 2. 引用计数：跟踪有多少组件正在使用连接
 * 3. 自动清理：当没有组件使用时断开连接
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

export interface ConsultationUpdate {
  id: string;
  userId: string;
  chiefComplaint?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export type ConsultationUpdateHandler = (consultation: ConsultationUpdate) => void;
export type MessageReadHandler = (messageIds: string[]) => void;
export type ConnectionStatusHandler = (connected: boolean) => void;

class WebSocketSingleton {
  private static instance: WebSocketSingleton | null = null;
  private ws: WebSocket | null = null;
  private url: string = '';
  private token: string = '';
  private refCount: number = 0;

  // Event handlers
  private messageHandlers: Set<MessageHandler> = new Set();
  private systemHandlers: Set<SystemHandler> = new Set();
  private typingHandlers: Set<TypingHandler> = new Set();
  private consultationUpdateHandlers: Set<ConsultationUpdateHandler> = new Set();
  private messageReadHandlers: Set<MessageReadHandler> = new Set();
  private connectionStatusHandlers: Set<ConnectionStatusHandler> = new Set();

  // Reconnection
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private intentionalDisconnect = false;
  private connectPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): WebSocketSingleton {
    if (!WebSocketSingleton.instance) {
      WebSocketSingleton.instance = new WebSocketSingleton();
    }
    return WebSocketSingleton.instance;
  }

  /**
   * 增加引用计数并连接（如果尚未连接）
   */
  acquire(url: string, token: string): Promise<void> {
    this.refCount++;
    console.log('[WebSocketSingleton] acquire, refCount:', this.refCount);

    // 如果 token 或 url 变化，需要重新连接
    if (this.ws && (this.url !== url || this.token !== token)) {
      console.log('[WebSocketSingleton] Token/URL changed, reconnecting...');
      this.forceDisconnect();
    }

    this.url = url;
    this.token = token;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    // 如果正在连接中，返回相同的 Promise
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.connect();
    return this.connectPromise;
  }

  /**
   * 减少引用计数，当计数为0时断开连接
   */
  release(): void {
    this.refCount = Math.max(0, this.refCount - 1);
    console.log('[WebSocketSingleton] release, refCount:', this.refCount);

    // 可选：当没有组件使用时断开连接
    // 但对于需要后台接收消息的应用，可能需要保持连接
    // if (this.refCount === 0) {
    //   this.disconnect();
    // }
  }

  private connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.connectPromise = null;
          resolve();
          return;
        }

        const wsUrl = `${this.url}?token=${this.token}`;
        console.log('[WebSocketSingleton] Connecting to:', wsUrl);
        this.ws = new WebSocket(wsUrl);
        this.intentionalDisconnect = false;

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.connectPromise = null;
          console.log('[WebSocketSingleton] Connected successfully');
          this.connectionStatusHandlers.forEach((h) => h(true));
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(JSON.parse(event.data));
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocketSingleton] Error:', error);
          this.connectPromise = null;
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = (event) => {
          console.log('[WebSocketSingleton] Disconnected', {
            code: event.code,
            reason: event.reason,
          });
          this.connectPromise = null;
          this.connectionStatusHandlers.forEach((h) => h(false));
          this.handleDisconnect();
        };
      } catch (error) {
        console.error('[WebSocketSingleton] Failed to create WebSocket:', error);
        this.connectPromise = null;
        reject(error);
      }
    });
  }

  private handleMessage(data: Record<string, unknown>): void {
    console.log('[WebSocketSingleton] Received message:', data);

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
      case 'consultation_update':
        this.consultationUpdateHandlers.forEach((h) => h(data.consultation as ConsultationUpdate));
        break;
      case 'mark_read':
        const messageIds = (data.data as { messageIds: string[] })?.messageIds || [];
        if (messageIds.length > 0) {
          this.messageReadHandlers.forEach((h) => h(messageIds));
        }
        break;
      default:
        console.warn('[WebSocketSingleton] Unknown message type:', data);
    }
  }

  private handleDisconnect(): void {
    if (this.intentionalDisconnect) {
      console.log('[WebSocketSingleton] Intentional disconnect, not reconnecting');
      return;
    }

    // 只有在有活跃组件时才重连
    if (this.refCount > 0 && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`[WebSocketSingleton] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => {
        this.connect().catch((err) => {
          console.error('[WebSocketSingleton] Reconnect failed:', err);
        });
      }, delay);
    } else if (this.refCount === 0) {
      console.log('[WebSocketSingleton] No active components, not reconnecting');
    } else {
      console.error('[WebSocketSingleton] Max reconnect attempts reached');
    }
  }

  /**
   * 主动断开连接（用户登出时调用）
   */
  disconnect(): void {
    if (this.refCount > 0) {
      console.log('[WebSocketSingleton] Cannot disconnect, still has active refs:', this.refCount);
      return;
    }
    this.forceDisconnect();
  }

  /**
   * 强制断开连接（忽略引用计数）
   */
  forceDisconnect(): void {
    this.intentionalDisconnect = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectPromise = null;
    console.log('[WebSocketSingleton] Force disconnected');
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // ========== 消息发送 ==========

  private send(data: Record<string, unknown>): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    console.warn('[WebSocketSingleton] Cannot send, WebSocket not connected');
    return false;
  }

  join(conversationId: string): boolean {
    console.log('[WebSocketSingleton] Joining conversation:', conversationId);
    return this.send({ type: 'join', conversationId });
  }

  leave(conversationId: string): boolean {
    console.log('[WebSocketSingleton] Leaving conversation:', conversationId);
    return this.send({ type: 'leave', conversationId });
  }

  sendMessage(conversationId: string, content: string, imageUrl?: string): boolean {
    return this.send({
      type: 'message',
      conversationId,
      data: { content, contentType: 'text', imageUrl },
    });
  }

  sendTyping(conversationId: string, isTyping: boolean): boolean {
    return this.send({ type: 'typing', conversationId, isTyping });
  }

  markAsRead(conversationId: string, messageIds: string[]): boolean {
    return this.send({
      type: 'mark_read',
      conversationId,
      data: { messageIds },
    });
  }

  // ========== 事件订阅 ==========

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

  onConsultationUpdate(handler: ConsultationUpdateHandler): () => void {
    this.consultationUpdateHandlers.add(handler);
    return () => this.consultationUpdateHandlers.delete(handler);
  }

  onMessageRead(handler: MessageReadHandler): () => void {
    this.messageReadHandlers.add(handler);
    return () => this.messageReadHandlers.delete(handler);
  }

  onConnectionStatus(handler: ConnectionStatusHandler): () => void {
    this.connectionStatusHandlers.add(handler);
    return () => this.connectionStatusHandlers.delete(handler);
  }
}

// 导出单例实例
export const wsService = WebSocketSingleton.getInstance();

// 保留旧的 WebSocketService 类以保持向后兼容
export class WebSocketService {
  private url: string;
  private token: string;
  private unsubscribers: Array<() => void> = [];

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  async connect(): Promise<void> {
    await wsService.acquire(this.url, this.token);
  }

  disconnect(): void {
    // 清理所有订阅
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
    wsService.release();
  }

  isConnected(): boolean {
    return wsService.isConnected();
  }

  join(conversationId: string): void {
    wsService.join(conversationId);
  }

  leave(conversationId: string): void {
    wsService.leave(conversationId);
  }

  sendMessage(conversationId: string, content: string): void {
    wsService.sendMessage(conversationId, content);
  }

  sendTyping(conversationId: string, isTyping: boolean): void {
    wsService.sendTyping(conversationId, isTyping);
  }

  markAsRead(conversationId: string, messageIds: string[]): void {
    wsService.markAsRead(conversationId, messageIds);
  }

  onMessage(handler: MessageHandler): () => void {
    const unsub = wsService.onMessage(handler);
    this.unsubscribers.push(unsub);
    return unsub;
  }

  onSystem(handler: SystemHandler): () => void {
    const unsub = wsService.onSystem(handler);
    this.unsubscribers.push(unsub);
    return unsub;
  }

  onTyping(handler: TypingHandler): () => void {
    const unsub = wsService.onTyping(handler);
    this.unsubscribers.push(unsub);
    return unsub;
  }

  onConsultationUpdate(handler: ConsultationUpdateHandler): () => void {
    const unsub = wsService.onConsultationUpdate(handler);
    this.unsubscribers.push(unsub);
    return unsub;
  }

  onMessageRead(handler: MessageReadHandler): () => void {
    const unsub = wsService.onMessageRead(handler);
    this.unsubscribers.push(unsub);
    return unsub;
  }
}
