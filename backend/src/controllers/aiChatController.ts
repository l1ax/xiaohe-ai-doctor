import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { runAgent } from '../agent';
import { AgentEventEmitter, globalAgentEventEmitter } from '../agent/events/AgentEventEmitter';
import { SSEHandler } from '../services/streaming/SSEHandler';
import { MessageWriter } from '../services/database/MessageWriter';
import { Message } from '../agent/types';

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
  }

  /**
   * Stream chat endpoint using SSE
   */
  async streamChat(req: Request, res: Response): Promise<void> {
    // Validate query parameters are strings, not arrays (I1)
    const messageQuery = req.query.message;
    const conversationIdQuery = req.query.conversationId;

    if (!messageQuery) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    // Ensure message is a string, not an array
    const messageStr = String(Array.isArray(messageQuery) ? messageQuery[0] : messageQuery);
    const conversationId = conversationIdQuery
      ? (Array.isArray(conversationIdQuery) ? conversationIdQuery[0] : conversationIdQuery)
      : `conv_${Date.now()}`;

    // Type guard to ensure conversationId is a string
    const conversationIdStr = String(conversationId);

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

      // Run agent with session emitter
      await runAgent({
        messages,
        conversationId: conversationIdStr,
        eventEmitter: sessionEmitter,
      });

    } catch (error: any) {
      console.error('[AIChatController] Agent error:', error);

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
   */
  async createConversation(req: Request, res: Response): Promise<void> {
    try {
      const { type = 'ai_consultation', patientId, doctorId } = req.body;

      if (!patientId) {
        res.status(400).json({ error: 'Patient ID is required' });
        return;
      }

      const conversation = this.messageWriter.createConversation(
        type,
        patientId,
        doctorId
      );

      res.status(201).json({
        success: true,
        data: conversation,
      });
    } catch (error: any) {
      console.error('Create conversation error:', error);
      res.status(500).json({
        error: 'Failed to create conversation',
        message: error.message,
      });
    }
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Conversation ID is required' });
        return;
      }

      const conversationId = Array.isArray(id) ? id[0] : id;
      const messages = await this.messageWriter.getMessages(conversationId);

      res.status(200).json({
        success: true,
        data: messages,
      });
    } catch (error: any) {
      console.error('Get messages error:', error);
      res.status(500).json({
        error: 'Failed to get messages',
        message: error.message,
      });
    }
  }

  /**
   * Shutdown the controller and cleanup resources
   */
  shutdown(): void {
    console.log('[AIChatController] Shutting down...');
    this.sseHandler.closeAllConnections();
    this.messageWriter.stop();
    console.log('[AIChatController] Shutdown complete');
  }
}

export const aiChatController = new AIChatController();
