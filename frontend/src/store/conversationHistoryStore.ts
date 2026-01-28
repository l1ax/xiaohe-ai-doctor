/**
 * Conversation History Store
 *
 * MobX store for managing conversation history list
 */

import { makeAutoObservable, runInAction } from 'mobx';
import { userStore } from './userStore';

export interface ConversationSummary {
  id: string;
  type: 'ai' | 'doctor';
  title: string | null;
  lastMessage: string | null;
  status: 'active' | 'closed';
  createdAt: string;
  updatedAt: string;
}

class ConversationHistoryStore {
  conversations: ConversationSummary[] = [];
  isLoading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  /**
   * Fetch conversations from API
   */
  async fetchConversations(limit = 20, offset = 0): Promise<void> {
    if (this.isLoading) return;

    this.isLoading = true;
    this.error = null;

    try {
      const token = userStore.accessToken;
      if (!token) {
        throw new Error('未登录');
      }

      const response = await fetch(
        `/api/ai-chat/conversations?limit=${limit}&offset=${offset}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const result = await response.json();

      runInAction(() => {
        if (result.code === 'SUCCESS') {
          this.conversations = result.data || [];
        } else {
          this.error = result.message || '获取对话列表失败';
        }
        this.isLoading = false;
      });
    } catch (error) {
      runInAction(() => {
        this.error = error instanceof Error ? error.message : '获取对话列表失败';
        this.isLoading = false;
      });
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(id: string): Promise<boolean> {
    try {
      const token = userStore.accessToken;
      if (!token) {
        throw new Error('未登录');
      }

      const response = await fetch(`/api/ai-chat/conversations/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const result = await response.json();

      if (result.code === 'SUCCESS') {
        runInAction(() => {
          this.conversations = this.conversations.filter((c) => c.id !== id);
        });
        return true;
      }

      return false;
    } catch (error) {
      console.error('[ConversationHistoryStore] Delete failed:', error);
      return false;
    }
  }

  /**
   * Clear store
   */
  clear(): void {
    this.conversations = [];
    this.isLoading = false;
    this.error = null;
  }
}

export const conversationHistoryStore = new ConversationHistoryStore();
