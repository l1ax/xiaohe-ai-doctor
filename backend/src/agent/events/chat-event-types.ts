import { UserIntent } from '../types';

// ============ 状态定义 ============

export type ConversationStatus =
  | 'idle'           // 空闲
  | 'sending'        // 消息发送中
  | 'processing'     // AI 处理中
  | 'streaming'      // 内容流输出
  | 'complete'       // 完成
  | 'error'          // 错误
  | 'closed';        // 关闭

export type MessageStatus =
  | 'pending'        // 待发送
  | 'sending'        // 发送中
  | 'streaming'      // 流式输出
  | 'complete'       // 完成
  | 'failed';        // 失败

export type ToolStatus =
  | 'pending'        // 等待执行
  | 'running'        // 执行中
  | 'completed'      // 完成
  | 'failed';        // 失败

// ============ 基础事件接口 ============

export interface BaseEvent {
  eventId: string;      // 每个 SSE 事件的唯一 ID
  type: string;
  data: {
    conversationId: string;
    timestamp: string;
  };
}

// ============ 事件定义 ============

// 对话状态事件
export interface ConversationStatusEvent extends BaseEvent {
  type: 'conversation:status';
  data: BaseEvent['data'] & {
    status: ConversationStatus;
    previousStatus?: ConversationStatus;
    message?: string;
    reason?: string;
  };
}

// 消息状态事件
export interface MessageStatusEvent extends BaseEvent {
  type: 'message:status';
  data: BaseEvent['data'] & {
    messageId: string;
    status: MessageStatus;
    role: 'user' | 'assistant';
  };
}

// 消息内容事件（流式）
export interface MessageContentEvent extends BaseEvent {
  type: 'message:content';
  data: BaseEvent['data'] & {
    messageId: string;
    delta: string;
    index: number;
    isFirst: boolean;
    isLast: boolean;
  };
}

// 消息元数据事件
export interface MessageMetadataEvent extends BaseEvent {
  type: 'message:metadata';
  data: BaseEvent['data'] & {
    messageId: string;
    sources?: Array<{
      title: string;
      url: string;
      snippet: string;
    }>;
    actions?: Array<{
      type: 'transfer_to_doctor' | 'view_more' | 'book_appointment' | 'retry' | 'cancel';
      label: string;
      data?: Record<string, any>;
    }>;
    medicalAdvice?: {
      symptoms: string[];
      possibleConditions: string[];
      suggestions: string[];
      urgencyLevel: 'low' | 'medium' | 'high';
    };
    toolsUsed?: string[];  // 使用的工具列表
  };
}

// 工具调用事件
export interface ToolCallEvent extends BaseEvent {
  type: 'tool:call';
  data: BaseEvent['data'] & {
    toolId: string;
    toolName: string;
    messageId: string;
    status: ToolStatus;
    input?: Record<string, any>;
    output?: Record<string, any>;
    error?: string;
    duration?: number;
    iteration?: number;
  };
}

// 错误事件
export interface ErrorEvent extends BaseEvent {
  type: 'error';
  data: BaseEvent['data'] & {
    messageId?: string;
    code: string;
    message: string;
    recoverable: boolean;
    suggestion?: string;
  };
}

// 会话结束事件
export interface ConversationEndEvent extends BaseEvent {
  type: 'conversation:end';
  data: BaseEvent['data'] & {
    messageId: string;
    duration: number;
    messageCount: number;
  };
}

// 统一事件类型
export type ChatEvent =
  | ConversationStatusEvent
  | MessageStatusEvent
  | MessageContentEvent
  | MessageMetadataEvent
  | ToolCallEvent
  | ErrorEvent
  | ConversationEndEvent;

// ============ 事件工厂函数 ============

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createConversationStatusEvent(
  conversationId: string,
  status: ConversationStatus,
  options?: { previousStatus?: ConversationStatus; message?: string; reason?: string }
): ConversationStatusEvent {
  return {
    eventId: generateEventId(),
    type: 'conversation:status',
    data: {
      conversationId,
      status,
      timestamp: new Date().toISOString(),
      ...options,
    },
  };
}

export function createMessageStatusEvent(
  conversationId: string,
  messageId: string,
  status: MessageStatus,
  role: 'user' | 'assistant'
): MessageStatusEvent {
  return {
    eventId: generateEventId(),
    type: 'message:status',
    data: {
      conversationId,
      messageId,
      status,
      role,
      timestamp: new Date().toISOString(),
    },
  };
}

export function createMessageContentEvent(
  conversationId: string,
  messageId: string,
  delta: string,
  index: number,
  isFirst: boolean,
  isLast: boolean
): MessageContentEvent {
  return {
    eventId: generateEventId(),
    type: 'message:content',
    data: {
      conversationId,
      messageId,
      delta,
      index,
      isFirst,
      isLast,
      timestamp: new Date().toISOString(),
    },
  };
}

export function createMessageMetadataEvent(
  conversationId: string,
  messageId: string,
  sources?: Array<{ title: string; url: string; snippet: string }>,
  actions?: Array<{
    type: 'transfer_to_doctor' | 'view_more' | 'book_appointment' | 'retry' | 'cancel';
    label: string;
    data?: Record<string, any>;
  }>,
  medicalAdvice?: {
    symptoms: string[];
    possibleConditions: string[];
    suggestions: string[];
    urgencyLevel: 'low' | 'medium' | 'high';
  },
  toolsUsed?: string[]
): MessageMetadataEvent {
  return {
    eventId: generateEventId(),
    type: 'message:metadata',
    data: {
      conversationId,
      messageId,
      sources,
      actions,
      medicalAdvice,
      toolsUsed,
      timestamp: new Date().toISOString(),
    },
  };
}

export function createToolCallEvent(
  conversationId: string,
  toolId: string,
  toolName: string,
  messageId: string,
  status: ToolStatus,
  options?: { input?: Record<string, any>; output?: Record<string, any>; error?: string; duration?: number; iteration?: number }
): ToolCallEvent {
  return {
    eventId: generateEventId(),
    type: 'tool:call',
    data: {
      conversationId,
      toolId,
      toolName,
      messageId,
      status,
      timestamp: new Date().toISOString(),
      ...options,
    },
  };
}

export function createErrorEvent(
  conversationId: string,
  code: string,
  message: string,
  options?: { messageId?: string; recoverable?: boolean; suggestion?: string }
): ErrorEvent {
  return {
    eventId: generateEventId(),
    type: 'error',
    data: {
      conversationId,
      code,
      message,
      timestamp: new Date().toISOString(),
      recoverable: options?.recoverable ?? true,
      ...options,
    },
  };
}

export function createConversationEndEvent(
  conversationId: string,
  messageId: string,
  duration: number,
  messageCount: number
): ConversationEndEvent {
  return {
    eventId: generateEventId(),
    type: 'conversation:end',
    data: {
      conversationId,
      messageId,
      duration,
      messageCount,
      timestamp: new Date().toISOString(),
    },
  };
}
