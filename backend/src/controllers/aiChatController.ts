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
    const { message, conversationId = `conv_${Date.now()}` } = req.query;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    try {
      // Create session-specific event emitter for this request
      const sessionEmitter = new AgentEventEmitter();

      // Forward session events to global emitter
      sessionEmitter.on('*', (event) => {
        this.globalEmitter.emit(event.type, event);
      });

      // Handle SSE connection
      this.sseHandler.handleConnection(req, res, conversationId as string);

      // Prepare messages
      const messages: Message[] = [
        { role: 'user', content: message as string }
      ];

      // Run agent with session emitter
      await runAgent({
        messages,
        conversationId: conversationId as string,
        eventEmitter: sessionEmitter,
      });

    } catch (error: any) {
      console.error('[AIChatController] Agent error:', error);
      this.globalEmitter.emit('agent:error', {
        type: 'agent:error',
        data: {
          error: error.message || 'Unknown error',
          code: 'AGENT_ERROR',
          timestamp: new Date().toISOString(),
        },
      });
    } finally {
      // Cleanup session emitter
      // Note: sessionEmitter is local to try block, will be garbage collected
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
