/**
 * Conversation Repository
 *
 * 对话 CRUD 操作
 */

import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { Conversation, ConversationType, ConversationStatus } from './types';
import * as memoryStorage from './memoryStorage';
import { v4 as uuidv4 } from 'uuid';

export interface ConversationSummary {
  id: string;
  type: ConversationType;
  title: string | null;
  lastMessage: string | null;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConversationInput {
  id?: string;  // Optional: use existing ID instead of generating new one
  type: ConversationType;
  patientId: string;
  doctorId?: string;
  title?: string;
}

export class ConversationRepository {
  /**
   * 创建新对话
   */
  async create(input: CreateConversationInput): Promise<Conversation> {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: input.id || uuidv4(),  // Use provided ID or generate new one
      type: input.type,
      patient_id: input.patientId,
      doctor_id: input.doctorId,
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    if (!isSupabaseConfigured()) {
      console.log('[ConversationRepository] Using memory storage');
      memoryStorage.saveConversation(conversation);
      return conversation;
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('conversations')
      .insert({
        id: conversation.id,
        type: conversation.type,
        patient_id: conversation.patient_id,
        doctor_id: conversation.doctor_id,
        status: conversation.status,
      })
      .select()
      .single();

    if (error) {
      console.error('[ConversationRepository] Failed to create conversation:', error);
      throw new Error(`Failed to create conversation: ${error.message}`);
    }

    return {
      id: data.id,
      type: data.type,
      patient_id: data.patient_id,
      doctor_id: data.doctor_id,
      status: data.status,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  /**
   * 根据患者 ID 获取对话列表（分页）
   */
  async findByPatientId(
    patientId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<ConversationSummary[]> {
    if (!isSupabaseConfigured()) {
      console.log('[ConversationRepository] Using memory storage');
      const conversations = memoryStorage.getConversations(patientId);
      const paged = conversations.slice(offset, offset + limit);
      
      return paged.map(conv => {
        const messages = memoryStorage.getMessages(conv.id);
        const lastMsg = messages[messages.length - 1];
        const firstUserMsg = messages.find(m => m.sender_id !== 'assistant');
        const title = firstUserMsg 
          ? firstUserMsg.content.substring(0, 30) + (firstUserMsg.content.length > 30 ? '...' : '')
          : '新对话';
        
        return {
          id: conv.id,
          type: conv.type,
          title,
          lastMessage: lastMsg?.content || null,
          status: conv.status,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at,
        };
      });
    }

    const client = getSupabaseClient();

    // 获取对话列表，同时获取最新一条消息作为预览
    const { data: conversations, error } = await client
      .from('conversations')
      .select(`
        id,
        type,
        status,
        created_at,
        updated_at,
        messages (
          content,
          created_at
        )
      `)
      .eq('patient_id', patientId)
      .eq('type', 'ai')
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[ConversationRepository] Failed to fetch conversations:', error);
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }

    return (conversations || []).map((conv: any) => {
      // 获取最新消息作为预览
      const messages = conv.messages || [];
      const sortedMessages = messages.sort(
        (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastMessage = sortedMessages[0]?.content || null;

      // 从第一条消息生成标题（截取前 20 个字符）
      const firstUserMessage = messages.find((m: any) => m.sender_id !== 'assistant');
      const title = firstUserMessage
        ? firstUserMessage.content.substring(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '')
        : '新对话';

      return {
        id: conv.id,
        type: conv.type,
        title,
        lastMessage,
        status: conv.status,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
      };
    });
  }

  /**
   * 根据 ID 获取对话
   */
  async findById(id: string): Promise<Conversation | null> {
    if (!isSupabaseConfigured()) {
      console.log('[ConversationRepository] Using memory storage');
      return memoryStorage.getConversation(id);
    }

    const client = getSupabaseClient();
    const { data, error } = await client
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      console.error('[ConversationRepository] Failed to fetch conversation:', error);
      throw new Error(`Failed to fetch conversation: ${error.message}`);
    }

    return {
      id: data.id,
      type: data.type,
      patient_id: data.patient_id,
      doctor_id: data.doctor_id,
      status: data.status,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  /**
   * 更新对话的 updated_at 时间戳
   */
  async updateUpdatedAt(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      console.log('[ConversationRepository] Using memory storage');
      memoryStorage.touchConversation(id);
      return;
    }

    const client = getSupabaseClient();
    const { error } = await client
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[ConversationRepository] Failed to update conversation:', error);
      throw new Error(`Failed to update conversation: ${error.message}`);
    }
  }

  /**
   * 删除对话
   */
  async deleteById(id: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
      console.log('[ConversationRepository] Using memory storage');
      return memoryStorage.deleteConversation(id);
    }

    const client = getSupabaseClient();

    // 由于 messages 表有外键约束（ON DELETE CASCADE），删除对话会自动删除消息
    const { error } = await client.from('conversations').delete().eq('id', id);

    if (error) {
      console.error('[ConversationRepository] Failed to delete conversation:', error);
      throw new Error(`Failed to delete conversation: ${error.message}`);
    }

    return true;
  }
}

// 导出单例
export const conversationRepository = new ConversationRepository();
