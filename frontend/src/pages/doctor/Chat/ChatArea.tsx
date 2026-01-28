/**
 * 医生端聊天页面 - 消息列表区域组件
 */

import React, { useEffect, useRef } from 'react';
import { User, Stethoscope } from 'lucide-react';
import { ChatMessage } from './types';

interface ChatAreaProps {
  messages: ChatMessage[];
  currentUserId: string;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ messages, currentUserId }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}小时前`;
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
          <Stethoscope className="w-10 h-10" />
        </div>
        <p className="text-sm">开始与患者交流</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-slate-50 dark:bg-slate-900">
      {messages.map((message) => {
        const isOwnMessage = message.senderId === currentUserId;

        return (
          <div
            key={message.id}
            className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* 头像 */}
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                isOwnMessage
                  ? 'bg-blue-500'
                  : 'bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600'
              }`}
            >
              {isOwnMessage ? (
                <Stethoscope className="w-5 h-5 text-white" />
              ) : (
                <User className="w-5 h-5 text-slate-400" />
              )}
            </div>

            {/* 消息内容 */}
            <div className={`flex flex-col max-w-[75%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
              {/* 消息气泡 */}
              <div
                className={`px-4 py-2.5 rounded-2xl shadow-sm ${
                  isOwnMessage
                    ? 'bg-blue-500 text-white rounded-tr-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-sm border border-slate-200 dark:border-slate-700'
                }`}
              >
                {message.contentType === 'text' ? (
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                    {message.content}
                  </p>
                ) : message.contentType === 'image' && message.imageUrl ? (
                  <img
                    src={message.imageUrl}
                    alt="图片消息"
                    className="max-w-full rounded-lg"
                  />
                ) : (
                  <p className="text-sm opacity-75">[不支持的消息类型]</p>
                )}
              </div>

              {/* 时间和已读状态 */}
              <div className={`flex items-center gap-1.5 mt-1 px-1 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}>
                <span className="text-[11px] text-slate-400">
                  {formatTime(message.createdAt)}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* 滚动锚点 */}
      <div ref={messagesEndRef} className="h-2" />
    </div>
  );
};
