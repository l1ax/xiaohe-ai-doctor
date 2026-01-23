import { IncomingMessage, ServerResponse } from 'http';
import { globalAgentEventEmitter } from '../../agent/events/AgentEventEmitter';
import type { AgentEvent } from '../../agent/events/types';
import { SSEConnection, SSEEventData, SSEConfig } from './types';

export class SSEHandler {
  private static instance: SSEHandler;
  private connections: Map<string, SSEConnection> = new Map();
  private config: SSEConfig;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private eventListener?: (event: AgentEvent) => void;
  private connectionIdCounter = 0;

  private constructor(config?: Partial<SSEConfig>) {
    this.config = {
      heartbeatInterval: config?.heartbeatInterval ?? 30000,
      timeout: config?.timeout ?? 60000,
      retryDelay: config?.retryDelay ?? 1000,
    };
  }

  static getInstance(config?: Partial<SSEConfig>): SSEHandler {
    if (!SSEHandler.instance) {
      SSEHandler.instance = new SSEHandler(config);
    }
    return SSEHandler.instance;
  }

  handleConnection(req: IncomingMessage, res: ServerResponse, conversationId: string): void {
    const connectionId = `conn_${this.connectionIdCounter++}_${Date.now()}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const connection: SSEConnection = {
      req,
      res,
      conversationId,
      connectedAt: new Date(),
    };

    this.connections.set(connectionId, connection);

    this.sendSSEEvent(res, 'connected', {
      connectionId,
      conversationId,
      timestamp: new Date().toISOString(),
    });

    req.on('close', () => {
      this.closeConnection(connectionId);
    });

    if (!this.heartbeatInterval) {
      this.startHeartbeat();
    }

    if (!this.eventListener) {
      this.startEventListener();
    }

    const timeout = setTimeout(() => {
      this.closeConnection(connectionId);
    }, this.config.timeout);

    this.connections.set(connectionId, { ...connection, timeout });
  }

  startEventListener(): void {
    if (this.eventListener) return;

    this.eventListener = (event: AgentEvent) => this.sendAgentEvent(event);
    globalAgentEventEmitter.on('*', this.eventListener);
  }

  stopEventListener(): void {
    if (this.eventListener) {
      globalAgentEventEmitter.removeListener('*', this.eventListener);
      this.eventListener = undefined;
    }
  }

  broadcastEvent(eventData: SSEEventData): void {
    const deadConnections: string[] = [];

    for (const [connectionId, connection] of this.connections) {
      const success = this.sendSSEEvent(connection.res, eventData.type, eventData.data);
      if (!success) {
        deadConnections.push(connectionId);
      }
    }

    // Clean up dead connections
    for (const connectionId of deadConnections) {
      this.closeConnection(connectionId);
    }
  }

  private sendAgentEvent(agentEvent: AgentEvent): void {
    const eventTypeMap: Record<string, SSEEventData['type']> = {
      'agent:thinking': 'thinking',
      'agent:intent': 'intent',
      'agent:tool_call': 'tool_call',
      'agent:content': 'content',
      'agent:metadata': 'metadata',
      'agent:done': 'done',
      'agent:error': 'error',
    };

    const sseType = eventTypeMap[agentEvent.type];
    if (!sseType) return;

    const eventData: SSEEventData = {
      type: sseType,
      data: agentEvent.data,
    };

    // Extract conversationId from event data (C2) - added by controller
    const conversationId = (agentEvent.data as any).conversationId as string | undefined;

    if (conversationId) {
      // Send only to connections for this conversation
      this.sendToConversation(conversationId, eventData);
    } else {
      // Fallback to broadcast if no conversationId (shouldn't happen in normal flow)
      this.broadcastEvent(eventData);
    }
  }

  private sendSSEEvent(res: ServerResponse, event: string, data: any): boolean {
    try {
      const dataStr = JSON.stringify(data);
      res.write(`event: ${event}\n`);
      res.write(`data: ${dataStr}\n\n`);
      return true;
    } catch (error) {
      console.error('Error sending SSE event:', error);
      return false;
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const heartbeatData = {
        timestamp: new Date().toISOString(),
      };
      const deadConnections: string[] = [];

      for (const [connectionId, connection] of this.connections) {
        const success = this.sendSSEEvent(connection.res, 'heartbeat', heartbeatData);
        if (!success) {
          deadConnections.push(connectionId);
        }
      }

      // Clean up dead connections
      for (const connectionId of deadConnections) {
        this.closeConnection(connectionId);
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private closeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      if (connection.timeout) {
        clearTimeout(connection.timeout);
      }
      try {
        connection.res.end();
      } catch (error) {
        console.error('Error closing connection:', error);
      }
      this.connections.delete(connectionId);
    }

    if (this.connections.size === 0) {
      this.stopHeartbeat();
    }
  }

  closeAllConnections(): void {
    for (const [connectionId] of this.connections) {
      this.closeConnection(connectionId);
    }
    this.stopEventListener();
  }

  getActiveConnectionCount(): number {
    return this.connections.size;
  }

  sendToConversation(conversationId: string, eventData: SSEEventData): void {
    for (const [, connection] of this.connections) {
      if (connection.conversationId === conversationId) {
        this.sendSSEEvent(connection.res, eventData.type, eventData.data);
      }
    }
  }
}
