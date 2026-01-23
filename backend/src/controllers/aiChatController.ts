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
    // Validate query parameters are strings, not arrays (I1)
    const messageQuery = req.query.message;
    const conversationIdQuery = req.query.conversationId;

    if (!messageQuery) {
      throw new ValidationError('Message is required');
    }

    // I1: Ensure message is a string, not an array
    // After String() conversion, the value is always a string, so no need to check type again
    const messageStr = String(Array.isArray(messageQuery) ? messageQuery[0] : messageQuery);

    // Validate message max 5000 chars
    if (messageStr.length > 5000) {
      throw new ValidationError('Message must not exceed 5000 characters');
    }

    const conversationId = conversationIdQuery
      ? (Array.isArray(conversationIdQuery) ? conversationIdQuery[0] : conversationIdQuery)
      : `conv_${Date.now()}`;

    // Ensure conversationId is a string
    const conversationIdStr = String(conversationId);

    logger.info('Stream chat request received', { conversationId: conversationIdStr, messageLength: messageStr.length });

    // Create session-specific event emitter for this request
    const sessionEmitter = new AgentEventEmitter();

    // Forward session events to global emitter - store listener reference (C1)
    const eventForwarder = (event: any) => {
      // Attach conversationId to all events for proper routing (C2)
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

      // Prepare messages
      const messages: Message[] = [
        { role: 'user', content: messageStr }
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

      // I2: Improve LLM error detection using error instance/name checks
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

      // Send error to SSE client before global emitter (C3)
      this.sseHandler.sendToConversation(conversationIdStr, {
        type: 'error',
        data: errorData.data,
      });

      this.globalEmitter.emit('agent:error', errorData);
    } finally {
      // Cleanup session emitter and its listeners (C1)
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
