/**
 * 医生端聊天页面 - 输入框和快捷操作组件
 */

import React, { useState } from 'react';
import { Send, FileText, Calendar, CheckCircle, Image as ImageIcon } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  onCloseConsultation?: () => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onCloseConsultation,
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState('');

  // 快捷操作项
  const quickActions = [
    {
      icon: FileText,
      label: '查看病历',
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      onClick: () => {
        // TODO: 实现查看病历功能
        console.log('查看病历');
      },
    },
    {
      icon: Calendar,
      label: '开具处方',
      color: 'text-green-500',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      onClick: () => {
        // TODO: 实现开具处方功能
        console.log('开具处方');
      },
    },
    {
      icon: CheckCircle,
      label: '结束问诊',
      color: 'text-orange-500',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      onClick: onCloseConsultation,
    },
  ];

  // 发送消息
  const handleSend = () => {
    const content = inputValue.trim();
    if (content && !disabled) {
      onSendMessage(content);
      setInputValue('');
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-lg">
      {/* 快捷操作栏 */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              disabled={disabled}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${action.bgColor} ${action.color} hover:opacity-80 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0`}
            >
              <action.icon className="w-4 h-4" />
              <span className="text-sm font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 输入区域 */}
      <div className="flex items-end gap-2 px-4 pb-4 pt-2">
        {/* 图片上传按钮 */}
        <button
          disabled={disabled}
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          aria-label="上传图片"
          onClick={() => {
            // TODO: 实现图片上传功能
            console.log('上传图片');
          }}
        >
          <ImageIcon className="w-5 h-5" />
        </button>

        {/* 输入框 */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-2xl min-h-[44px] flex items-center px-4 py-2.5 border-2 border-transparent focus-within:border-blue-500/50 focus-within:bg-white dark:focus-within:bg-slate-600 transition-all">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="输入消息..."
            rows={1}
            className="w-full bg-transparent border-none p-0 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-0 resize-none text-[15px] max-h-32"
            style={{
              height: 'auto',
              minHeight: '24px',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = target.scrollHeight + 'px';
            }}
          />
        </div>

        {/* 发送按钮 */}
        <button
          onClick={handleSend}
          disabled={!inputValue.trim() || disabled}
          className={`flex items-center justify-center w-10 h-10 rounded-full transition-all active:scale-95 shrink-0 ${
            inputValue.trim() && !disabled
              ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-md'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
          }`}
          aria-label="发送消息"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
