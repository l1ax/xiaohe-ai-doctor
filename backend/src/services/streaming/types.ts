import { IncomingMessage, ServerResponse } from 'http';

export interface SSEConnection {
  req: IncomingMessage;
  res: ServerResponse;
  conversationId: string;
  connectedAt: Date;
  timeout?: NodeJS.Timeout;
}

export interface SSEEventData {
  type: 'thinking' | 'intent' | 'tool_call' | 'content' | 'metadata' | 'done' | 'error';
  data: any;
}

export interface SSEConfig {
  heartbeatInterval: number;
  timeout: number;
  retryDelay: number;
}
