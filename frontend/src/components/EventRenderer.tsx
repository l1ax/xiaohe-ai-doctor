import React, { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { MarkdownRenderer } from './shared/MarkdownRenderer';
import { 
  ChevronDown, 
  Terminal, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { Event } from '../models/events/Event';
import { ToolCallEvent } from '../models/events/ToolCallEvent';
import { MessageContentEvent } from '../models/events/MessageContentEvent';
import { ThinkingEvent } from '../models/events/ThinkingEvent';
import { ErrorEvent } from '../models/events/ErrorEvent';
import { ConversationStatusEvent } from '../models/events/ConversationStatusEvent';

interface EventRendererProps {
  event: Event;
}

/**
 * 事件渲染器：根据事件类型渲染不同的 UI
 */
export const EventRenderer: React.FC<EventRendererProps> = observer(({ event }) => {
  switch (event.type) {
    case 'tool_call':
      return <ToolCallRenderer event={event as ToolCallEvent} />;
    case 'message_content':
      return <MessageContentRenderer event={event as MessageContentEvent} />;
    case 'thinking':
      return <ThinkingRenderer event={event as ThinkingEvent} />;
    case 'error':
      return <ErrorRenderer event={event as ErrorEvent} />;
    case 'conversation_status':
      return <ConversationStatusRenderer event={event as ConversationStatusEvent} />;
    default:
      return null;
  }
});

/**
 * 工具调用渲染器
 */
const ToolCallRenderer: React.FC<{ event: ToolCallEvent }> = observer(({ event }) => {
  const [isOpen, setIsOpen] = useState(false);

  const statusIcon = {
    running: <Loader2 className="w-4 h-4 animate-spin" />,
    completed: <CheckCircle2 className="w-4 h-4 text-green-500" />,
    failed: <XCircle className="w-4 h-4 text-red-500" />,
  };

  const statusText = {
    running: '执行中',
    completed: '执行成功',
    failed: '请求失败',
  };

  const hasOutput = event.output !== undefined;

  return (
    <div className="tool-call-event">
      <div 
        className="tool-call-header" 
        onClick={() => hasOutput && setIsOpen(!isOpen)}
      >
        <div className="tool-icon-wrapper">
          {statusIcon[event.status]}
        </div>
        <div className="tool-name">使用工具: {event.name}</div>
        <div className="tool-status">{statusText[event.status]}</div>
        {hasOutput && (
          <ChevronDown className={`tool-chevron w-4 h-4 ${isOpen ? 'open' : ''}`} />
        )}
      </div>

      {isOpen && hasOutput && (
        <div className="tool-details">
          <div className="flex items-center gap-2 mb-2 text-xs text-slate-400">
            <Terminal className="w-3 h-3" />
            <span>工具输出内容</span>
          </div>
          <pre className="tool-output-box">
            {typeof event.output === 'object' 
              ? JSON.stringify(event.output, null, 2) 
              : String(event.output)}
          </pre>
          {event.status === 'failed' && event.output?.error && (
            <div className="tool-error">
              <AlertCircle className="w-3 h-3 inline mr-1" />
              {String(event.output.error)}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

/**
 * 消息内容渲染器
 */
const MessageContentRenderer: React.FC<{ event: MessageContentEvent }> = observer(({ event }) => {
  if (!event.content) return null;

  return (
    <div className="message-content-event">
      <MarkdownRenderer content={event.content} />
      {!event.isComplete && <span className="typing-cursor">▋</span>}
    </div>
  );
});

/**
 * 思考状态渲染器
 */
const ThinkingRenderer: React.FC<{ event: ThinkingEvent }> = observer(() => {
  return (
    <div className="thinking-event">
      <div className="thinking-shimmer">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span className="thinking-text">小禾正在思考为您提供最准确的建议...</span>
    </div>
  );
});

/**
 * 错误渲染器
 */
const ErrorRenderer: React.FC<{ event: ErrorEvent }> = observer(({ event }) => {
  return (
    <div className="error-event">
      <AlertCircle className="w-5 h-5 text-red-500" />
      <div className="flex-1">
        <span className="error-message">{event.message}</span>
        {event.code && <span className="error-code text-xs block opacity-70">错误代码: {event.code}</span>}
      </div>
    </div>
  );
});

/**
 * 对话状态渲染器
 */
const ConversationStatusRenderer: React.FC<{ event: ConversationStatusEvent }> = observer(({ event }) => {
  if (['idle', 'processing', 'streaming', 'complete', 'starting'].includes(event.status)) {
    return null;
  }

  return (
    <div className="conversation-status-event">
      <span className="status-text">{event.message || event.status}</span>
    </div>
  );
});
