import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { jwtService } from '../auth/jwt';
import { logger } from '../../utils/logger';
import {
  WSConnection,
  ClientMessage,
  ServerMessage,
  WSMessageType,
  SenderType,
  ContentType,
} from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * WebSocket 管理器
 *
 * 职责：
 * 1. 管理 WebSocket 连接
 * 2. 处理消息路由和广播
 * 3. 心跳检测
 * 4. 会话管理
 */
export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, WSConnection> = new Map();
  private conversations: Map<string, Set<string>> = new Map(); // conversationId -> userIds
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30秒
  private readonly HEARTBEAT_TIMEOUT = 60000; // 60秒无心跳则断开

  /**
   * 初始化 WebSocket 服务器
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket, req) => {
      this.handleConnection(ws, req);
    });

    // 启动心跳检测
    this.startHeartbeatCheck();

    logger.info('WebSocket server initialized');
  }

  /**
   * 处理新连接
   */
  private handleConnection(ws: WebSocket, req: any): void {
    try {
      // 从 URL 查询参数获取 token
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        ws.close(1008, 'Token required');
        return;
      }

      // 验证 token
      const payload = jwtService.verifyToken(token);

      // 检查是否已有连接
      const existingConnection = this.connections.get(payload.userId);
      if (existingConnection) {
        logger.info('Closing existing connection', { userId: payload.userId });
        existingConnection.ws.close();
      }

      // 创建新连接
      const connection: WSConnection = {
        ws,
        userId: payload.userId,
        userRole: payload.role,
        connectedAt: Date.now(),
        lastHeartbeat: Date.now(),
      };

      this.connections.set(payload.userId, connection);

      logger.info('WebSocket connection established', {
        userId: payload.userId,
        role: payload.role,
      });

      // 发送连接成功消息
      this.sendToUser(payload.userId, {
        type: WSMessageType.SYSTEM,
        conversationId: '',
        data: { text: 'Connected' },
      });

      // 设置消息处理器
      ws.on('message', (data: Buffer) => {
        this.handleMessage(payload.userId, data);
      });

      // 设置关闭处理器
      ws.on('close', () => {
        this.handleDisconnection(payload.userId);
      });

      // 设置错误处理器
      ws.on('error', (error) => {
        logger.error('WebSocket error', { userId: payload.userId, error });
      });

      // 设置 pong 处理器（响应心跳）
      ws.on('pong', () => {
        connection.lastHeartbeat = Date.now();
      });
    } catch (error) {
      logger.error('WebSocket connection error', error);
      ws.close(1008, 'Authentication failed');
    }
  }

  /**
   * 处理消息接收
   */
  private handleMessage(userId: string, data: Buffer): void {
    try {
      const message: ClientMessage = JSON.parse(data.toString());
      const connection = this.connections.get(userId);

      if (!connection) {
        logger.warn('Message from unknown connection', { userId });
        return;
      }

      // 更新心跳时间
      connection.lastHeartbeat = Date.now();

      switch (message.type) {
        case WSMessageType.MESSAGE:
          this.handleChatMessage(userId, message);
          break;

        case WSMessageType.TYPING:
          this.handleTyping(userId, message);
          break;

        case WSMessageType.HEARTBEAT:
          // 心跳消息，pong 已在连接级别处理
          break;

        default:
          logger.warn('Unknown message type', { type: message.type });
      }
    } catch (error) {
      logger.error('Message handling error', { userId, error });
    }
  }

  /**
   * 处理聊天消息
   */
  private handleChatMessage(userId: string, clientMessage: ClientMessage): void {
    const connection = this.connections.get(userId);
    if (!connection) return;

    // 构建服务端消息
    const serverMessage: ServerMessage = {
      type: WSMessageType.MESSAGE,
      conversationId: clientMessage.conversationId,
      message: {
        id: uuidv4(),
        senderId: userId,
        senderType: connection.userRole === 'patient' ? SenderType.PATIENT : SenderType.DOCTOR,
        contentType: clientMessage.data?.contentType || ContentType.TEXT,
        content: clientMessage.data?.content || '',
        metadata: clientMessage.data?.imageUrl ? { imageUrl: clientMessage.data.imageUrl } : undefined,
        createdAt: new Date().toISOString(),
      },
    };

    // 广播到会话中的所有用户
    this.broadcastToConversation(clientMessage.conversationId, serverMessage, userId);

    // TODO: 存储到数据库
    logger.info('Chat message sent', {
      messageId: serverMessage.message?.id,
      conversationId: clientMessage.conversationId,
      senderId: userId,
    });
  }

  /**
   * 处理正在输入状态
   */
  private handleTyping(userId: string, clientMessage: ClientMessage): void {
    const serverMessage: ServerMessage = {
      type: WSMessageType.TYPING,
      conversationId: clientMessage.conversationId,
      data: {
        senderId: userId,
      },
    };

    // 广播到会话中的其他用户
    this.broadcastToConversation(clientMessage.conversationId, serverMessage, userId);
  }

  /**
   * 广播消息到会话
   */
  broadcastToConversation(
    conversationId: string,
    message: ServerMessage,
    excludeUserId?: string
  ): void {
    const userIds = this.conversations.get(conversationId);
    if (!userIds) return;

    for (const userId of userIds) {
      if (userId !== excludeUserId) {
        this.sendToUser(userId, message);
      }
    }
  }

  /**
   * 发送消息给指定用户
   */
  sendToUser(userId: string, message: ServerMessage): boolean {
    const connection = this.connections.get(userId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      connection.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      logger.error('Send message error', { userId, error });
      return false;
    }
  }

  /**
   * 用户加入会话
   */
  joinConversation(userId: string, conversationId: string): void {
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, new Set());
    }
    this.conversations.get(conversationId)!.add(userId);

    logger.info('User joined conversation', { userId, conversationId });
  }

  /**
   * 用户离开会话
   */
  leaveConversation(userId: string, conversationId: string): void {
    const userIds = this.conversations.get(conversationId);
    if (userIds) {
      userIds.delete(userId);
      if (userIds.size === 0) {
        this.conversations.delete(conversationId);
      }
    }

    logger.info('User left conversation', { userId, conversationId });
  }

  /**
   * 处理断开连接
   */
  private handleDisconnection(userId: string): void {
    this.connections.delete(userId);

    // 从所有会话中移除用户
    for (const [conversationId, userIds] of this.conversations.entries()) {
      if (userIds.has(userId)) {
        userIds.delete(userId);
        // 通知其他用户
        this.broadcastToConversation(
          conversationId,
          {
            type: WSMessageType.SYSTEM,
            conversationId,
            data: { text: 'User disconnected' },
          },
          userId
        );
      }
    }

    logger.info('WebSocket connection closed', { userId });
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeatCheck(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      for (const [userId, connection] of this.connections.entries()) {
        // 超时检测
        if (now - connection.lastHeartbeat > this.HEARTBEAT_TIMEOUT) {
          logger.info('Connection timeout, closing', { userId });
          connection.ws.close();
          this.handleDisconnection(userId);
        } else {
          // 发送 ping
          if (connection.ws.readyState === WebSocket.OPEN) {
            connection.ws.ping();
          }
        }
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * 获取在线用户数
   */
  getOnlineCount(): number {
    return this.connections.size;
  }

  /**
   * 获取会话中的用户
   */
  getConversationUsers(conversationId: string): string[] {
    const userIds = this.conversations.get(conversationId);
    return userIds ? Array.from(userIds) : [];
  }

  /**
   * 关闭服务器
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    for (const [userId, connection] of this.connections.entries()) {
      connection.ws.close();
    }

    this.connections.clear();
    this.conversations.clear();

    if (this.wss) {
      this.wss.close();
    }

    logger.info('WebSocket server shut down');
  }
}

// 导出单例
export const wsManager = new WebSocketManager();
