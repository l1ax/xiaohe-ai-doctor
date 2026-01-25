import WebSocket, { WebSocket as WebSocketType } from 'ws';

export type ServerMessage =
  | { type: 'message'; conversationId: string; message: any }
  | { type: 'typing'; conversationId: string; senderId: string; isTyping: boolean }
  | { type: 'system'; conversationId: string; text: string }
  | { type: 'joined'; conversationId: string }
  | { type: 'left'; conversationId: string };

export class TestWebSocketClient {
  private ws: WebSocketType | null = null;
  private messageQueue: ServerMessage[] = [];
  private url: string;
  private connected: boolean = false;

  constructor(wsUrl: string = 'ws://localhost:3000/ws') {
    this.url = wsUrl;
  }

  /**
   * 连接 WebSocket 服务器
   */
  async connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const urlWithToken = `${this.url}?token=${token}`;
      this.ws = new WebSocket(urlWithToken);

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.connected = true;
        resolve();
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as ServerMessage;
          this.messageQueue.push(message);
        } catch (e) {
          // 忽略无法解析的消息
        }
      });

      this.ws.on('close', () => {
        this.connected = false;
      });
    });
  }

  /**
   * 加入会话
   */
  joinConversation(conversationId: string): void {
    this.send({ type: 'join', conversationId });
  }

  /**
   * 离开会话
   */
  leaveConversation(conversationId: string): void {
    this.send({ type: 'leave', conversationId });
  }

  /**
   * 发送消息
   */
  sendMessage(conversationId: string, content: string): void {
    this.send({
      type: 'message',
      conversationId,
      content,
    });
  }

  /**
   * 发送正在输入状态
   */
  sendTyping(conversationId: string, isTyping: boolean): void {
    this.send({
      type: 'typing',
      conversationId,
      isTyping,
    });
  }

  /**
   * 发送心跳
   */
  sendHeartbeat(): void {
    this.send({ type: 'heartbeat' });
  }

  /**
   * 私有方法：发送数据
   */
  private send(data: any): void {
    if (!this.isConnected()) {
      throw new Error('WebSocket is not connected');
    }
    this.ws!.send(JSON.stringify(data));
  }

  /**
   * 等待下一条消息
   */
  async waitForMessage(timeout = 5000): Promise<ServerMessage> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.messageQueue.length > 0) {
        return this.messageQueue.shift()!;
      }
      await this.sleep(50);
    }

    throw new Error(`Timeout waiting for message after ${timeout}ms`);
  }

  /**
   * 等待特定类型的系统消息
   */
  async waitForSystemMessage(expectedText: string, timeout = 5000): Promise<ServerMessage> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const index = this.messageQueue.findIndex(
        (m) => m.type === 'system' && (m as any).text === expectedText
      );

      if (index !== -1) {
        return this.messageQueue.splice(index, 1)[0];
      }
      await this.sleep(50);
    }

    throw new Error(`Timeout waiting for system message: "${expectedText}"`);
  }

  /**
   * 等待特定类型的消息
   */
  async waitForMessageOfType(type: string, timeout = 5000): Promise<ServerMessage> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const index = this.messageQueue.findIndex((m) => (m as any).type === type);

      if (index !== -1) {
        return this.messageQueue.splice(index, 1)[0];
      }
      await this.sleep(50);
    }

    throw new Error(`Timeout waiting for ${type} message`);
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.messageQueue = [];
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 私有方法：延迟
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
