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
import { consultationStore } from '../storage/consultationStore';
import { messageStore, Message } from '../storage/messageStore';

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
  // Track active connection IDs to prevent stale close events from cleaning up new connections
  private activeConnectionIds: Map<string, string> = new Map(); // userId -> connectionId
  // WARNING: In-memory storage only - data will be lost on server restart
  // TODO: Implement persistent storage for production use
  private conversations: Map<string, Set<string>> = new Map(); // conversationId -> userIds
  private onlineDoctors: Set<string> = new Set(); // 在线医生列表
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30秒
  private readonly HEARTBEAT_TIMEOUT = 60000; // 60秒无心跳则断开
  private readonly MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB max message size
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly RATE_LIMIT_MAX = 60; // 60 messages per minute
  private rateLimitMap: Map<string, { count: number; resetTime: number }> = new Map();

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
        // Prevent race condition by checking isClosing flag
        if (!existingConnection.isClosing) {
          logger.info('Closing existing connection', { userId: payload.userId });
          // 先从 connections Map 中移除旧连接，这样 handleDisconnection 就不会被调用
          this.connections.delete(payload.userId);
          // Mark as stale by clearing the active connection ID
          this.activeConnectionIds.delete(payload.userId);
          existingConnection.isClosing = true;
          existingConnection.ws.close();
        }
      }

      // 生成新连接的唯一 ID
      const connectionId = uuidv4();

      // 创建新连接
      const connection: WSConnection = {
        ws,
        userId: payload.userId,
        userRole: payload.role,
        connectedAt: Date.now(),
        lastHeartbeat: Date.now(),
        isClosing: false,
      };

      this.connections.set(payload.userId, connection);
      // 记录活跃连接 ID
      this.activeConnectionIds.set(payload.userId, connectionId);

      // 如果是医生，加入在线医生列表
      if (payload.role === 'doctor') {
        this.onlineDoctors.add(payload.userId);
        logger.info('Doctor came online', { doctorId: payload.userId });
      }

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

      // 设置关闭处理器（使用闭包捕获 connectionId）
      ws.on('close', () => {
        this.handleDisconnection(payload.userId, connectionId);
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
      // Validate message size
      if (data.length > this.MAX_MESSAGE_SIZE) {
        logger.warn('Message size exceeds limit', {
          userId,
          size: data.length,
          maxSize: this.MAX_MESSAGE_SIZE,
        });
        const connection = this.connections.get(userId);
        if (connection) {
          this.sendToUser(userId, {
            type: WSMessageType.SYSTEM,
            conversationId: '',
            data: { text: 'Message too large' },
          });
        }
        return;
      }

      // Validate and parse JSON
      let message: ClientMessage;
      try {
        message = JSON.parse(data.toString());
      } catch (parseError) {
        logger.warn('Invalid JSON message', { userId });
        const connection = this.connections.get(userId);
        if (connection) {
          this.sendToUser(userId, {
            type: WSMessageType.SYSTEM,
            conversationId: '',
            data: { text: 'Invalid message format' },
          });
        }
        return;
      }

      // Validate message format
      if (!message.type || !message.conversationId) {
        logger.warn('Invalid message format', { userId });
        const connection = this.connections.get(userId);
        if (connection) {
          this.sendToUser(userId, {
            type: WSMessageType.SYSTEM,
            conversationId: '',
            data: { text: 'Invalid message format' },
          });
        }
        return;
      }

      // Check rate limit
      if (!this.checkRateLimit(userId)) {
        logger.warn('Rate limit exceeded', { userId });
        this.sendToUser(userId, {
          type: WSMessageType.SYSTEM,
          conversationId: '',
          data: { text: 'Rate limit exceeded' },
        });
        return;
      }

      const connection = this.connections.get(userId);

      if (!connection) {
        logger.warn('Message from unknown connection', { userId });
        return;
      }

      // 更新心跳时间
      connection.lastHeartbeat = Date.now();

      switch (message.type) {
        case WSMessageType.JOIN:
          this.handleJoin(userId, message);
          break;

        case WSMessageType.LEAVE:
          this.handleLeave(userId, message);
          break;

        case WSMessageType.MESSAGE:
          this.handleChatMessage(userId, message);
          break;

        case WSMessageType.TYPING:
          this.handleTyping(userId, message);
          break;

        case WSMessageType.MARK_READ:
          this.handleMarkRead(userId, message);
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
    if (!connection) {
      logger.warn('[❌ MESSAGE] 连接不存在', { userId });
      return;
    }

    logger.info('[📥 MESSAGE] 收到聊天消息', {
      userId,
      userRole: connection.userRole,
      conversationId: clientMessage.conversationId,
      content: clientMessage.data?.content,
    });

    // Validate user is in the conversation
    const conversationUsers = this.conversations.get(clientMessage.conversationId);
    if (!conversationUsers || !conversationUsers.has(userId)) {
      logger.warn('[❌ MESSAGE] 用户不在会话中', {
        userId,
        conversationId: clientMessage.conversationId,
        conversationExists: !!conversationUsers,
        userInConversation: conversationUsers?.has(userId),
      });
      this.sendToUser(userId, {
        type: WSMessageType.SYSTEM,
        conversationId: clientMessage.conversationId,
        data: { text: 'You are not in this conversation' },
      });
      return;
    }

    logger.info('[✅ MESSAGE] 用户在会话中，会话用户列表', {
      conversationId: clientMessage.conversationId,
      allUsers: Array.from(conversationUsers),
      senderId: userId,
    });

    // 生成消息 ID
    const messageId = uuidv4();
    const content = clientMessage.data?.content || '';
    const createdAt = new Date().toISOString();

    // 存储消息到 messageStore
    const newMessage: Message = {
      id: messageId,
      consultationId: clientMessage.conversationId,
      senderId: userId,
      senderType: connection.userRole === 'doctor' ? 'doctor' : 'patient',
      content,
      createdAt,
      isRead: false,
    };
    messageStore.addMessage(newMessage);

    // 更新会话的最后消息
    consultationStore.updateLastMessage(clientMessage.conversationId, content);

    // 广播问诊更新
    this.broadcastConsultationUpdate(clientMessage.conversationId);

    logger.info('[💾 MESSAGE] 消息已存储', {
      messageId,
      consultationId: clientMessage.conversationId,
    });

    // 构建服务端消息 - 给接收者（未读）
    const messageForReceivers: ServerMessage = {
      type: WSMessageType.MESSAGE,
      conversationId: clientMessage.conversationId,
      message: {
        id: messageId,
        senderId: userId,
        senderType: connection.userRole === 'patient' ? SenderType.PATIENT : SenderType.DOCTOR,
        contentType: clientMessage.data?.contentType || ContentType.TEXT,
        content,
        metadata: clientMessage.data?.imageUrl ? { imageUrl: clientMessage.data.imageUrl } : undefined,
        createdAt,
        isRead: false,
      },
    };

    // 构建发送者消息（已读）
    const messageForSender: ServerMessage = {
      ...messageForReceivers,
      message: {
        ...messageForReceivers.message!,
        isRead: true,
      },
    };

    logger.info('[📤 MESSAGE] 准备广播消息', {
      messageId: messageForReceivers.message?.id,
      conversationId: clientMessage.conversationId,
      senderId: userId,
    });

    // 广播到会话中的其他用户（排除发送者）
    this.broadcastToConversation(clientMessage.conversationId, messageForReceivers, userId);

    // 发送给发送者（确认消息）
    this.sendToUser(userId, messageForSender);

    logger.info('[✅ MESSAGE] 消息处理完成', {
      messageId: messageForReceivers.message?.id,
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
   * 处理标记已读
   */
  private handleMarkRead(userId: string, clientMessage: ClientMessage): void {
    const connection = this.connections.get(userId);
    if (!connection) {
      logger.warn('[❌ MARK_READ] 连接不存在', { userId });
      return;
    }

    const messageIds = (clientMessage.data as any)?.messageIds as string[] | undefined;
    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      logger.warn('[❌ MARK_READ] 消息ID列表无效', { userId, messageIds });
      return;
    }

    logger.info('[📥 MARK_READ] 收到标记已读请求', {
      userId,
      conversationId: clientMessage.conversationId,
      messageCount: messageIds.length,
    });

    // 验证用户是否在会话中
    const conversationUsers = this.conversations.get(clientMessage.conversationId);
    if (!conversationUsers || !conversationUsers.has(userId)) {
      logger.warn('[❌ MARK_READ] 用户不在会话中', {
        userId,
        conversationId: clientMessage.conversationId,
      });
      return;
    }

    // 标记消息为已读
    messageStore.markMultipleAsRead(messageIds);

    logger.info('[✅ MARK_READ] 消息已标记为已读', {
      userId,
      messageCount: messageIds.length,
    });
  }

  /**
   * 处理加入会话
   */
  private handleJoin(userId: string, clientMessage: ClientMessage): void {
    const { conversationId } = clientMessage;
    if (!conversationId) {
      this.sendToUser(userId, {
        type: WSMessageType.SYSTEM,
        conversationId: '',
        data: { text: 'Conversation ID required' },
      });
      return;
    }

    logger.info('[🔵 JOIN] 用户请求加入会话', { userId, conversationId });

    this.joinConversation(userId, conversationId);

    // 记录当前会话中的所有用户
    const currentUsers = this.getConversationUsers(conversationId);
    logger.info('[📋 JOIN] 会话当前用户列表', {
      conversationId,
      users: currentUsers,
      totalUsers: currentUsers.length,
    });

    // 通知会话中的其他用户
    this.broadcastToConversation(
      conversationId,
      {
        type: WSMessageType.SYSTEM,
        conversationId,
        data: { text: 'User joined the conversation' },
      },
      userId
    );

    // 发送确认给用户
    this.sendToUser(userId, {
      type: WSMessageType.SYSTEM,
      conversationId,
      data: { text: 'Joined conversation' },
    });
  }

  /**
   * 处理离开会话
   */
  private handleLeave(userId: string, clientMessage: ClientMessage): void {
    const { conversationId } = clientMessage;
    if (!conversationId) return;

    this.leaveConversation(userId, conversationId);

    // 通知会话中的其他用户
    this.broadcastToConversation(
      conversationId,
      {
        type: WSMessageType.SYSTEM,
        conversationId,
        data: { text: 'User left the conversation' },
      },
      userId
    );
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
    if (!userIds) {
      logger.warn('[❌ BROADCAST] 会话不存在', { conversationId });
      return;
    }

    const allUsers = Array.from(userIds);
    const targetUsers = allUsers.filter((id) => id !== excludeUserId);

    logger.info('[📡 BROADCAST] 广播消息', {
      conversationId,
      messageType: message.type,
      allUsers,
      excludeUserId,
      targetUsers,
      willSendTo: targetUsers.length,
    });

    for (const userId of userIds) {
      if (userId !== excludeUserId) {
        const sent = this.sendToUser(userId, message);
        logger.info('[📤 BROADCAST] 发送结果', {
          userId,
          sent,
          messageType: message.type,
        });
      } else {
        logger.info('[⏭️ BROADCAST] 跳过发送者', {
          userId,
          reason: 'excludeUserId',
        });
      }
    }
  }

  /**
   * 广播消息给所有在线医生
   */
  broadcastToOnlineDoctors(message: ServerMessage): void {
    const doctorCount = this.onlineDoctors.size;
    logger.info('[📡 BROADCAST] 广播给所有在线医生', {
      doctorCount,
      messageType: message.type,
    });

    let successCount = 0;
    for (const doctorId of this.onlineDoctors) {
      const sent = this.sendToUser(doctorId, message);
      if (sent) {
        successCount++;
      }
    }

    logger.info('[✅ BROADCAST] 广播完成', {
      total: doctorCount,
      success: successCount,
    });
  }

  /**
   * 发送消息给指定用户
   */
  sendToUser(userId: string, message: ServerMessage): boolean {
    const connection = this.connections.get(userId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN || connection.isClosing) {
      logger.warn('[❌ SEND] 无法发送，连接不可用', {
        userId,
        hasConnection: !!connection,
        readyState: connection?.ws.readyState,
        isClosing: connection?.isClosing,
      });
      return false;
    }

    try {
      const payload = JSON.stringify(message);
      connection.ws.send(payload);
      logger.info('[✅ SEND] 消息已发送', {
        userId,
        messageType: message.type,
        conversationId: message.conversationId,
      });
      return true;
    } catch (error) {
      logger.error('[❌ SEND] 发送失败', { userId, error });
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
  private handleDisconnection(userId: string, connectionId: string): void {
    // 检查是否是活跃连接（防止旧的 close 事件清理新连接）
    const activeConnectionId = this.activeConnectionIds.get(userId);
    if (activeConnectionId !== connectionId) {
      logger.info('Ignoring stale close event from old connection', {
        userId,
        staleConnectionId: connectionId,
        activeConnectionId,
      });
      return;
    }

    const connection = this.connections.get(userId);

    // 如果连接不在 Map 中，说明是被替换的旧连接，不从会话中移除用户
    if (!connection) {
      logger.info('Connection already removed from Map (likely replaced by new connection)', { userId });
      return;
    }

    this.connections.delete(userId);
    this.activeConnectionIds.delete(userId);
    this.rateLimitMap.delete(userId);

    // 从在线医生列表中移除
    this.onlineDoctors.delete(userId);

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
        // Skip if connection is already closing
        if (connection.isClosing) {
          continue;
        }

        // 超时检测
        if (now - connection.lastHeartbeat > this.HEARTBEAT_TIMEOUT) {
          logger.info('Connection timeout, closing', { userId });
          connection.isClosing = true;
          connection.ws.close();
          const connectionId = this.activeConnectionIds.get(userId) || '';
          this.handleDisconnection(userId, connectionId);
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
   * 检查用户速率限制
   */
  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const userLimit = this.rateLimitMap.get(userId);

    if (!userLimit) {
      this.rateLimitMap.set(userId, { count: 1, resetTime: now + this.RATE_LIMIT_WINDOW });
      return true;
    }

    // Reset if window expired
    if (now > userLimit.resetTime) {
      userLimit.count = 1;
      userLimit.resetTime = now + this.RATE_LIMIT_WINDOW;
      return true;
    }

    // Check limit
    if (userLimit.count >= this.RATE_LIMIT_MAX) {
      return false;
    }

    userLimit.count++;
    return true;
  }

  /**
   * 广播问诊更新给相关用户（医生和患者）
   */
  broadcastConsultationUpdate(consultationId: string): void {
    const consultation = consultationStore.getById(consultationId);
    if (!consultation) return;

    const updateMessage: ServerMessage = {
      type: WSMessageType.CONSULTATION_UPDATE,
      conversationId: consultationId,
      consultation: {
        id: consultation.id,
        status: consultation.status,
        lastMessage: consultation.lastMessage || '',
        lastMessageTime: consultation.lastMessageTime || consultation.createdAt,
        createdAt: consultation.createdAt,
        updatedAt: consultation.updatedAt,
      },
    };

    // 发送给医生
    this.sendToUser(consultation.doctorId, updateMessage);

    // 发送给患者
    this.sendToUser(consultation.patientId, updateMessage);
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
    this.activeConnectionIds.clear();
    this.conversations.clear();
    this.rateLimitMap.clear();
    this.onlineDoctors.clear();

    if (this.wss) {
      this.wss.close();
    }

    logger.info('WebSocket server shut down');
  }
}

// 导出单例
export const wsManager = new WebSocketManager();
