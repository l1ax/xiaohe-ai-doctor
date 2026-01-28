import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAgent } from '../agent';
import { AgentEventEmitter, globalAgentEventEmitter } from '../agent/events/AgentEventEmitter';
import { SSEHandler } from '../services/streaming/SSEHandler';
import { MessageWriter } from '../services/database/MessageWriter';
import { conversationRepository } from '../services/database/ConversationRepository';
import { messageRepository } from '../services/database/MessageRepository';
import { Message } from '../agent/types';
import { logger } from '../utils/logger';
import { ValidationError, LLMError, NotFoundError } from '../utils/errorHandler';

export class AIChatController {
  private sseHandler: SSEHandler;
  private messageWriter: MessageWriter;
  private globalEmitter: AgentEventEmitter;

  constructor() {
    this.globalEmitter = globalAgentEventEmitter;
    this.sseHandler = SSEHandler.getInstance({
      heartbeatInterval: 30000,
      timeout: 60000,
      retryDelay: 1000,
    });
    this.messageWriter = new MessageWriter(this.globalEmitter, {
      enabled: true,
      batch: {
        maxSize: 10,
        flushInterval: 5000,
      },
    });
    this.sseHandler.startEventListener();
    logger.info('AIChatController initialized');
  }

  /**
   * Stream chat endpoint using SSE
   */
  async streamChat(req: Request, res: Response): Promise<void> {
    const { message, conversationId, imageUrls } = req.body;

    if (!message || typeof message !== 'string') {
      throw new ValidationError('Message is required and must be a string');
    }

    if (message.length > 5000) {
      throw new ValidationError('Message must not exceed 5000 characters');
    }

    if (imageUrls !== undefined) {
      if (!Array.isArray(imageUrls)) {
        throw new ValidationError('imageUrls must be an array');
      }

      if (imageUrls.length > 1) {
        throw new ValidationError('Currently only 1 image is supported');
      }

      for (const url of imageUrls) {
        if (typeof url !== 'string') {
          throw new ValidationError('Invalid image URL format');
        }
        
        try {
          const urlObj = new URL(url);
          if (!['http:', 'https:'].includes(urlObj.protocol)) {
            throw new ValidationError('Invalid image URL format');
          }
        } catch {
          throw new ValidationError('Invalid image URL format');
        }
      }
    }

    const conversationIdStr = conversationId || `conv_${Date.now()}`;
    const userId = (req as any).user?.userId || 'anonymous';

    logger.info('Stream chat request received', { 
      conversationId: conversationIdStr, 
      messageLength: message.length,
      imageCount: imageUrls?.length || 0,
    });

    // 立即创建对话和保存用户消息（在 Agent 执行之前）
    // 这样用户切换会话时也能看到历史记录
    try {
      // 检查对话是否已存在
      const existingConversation = await conversationRepository.findById(conversationIdStr);
      if (!existingConversation) {
        // 创建新对话
        await conversationRepository.create({
          id: conversationIdStr,
          type: 'ai',
          patientId: userId,
        });
        logger.info('Conversation created', { conversationId: conversationIdStr, userId });
      }

      // 保存用户消息
      await messageRepository.create({
        conversationId: conversationIdStr,
        senderId: userId,
        contentType: 'text',
        content: message,
      });
      logger.info('User message saved', { conversationId: conversationIdStr });
    } catch (error) {
      logger.error('Failed to save conversation/message', error);
      // 不阻塞 Agent 执行，继续处理
    }

    const sessionEmitter = new AgentEventEmitter();

    const eventForwarder = (event: any) => {
      const eventWithConversationId = {
        ...event,
        data: {
          ...event.data,
          conversationId: conversationIdStr,
        },
      };
      this.globalEmitter.emit(event.type, eventWithConversationId);
    };
    sessionEmitter.on('*', eventForwarder);

    const executeAgent = async () => {
      try {
        this.sseHandler.handleConnection(req, res, conversationIdStr);

        const messages: Message[] = [
          {
            role: 'user',
            content: message,
            imageUrls,
          }
        ];

        logger.agent('Starting agent execution', { conversationId: conversationIdStr });

        this.sseHandler.sendToConversation(conversationIdStr, {
          type: 'conversation_status',
          data: {
            conversationId: conversationIdStr,
            status: 'starting',
            message: '正在启动 AI 助手...',
            timestamp: new Date().toISOString(),
          },
        });

        await runAgent({
          messages,
          conversationId: conversationIdStr,
          eventEmitter: sessionEmitter,
          userId: (req as any).user?.userId || 'anonymous',
        });

        logger.agent('Agent execution completed', { conversationId: conversationIdStr });

        // 标准 SSE 流式传输模式：
        // 1. Agent 执行完成，conversation:end 事件已由 finalResponse 节点发送
        // 2. 等待足够时间让前端接收并处理所有事件
        // 3. 后端关闭连接（前端收到 DONE 事件后也可以主动关闭）

        await new Promise(r => setTimeout(r, 500)); // 增加延迟确保所有事件都被前端接收
        this.sseHandler.closeConnectionByConversation(conversationIdStr);

      } catch (error: any) {
        logger.error('Agent execution failed', error, { conversationId: conversationIdStr });

        const isLLMError = error instanceof LLMError ||
                          error.name === 'LLMError' ||
                          error.code === 'LLM_ERROR';

        if (isLLMError) {
          throw new LLMError(error.message || 'LLM service error', error);
        }

        const errorData = {
          type: 'agent:error',
          data: {
            error: error.message || 'Unknown error',
            code: 'AGENT_ERROR',
            timestamp: new Date().toISOString(),
            conversationId: conversationIdStr,
          },
        };

        this.sseHandler.sendToConversation(conversationIdStr, {
          type: 'error',
          data: errorData.data,
        });

        this.globalEmitter.emit('agent:error', errorData);
        throw error;
      } finally {
        sessionEmitter.removeListener('*', eventForwarder);
      }
    };

    return executeAgent();
  }

  /**
   * Create a new conversation
   * C3: Removed try-catch to let errors propagate to error handler middleware
   * All error responses now use standard { code, message, data } format
   */
  async createConversation(req: Request, res: Response): Promise<void> {
    const { type = 'ai_consultation', patientId, doctorId } = req.body;

    if (!patientId) {
      throw new ValidationError('Patient ID is required');
    }

    const conversation = this.messageWriter.createConversation(
      type,
      patientId,
      doctorId
    );

    logger.info('Conversation created', { conversationId: conversation.id, patientId });

    res.status(201).json({
      code: 'SUCCESS',
      message: 'Conversation created successfully',
      data: conversation,
    });
  }

  /**
   * Get messages for a conversation
   * C3: Removed try-catch to let errors propagate to error handler middleware
   * All error responses now use standard { code, message, data } format
   */
  async getMessages(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    if (!id) {
      throw new ValidationError('Conversation ID is required');
    }

    const conversationId = Array.isArray(id) ? id[0] : id;
    const messages = await this.messageWriter.getMessages(conversationId);

    logger.info('Messages retrieved', { conversationId, count: messages.length });

    res.status(200).json({
      code: 'SUCCESS',
      message: 'Messages retrieved successfully',
      data: messages,
    });
  }

  /**
   * List conversations for the current user
   */
  async listConversations(req: Request, res: Response): Promise<void> {
    // Get user ID from auth middleware
    const userId = (req as any).user?.userId;
    
    if (!userId) {
      throw new ValidationError('User not authenticated');
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const conversations = await conversationRepository.findByPatientId(userId, limit, offset);

    logger.info('Conversations listed', { userId, count: conversations.length });

    res.status(200).json({
      code: 'SUCCESS',
      message: 'Conversations retrieved successfully',
      data: conversations,
    });
  }

  /**
   * Get conversation with messages
   */
  async getConversationWithMessages(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    if (!id) {
      throw new ValidationError('Conversation ID is required');
    }

    const conversationId = Array.isArray(id) ? id[0] : id;
    
    // Get conversation
    const conversation = await conversationRepository.findById(conversationId);
    
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // Verify ownership
    if (conversation.patient_id !== userId) {
      throw new ValidationError('Access denied');
    }

    // Get messages
    const messages = await messageRepository.findByConversationId(conversationId, 100);

    logger.info('Conversation retrieved', { conversationId, messageCount: messages.length });

    res.status(200).json({
      code: 'SUCCESS',
      message: 'Conversation retrieved successfully',
      data: {
        conversation,
        messages,
      },
    });
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    if (!id) {
      throw new ValidationError('Conversation ID is required');
    }

    const conversationId = Array.isArray(id) ? id[0] : id;
    
    // Get conversation to verify ownership
    const conversation = await conversationRepository.findById(conversationId);
    
    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // Verify ownership
    if (conversation.patient_id !== userId) {
      throw new ValidationError('Access denied');
    }

    // Delete conversation (messages will be deleted via CASCADE)
    await conversationRepository.deleteById(conversationId);

    logger.info('Conversation deleted', { conversationId, userId });

    res.status(200).json({
      code: 'SUCCESS',
      message: 'Conversation deleted successfully',
      data: null,
    });
  }

  /**
   * Shutdown the controller and cleanup resources
   */
  shutdown(): void {
    logger.info('Shutting down AIChatController');
    this.sseHandler.closeAllConnections();
    this.messageWriter.stop();
    logger.info('AIChatController shutdown complete');
  }
}

export const aiChatController = new AIChatController();
