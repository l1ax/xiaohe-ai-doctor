import { EventEmitter } from 'events';
import {
  ChatEvent,
  ConversationStatus,
  MessageStatus,
  ToolStatus,
  createConversationStatusEvent,
  createMessageStatusEvent,
  createMessageContentEvent,
  createMessageMetadataEvent,
  createToolCallEvent,
  createErrorEvent,
  createConversationEndEvent,
} from './chat-event-types';
import { logger } from '../../utils/logger';

interface ConversationContext {
  conversationId: string;
  currentStatus: ConversationStatus;
  messageId: string | null;
  toolCalls: Map<string, { name: string; status: ToolStatus }>;
  createdAt: Date;
  lastEventAt: Date;
}

interface MessageContext {
  messageId: string;
  role: 'user' | 'assistant';
  content: string;
  chunks: string[];
  status: MessageStatus;
  sources: any[];
  actions: any[];
  medicalAdvice: any | null;
}

export class EventStateMachine extends EventEmitter {
  private conversations: Map<string, ConversationContext> = new Map();
  private messages: Map<string, MessageContext> = new Map();

  constructor() {
    super();
    this.setupDefaultHandlers();
    logger.info('EventStateMachine initialized');
  }

  private setupDefaultHandlers(): void {
    this.on('conversation:status', this.handleConversationStatus.bind(this));
    this.on('message:status', this.handleMessageStatus.bind(this));
    this.on('message:content', this.handleMessageContent.bind(this));
    this.on('message:metadata', this.handleMessageMetadata.bind(this));
    this.on('tool:call', this.handleToolCall.bind(this));
    this.on('error', this.handleError.bind(this));
    this.on('conversation:end', this.handleConversationEnd.bind(this));
  }

  // ============ 状态转换验证 ============

  private isValidStatusTransition(
    from: ConversationStatus,
    to: ConversationStatus
  ): boolean {
    const validTransitions: Record<ConversationStatus, ConversationStatus[]> = {
      idle: ['sending', 'closed'],
      sending: ['processing', 'error', 'closed'],
      processing: ['streaming', 'error', 'closed'],
      streaming: ['complete', 'error', 'closed'],
      complete: ['idle', 'closed'],
      error: ['idle', 'closed'],
      closed: [],
    };
    return validTransitions[from]?.includes(to) ?? false;
  }

  private isValidMessageStatusTransition(
    from: MessageStatus,
    to: MessageStatus
  ): boolean {
    const validTransitions: Record<MessageStatus, MessageStatus[]> = {
      pending: ['sending', 'failed'],
      sending: ['streaming', 'failed'],
      streaming: ['complete', 'failed'],
      complete: [],
      failed: ['pending'],
    };
    return validTransitions[from]?.includes(to) ?? false;
  }

  // ============ 对话状态处理 ============

  private handleConversationStatus(event: ChatEvent): void {
    const conversationEvent = event as any;
    const { conversationId, status, previousStatus, reason } = conversationEvent.data;
    const context = this.conversations.get(conversationId);

    if (!context) {
      // 自动创建新会话上下文
      this.startConversation(conversationId);
    }

    const currentContext = this.conversations.get(conversationId);
    if (!currentContext) return;

    const fromStatus = currentContext.currentStatus;

    if (!this.isValidStatusTransition(fromStatus, status)) {
      logger.warn(`Invalid status transition: ${fromStatus} -> ${status}`, {
        conversationId,
        reason,
      });
      return;
    }

    currentContext.currentStatus = status;
    currentContext.lastEventAt = new Date();

    logger.info(`Conversation status: ${fromStatus} -> ${status}`, {
      conversationId,
      reason,
    });

    // 广播状态变更
    this.emit('statusChanged', { conversationId, fromStatus, toStatus: status });
  }

  // ============ 消息状态处理 ============

  private handleMessageStatus(event: ChatEvent): void {
    const messageEvent = event as any;
    const { conversationId, messageId, status, role } = messageEvent.data;

    let messageContext = this.messages.get(messageId);

    if (!messageContext && status !== 'sending') {
      // 创建新消息上下文
      messageContext = {
        messageId,
        role,
        content: '',
        chunks: [],
        status: 'pending',
        sources: [],
        actions: [],
        medicalAdvice: null,
      };
      this.messages.set(messageId, messageContext);
    }

    if (messageContext) {
      const previousStatus = messageContext.status;
      if (this.isValidMessageStatusTransition(previousStatus, status)) {
        messageContext.status = status;
        messageContext.role = role;

        logger.info(`Message status: ${previousStatus} -> ${status}`, {
          messageId,
          conversationId,
        });

        // 更新会话的最后消息 ID
        const context = this.conversations.get(conversationId);
        if (context) {
          context.messageId = messageId;
        }
      }
    }
  }

  private handleMessageContent(event: ChatEvent): void {
    const contentEvent = event as any;
    const { conversationId, messageId, delta, index, isLast } = contentEvent.data;

    let messageContext = this.messages.get(messageId);

    if (!messageContext) {
      messageContext = {
        messageId,
        role: 'assistant',
        content: '',
        chunks: [],
        status: 'streaming',
        sources: [],
        actions: [],
        medicalAdvice: null,
      };
      this.messages.set(messageId, messageContext);
    }

    messageContext.chunks.push(delta);
    messageContext.content += delta;

    if (isLast) {
      messageContext.status = 'complete';
      logger.info(`Message complete`, { messageId, conversationId });
    }
  }

  private handleMessageMetadata(event: ChatEvent): void {
    const metadataEvent = event as any;
    const { messageId, sources, actions, medicalAdvice } = metadataEvent.data;

    const messageContext = this.messages.get(messageId);
    if (messageContext) {
      if (sources) messageContext.sources = sources;
      if (actions) messageContext.actions = actions;
      if (medicalAdvice) messageContext.medicalAdvice = medicalAdvice;

      logger.info(`Message metadata updated`, {
        messageId,
        hasSources: !!sources?.length,
        hasActions: !!actions?.length,
        hasMedicalAdvice: !!medicalAdvice,
      });
    }
  }

  // ============ 工具调用处理 ============

  private handleToolCall(event: ChatEvent): void {
    const toolEvent = event as any;
    const { conversationId, toolId, toolName, status, input, output, error, duration } = toolEvent.data;

    const context = this.conversations.get(conversationId);
    if (context) {
      context.toolCalls.set(toolId, { name: toolName, status });

      logger.info(`Tool call ${status}`, {
        toolId,
        toolName,
        conversationId,
        duration,
      });

      // 完成或失败后 1 分钟清理
      if (status === 'completed' || status === 'failed') {
        setTimeout(() => {
          context.toolCalls.delete(toolId);
        }, 60000);
      }
    }

    this.emit('toolCallChanged', { toolId, toolName, status, input, output, error, duration });
  }

  // ============ 错误处理 ============

  private handleError(event: ChatEvent): void {
    const errorEvent = event as any;
    const { conversationId, messageId, code, message, recoverable, suggestion } = errorEvent.data;

    const context = this.conversations.get(conversationId);
    if (context) {
      context.currentStatus = 'error';

      logger.error(`Error in conversation: ${code} - ${message}`, {
        conversationId,
        messageId,
        recoverable,
        suggestion,
      });
    }

    this.emit('errorOccurred', { conversationId, messageId, code, message, recoverable, suggestion });
  }

  private handleConversationEnd(event: ChatEvent): void {
    const endEvent = event as any;
    const { conversationId, messageId, duration, messageCount } = endEvent.data;

    const context = this.conversations.get(conversationId);
    if (context) {
      context.currentStatus = 'complete';

      logger.info(`Conversation ended`, {
        conversationId,
        duration,
        messageCount,
      });

      // 30 分钟后清理会话数据
      setTimeout(() => {
        this.conversations.delete(conversationId);
        // 清理相关消息
        for (const [msgId, msg] of this.messages.entries()) {
          if (msg.content.includes(conversationId)) {
            this.messages.delete(msgId);
          }
        }
      }, 1800000);
    }

    this.emit('conversationEnded', { conversationId, duration, messageCount });
  }

  // ============ 公共方法 ============

  startConversation(conversationId: string): ConversationContext {
    const context: ConversationContext = {
      conversationId,
      currentStatus: 'idle',
      messageId: null,
      toolCalls: new Map(),
      createdAt: new Date(),
      lastEventAt: new Date(),
    };
    this.conversations.set(conversationId, context);
    logger.info(`Conversation started: ${conversationId}`);
    return context;
  }

  getConversation(conversationId: string): ConversationContext | undefined {
    return this.conversations.get(conversationId);
  }

  getMessage(messageId: string): MessageContext | undefined {
    return this.messages.get(messageId);
  }

  getAllMessages(conversationId: string): MessageContext[] {
    return Array.from(this.messages.values()).filter(
      (msg) => msg.content || msg.chunks.length > 0
    );
  }

  getActiveToolCalls(conversationId: string): Array<{ id: string; name: string; status: ToolStatus }> {
    const context = this.conversations.get(conversationId);
    if (!context) return [];

    return Array.from(context.toolCalls.entries()).map(([id, tool]) => ({
      id,
      name: tool.name,
      status: tool.status,
    }));
  }

  resetConversation(conversationId: string): void {
    const context = this.conversations.get(conversationId);
    if (context) {
      context.currentStatus = 'idle';
      context.toolCalls.clear();
      context.lastEventAt = new Date();
      logger.info(`Conversation reset: ${conversationId}`);
    }
  }

  closeConversation(conversationId: string): void {
    const context = this.conversations.get(conversationId);
    if (context) {
      context.currentStatus = 'closed';
      logger.info(`Conversation closed: ${conversationId}`);
    }
  }

  // 发送事件的便捷方法
  emitConversationStatus(conversationId: string, status: ConversationStatus, reason?: string): void {
    const context = this.conversations.get(conversationId);
    const previousStatus = context?.currentStatus;
    this.emit('conversation:status', createConversationStatusEvent(conversationId, status, { previousStatus, reason }));
  }

  emitMessageStatus(conversationId: string, messageId: string, status: MessageStatus, role: 'user' | 'assistant'): void {
    this.emit('message:status', createMessageStatusEvent(conversationId, messageId, status, role));
  }

  emitMessageContent(
    conversationId: string,
    messageId: string,
    delta: string,
    index: number,
    isFirst: boolean,
    isLast: boolean
  ): void {
    this.emit('message:content', createMessageContentEvent(conversationId, messageId, delta, index, isFirst, isLast));
  }

  emitToolCall(
    conversationId: string,
    toolId: string,
    toolName: string,
    messageId: string,
    status: ToolStatus,
    options?: { input?: Record<string, any>; output?: Record<string, any>; error?: string; duration?: number }
  ): void {
    this.emit('tool:call', createToolCallEvent(conversationId, toolId, toolName, messageId, status, options));
  }

  emitError(
    conversationId: string,
    code: string,
    message: string,
    options?: { messageId?: string; recoverable?: boolean; suggestion?: string }
  ): void {
    this.emit('error', createErrorEvent(conversationId, code, message, options));
  }
}

export const eventStateMachine = new EventStateMachine();
