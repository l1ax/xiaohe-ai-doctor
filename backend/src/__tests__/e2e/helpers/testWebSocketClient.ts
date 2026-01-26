import WebSocket, { WebSocket as WebSocketType } from 'ws';
import { TEST_CONFIG } from './testSetup';

// 实际服务器返回的消息格式
type ServerMessageBase = {
  type: 'message' | 'typing' | 'system' | 'consultation_update';
  conversationId: string;
  data?: {
    text?: string;
    senderId?: string;
    consultation?: {
      id: string;
      status: 'pending' | 'active' | 'closed' | 'cancelled';
      lastMessage?: string;
      lastMessageTime?: string;
      updatedAt: string;
    };
  };
  message?: {
    id: string;
    senderId: string;
    senderType: 'patient' | 'doctor';
    contentType: 'text' | 'image';
    content: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
  };
  consultation?: {
    id: string;
    status: 'pending' | 'active' | 'closed' | 'cancelled';
    lastMessage?: string;
    lastMessageTime?: string;
    updatedAt: string;
  };
};

export type ServerMessage = ServerMessageBase;

export class TestWebSocketClient {
  private ws: WebSocketType | null = null;
  private messageQueue: ServerMessage[] = [];
  private url: string;
  private connected: boolean = false;

  constructor(wsUrl?: string) {
    // 动态读取 process.env.WS_URL，而不是使用 TEST_CONFIG.WS_URL
    // 因为 TEST_CONFIG.WS_URL 在模块导入时就被评估，而 process.env.WS_URL 在测试运行时才设置
    this.url = wsUrl || process.env.WS_URL || TEST_CONFIG.WS_URL;
  }

  /**
   * 连接 WebSocket 服务器
   */
  async connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const urlWithToken = `${this.url}?token=${token}`;

      // 诊断日志：显示连接的 URL
      console.log('[WS-CLIENT] 正在连接:', {
        baseUrl: this.url,
        urlWithToken: urlWithToken.replace(/token=[^&]+/, 'token=***'),
      });

      this.ws = new WebSocket(urlWithToken);

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      this.ws.on('open', () => {
        console.log('[WS-CLIENT] 连接已建立');
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
          // 诊断日志：记录所有接收到的消息
          if (process.env.NODE_ENV === 'test') {
            console.log('[WS-CLIENT] 收到消息:', {
              type: message.type,
              conversationId: message.conversationId,
              hasMessage: !!message.message,
              hasData: !!message.data,
              hasConsultation: !!message.consultation,
            });
          }
          this.messageQueue.push(message);
        } catch (e) {
          // 诊断日志：解析失败
          if (process.env.NODE_ENV === 'test') {
            console.log('[WS-CLIENT] 消息解析失败:', data.toString());
          }
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
      data: {
        content,
      },
    });
  }

  /**
   * 发送正在输入状态
   */
  sendTyping(conversationId: string, isTyping: boolean): void {
    this.send({
      type: 'typing',
      conversationId,
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
    // 诊断日志：记录发送的消息
    if (process.env.NODE_ENV === 'test') {
      console.log('[WS-CLIENT] 发送消息:', {
        type: data.type,
        conversationId: data.conversationId,
        hasData: !!data.data,
      });
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
        (m) => m.type === 'system' && m.data?.text === expectedText
      );

      if (index !== -1) {
        return this.messageQueue.splice(index, 1)[0];
      }
      await this.sleep(50);
    }

    throw new Error(`Timeout waiting for system message: "${expectedText}"`);
  }

  /**
   * 等待聊天消息
   * @param timeout 超时时间（毫秒）
   * @param options 可选过滤条件
   * @param options.senderType 只等待特定发送者类型的消息
   * @param options.excludeSenderId 排除特定发送者ID的消息
   */
  async waitForChatMessage(
    timeout = 5000,
    options?: { senderType?: 'patient' | 'doctor'; excludeSenderId?: string }
  ): Promise<ServerMessage> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const index = this.messageQueue.findIndex((m) => {
        // 基本过滤：必须是聊天消息
        if (m.type !== 'message' || !m.message) {
          return false;
        }

        // 可选：过滤发送者类型
        if (options?.senderType && m.message.senderType !== options.senderType) {
          return false;
        }

        // 可选：排除特定发送者（如排除自己）
        if (options?.excludeSenderId && m.message.senderId === options.excludeSenderId) {
          return false;
        }

        return true;
      });

      if (index !== -1) {
        return this.messageQueue.splice(index, 1)[0];
      }
      await this.sleep(50);
    }

    throw new Error(`Timeout waiting for chat message`);
  }

  /**
   * 等待正在输入消息
   */
  async waitForTypingMessage(timeout = 5000): Promise<ServerMessage> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const index = this.messageQueue.findIndex((m) => m.type === 'typing' && m.data?.senderId);

      if (index !== -1) {
        return this.messageQueue.splice(index, 1)[0];
      }
      await this.sleep(50);
    }

    throw new Error(`Timeout waiting for typing message`);
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
   * 等待特定状态的 consultation_update 消息
   */
  async waitForConsultationUpdateWithStatus(
    expectedStatus: 'pending' | 'active' | 'closed' | 'cancelled',
    timeout = 5000
  ): Promise<ServerMessage> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // 查找匹配的 consultation_update 消息
      const index = this.messageQueue.findIndex((m) => {
        if (m.type !== 'consultation_update') return false;
        if (!m.consultation) return false;
        return m.consultation.status === expectedStatus;
      });

      if (index !== -1) {
        return this.messageQueue.splice(index, 1)[0];
      }
      await this.sleep(50);
    }

    throw new Error(`Timeout waiting for consultation_update with status: ${expectedStatus}`);
  }

  /**
   * 等待特定 lastMessage 的 consultation_update 消息
   */
  async waitForConsultationUpdateWithLastMessage(
    expectedLastMessage: string,
    timeout = 5000
  ): Promise<ServerMessage> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      // 查找匹配的 consultation_update 消息
      const index = this.messageQueue.findIndex((m) => {
        if (m.type !== 'consultation_update') return false;
        if (!m.consultation) return false;
        return m.consultation.lastMessage === expectedLastMessage;
      });

      if (index !== -1) {
        return this.messageQueue.splice(index, 1)[0];
      }
      await this.sleep(50);
    }

    throw new Error(`Timeout waiting for consultation_update with lastMessage: ${expectedLastMessage}`);
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
