import { EventEmitter } from 'events';
import {
  AgentEvent,
  AgentEventListener,
  AgentEventType,
  ThinkingEvent,
  IntentEvent,
  ToolCallEvent,
  ContentEvent,
  MetadataEvent,
  DoneEvent,
  ErrorEvent,
  UserIntent,
  ToolType,
} from './types';

export class AgentEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  emitThinking(message: string): void {
    const event: ThinkingEvent = {
      type: 'agent:thinking',
      data: {
        message,
        timestamp: new Date().toISOString(),
      },
    };
    this.emit('agent:thinking', event);
    this.emit('*', event);
  }

  emitIntent(intent: UserIntent, entities: Record<string, any>): void {
    const event: IntentEvent = {
      type: 'agent:intent',
      data: {
        intent,
        entities,
        timestamp: new Date().toISOString(),
      },
    };
    this.emit('agent:intent', event);
    this.emit('*', event);
  }

  emitToolCall(
    tool: ToolType,
    status: 'running' | 'completed' | 'failed',
    details?: { input?: any; output?: any; error?: string }
  ): void {
    const event: ToolCallEvent = {
      type: 'agent:tool_call',
      data: {
        tool,
        status,
        input: details?.input,
        output: details?.output,
        error: details?.error,
        timestamp: new Date().toISOString(),
      },
    };
    this.emit('agent:tool_call', event);
    this.emit('*', event);
  }

  emitContent(delta: string): void {
    const event: ContentEvent = {
      type: 'agent:content',
      data: {
        delta,
        timestamp: new Date().toISOString(),
      },
    };
    this.emit('agent:content', event);
    this.emit('*', event);
  }

  emitMetadata(metadata: Omit<MetadataEvent['data'], 'timestamp'>): void {
    const event: MetadataEvent = {
      type: 'agent:metadata',
      data: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    };
    this.emit('agent:metadata', event);
    this.emit('*', event);
  }

  emitDone(conversationId: string, messageId?: string): void {
    const event: DoneEvent = {
      type: 'agent:done',
      data: {
        conversationId,
        messageId,
        timestamp: new Date().toISOString(),
      },
    };
    this.emit('agent:done', event);
    this.emit('*', event);
  }

  emitError(error: string, code?: string): void {
    const event: ErrorEvent = {
      type: 'agent:error',
      data: {
        error,
        code,
        timestamp: new Date().toISOString(),
      },
    };
    this.emit('agent:error', event);
    this.emit('*', event);
  }

  on(eventType: AgentEventType | '*', listener: AgentEventListener): this {
    return super.on(eventType, listener);
  }

  once(eventType: AgentEventType | '*', listener: AgentEventListener): this {
    return super.once(eventType, listener);
  }

  off(eventType: AgentEventType | '*', listener: AgentEventListener): this {
    return super.off(eventType, listener);
  }

  removeAllListeners(eventType?: AgentEventType | '*'): this {
    if (eventType) {
      return super.removeAllListeners(eventType);
    }
    return super.removeAllListeners();
  }

  getListenerCount(eventType: AgentEventType | '*'): number {
    return this.listenerCount(eventType);
  }
}

export const globalAgentEventEmitter = new AgentEventEmitter();
