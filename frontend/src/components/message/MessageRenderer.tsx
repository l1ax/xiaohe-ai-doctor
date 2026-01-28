import React from 'react';
import { User, Bot } from 'lucide-react';
import { Message, ToolCall } from '../../machines/chatMachine';
import { ToolCallCard } from './ToolCallCard';
import { ThinkingDots } from './ThinkingDots';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ============ 基础样式 ============

const messageStyles = {
  user: {
    container: 'flex justify-end items-start gap-3',
    wrapper: 'flex flex-col gap-1 items-end max-w-[85%]',
    bubble: 'bg-primary text-primary-foreground rounded-2xl rounded-tr-none px-4 py-3 shadow-md text-[16px] leading-relaxed',
    name: 'hidden',
  },
  assistant: {
    container: 'flex justify-start items-start gap-3',
    wrapper: 'flex flex-col gap-1 items-start max-w-[85%]',
    bubble: 'bg-card text-card-foreground rounded-2xl rounded-tl-none px-4 py-3 shadow-sm border text-[16px] leading-relaxed',
    name: 'text-muted-foreground text-xs font-medium ml-1 mb-0.5',
  },
  system: {
    container: 'flex justify-center my-4',
    wrapper: '',
    bubble: 'bg-muted/50 backdrop-blur-sm text-muted-foreground text-xs font-medium px-4 py-1.5 rounded-full text-center',
    name: 'hidden',
  },
};

// ============ TextMessage 组件 ============

interface TextMessageProps {
  content: string;
  role: 'user' | 'assistant' | 'system';
  isStreaming?: boolean;
  imageUrls?: string[];
  toolCalls?: ToolCall[];
}

export const TextMessage: React.FC<TextMessageProps> = ({ content, role, isStreaming, imageUrls, toolCalls }) => {
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

  // 检查是否是 thinking 状态（通过内容为空且 role 为 assistant 来判断）
  const isThinking = role === 'assistant' && !content && !imageUrls;

  return (
    <div className={cn(styles.container, "mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300")}>
      {/* Assistant Avatar */}
      {role === 'assistant' && (
        <Avatar className="w-10 h-10 border-2 border-background shadow-sm">
          <AvatarImage src="https://lh3.googleusercontent.com/aida-public/AB6AXuCF1kVXFyF37q3nrI02oGmsRVTY32V4_XBRDIbhjwotETvXN2SYYSvbHK1-QKsrjtU3IFzODgzEz4wCNcZ88VrNw4gmwGKNwCz7ULW1EeppZuX5FWqZrkxsDvxodVjnkMQKZAi8QaQP7iu1oG_T8cwbWYvfQ7tCJ8HAXLP_3fvgB_ZCpCkbJ8yIW0s1Q8bv2Poeg0A98RIJXErD3OLPQFuV3-hOijxEtf-DN9zpxVPf1vwMMmBEB26_cgxXZZrMFn-6hwZfpzNkHMc-" alt="AI Doctor" />
          <AvatarFallback className="bg-primary/5 text-primary">
            <Bot className="w-6 h-6" />
          </AvatarFallback>
        </Avatar>
      )}

      <div className={styles.wrapper}>
        {role === 'assistant' && (
          <span className={styles.name}>小禾AI医生</span>
        )}

        {/* 工具调用卡片（在名称和气泡之间） */}
        {role === 'assistant' && toolCalls && toolCalls.length > 0 && (
          <div className="mb-1 w-full">
            <ToolCallCard tools={toolCalls} />
          </div>
        )}

        <div className={styles.bubble}>
          {/* 正在思考状态 */}
          {isThinking ? (
            <ThinkingDots />
          ) : (
            <>
              {/* 图片（如果有） */}
              {imageUrls && imageUrls.length > 0 && (
                <div className="mb-3">
                  <img
                    src={imageUrls[0]}
                    alt="用户上传的图片"
                    className="max-w-full rounded-lg border shadow-sm"
                    style={{ maxHeight: '200px', objectFit: 'contain' }}
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7lm77niYflia3ovb3lpLHotKU8L3RleHQ+PC9zdmc+';
                      e.currentTarget.alt = '图片加载失败';
                    }}
                  />
                </div>
              )}

              {/* 文字内容 */}
              {content && (
                role === 'user' ? (
                  <p className="whitespace-pre-wrap">{content}</p>
                ) : (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <MarkdownRenderer content={content} />
                  </div>
                )
              )}
              {isStreaming && (
                <span className="inline-block w-2 h-4 bg-primary/50 ml-1 animate-pulse rounded-sm" />
              )}
            </>
          )}
        </div>
      </div>

      {/* User Avatar */}
      {role === 'user' && (
        <Avatar className="w-10 h-10 border-2 border-background shadow-sm">
          <AvatarFallback className="bg-primary/10 text-primary">
            <User className="w-5 h-5" />
          </AvatarFallback>
        </Avatar>
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
    <div className={cn(styles.container, "mb-6")}>
      {role === 'assistant' && (
        <Avatar className="w-10 h-10 border-2 border-background shadow-sm">
           <AvatarImage src="https://lh3.googleusercontent.com/aida-public/AB6AXuCF1kVXFyF37q3nrI02oGmsRVTY32V4_XBRDIbhjwotETvXN2SYYSvbHK1-QKsrjtU3IFzODgzEz4wCNcZ88VrNw4gmwGKNwCz7ULW1EeppZuX5FWqZrkxsDvxodVjnkMQKZAi8QaQP7iu1oG_T8cwbWYvfQ7tCJ8HAXLP_3fvgB_ZCpCkbJ8yIW0s1Q8bv2Poeg0A98RIJXErD3OLPQFuV3-hOijxEtf-DN9zpxVPf1vwMMmBEB26_cgxXZZrMFn-6hwZfpzNkHMc-" alt="AI Doctor" />
           <AvatarFallback><Bot className="w-6 h-6" /></AvatarFallback>
        </Avatar>
      )}

      <div className={styles.wrapper}>
        {role === 'assistant' && (
            <span className={styles.name}>小禾AI医生</span>
        )}
        <div className={cn(styles.bubble, "p-2")}>
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
        <Avatar className="w-10 h-10 border-2 border-background shadow-sm">
           <AvatarFallback><User className="w-6 h-6" /></AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

// ============ SystemMessage 组件 ============

interface SystemMessageProps {
  content: string;
  type?: 'info' | 'warning' | 'error' | 'success';
}

export const SystemMessage: React.FC<SystemMessageProps> = ({ content, type: _type = 'info' }) => {
  return (
    <div className="flex justify-center w-full mt-2 mb-4">
      <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted px-4 py-1.5 rounded-full backdrop-blur-sm font-medium">
          {content}
      </Badge>
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
    low: 'bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-900',
    medium: 'bg-yellow-50/50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900',
    high: 'bg-red-50/50 border-red-200 dark:bg-red-950/20 dark:border-red-900',
  };

  const urgencyTextColors = {
    low: 'text-green-700 dark:text-green-400',
    medium: 'text-yellow-700 dark:text-yellow-400',
    high: 'text-red-700 dark:text-red-400',
  };

  const urgencyLabels = {
    low: '建议关注',
    medium: '建议就医',
    high: '尽快就医',
  };

  return (
    <Card className={cn("mt-4 border shadow-sm overflow-hidden", urgencyColors[advice.urgencyLevel])}>
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base font-semibold">健康建议</CardTitle>
        <Badge variant="outline" className={cn("bg-background/80 backdrop-blur-sm border-transparent shadow-sm", urgencyTextColors[advice.urgencyLevel])}>
          {urgencyLabels[advice.urgencyLevel]}
        </Badge>
      </CardHeader>
      <CardContent className="p-4 pt-2 grid gap-4">
        {advice.symptoms.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">可能症状</p>
            <div className="flex flex-wrap gap-1.5">
              {advice.symptoms.map((s, i) => (
                <Badge key={i} variant="secondary" className="bg-background/60 hover:bg-background/80 text-foreground font-normal">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {advice.possibleConditions.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">可能情况</p>
            <div className="flex flex-wrap gap-1.5">
              {advice.possibleConditions.map((c, i) => (
                <Badge key={i} variant="secondary" className="bg-background/60 hover:bg-background/80 text-foreground font-normal">
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {advice.suggestions.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-medium">建议</p>
            <ul className="text-sm list-disc list-inside space-y-1 text-foreground/90">
              {advice.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ============ MessageRenderer 主组件 ============

interface MessageRendererProps {
  message: Message;
  toolCalls?: ToolCall[];
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({ message, toolCalls }) => {
  const isStreaming = message.status === 'streaming';

  return (
    <div>
      <TextMessage
        content={message.content}
        role={message.role}
        isStreaming={isStreaming}
        imageUrls={message.imageUrls}
        toolCalls={toolCalls}
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
  toolCalls?: ToolCall[];
}

export const MessagesList: React.FC<MessagesListProps> = ({ messages, toolCalls }) => {
  return (
    <div className="flex flex-col pb-4">
      {messages.map((message) => {
        // 最后一条 AI 消息显示工具调用（但排除 thinking 消息）
        const isLastAssistant =
          message.role === 'assistant' &&
          message.id !== 'thinking_temp' &&  // 排除 thinking 临时消息
          message === messages.filter(m => m.role === 'assistant' && m.id !== 'thinking_temp').slice(-1)[0];

        const relatedTools = isLastAssistant ? toolCalls : undefined;

        return (
          <MessageRenderer
            key={message.id}
            message={message}
            toolCalls={relatedTools}
          />
        );
      })}
    </div>
  );
};
