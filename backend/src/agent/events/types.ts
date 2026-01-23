import { UserIntent } from '../types';

// Re-export UserIntent for use in AgentEventEmitter
export { UserIntent } from '../types';

export type AgentEventType =
  | 'agent:thinking'
  | 'agent:intent'
  | 'agent:tool_call'
  | 'agent:content'
  | 'agent:metadata'
  | 'agent:done'
  | 'agent:error';

export type ToolType = 'coze_knowledge' | 'web_search' | 'hospital_query' | 'ocr';

export interface ThinkingEvent {
  type: 'agent:thinking';
  data: { message: string; timestamp: string };
}

export interface IntentEvent {
  type: 'agent:intent';
  data: { intent: UserIntent; entities: Record<string, any>; timestamp: string };
}

export interface ToolCallEvent {
  type: 'agent:tool_call';
  data: {
    tool: ToolType;
    status: 'running' | 'completed' | 'failed';
    input?: any;
    output?: any;
    error?: string;
    timestamp: string;
  };
}

export interface ContentEvent {
  type: 'agent:content';
  data: { delta: string; timestamp: string };
}

export interface MetadataEvent {
  type: 'agent:metadata';
  data: {
    sources?: Array<{ title: string; url: string; snippet: string }>;
    medicalAdvice?: {
      symptoms: string[];
      possibleConditions: string[];
      suggestions: string[];
      urgencyLevel: 'low' | 'medium' | 'high';
    };
    actions?: Array<{
      type: 'transfer_to_doctor' | 'view_more' | 'book_appointment';
      label: string;
      data?: any;
    }>;
    timestamp: string;
  };
}

export interface DoneEvent {
  type: 'agent:done';
  data: { conversationId: string; messageId?: string; timestamp: string };
}

export interface ErrorEvent {
  type: 'agent:error';
  data: { error: string; code?: string; timestamp: string };
}

export type AgentEvent =
  | ThinkingEvent
  | IntentEvent
  | ToolCallEvent
  | ContentEvent
  | MetadataEvent
  | DoneEvent
  | ErrorEvent;

export type AgentEventListener = (event: AgentEvent) => void | Promise<void>;
