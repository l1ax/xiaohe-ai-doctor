import { makeObservable, observable, action } from 'mobx';
import { Event } from './events/Event';
import { MessageContentEvent } from './events/MessageContentEvent';
import { ToolCallEvent } from './events/ToolCallEvent';
import { EventFactory, SSEEvent } from './events/EventFactory';

/**
 * Agent 输出视图：包含一系列事件的可观察数组
 */
export class AgentView {
  @observable.deep events: Event[] = [];

  constructor() {
    makeObservable(this);
  }

  /**
   * 从 SSE 事件添加或更新 Event
   */
  @action
  handleSSEEvent(sseEvent: SSEEvent): void {
    console.log('[AgentView] Received SSE event:', sseEvent);

    // 特殊处理 message_content 事件（流式更新）
    if (sseEvent.type === 'message_content') {
      const messageId = sseEvent.data.messageId || `msg-${Date.now()}`;
      const existingIndex = this.events.findIndex((e) => e.id === messageId && e.type === 'message_content');

      if (existingIndex >= 0) {
        // 更新现有消息内容事件
        const existing = this.events[existingIndex];
        console.log('[AgentView] Updating message content, delta:', sseEvent.data.delta);
        if (existing.type === 'message_content') {
          (existing as MessageContentEvent).update({
            delta: sseEvent.data.delta,
            isLast: sseEvent.data.isLast,
          });
        }
      } else {
        // 创建新的消息内容事件
        const newEvent = EventFactory.createFromSSE(sseEvent);
        if (newEvent) {
          console.log('[AgentView] Adding new message content event');
          this.events.push(newEvent);
        }
      }
      console.log('[AgentView] Current events count:', this.events.length);
      return;
    }

    // 特殊处理 tool_call 事件（状态更新）- 使用替换策略
    if (sseEvent.type === 'tool_call') {
      const toolId = sseEvent.data.toolId;
      const existingIndex = this.events.findIndex((e) => e.type === 'tool_call' && (e as ToolCallEvent).toolId === toolId);

      if (existingIndex >= 0) {
        // 替换现有工具调用事件（创建新对象）
        const existing = this.events[existingIndex] as ToolCallEvent;
        console.log('[AgentView] Replacing tool call, status:', sseEvent.data.status);

        // 创建新的 ToolCallEvent 对象，继承现有数据并更新
        const updated = new ToolCallEvent({
          id: existing.id,
          toolId: existing.toolId,
          name: existing.name,
          status: (sseEvent.data.status as 'running' | 'completed' | 'failed') || existing.status,
          input: existing.input,
          output: sseEvent.data.output !== undefined ? sseEvent.data.output : existing.output,
          duration: sseEvent.data.duration !== undefined ? sseEvent.data.duration : existing.duration,
        });

        // 替换数组中的对象
        this.events[existingIndex] = updated;
      } else {
        // 创建新的工具调用事件
        const newEvent = EventFactory.createFromSSE(sseEvent);
        if (newEvent) {
          console.log('[AgentView] Adding new tool call event');
          this.events.push(newEvent);
        }
      }
      console.log('[AgentView] Current events count:', this.events.length);
      return;
    }

    // 其他事件类型
    const newEvent = EventFactory.createFromSSE(sseEvent);
    console.log('[AgentView] Created event:', newEvent);

    if (!newEvent) return;

    // 查找是否已存在相同 id 的事件
    const existingIndex = this.events.findIndex((e) => e.id === newEvent.id);

    if (existingIndex >= 0) {
      // 更新现有事件
      const existing = this.events[existingIndex];
      console.log('[AgentView] Updating existing event:', existing, 'with:', newEvent);
      EventFactory.updateEvent(existing, newEvent);
    } else {
      // 添加新事件
      console.log('[AgentView] Adding new event:', newEvent);
      this.events.push(newEvent);
    }

    console.log('[AgentView] Current events count:', this.events.length);
  }

  /**
   * 清空所有事件
   */
  @action
  clear(): void {
    this.events = [];
  }

  /**
   * 获取最后一个 MessageContent 事件的完整内容
   */
  getFullMessageContent(): string {
    const messageEvents = this.events.filter((e) => e.type === 'message_content');
    return messageEvents.map((e: any) => e.content || '').join('');
  }

  /**
   * 检查是否有正在运行的工具
   */
  hasRunningTools(): boolean {
    return this.events.some((e) => e.type === 'tool_call' && (e as any).status === 'running');
  }

  /**
   * 结束所有挂起的工具调用（当对话意外结束时调用）
   */
  @action
  finalizePendingTools(): void {
    this.events.forEach((event, index) => {
      if (event.type === 'tool_call' && (event as ToolCallEvent).status === 'running') {
        const existing = event as ToolCallEvent;
        console.log('[AgentView] Finalizing pending tool:', existing.id);
        
        const updated = new ToolCallEvent({
          id: existing.id,
          toolId: existing.toolId,
          name: existing.name,
          status: 'failed', // 标记为失败/中断
          input: existing.input,
          output: { message: 'Conversation ended unexpectedly' },
          duration: existing.duration,
        });

        this.events[index] = updated;
      }
    });
  }
}
