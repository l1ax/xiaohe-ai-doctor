import React from 'react';
import ReactMarkdown from 'react-markdown';
import { User, Bot, AlertCircle, Stethoscope } from 'lucide-react';
import { Message } from '../../machines/chatMachine';

// ============ 基础样式 ============

const messageStyles = {
  user: {
    container: 'flex justify-end items-start gap-3',
    wrapper: 'flex flex-col gap-1 items-end max-w-[85%]',
    bubble: 'bg-primary text-white rounded-2xl rounded-tr-none px-4 py-3 shadow-sm text-[16px] leading-relaxed',
    avatarContainer: 'w-10 h-10 shrink-0 rounded-full bg-blue-100 flex items-center justify-center border-2 border-white shadow-sm mt-1',
    name: 'hidden',
  },
  assistant: {
    container: 'flex justify-start items-start gap-3',
    wrapper: 'flex flex-col gap-1 items-start max-w-[85%]',
    bubble: 'bg-white dark:bg-[#1e2e36] text-slate-800 dark:text-slate-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm border border-slate-100 dark:border-slate-700 text-[16px] leading-relaxed',
    avatarContainer: 'w-10 h-10 shrink-0 rounded-full bg-white flex items-center justify-center border-2 border-white dark:border-slate-700 shadow-sm mt-1 overflow-hidden',
    name: 'text-slate-500 dark:text-slate-400 text-xs font-medium ml-1',
  },
  system: {
    container: 'flex justify-center my-4',
    wrapper: '',
    bubble: 'bg-slate-200/50 dark:bg-slate-800/50 backdrop-blur-sm text-slate-500 dark:text-slate-400 text-xs font-medium px-4 py-1.5 rounded-full text-center',
    avatarContainer: 'hidden',
    name: 'hidden',
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
    <div className={`${styles.container} mb-6`}>
      {/* Assistant Avatar */}
      {role === 'assistant' && (
        <div className={styles.avatarContainer}>
          {/* Use an image if available, otherwise Bot icon */}
           <img 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCF1kVXFyF37q3nrI02oGmsRVTY32V4_XBRDIbhjwotETvXN2SYYSvbHK1-QKsrjtU3IFzODgzEz4wCNcZ88VrNw4gmwGKNwCz7ULW1EeppZuX5FWqZrkxsDvxodVjnkMQKZAi8QaQP7iu1oG_T8cwbWYvfQ7tCJ8HAXLP_3fvgB_ZCpCkbJ8yIW0s1Q8bv2Poeg0A98RIJXErD3OLPQFuV3-hOijxEtf-DN9zpxVPf1vwMMmBEB26_cgxXZZrMFn-6hwZfpzNkHMc-" 
            alt="AI Doctor"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement?.classList.add('bg-primary/10');
            }}
           />
           <Bot className="w-6 h-6 text-primary absolute opacity-0" style={{ opacity: 0 }} /> {/* Fallback handled by onError logic physically or just use Bot icon if img fails logic which is complex here. Let's keep it simple: Image first. */}
        </div>
      )}

      <div className={styles.wrapper}>
        {role === 'assistant' && (
          <span className={styles.name}>小禾AI医生</span>
        )}
        
        <div className={styles.bubble}>
          {role === 'user' ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
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
            <span className="inline-block w-2 h-4 bg-primary/50 ml-1 animate-pulse" />
          )}
        </div>
      </div>

      {/* User Avatar */}
      {role === 'user' && (
        <div className={styles.avatarContainer}>
          <User className="w-6 h-6 text-primary" />
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
    <div className={`${styles.container} mb-6`}>
      {role === 'assistant' && (
        <div className={styles.avatarContainer}>
          <Bot className="w-6 h-6 text-primary" />
        </div>
      )}

      <div className={styles.wrapper}>
        {role === 'assistant' && (
            <span className={styles.name}>小禾AI医生</span>
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
      </div>

      {role === 'user' && (
        <div className={styles.avatarContainer}>
           <User className="w-6 h-6 text-primary" />
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
  // Use the new simplified style for system messages
  return (
    <div className="flex justify-center w-full mt-2 mb-4">
      <div className="bg-slate-200/50 dark:bg-slate-800/50 px-4 py-1.5 rounded-full backdrop-blur-sm">
        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium text-center">
          {content}
        </p>
      </div>
    </div>
  );
};

// ============ MedicalAdviceCard 组件 ============

interface MedicalAdviceCardProps {
  advice: {
    symptoms: string[];
    possibleConditions: string[];
    suggestions: string[];
    urgencyLevel: 'low' | 'medium' | 'high';
  };
}

export const MedicalAdviceCard: React.FC<MedicalAdviceCardProps> = ({ advice }) => {
  const urgencyColors = {
    low: 'bg-green-50 border-green-200 text-green-800',
    medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    high: 'bg-red-50 border-red-200 text-red-800',
  };

  const urgencyLabels = {
    low: '建议关注',
    medium: '建议就医',
    high: '尽快就医',
  };

  return (
    <div className={`rounded-lg border p-4 mt-3 ${urgencyColors[advice.urgencyLevel]}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium">健康建议</span>
        <span className="text-xs px-2 py-1 rounded bg-white/50">
          {urgencyLabels[advice.urgencyLevel]}
        </span>
      </div>

      {advice.symptoms.length > 0 && (
        <div className="mb-2">
          <p className="text-xs opacity-75 mb-1">可能症状</p>
          <div className="flex flex-wrap gap-1">
            {advice.symptoms.map((s, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded bg-white/50">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {advice.possibleConditions.length > 0 && (
        <div className="mb-2">
          <p className="text-xs opacity-75 mb-1">可能情况</p>
          <div className="flex flex-wrap gap-1">
            {advice.possibleConditions.map((c, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded bg-white/50">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {advice.suggestions.length > 0 && (
        <div>
          <p className="text-xs opacity-75 mb-1">建议</p>
          <ul className="text-xs list-disc list-inside">
            {advice.suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
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
    <div>
      <TextMessage
        content={message.content}
        role={message.role}
        isStreaming={isStreaming}
      />
      {message.medicalAdvice && (
        <MedicalAdviceCard advice={message.medicalAdvice} />
      )}
    </div>
  );
};

// ============ 批量消息渲染 ============

interface MessagesListProps {
  messages: Message[];
}

export const MessagesList: React.FC<MessagesListProps> = ({ messages }) => {
  return (
    <div className="flex flex-col pb-4">
      {messages.map((message) => (
        <MessageRenderer key={message.id} message={message} />
      ))}
    </div>
  );
};
