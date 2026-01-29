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

/**
 * MessageWriter - 实时保存 Agent 消息
 * 
 * 保存策略：
 * - 收到第一个 message:content (isFirst=true) 时 → 创建消息记录
 * - 收到后续 message:content 时 → 更新消息内容
 * - 收到 tool:call 时 → 更新消息的 metadata.toolCalls
 * - 收到 message:metadata 时 → 更新消息的 metadata
 */
export class MessageWriter {
  private eventEmitter: AgentEventEmitter;
  private config: WriterConfig;
  
  // Track active messages: conversationId -> { messageId, content, metadata }
  private activeMessages: Map<string, {
    messageId: string;
    content: string;
    metadata: MessageMetadata;
    created: boolean; // Whether the DB record has been created
  }> = new Map();
  
  private listenerRefs: Map<string, (event: any) => void> = new Map();

  constructor(eventEmitter: AgentEventEmitter, config: WriterConfig) {
    this.eventEmitter = eventEmitter;
    this.config = config;

    if (this.config.enabled) {
      this.setupEventListeners();
    }
  }

  private setupEventListeners(): void {
    // Listen to the actual event types used by the agent
    this.listenerRefs.set('message:content', this.handleMessageContentEvent.bind(this));
    this.listenerRefs.set('message:metadata', this.handleMessageMetadataEvent.bind(this));
    this.listenerRefs.set('tool:call', this.handleToolCallEvent.bind(this));
    this.listenerRefs.set('conversation:end', this.handleConversationEndEvent.bind(this));

    this.eventEmitter.on('message:content' as any, this.listenerRefs.get('message:content')!);
    this.eventEmitter.on('message:metadata' as any, this.listenerRefs.get('message:metadata')!);
    this.eventEmitter.on('tool:call' as any, this.listenerRefs.get('tool:call')!);
    this.eventEmitter.on('conversation:end' as any, this.listenerRefs.get('conversation:end')!);

    console.log('[MessageWriter] Event listeners registered for real-time saving');
  }

  /**
   * Handle message:content events
   * - isFirst=true: Create new message record
   * - Subsequent: Update content
   */
  private handleMessageContentEvent(event: any): void {
    const { conversationId, messageId, delta, isFirst, isLast } = event.data || {};

    if (!conversationId || !messageId) {
      console.warn('[MessageWriter] Missing conversationId or messageId in message:content event');
      return;
    }

    let active = this.activeMessages.get(conversationId);

    if (isFirst || !active) {
      // Start a new message
      active = {
        messageId,
        content: delta || '',
        metadata: {},
        created: false,
      };
      this.activeMessages.set(conversationId, active);
      
      // Create the record immediately
      this.createMessageRecord(conversationId, active);
    } else {
      // Append content
      active.content += delta || '';
      
      // Update the record
      this.updateMessageContent(conversationId, active);
    }

    if (isLast) {
      console.log(`[MessageWriter] Message content complete for ${conversationId}, total length: ${active.content.length}`);
    }
  }

  /**
   * Handle message:metadata events - update metadata immediately
   */
  private handleMessageMetadataEvent(event: any): void {
    const { conversationId, sources, medicalAdvice, actions, toolsUsed } = event.data || {};

    if (!conversationId) {
      console.warn('[MessageWriter] Missing conversationId in message:metadata event');
      return;
    }

    const active = this.activeMessages.get(conversationId);
    if (!active) {
      console.warn(`[MessageWriter] No active message for conversation ${conversationId}`);
      return;
    }

    // Merge metadata
    if (sources) active.metadata.sources = sources;
    if (medicalAdvice) active.metadata.medicalAdvice = medicalAdvice;
    if (actions) active.metadata.actions = actions;

    // Update the record
    this.updateMessageMetadata(conversationId, active);
  }

  /**
   * Handle tool:call events - track tool calls in metadata
   */
  private handleToolCallEvent(event: any): void {
    const { conversationId, toolName, status, input, output, error } = event.data || {};

    if (!conversationId || !toolName) {
      console.warn('[MessageWriter] Missing conversationId or toolName in tool:call event');
      return;
    }

    const active = this.activeMessages.get(conversationId);
    if (!active) {
      // Tool call before content - create placeholder
      const newActive = {
        messageId: `msg_${Date.now()}`,
        content: '',
        metadata: { toolCalls: [] as any[] },
        created: false,
      };
      this.activeMessages.set(conversationId, newActive);
      this.addOrUpdateToolCall(newActive, toolName, status, input, output, error);
      return;
    }

    // Ensure toolCalls array exists
    if (!active.metadata.toolCalls) {
      active.metadata.toolCalls = [];
    }

    this.addOrUpdateToolCall(active, toolName, status, input, output, error);
    
    // Update the record if already created
    if (active.created) {
      this.updateMessageMetadata(conversationId, active);
    }
  }

  private addOrUpdateToolCall(
    active: { metadata: MessageMetadata },
    toolName: string,
    status: 'running' | 'completed' | 'failed',
    input?: any,
    output?: any,
    error?: string
  ): void {
    const toolCalls = active.metadata.toolCalls!;
    const existingIndex = toolCalls.findIndex(tc => tc.tool === toolName);

    if (existingIndex >= 0) {
      toolCalls[existingIndex] = {
        ...toolCalls[existingIndex],
        status,
        output: output !== undefined ? output : toolCalls[existingIndex].output,
        error: error !== undefined ? error : toolCalls[existingIndex].error,
      };
    } else {
      toolCalls.push({ tool: toolName, status, input, output, error });
    }

    console.log(`[MessageWriter] Tool call: ${toolName} (${status})`);
  }

  /**
   * Handle conversation:end events - clean up
   */
  private handleConversationEndEvent(event: any): void {
    const { conversationId } = event.data || {};

    if (!conversationId) {
      return;
    }

    console.log(`[MessageWriter] Conversation ended: ${conversationId}`);
    this.activeMessages.delete(conversationId);
  }

  /**
   * Create message record in database
   */
  private async createMessageRecord(
    conversationId: string,
    active: { messageId: string; content: string; metadata: MessageMetadata; created: boolean }
  ): Promise<void> {
    try {
      await messageRepository.createWithId(active.messageId, {
        conversationId,
        senderId: 'assistant',
        contentType: 'text',
        content: active.content,
        metadata: active.metadata,
      });
      active.created = true;
      await conversationRepository.updateUpdatedAt(conversationId);
      console.log(`[MessageWriter] ✅ Created message ${active.messageId} for conversation ${conversationId}`);
    } catch (error) {
      console.error(`[MessageWriter] Failed to create message:`, error);
    }
  }

  /**
   * Update message content in database
   */
  private async updateMessageContent(
    conversationId: string,
    active: { messageId: string; content: string; created: boolean }
  ): Promise<void> {
    if (!active.created) {
      // Create if not yet created
      await this.createMessageRecord(conversationId, active as any);
      return;
    }

    try {
      await messageRepository.update(active.messageId, { content: active.content });
    } catch (error) {
      console.error(`[MessageWriter] Failed to update content:`, error);
    }
  }

  /**
   * Update message metadata in database
   */
  private async updateMessageMetadata(
    conversationId: string,
    active: { messageId: string; metadata: MessageMetadata; created: boolean }
  ): Promise<void> {
    if (!active.created) {
      return; // Will be included when created
    }

    try {
      await messageRepository.update(active.messageId, { metadata: active.metadata });
      console.log(`[MessageWriter] Updated metadata for ${active.messageId}`);
    } catch (error) {
      console.error(`[MessageWriter] Failed to update metadata:`, error);
    }
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

    console.log(`[MessageWriter] Created conversation:`, conversation.id);
    return conversation;
  }

  /**
   * Get all messages for a conversation
   */
  async getMessages(conversationId: string): Promise<Message[]> {
    try {
      const records = await messageRepository.findByConversationId(conversationId);
      return records.map(r => ({
        id: r.id,
        conversation_id: r.conversationId,
        sender_id: r.senderId,
        content_type: r.contentType,
        content: r.content,
        metadata: r.metadata,
        created_at: r.createdAt,
      }));
    } catch (error) {
      console.error(`[MessageWriter] Failed to get messages:`, error);
      return [];
    }
  }

  /**
   * Stop the writer and clean up
   */
  stop(): void {
    for (const [eventType, listener] of this.listenerRefs) {
      this.eventEmitter.removeListener(eventType as any, listener);
    }
    this.listenerRefs.clear();
    this.activeMessages.clear();
    console.log('[MessageWriter] Stopped');
  }
}
