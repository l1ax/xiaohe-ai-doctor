/**
 * Message Repository
 *
 * 消息 CRUD 操作
 */

import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { Message, MessageType, MessageMetadata } from './types';
import * as memoryStorage from './memoryStorage';
import { v4 as uuidv4 } from 'uuid';

export interface CreateMessageInput {
  conversationId: string;
  senderId: string;
  contentType: MessageType;
  content: string;
  metadata?: MessageMetadata;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  senderId: string;
  contentType: MessageType;
  content: string;
  metadata?: MessageMetadata;
  createdAt: string;
}

export class MessageRepository {
  /**
   * 创建消息
   */
  async create(input: CreateMessageInput): Promise<MessageRecord> {
    const now = new Date().toISOString();
    const message: MessageRecord = {
      id: uuidv4(),
      conversationId: input.conversationId,
      senderId: input.senderId,
      contentType: input.contentType,
      content: input.content,
      metadata: input.metadata,
      createdAt: now,
    };

    if (!isSupabaseConfigured()) {
      console.log('[MessageRepository] Using memory storage');
      // Convert to storage format (snake_case)
      const storageMessage: Message = {
        id: message.id,
        conversation_id: message.conversationId,
        sender_id: message.senderId,
        content_type: message.contentType,
        content: message.content,
        metadata: message.metadata,
        created_at: message.createdAt,
      };
      memoryStorage.addMessage(storageMessage);
      return message;
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('messages')
      .insert({
        id: message.id,
        conversation_id: message.conversationId,
        sender_id: message.senderId,
        content_type: message.contentType,
        content: message.content,
        metadata: message.metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('[MessageRepository] Failed to create message:', error);
      throw new Error(`Failed to create message: ${error.message}`);
    }

    return {
      id: data.id,
      conversationId: data.conversation_id,
      senderId: data.sender_id,
      contentType: data.content_type,
      content: data.content,
      metadata: data.metadata,
      createdAt: data.created_at,
    };
  }

  /**
   * 批量创建消息
   */
  async createMany(inputs: CreateMessageInput[]): Promise<MessageRecord[]> {
    if (inputs.length === 0) return [];

    const now = new Date().toISOString();
    const messages: MessageRecord[] = inputs.map((input) => ({
      id: uuidv4(),
      conversationId: input.conversationId,
      senderId: input.senderId,
      contentType: input.contentType,
      content: input.content,
      metadata: input.metadata,
      createdAt: now,
    }));

    if (!isSupabaseConfigured()) {
      console.log('[MessageRepository] Using memory storage');
      // Convert to storage format and add
      const storageMessages = messages.map(m => ({
        id: m.id,
        conversation_id: m.conversationId,
        sender_id: m.senderId,
        content_type: m.contentType,
        content: m.content,
        metadata: m.metadata,
        created_at: m.createdAt,
      }));
      memoryStorage.addMessages(storageMessages);
      return messages;
    }

    const client = getSupabaseClient();
    const insertData = messages.map((m) => ({
      id: m.id,
      conversation_id: m.conversationId,
      sender_id: m.senderId,
      content_type: m.contentType,
      content: m.content,
      metadata: m.metadata || {},
    }));

    const { data, error } = await client.from('messages').insert(insertData).select();

    if (error) {
      console.error('[MessageRepository] Failed to create messages:', error);
      throw new Error(`Failed to create messages: ${error.message}`);
    }

    return (data || []).map((d: any) => ({
      id: d.id,
      conversationId: d.conversation_id,
      senderId: d.sender_id,
      contentType: d.content_type,
      content: d.content,
      metadata: d.metadata,
      createdAt: d.created_at,
    }));
  }

  /**
   * 获取对话的所有消息
   */
  async findByConversationId(
    conversationId: string,
    limit: number = 50
  ): Promise<MessageRecord[]> {
    if (!isSupabaseConfigured()) {
      console.log('[MessageRepository] Using memory storage');
      const messages = memoryStorage.getMessages(conversationId)
        .slice(0, limit)
        .map(m => ({
          id: m.id,
          conversationId: m.conversation_id,
          senderId: m.sender_id,
          contentType: m.content_type as MessageType,
          content: m.content,
          metadata: m.metadata,
          createdAt: m.created_at,
        }));
      return messages;
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[MessageRepository] Failed to fetch messages:', error);
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    return (data || []).map((d: any) => ({
      id: d.id,
      conversationId: d.conversation_id,
      senderId: d.sender_id,
      contentType: d.content_type,
      content: d.content,
      metadata: d.metadata,
      createdAt: d.created_at,
    }));
  }

  /**
   * 删除对话的所有消息
   */
  async deleteByConversationId(conversationId: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.log('[MessageRepository] Supabase not configured, returning true');
      return true;
    }

    const client = getSupabaseClient();
    const { error } = await client
      .from('messages')
      .delete()
      .eq('conversation_id', conversationId);

    if (error) {
      console.error('[MessageRepository] Failed to delete messages:', error);
      throw new Error(`Failed to delete messages: ${error.message}`);
    }

    return true;
  }
}

// 导出单例
export const messageRepository = new MessageRepository();
