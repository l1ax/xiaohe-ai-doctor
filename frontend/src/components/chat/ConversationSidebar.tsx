/**
 * Conversation Sidebar Component
 *
 * 对话历史侧边栏，类似 ChatGPT 的对话列表
 */

import React, { useEffect, useCallback, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import {
  X,
  MessageSquarePlus,
  Trash2,
  MessageCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import {
  conversationHistoryStore,
  ConversationSummary,
} from '../../store/conversationHistoryStore';
import toast from 'react-hot-toast';

interface ConversationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onNewConversation: () => void;
  onSelectConversation: (conversationId: string) => void;
  currentConversationId?: string;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = observer(
  ({
    isOpen,
    onClose,
    onNewConversation,
    onSelectConversation,
    currentConversationId,
  }) => {
    const { conversations, isLoading, error } = conversationHistoryStore;
    const hasFetchedRef = useRef(false);

    // Fetch conversations on open
    useEffect(() => {
      if (isOpen && !hasFetchedRef.current) {
        hasFetchedRef.current = true;
        conversationHistoryStore.fetchConversations();
      }
      // Reset when closed so next open will fetch fresh data
      if (!isOpen) {
        hasFetchedRef.current = false;
      }
    }, [isOpen]);

    // Handle delete
    const handleDelete = useCallback(
      async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();

        if (!confirm('确定要删除这条对话吗？')) {
          return;
        }

        const success = await conversationHistoryStore.deleteConversation(id);
        if (success) {
          toast.success('对话已删除');
        } else {
          toast.error('删除失败');
        }
      },
      []
    );

    // Sort conversations by date groups
    const groupConversations = (
      items: ConversationSummary[]
    ): { label: string; conversations: ConversationSummary[] }[] => {
      const today: ConversationSummary[] = [];
      const yesterday: ConversationSummary[] = [];
      const thisWeek: ConversationSummary[] = [];
      const older: ConversationSummary[] = [];

      const now = new Date();
      const todayStart = new Date(now.setHours(0, 0, 0, 0));
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

      items.forEach((conv) => {
        const date = new Date(conv.updatedAt);
        if (date >= todayStart) {
          today.push(conv);
        } else if (date >= yesterdayStart) {
          yesterday.push(conv);
        } else if (date >= weekStart) {
          thisWeek.push(conv);
        } else {
          older.push(conv);
        }
      });

      const groups = [];
      if (today.length > 0) groups.push({ label: '今天', conversations: today });
      if (yesterday.length > 0)
        groups.push({ label: '昨天', conversations: yesterday });
      if (thisWeek.length > 0)
        groups.push({ label: '过去 7 天', conversations: thisWeek });
      if (older.length > 0) groups.push({ label: '更早', conversations: older });

      return groups;
    };

    const groups = groupConversations(conversations);

    return (
      <>
        {/* Backdrop */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 transition-opacity"
            onClick={onClose}
          />
        )}

        {/* Sidebar */}
        <div
          className={`fixed top-0 left-0 h-full w-80 bg-white dark:bg-slate-900 z-50 transform transition-transform duration-300 ease-in-out ${
            isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              对话历史
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="关闭"
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* New Conversation Button */}
          <div className="p-4">
            <button
              onClick={() => {
                onNewConversation();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition-colors"
            >
              <MessageSquarePlus className="w-5 h-5" />
              新建对话
            </button>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                <AlertCircle className="w-8 h-8 mb-2 text-red-400" />
                <p className="text-sm">{error}</p>
                <button
                  onClick={() => conversationHistoryStore.fetchConversations()}
                  className="mt-2 text-primary text-sm hover:underline"
                >
                  重试
                </button>
              </div>
            )}

            {!isLoading && !error && conversations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">暂无对话记录</p>
                <p className="text-xs mt-1">开始新对话来创建记录</p>
              </div>
            )}

            {!isLoading &&
              !error &&
              groups.map((group) => (
                <div key={group.label} className="mb-4">
                  {/* Group Label */}
                  <div className="flex items-center gap-2 px-2 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <Clock className="w-3 h-3" />
                    {group.label}
                  </div>

                  {/* Conversations */}
                  {group.conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => {
                        onSelectConversation(conv.id);
                        onClose();
                      }}
                      className={`group flex items-start gap-3 p-3 mx-1 rounded-lg cursor-pointer transition-colors ${
                        currentConversationId === conv.id
                          ? 'bg-primary/10 border border-primary/30'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {/* Icon */}
                      <div className="shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                        <MessageCircle className="w-4 h-4 text-slate-500" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                          {conv.title || '新对话'}
                        </p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {conv.lastMessage || '无消息'}
                        </p>
                      </div>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => handleDelete(e, conv.id)}
                        className="shrink-0 p-1.5 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                        aria-label="删除对话"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
          </div>
        </div>
      </>
    );
  }
);

export default ConversationSidebar;
