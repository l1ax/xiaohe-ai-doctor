import { Event } from './Event';
import { ToolCallEvent } from './ToolCallEvent';
import { MessageContentEvent } from './MessageContentEvent';
import { ThinkingEvent } from './ThinkingEvent';
import { ErrorEvent } from './ErrorEvent';
import { ConversationStatusEvent } from './ConversationStatusEvent';
import { MessageMetadataEvent } from './MessageMetadataEvent';

/**
 * SSE 事件接口（匹配后端发送的格式）
 */
export interface SSEEvent {
  eventId?: string;  // 每个 SSE 事件的唯一 ID
  type: string;
  data: {
    conversationId?: string;
    messageId?: string;
    status?: string;
    tool?: string; // 工具名称
    toolName?: string;
    input?: any;
    output?: any;
    error?: string;
    delta?: string;
    message?: string;
    code?: string;
    timestamp?: string;
    [key: string]: any;
  };
}

/**
 * 事件工厂：从 SSE 事件创建对应的 Event 实例
 */
export class EventFactory {
  static createFromSSE(sseEvent: SSEEvent): Event | null {
    try {
      switch (sseEvent.type) {
        // 工具调用事件
        case 'tool_call': {
          const toolName = sseEvent.data.tool || sseEvent.data.toolName || '';
          const status = sseEvent.data.status as 'running' | 'completed' | 'failed';
          const eventId = sseEvent.eventId || `tool-${toolName}-${Date.now()}`;

          return new ToolCallEvent({
            id: eventId,
            toolId: sseEvent.data.toolId || eventId,
            name: toolName,
            status: status || 'running',
            input: sseEvent.data.input,
            output: sseEvent.data.output,
          });
        }

        // 消息内容事件（使用 messageId，用于流式累加）
        case 'message_content':
          return new MessageContentEvent({
            id: sseEvent.data.messageId || `msg-${Date.now()}`,
            delta: sseEvent.data.delta || '',
            isLast: sseEvent.data.isLast || false,
          });

        // 思考状态事件
        case 'thinking':
          return new ThinkingEvent(sseEvent.eventId || `thinking-${Date.now()}`);

        // 错误事件
        case 'error':
          return new ErrorEvent({
            id: sseEvent.eventId || `error-${Date.now()}`,
            message: sseEvent.data.error || sseEvent.data.message || '未知错误',
            code: sseEvent.data.code || 'UNKNOWN_ERROR',
          });

        // 对话状态事件
        case 'conversation_status':
          return new ConversationStatusEvent({
            id: sseEvent.eventId || `status-${Date.now()}`,
            status: sseEvent.data.status || '',
            message: sseEvent.data.message,
          });

        // 对话结束事件（返回 null，由 Conversation 处理）
        case 'conversation_end':
          return null;

        // 消息状态事件（暂时忽略）
        case 'message_status':
          return null;

        // 元数据事件
        case 'message_metadata':
          return new MessageMetadataEvent({
            id: sseEvent.eventId || `metadata-${Date.now()}`,
            actions: sseEvent.data.actions || [],
          });

        default:
          console.warn('Unknown SSE event type:', sseEvent.type);
          return null;
      }
    } catch (error) {
      console.error('Error creating event from SSE:', error, sseEvent);
      return null;
    }
  }

  /**
   * 根据 Event 实例更新现有 Event（用于工具调用状态更新等场景）
   */
  static updateEvent(existingEvent: Event, updateData: Event): void {
    if (existingEvent.type === updateData.type) {
      existingEvent.update(updateData);
    }
  }
}
