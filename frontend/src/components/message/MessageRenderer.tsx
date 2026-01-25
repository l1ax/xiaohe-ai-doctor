import React from 'react';
import ReactMarkdown from 'react-markdown';
import { User, Bot, AlertCircle, Stethoscope } from 'lucide-react';
import { Message } from '../../machines/chatMachine';

// ============ 基础样式 ============

const messageStyles = {
  user: {
    container: 'flex justify-end',
    bubble: 'bg-blue-500 text-white rounded-2xl rounded-tr-sm max-w-[80%] px-4 py-3',
    avatar: 'ml-2 bg-blue-200',
  },
  assistant: {
    container: 'flex justify-start',
    bubble: 'bg-gray-100 text-gray-800 rounded-2xl rounded-tl-sm max-w-[80%] px-4 py-3',
    avatar: 'mr-2 bg-green-100',
  },
  system: {
    container: 'flex justify-center',
    bubble: 'bg-yellow-50 text-yellow-800 text-sm px-4 py-2 rounded-lg',
    avatar: '',
  },
};

// ============ TextMessage 组件 ============

interface TextMessageProps {
  content: string;
  role: 'user' | 'assistant' | 'system';
  isStreaming?: boolean;
}

export const TextMessage: React.FC<TextMessageProps> = ({ content, role, isStreaming }) => {
  if (role === 'system') {
    return (
      <div className={messageStyles.system.container}>
        <div className={messageStyles.system.bubble}>
          {content}
        </div>
      </div>
    );
  }

  const styles = messageStyles[role];

  return (
    <div className={`${styles.container} mb-4`}>
      {role === 'assistant' && (
        <div className={`${styles.avatar} w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0`}>
          <Bot className="w-5 h-5 text-green-600" />
        </div>
      )}

      <div className={styles.bubble}>
        {role === 'user' ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
              li: ({ children }) => <li className="mb-1">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em>{children}</em>,
              a: ({ href, children }) => (
                <a href={href} className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-gray-300 pl-3 italic my-2">{children}</blockquote>
              ),
            }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
        {isStreaming && (
          <span className="inline-block w-2 h-4 bg-gray-400 ml-1 animate-pulse" />
        )}
      </div>

      {role === 'user' && (
        <div className={`${styles.avatar} w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0`}>
          <User className="w-5 h-5 text-blue-600" />
        </div>
      )}
    </div>
  );
};

// ============ ImageMessage 组件 ============

interface ImageMessageProps {
  src: string;
  alt?: string;
  caption?: string;
  role: 'user' | 'assistant';
}

export const ImageMessage: React.FC<ImageMessageProps> = ({ src, alt, caption, role }) => {
  const styles = messageStyles[role];

  return (
    <div className={`${styles.container} mb-4`}>
      {role === 'assistant' && (
        <div className={`${styles.avatar} w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0`}>
          <Bot className="w-5 h-5 text-green-600" />
        </div>
      )}

      <div className={`${styles.bubble} p-2`}>
        <img
          src={src}
          alt={alt || 'Image'}
          className="max-w-full h-auto rounded-lg"
          loading="lazy"
        />
        {caption && (
          <p className="text-sm mt-2 opacity-75">{caption}</p>
        )}
      </div>

      {role === 'user' && (
        <div className={`${styles.avatar} w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0`}>
          <User className="w-5 h-5 text-blue-600" />
        </div>
      )}
    </div>
  );
};

// ============ SystemMessage 组件 ============

interface SystemMessageProps {
  content: string;
  type?: 'info' | 'warning' | 'error' | 'success';
}

export const SystemMessage: React.FC<SystemMessageProps> = ({ content, type = 'info' }) => {
  const typeStyles = {
    info: 'bg-blue-50 text-blue-800 border-blue-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    success: 'bg-green-50 text-green-800 border-green-200',
  };

  const iconMap = {
    info: <Stethoscope className="w-4 h-4" />,
    warning: <AlertCircle className="w-4 h-4" />,
    error: <AlertCircle className="w-4 h-4" />,
    success: <Bot className="w-4 h-4" />,
  };

  return (
    <div className="flex justify-center mb-4">
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${typeStyles[type]}`}>
        {iconMap[type]}
        <span className="text-sm">{content}</span>
      </div>
    </div>
  );
};

// ============ MessageRenderer 主组件 ============

interface MessageRendererProps {
  message: Message;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({ message }) => {
  const isStreaming = message.status === 'streaming';

  return (
    <TextMessage
      content={message.content}
      role={message.role}
      isStreaming={isStreaming}
    />
  );
};

// ============ 批量消息渲染 ============

interface MessagesListProps {
  messages: Message[];
}

export const MessagesList: React.FC<MessagesListProps> = ({ messages }) => {
  return (
    <div className="flex flex-col">
      {messages.map((message) => (
        <MessageRenderer key={message.id} message={message} />
      ))}
    </div>
  );
};
