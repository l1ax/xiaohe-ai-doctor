import React from 'react';
import { observer } from 'mobx-react-lite';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  const statusIcon = {
    running: '⏳',
    completed: '✅',
    failed: '❌',
  };

  const statusText = {
    running: '执行中',
    completed: '已完成',
    failed: '失败',
  };

  return (
    <div className="tool-call-event">
      <div className="tool-call-header">
        <span className="tool-icon">{statusIcon[event.status]}</span>
        <span className="tool-name">{event.name}</span>
        <span className="tool-status">{statusText[event.status]}</span>
        {event.duration && <span className="tool-duration">{event.duration}ms</span>}
      </div>
      {event.status === 'failed' && event.output?.error && (
        <div className="tool-error">{String(event.output.error)}</div>
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
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {event.content}
      </ReactMarkdown>
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
      <span className="thinking-icon">🤔</span>
      <span className="thinking-text">思考中...</span>
    </div>
  );
});

/**
 * 错误渲染器
 */
const ErrorRenderer: React.FC<{ event: ErrorEvent }> = observer(({ event }) => {
  return (
    <div className="error-event">
      <span className="error-icon">❌</span>
      <span className="error-message">{event.message}</span>
      {event.code && <span className="error-code">({event.code})</span>}
    </div>
  );
});

/**
 * 对话状态渲染器
 */
const ConversationStatusRenderer: React.FC<{ event: ConversationStatusEvent }> = observer(({ event }) => {
  // 大多数状态事件不需要显示 UI，只在关键状态显示
  // 不显示：idle, processing, streaming, complete, starting
  // 只在错误或特殊状态显示
  if (['idle', 'processing', 'streaming', 'complete', 'starting'].includes(event.status)) {
    return null;
  }

  return (
    <div className="conversation-status-event">
      <span className="status-text">{event.message || event.status}</span>
    </div>
  );
});
