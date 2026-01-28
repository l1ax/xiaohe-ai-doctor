import React, { useEffect, useRef, useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import {
  Send,
  History,
  Thermometer,
  Brain,
  Stethoscope,
  Activity,
  X,
  ChevronLeft
} from 'lucide-react';
import { Conversation } from '../models/Conversation';
import { ConversationRenderer } from '../components/ConversationRenderer';
import { ImageUploader } from '../components/upload/ImageUploader';
import { ConversationSidebar } from '../components/chat/ConversationSidebar';
import toast from 'react-hot-toast';
// import '../styles/events.css'; // Optimized with shadcn-ui components

// Quick replies data
const QUICK_REPLIES = [
  { label: '感冒发烧', icon: Thermometer, color: 'text-primary' },
  { label: '头痛眩晕', icon: Brain, color: 'text-primary' },
  { label: '腹痛腹泻', icon: Activity, color: 'text-primary' },
  { label: '儿童发热', icon: Stethoscope, color: 'text-primary' },
];

export const ChatPage: React.FC = observer(() => {
  const [conversation, setConversation] = useState(() => new Conversation());
  const [inputValue, setInputValue] = useState('');
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [conversation.items.length, scrollToBottom]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      conversation.close();
    };
  }, [conversation]);

  // Send message
  const handleSendMessage = useCallback(async (content?: string) => {
    const messageContent = (content || inputValue).trim();
    const imageUrls = uploadedImageUrl ? [uploadedImageUrl] : undefined;

    // 验证：至少有文字或图片
    if (!messageContent && !imageUrls) {
      toast.error('请输入消息或上传图片');
      return;
    }

    if (conversation.isProcessing) return;

    try {
      // 立即清空输入，提供即时反馈
      setInputValue('');
      setUploadedImageUrl(null);
      
      await conversation.sendMessage(messageContent, imageUrls);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('发送失败，请重试');
      // 如果发送失败且内容还存在，可以考虑恢复输入（可选）
      // setInputValue(messageContent);
    }
  }, [inputValue, uploadedImageUrl, conversation]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  // New conversation
  const handleNewConversation = useCallback(() => {
    conversation.close();
    setConversation(new Conversation());
    setInputValue('');
    setUploadedImageUrl(null);
    toast.success('已开始新对话');
  }, [conversation]);

  // Select conversation from history
  const handleSelectConversation = useCallback(async (conversationId: string) => {
    try {
      // Close current conversation
      conversation.close();
      
      // Create new conversation with history load
      const newConversation = new Conversation(conversationId);
      await newConversation.loadFromHistory(conversationId);
      
      setConversation(newConversation);
      toast.success('已加载历史对话');
    } catch (error) {
      console.error('Failed to load conversation:', error);
      toast.error('加载对话失败');
    }
  }, [conversation]);

  // Render status
  const renderStatus = () => {
    switch (conversation.status) {
      case 'connecting':
        return (
          <div className="flex justify-center w-full mb-4">
            <div className="flex items-center gap-2 bg-slate-200/50 dark:bg-slate-800/50 px-4 py-2 rounded-full backdrop-blur-sm">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-500 dark:text-slate-400 text-sm">正在连接...</span>
            </div>
          </div>
        );
      /* case 'processing':
        return (
          <div className="flex justify-center w-full mb-4">
            <div className="flex items-center gap-2 bg-slate-200/50 dark:bg-slate-800/50 px-4 py-2 rounded-full backdrop-blur-sm">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-500 dark:text-slate-400 text-sm">AI 正在分析您的问题...</span>
            </div>
          </div>
        ); */
      case 'error':
        return (
          <div className="flex justify-center w-full mb-4">
            <div className="bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg">
              <span className="text-red-600 dark:text-red-400 text-sm">{conversation.error?.message || '出错了，请重试'}</span>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-background-light dark:bg-background-dark font-sans text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#1a2c35] border-b border-slate-100 dark:border-slate-800 shrink-0 z-20 shadow-sm">
        <button
          className="flex items-center justify-center p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
          onClick={() => window.history.back()}
          title="返回"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold text-slate-800 dark:text-white flex-1 text-center">AI 健康助手</h1>
        <button
          className="flex items-center justify-center p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-700 dark:text-slate-200"
          onClick={() => setIsSidebarOpen(true)}
          title="对话历史"
        >
          <History className="w-6 h-6" />
        </button>
      </header>

      {/* Conversation Sidebar */}
      <ConversationSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNewConversation={handleNewConversation}
        onSelectConversation={handleSelectConversation}
        currentConversationId={conversation.conversationId}
      />

      {/* Main Messages Area */}
      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-background-light dark:bg-background-dark pb-4 scroll-smooth" id="chat-container">
        {/* Disclaimer */}
        <div className="flex justify-center w-full mt-2 mb-2">
          <div className="bg-slate-200/50 dark:bg-slate-800/50 px-4 py-1.5 rounded-full backdrop-blur-sm">
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium text-center">
              AI建议仅供参考，不可替代医生线下诊疗
            </p>
          </div>
        </div>

        {/* Welcome message if empty */}
        {conversation.items.length === 0 && (
           <div className="flex flex-col items-center justify-center mt-10 opacity-50">
             <div className="w-20 h-20 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
               <Brain className="w-10 h-10 text-slate-400" />
             </div>
             <p className="text-slate-500 text-sm">请描述您的症状，AI 助手将为您解答</p>
           </div>
        )}

        {/* Conversation */}
        <ConversationRenderer conversation={conversation} />

        {/* Status */}
        {renderStatus()}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} className="h-2 w-full" />
      </main>

      {/* Footer / Input Area */}
      <div className="bg-white dark:bg-[#1a2c35] border-t border-slate-100 dark:border-slate-800 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">

        {/* 图片预览区域 */}
        {uploadedImageUrl && (
          <div className="px-4 pt-3 pb-2">
            <div className="relative inline-block">
              <img
                src={uploadedImageUrl}
                alt="预览图片"
                className="w-[120px] h-[120px] object-cover rounded-lg border-2 border-slate-200 dark:border-slate-700"
              />
              <button
                onClick={() => {
                  setUploadedImageUrl(null);
                  toast.success('图片已移除');
                }}
                aria-label="删除图片"
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Quick Replies (Chips) */}
        {conversation.items.length === 0 && !uploadedImageUrl && (
          <div className="pt-3 pb-1">
            <div className="flex gap-2 px-4 overflow-x-auto no-scrollbar mask-gradient-right">
              {QUICK_REPLIES.map((reply, index) => (
                <button
                  key={index}
                  onClick={() => setInputValue(reply.label)}
                  className="flex h-9 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-slate-600 active:bg-blue-100 border border-transparent hover:border-primary/30 transition-all px-4 group whitespace-nowrap"
                >
                  <reply.icon className={`w-[18px] h-[18px] ${reply.color}`} />
                  <span className="text-slate-700 dark:text-slate-200 text-sm font-medium">{reply.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Row */}
        <div className="flex items-end gap-2 p-3 pb-3">
          {/* Image Upload Button (左侧) */}
          <ImageUploader
            onImageUploaded={setUploadedImageUrl}
            disabled={conversation.isProcessing}
          />

          {/* Text Input */}
          <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-[20px] min-h-[44px] flex items-center px-4 py-2 border border-transparent focus-within:border-primary/50 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
            <input
              className="w-full bg-transparent border-none p-0 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-0 text-[16px]"
              placeholder={uploadedImageUrl ? "描述图片或直接发送..." : "请描述您的症状..."}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={conversation.isProcessing}
            />
          </div>

          {/* Send Button (右侧) */}
          <button
            aria-label="发送消息"
            onClick={() => handleSendMessage()}
            disabled={conversation.isProcessing || (!inputValue.trim() && !uploadedImageUrl)}
            className="flex items-center justify-center shrink-0 w-11 h-11 rounded-full text-white bg-primary hover:bg-primary-dark shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
});

export default ChatPage;
