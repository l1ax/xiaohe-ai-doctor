import { WebSocket } from 'ws';

/**
 * WebSocket 消息类型
 */
export enum WSMessageType {
  MESSAGE = 'message',
  TYPING = 'typing',
  READ = 'read',
  HEARTBEAT = 'heartbeat',
  SYSTEM = 'system',
  JOIN = 'join',
  LEAVE = 'leave',
  CONSULTATION_UPDATE = 'consultation_update',
  NEW_CONSULTATION = 'new_consultation',
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
 * 问诊更新消息数据
 */
export interface ConsultationUpdateData {
  id: string;
  status: 'pending' | 'active' | 'closed' | 'cancelled';
  lastMessage: string;
  lastMessageTime: string;
  updatedAt: string;
}

/**
 * 新问诊消息数据
 */
export interface NewConsultationData {
  id: string;
  patientId: string;
  patientPhone: string;
  status: 'pending';
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
    consultation?: ConsultationUpdateData | NewConsultationData;
  };
  consultation?: ConsultationUpdateData | NewConsultationData;
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
