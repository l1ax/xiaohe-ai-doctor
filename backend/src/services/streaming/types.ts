import { IncomingMessage, ServerResponse } from 'http';

export interface SSEConnection {
  req: IncomingMessage;
  res: ServerResponse;
  conversationId: string;
  connectedAt: Date;
  timeout?: NodeJS.Timeout;
}

export interface SSEEventData {
  type: 'thinking' | 'intent' | 'tool_call' | 'content' | 'metadata' | 'done' | 'error' | 'conversation_status' | 'message_status' | 'message_content' | 'message_metadata' | 'conversation_end';
  data: any;
}

export interface SSEConfig {
  heartbeatInterval: number;
  timeout: number;
  retryDelay: number;
}
