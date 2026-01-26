import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAgent } from '../agent';
import { AgentEventEmitter, globalAgentEventEmitter } from '../agent/events/AgentEventEmitter';
import { SSEHandler } from '../services/streaming/SSEHandler';
import { MessageWriter } from '../services/database/MessageWriter';
import { Message } from '../agent/types';
import { logger } from '../utils/logger';
import { ValidationError, LLMError } from '../utils/errorHandler';

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
    // 从 body 读取参数（改造前从 query 读取）
    const { message, conversationId, imageUrls } = req.body;

    // 验证 message
    if (!message || typeof message !== 'string') {
      throw new ValidationError('Message is required and must be a string');
    }

    // 验证 message 长度
    if (message.length > 5000) {
      throw new ValidationError('Message must not exceed 5000 characters');
    }

    // 验证 imageUrls（可选参数）
    if (imageUrls !== undefined) {
      if (!Array.isArray(imageUrls)) {
        throw new ValidationError('imageUrls must be an array');
      }

      if (imageUrls.length > 1) {
        throw new ValidationError('Currently only 1 image is supported');
      }

      // 验证每个 URL 格式
      for (const url of imageUrls) {
        if (typeof url !== 'string' || !url.startsWith('http')) {
          throw new ValidationError('Invalid image URL format');
        }
      }
    }

    const conversationIdStr = conversationId || `conv_${Date.now()}`;

    logger.info('Stream chat request received', { 
      conversationId: conversationIdStr, 
      messageLength: message.length,
      imageCount: imageUrls?.length || 0,
    });

    // 创建 session-specific event emitter
    const sessionEmitter = new AgentEventEmitter();

    // Forward session events to global emitter
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

    try {
      // Handle SSE connection
      this.sseHandler.handleConnection(req, res, conversationIdStr);

      // 构建消息（包含 imageUrls）
      const messages: Message[] = [
        { 
          role: 'user', 
          content: message,
          imageUrls,  // 传递给 Agent
        }
      ];

      logger.agent('Starting agent execution', { conversationId: conversationIdStr });

      // Run agent with session emitter
      await runAgent({
        messages,
        conversationId: conversationIdStr,
        eventEmitter: sessionEmitter,
      });

      logger.agent('Agent execution completed', { conversationId: conversationIdStr });

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
    } finally {
      // Cleanup session emitter
      sessionEmitter.removeListener('*', eventForwarder);
    }
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
