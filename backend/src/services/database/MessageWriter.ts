import { v4 as uuidv4 } from 'uuid';
import { AgentEventEmitter } from '../../agent/events/AgentEventEmitter';
import {
  MessageType,
  ConversationType,
  ConversationStatus,
  MessageMetadata,
  Conversation,
  Message,
  WriterConfig,
  UserIntent,
} from './types';
import type { AgentEvent } from '../../agent/events/types';
import { messageRepository, MessageRepository } from './MessageRepository';
import { conversationRepository, ConversationRepository } from './ConversationRepository';
import { isSupabaseConfigured } from './supabaseClient';

export class MessageWriter {
  private eventEmitter: AgentEventEmitter;
  private config: WriterConfig;
  private messageBuffer: Map<string, Partial<Message>[]>;
  private conversationMetadata: Map<string, MessageMetadata>;
  private userMessages: Map<string, Partial<Message>>;
  private flushTimer?: NodeJS.Timeout;
  // Fix I2: Use Map to track current conversationId per active session
  private activeConversations: Map<string, string> = new Map();
  // Fix I3: Store listener references to remove only specific listeners
  private listenerRefs: Map<string, (event: AgentEvent) => void> = new Map();
  private flushedConversations: Set<string> = new Set();

  constructor(eventEmitter: AgentEventEmitter, config: WriterConfig) {
    this.eventEmitter = eventEmitter;
    this.config = config;
    this.messageBuffer = new Map();
    this.conversationMetadata = new Map();
    this.userMessages = new Map();

    if (this.config.enabled) {
      this.setupEventListeners();
      this.setupBatchFlush();
    }
  }

  private setupEventListeners(): void {
    // Fix I3: Store listener references for proper cleanup
    this.listenerRefs.set('agent:intent', this.handleIntentEvent.bind(this));
    this.listenerRefs.set('agent:content', this.handleContentEvent.bind(this));
    this.listenerRefs.set('agent:metadata', this.handleMetadataEvent.bind(this));
    this.listenerRefs.set('agent:done', this.handleDoneEvent.bind(this));
    this.listenerRefs.set('agent:error', this.handleErrorEvent.bind(this));

    // Use stored listener references
    this.eventEmitter.on('agent:intent', this.listenerRefs.get('agent:intent')!);
    this.eventEmitter.on('agent:content', this.listenerRefs.get('agent:content')!);
    this.eventEmitter.on('agent:metadata', this.listenerRefs.get('agent:metadata')!);
    this.eventEmitter.on('agent:done', this.listenerRefs.get('agent:done')!);
    this.eventEmitter.on('agent:error', this.listenerRefs.get('agent:error')!);
  }

  private setupBatchFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushAllConversations();
    }, this.config.batch.flushInterval);
  }

  private handleIntentEvent(event: AgentEvent): void {
    if (event.type !== 'agent:intent') return;

    const { intent, entities } = event.data;
    const conversationId = entities.conversationId as string;
    const userMessage = entities.userMessage as string;

    if (!conversationId) {
      console.warn('[MessageWriter] No conversationId in intent event');
      return;
    }

    // Fix I2: Use Map to track active conversation per session
    // Use a unique session key if available, otherwise use conversationId
    const sessionKey = entities.sessionId as string || conversationId;
    this.activeConversations.set(sessionKey, conversationId);

    // Buffer the user message
    const partialMessage: Partial<Message> = {
      id: uuidv4(),
      conversation_id: conversationId,
      sender_id: entities.userId as string || 'patient',
      content_type: 'text' as MessageType,
      content: userMessage,
      created_at: new Date().toISOString(),
      metadata: {
        intent: intent as UserIntent,
      },
    };

    this.userMessages.set(conversationId, partialMessage);
    console.log(`[MessageWriter] Buffered user message for conversation ${conversationId}`);
  }

  private handleContentEvent(event: AgentEvent): void {
    if (event.type !== 'agent:content') return;

    const { delta } = event.data;
    // Fix I2: Extract conversationId from event data (added by controller)
    const conversationId = (event.data as any).conversationId as string | undefined;

    if (!conversationId) {
      console.warn('[MessageWriter] No conversationId in content event');
      return;
    }

    // Accumulate content in memory
    if (!this.messageBuffer.has(conversationId)) {
      this.messageBuffer.set(conversationId, []);
    }

    const messages = this.messageBuffer.get(conversationId)!;
    if (messages.length === 0) {
      // Create new assistant message
      messages.push({
        id: uuidv4(),
        conversation_id: conversationId,
        sender_id: 'assistant',
        content_type: 'text' as MessageType,
        content: delta,
        created_at: new Date().toISOString(),
      });
    } else {
      // Append to existing message
      const lastMessage = messages[messages.length - 1];
      lastMessage.content = (lastMessage.content || '') + delta;
    }
  }

  private handleMetadataEvent(event: AgentEvent): void {
    if (event.type !== 'agent:metadata') return;

    // Fix I2: Extract conversationId from event data (added by controller)
    const conversationId = (event.data as any).conversationId as string | undefined;

    if (!conversationId) {
      console.warn('[MessageWriter] No conversationId in metadata event');
      return;
    }

    const metadata: MessageMetadata = {
      sources: event.data.sources,
      medicalAdvice: event.data.medicalAdvice,
      actions: event.data.actions,
    };

    // Accumulate metadata in memory
    if (!this.conversationMetadata.has(conversationId)) {
      this.conversationMetadata.set(conversationId, {});
    }

    const existing = this.conversationMetadata.get(conversationId)!;
    this.conversationMetadata.set(conversationId, {
      ...existing,
      ...metadata,
    });
  }

  private handleDoneEvent(event: AgentEvent): void {
    if (event.type !== 'agent:done') return;

    const { conversationId } = event.data;

    if (!conversationId) {
      console.warn('[MessageWriter] No conversationId in done event');
      return;
    }

    // Flush the assistant message
    this.flushConversation(conversationId);

    // Fix I2: Clear from active conversations map
    this.activeConversations.delete(conversationId);
  }

  private handleErrorEvent(event: AgentEvent): void {
    if (event.type !== 'agent:error') return;

    const { error, code } = event.data;
    // Fix I2: Extract conversationId from event data (added by controller)
    const conversationId = (event.data as any).conversationId as string | undefined;

    console.error(`[MessageWriter] Agent error occurred: ${error}${code ? ` (code: ${code})` : ''}`);

    // Flush any pending messages for the specific conversation
    if (conversationId) {
      this.flushConversation(conversationId);
      this.activeConversations.delete(conversationId);
    }
  }

  /**
   * 确保对话存在，如果不存在则创建
   */
  private knownConversations: Set<string> = new Set();
  
  private async ensureConversationExists(conversationId: string, patientId: string): Promise<void> {
    // Skip if we already know this conversation exists
    if (this.knownConversations.has(conversationId)) {
      return;
    }

    // Check if conversation exists in storage
    const existing = await conversationRepository.findById(conversationId);
    if (existing) {
      this.knownConversations.add(conversationId);
      return;
    }

    // Create new conversation with the specified ID
    await conversationRepository.create({
      id: conversationId,
      type: 'ai',
      patientId: patientId,
    });
    console.log(`[MessageWriter] Created conversation ${conversationId} for patient ${patientId}`);
    this.knownConversations.add(conversationId);
  }

  private flushConversation(conversationId: string): void {
    // Avoid duplicate flushes
    if (this.flushedConversations.has(conversationId)) {
      console.log(`[MessageWriter] Skipping duplicate flush for ${conversationId}`);
      return;
    }

    // Mark as flushed early to prevent concurrent flushes
    this.flushedConversations.add(conversationId);

    // Get user message
    const userMessage = this.userMessages.get(conversationId);
    
    // Get assistant messages
    const messages = this.messageBuffer.get(conversationId) || [];
    const metadata = this.conversationMetadata.get(conversationId);

    console.log(`[MessageWriter] Flushing conversation ${conversationId}: ${messages.length} assistant message(s), userMessage: ${!!userMessage}`);
    if (messages.length > 0) {
      console.log(`[MessageWriter] First assistant message content length: ${messages[0]?.content?.length || 0} chars`);
    }

    // Clear buffers immediately
    this.userMessages.delete(conversationId);
    this.messageBuffer.delete(conversationId);
    this.conversationMetadata.delete(conversationId);

    // Save to database asynchronously (fire and forget with error logging)
    this.saveMessagesToDatabase(conversationId, userMessage, messages, metadata).catch((error) => {
      console.error(`[MessageWriter] Failed to save messages for conversation ${conversationId}:`, error);
    });
  }

  /**
   * 异步保存消息到数据库
   */
  private async saveMessagesToDatabase(
    conversationId: string,
    userMessage: Partial<Message> | undefined,
    assistantMessages: Partial<Message>[],
    metadata: MessageMetadata | undefined
  ): Promise<void> {
    // Note: Repository internally handles memory storage vs Supabase based on configuration
    // Note: User message is already saved in aiChatController.streamChat, so we only save assistant messages here

    try {
      // No need to ensure conversation exists - it's created in aiChatController.streamChat
      // No need to save user message - it's saved in aiChatController.streamChat

      // Save assistant messages
      for (const msg of assistantMessages) {
        if (msg.content) {
          await messageRepository.create({
            conversationId: msg.conversation_id!,
            senderId: msg.sender_id || 'assistant',
            contentType: msg.content_type || 'text',
            content: msg.content,
            metadata: metadata,
          });
        }
      }

      if (assistantMessages.length > 0) {
        console.log(`[MessageWriter] Saved ${assistantMessages.length} assistant message(s) for conversation ${conversationId}`);
      }

      // Update conversation updated_at
      await conversationRepository.updateUpdatedAt(conversationId);
    } catch (error) {
      console.error(`[MessageWriter] Database write error:`, error);
      throw error;
    }
  }

  private flushAllConversations(): void {
    const allIds = [
      ...this.userMessages.keys(),
      ...this.messageBuffer.keys(),
    ];

    const uniqueIds = new Set(allIds);
    uniqueIds.forEach((id) => {
      this.flushConversation(id);
    });
  }

  /**
   * Create a new conversation
   */
  createConversation(
    type: ConversationType,
    patientId: string,
    doctorId?: string
  ): Conversation {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: uuidv4(),
      type,
      patient_id: patientId,
      doctor_id: doctorId,
      status: 'active' as ConversationStatus,
      created_at: now,
      updated_at: now,
    };

    console.log(`[MessageWriter MVP] Would create conversation:`, JSON.stringify(conversation, null, 2));
    // TODO: Implement actual database write

    return conversation;
  }

  /**
   * Get all messages for a conversation
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    console.log(`[MessageWriter MVP] Would fetch messages for conversation ${conversationId}`);
    // TODO: Implement actual database query
    return [];
  }

  /**
   * Stop the writer and flush all pending messages
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Flush all pending messages
    this.flushAllConversations();

    // Fix I3: Remove only the listeners we added, not all listeners
    const intentListener = this.listenerRefs.get('agent:intent');
    const contentListener = this.listenerRefs.get('agent:content');
    const metadataListener = this.listenerRefs.get('agent:metadata');
    const doneListener = this.listenerRefs.get('agent:done');
    const errorListener = this.listenerRefs.get('agent:error');

    if (intentListener) {
      this.eventEmitter.removeListener('agent:intent', intentListener);
    }
    if (contentListener) {
      this.eventEmitter.removeListener('agent:content', contentListener);
    }
    if (metadataListener) {
      this.eventEmitter.removeListener('agent:metadata', metadataListener);
    }
    if (doneListener) {
      this.eventEmitter.removeListener('agent:done', doneListener);
    }
    if (errorListener) {
      this.eventEmitter.removeListener('agent:error', errorListener);
    }

    // Clear listener references
    this.listenerRefs.clear();

    console.log('[MessageWriter] Stopped and cleaned up');
  }
}
