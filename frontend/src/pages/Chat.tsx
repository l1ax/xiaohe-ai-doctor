import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useMachine } from '@xstate/react';
import { Send, Paperclip, Bot, AlertCircle, Stethoscope, Phone } from 'lucide-react';
import { chatMachine, ChatEventType } from '../machines/chatMachine';
import { MessagesList, SystemMessage } from '../components/message/MessageRenderer';
import { sseClientManager } from '../services/sseClient';

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export const ChatPage: React.FC = () => {
  const [state, send] = useMachine(chatMachine);
  const [inputValue, setInputValue] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isSSEConnected, setIsSSEConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isConnectingRef = useRef(false);

  // Auto scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [state.context.messages, scrollToBottom]);

  // Send message
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || state.matches('streaming') || isConnectingRef.current) return;

    const newConversationId = conversationId || `conv_${Date.now()}`;
    setConversationId(newConversationId);
    isConnectingRef.current = true;

    // Send to XState
    send({ type: 'SEND_MESSAGE', content: inputValue });

    // Clean up previous connection
    const previousClient = sseClientManager.getClient(conversationId || '');
    if (previousClient) {
      previousClient.close();
    }

    // Create SSE client that handles the stream
    const client = sseClientManager.createClient({
      url: `${API_BASE_URL}/api/ai-chat/stream`,
      conversationId: newConversationId,
      message: inputValue,
      onEvent: (event: ChatEventType) => {
        send(event);
      },
      onError: (error) => {
        console.error('SSE Error:', error);
        isConnectingRef.current = false;
        send({ type: 'ERROR', code: 'SSE_ERROR', message: 'Connection error' });
      },
      onOpen: () => {
        setIsSSEConnected(true);
        isConnectingRef.current = false;
        console.log('SSE Connected');
      },
      onClose: () => {
        setIsSSEConnected(false);
        isConnectingRef.current = false;
        console.log('SSE Closed');
      },
    });

    // Connect to SSE (this will trigger the agent)
    client.connect().catch((error) => {
      console.error('Failed to connect SSE:', error);
      isConnectingRef.current = false;
      send({ type: 'ERROR', code: 'CONNECT_FAILED', message: 'Failed to connect' });
    });

    setInputValue('');
  }, [inputValue, conversationId, state.matches, send]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  // Reset conversation
  const handleReset = useCallback(() => {
    if (conversationId) {
      const client = sseClientManager.getClient(conversationId);
      if (client) {
        client.close();
      }
    }
    setConversationId(null);
    setIsSSEConnected(false);
    send({ type: 'RESET' });
  }, [conversationId, send]);

  // Render status
  const renderStatus = () => {
    const { status, message } = state.context.conversationStatus;

    switch (status) {
      case 'sending':
        return <SystemMessage content="正在发送消息..." type="info" />;
      case 'processing':
        return <SystemMessage content={message || 'AI 正在分析您的问题...'} type="info" />;
      case 'streaming':
        return <SystemMessage content="AI 正在生成回复..." type="info" />;
      case 'error':
        return <SystemMessage content={message || '出错了，请重试'} type="error" />;
      case 'complete':
        return <SystemMessage content="回复已完成" type="success" />;
      default:
        return null;
    }
  };

  // Render quick actions
  const renderQuickActions = () => {
    if (state.context.actions.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-2 mb-4">
        {state.context.actions.map((action, index) => (
          <button
            key={index}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
            onClick={() => {
              if (action.type === 'transfer_to_doctor') {
                console.log('Transfer to doctor:', action.data);
              } else if (action.type === 'book_appointment') {
                console.log('Book appointment:', action.data);
              }
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    );
  };

  // Render urgency warning
  const renderUrgencyWarning = () => {
    const { medicalAdvice } = state.context;
    if (!medicalAdvice) return null;

    if (medicalAdvice.urgencyLevel === 'high') {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">建议尽快就医</p>
            <p className="text-sm text-red-600 mt-1">
              根据您的描述，建议您尽快联系医生或前往医院就诊。
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-800">小禾AI医生</h1>
            <p className="text-xs text-gray-500">
              {isSSEConnected ? (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  在线
                </span>
              ) : (
                <span className="flex items-center gap-1 text-gray-400">
                  <span className="w-2 h-2 bg-gray-400 rounded-full" />
                  离线
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={handleReset}
            title="新建对话"
          >
            <Stethoscope className="w-5 h-5" />
          </button>
          <button
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="联系人工医生"
          >
            <Phone className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Messages area */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto">
          {/* Welcome message */}
          {state.context.messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                您好，我是小禾AI医生
              </h2>
              <p className="text-gray-500 mb-6">
                有什么健康问题我可以帮您解答？
              </p>
              {/* Quick questions */}
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  '最近总是头疼怎么办',
                  '感冒了吃什么药好',
                  '睡眠不好怎么调理',
                ].map((question) => (
                  <button
                    key={question}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:border-blue-500 hover:text-blue-500 transition-colors"
                    onClick={() => setInputValue(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status messages */}
          {renderStatus()}

          {/* Urgency warning */}
          {renderUrgencyWarning()}

          {/* Quick actions */}
          {renderQuickActions()}

          {/* Messages list */}
          <MessagesList messages={state.context.messages} />

          {/* Error state */}
          {state.matches('error') && (
            <div className="flex justify-center mt-4">
              <button
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                onClick={() => send({ type: 'RETRY' })}
              >
                重试
              </button>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input area */}
      <footer className="bg-white border-t px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end gap-3">
            <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
              <Paperclip className="w-5 h-5" />
            </button>

            <div className="flex-1 relative">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="描述您的症状或问题..."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                rows={1}
                style={{
                  minHeight: '48px',
                  maxHeight: '120px',
                }}
              />
            </div>

            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || state.matches('streaming') || isConnectingRef.current}
              className={`p-3 rounded-xl transition-colors ${
                inputValue.trim() && !state.matches('streaming') && !isConnectingRef.current
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>

          <p className="text-center text-xs text-gray-400 mt-2">
            AI 仅供参考，具体诊疗请咨询专业医生
          </p>
        </div>
      </footer>
    </div>
  );
};

export default ChatPage;
