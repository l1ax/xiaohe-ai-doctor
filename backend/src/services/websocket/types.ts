import { WebSocket } from 'ws';

/**
 * WebSocket 消息类型
 */
export enum WSMessageType {
  MESSAGE = 'message',
  TYPING = 'typing',
  // READ type is kept for future read receipt functionality
  READ = 'read',
  HEARTBEAT = 'heartbeat',
  SYSTEM = 'system',
}

/**
 * 消息内容类型
 */
export enum ContentType {
  TEXT = 'text',
  IMAGE = 'image',
  SYSTEM = 'system',
}

/**
 * 发送者类型
 */
export enum SenderType {
  PATIENT = 'patient',
  DOCTOR = 'doctor',
  SYSTEM = 'system',
}

/**
 * 客户端 → 服务端 消息格式
 */
export interface ClientMessage {
  type: WSMessageType;
  conversationId: string;
  data?: {
    content?: string;
    contentType?: ContentType;
    imageUrl?: string;
  };
}

/**
 * 服务端消息数据
 */
export interface ServerMessageData {
  id: string;
  senderId: string;
  senderType: SenderType;
  contentType: ContentType;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/**
 * 服务端 → 客户端 消息格式
 */
export interface ServerMessage {
  type: WSMessageType;
  conversationId: string;
  message?: ServerMessageData;
  data?: {
    text?: string;
    senderId?: string;
  };
}

/**
 * WebSocket 连接上下文
 */
export interface WSConnection {
  ws: WebSocket;
  userId: string;
  userRole: 'patient' | 'doctor';
  connectedAt: number;
  lastHeartbeat: number;
  isClosing: boolean; // Flag to prevent race conditions during connection close
}

/**
 * 会话信息
 */
export interface ConsultationInfo {
  id: string;
  patientId: string;
  doctorId: string;
  status: 'pending' | 'active' | 'closed';
  createdAt: string;
}
