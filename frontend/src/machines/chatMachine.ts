import { setup, assign } from 'xstate';

// ============ 类型定义 ============

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  status: 'pending' | 'sending' | 'streaming' | 'complete' | 'failed';
}

export interface ConversationStatus {
  status: 'idle' | 'sending' | 'processing' | 'streaming' | 'complete' | 'error' | 'closed';
  previousStatus?: string;
  message?: string;
  reason?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  duration?: number;
}

export interface MessageAction {
  type: 'transfer_to_doctor' | 'view_more' | 'book_appointment' | 'retry' | 'cancel';
  label: string;
  data?: Record<string, unknown>;
}

export interface MedicalAdvice {
  symptoms: string[];
  possibleConditions: string[];
  suggestions: string[];
  urgencyLevel: 'low' | 'medium' | 'high';
}

export interface ChatEvent {
  type: string;
  data: {
    conversationId?: string;
    messageId?: string;
    status?: string;
    role?: 'user' | 'assistant';
    delta?: string;
    index?: number;
    isFirst?: boolean;
    isLast?: boolean;
    sources?: Array<{ title: string; url: string; snippet: string }>;
    actions?: MessageAction[];
    medicalAdvice?: MedicalAdvice;
    toolId?: string;
    toolName?: string;
    input?: Record<string, unknown>;
    output?: Record<string, unknown>;
    duration?: number;
    code?: string;
    message?: string;
    timestamp?: string;
  };
}

export interface ChatContext {
  conversationId: string | null;
  messages: Message[];
  currentMessageId: string | null;
  conversationStatus: ConversationStatus;
  toolCalls: ToolCall[];
  actions: MessageAction[];
  medicalAdvice: MedicalAdvice | null;
  error: { code: string; message: string } | null;
  isTyping: boolean;
}

// ============ 事件类型 ============

export type ChatEventType =
  | { type: 'SEND_MESSAGE'; content: string }
  | { type: 'RETRY' }
  | { type: 'CANCEL' }
  | { type: 'TOOL_CALL'; toolId: string; toolName: string; status: string; input?: Record<string, unknown>; output?: Record<string, unknown>; duration?: number }
  | { type: 'MESSAGE_STATUS'; messageId: string; status: string; role: 'user' | 'assistant' }
  | { type: 'MESSAGE_CONTENT'; messageId: string; delta: string; index: number; isFirst: boolean; isLast: boolean }
  | { type: 'MESSAGE_METADATA'; messageId: string; actions?: MessageAction[]; medicalAdvice?: MedicalAdvice }
  | { type: 'CONVERSATION_STATUS'; status: string; message?: string }
  | { type: 'ERROR'; code: string; message: string }
  | { type: 'DONE' }
  | { type: 'RESET' };

// ============ XState 机器定义 ============

export const chatMachine = setup({
  types: {
    context: {} as ChatContext,
    events: {} as ChatEventType,
  },
  actions: {
    setConversationId: assign({
      conversationId: () => null,
    }),

    addUserMessage: assign({
      messages: ({ context, event }): Message[] => {
        if (event.type !== 'SEND_MESSAGE') return context.messages;
        const newMessage: Message = {
          id: `msg_${Date.now()}`,
          role: 'user',
          content: event.content,
          timestamp: new Date().toISOString(),
          status: 'complete',
        };
        return [...context.messages, newMessage];
      },
    }),

    addAssistantMessage: assign({
      messages: ({ context, event }): Message[] => {
        if (event.type !== 'MESSAGE_CONTENT' || !event.isFirst) return context.messages;
        const newMessage: Message = {
          id: event.messageId,
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
          status: 'streaming',
        };
        return [...context.messages, newMessage];
      },
    }),

    updateMessageContent: assign({
      messages: ({ context, event }): Message[] => {
        if (event.type !== 'MESSAGE_CONTENT') return context.messages;
        return context.messages.map((msg) =>
          msg.id === event.messageId
            ? { ...msg, content: msg.content + event.delta, status: 'streaming' as const }
            : msg
        );
      },
    }),

    completeMessage: assign({
      messages: ({ context, event }): Message[] => {
        if (event.type !== 'MESSAGE_CONTENT' || !event.isLast) return context.messages;
        return context.messages.map((msg) =>
          msg.id === event.messageId ? { ...msg, status: 'complete' as const } : msg
        );
      },
      isTyping: () => false,
    }),

    updateMessageStatus: assign({
      messages: ({ context, event }): Message[] => {
        if (event.type !== 'MESSAGE_STATUS') return context.messages;
        return context.messages.map((msg) =>
          msg.id === event.messageId ? { ...msg, status: event.status as Message['status'] } : msg
        );
      },
    }),

    updateConversationStatus: assign({
      conversationStatus: (): ConversationStatus => {
        return { status: 'idle' };
      },
    }),

    addToolCall: assign({
      toolCalls: ({ context, event }): ToolCall[] => {
        if (event.type !== 'TOOL_CALL') return context.toolCalls;
        const newTool: ToolCall = {
          id: event.toolId,
          name: event.toolName,
          status: event.status as ToolCall['status'],
          input: event.input,
        };
        return [...context.toolCalls, newTool];
      },
    }),

    updateToolCall: assign({
      toolCalls: ({ context, event }): ToolCall[] => {
        if (event.type !== 'TOOL_CALL') return context.toolCalls;
        return context.toolCalls.map((tool) =>
          tool.id === event.toolId
            ? {
                ...tool,
                status: event.status as ToolCall['status'],
                output: event.output,
                duration: event.duration,
              }
            : tool
        );
      },
    }),

    setActions: assign({
      actions: (): MessageAction[] => [],
    }),

    setMedicalAdvice: assign({
      medicalAdvice: (): MedicalAdvice | null => null,
    }),

    setError: assign({
      error: (): { code: string; message: string } | null => null,
      conversationStatus: (): ConversationStatus => {
        return { status: 'idle' };
      },
    }),

    resetChat: assign({
      conversationId: () => null,
      messages: () => [],
      currentMessageId: () => null,
      conversationStatus: () => ({ status: 'idle' }),
      toolCalls: () => [],
      actions: () => [],
      medicalAdvice: () => null,
      error: () => null,
      isTyping: () => false,
    }),

    setTyping: assign({
      isTyping: () => true,
    }),
  },
}).createMachine({
  id: 'chat',
  initial: 'idle',
  context: {
    conversationId: null,
    messages: [],
    currentMessageId: null,
    conversationStatus: { status: 'idle' },
    toolCalls: [],
    actions: [],
    medicalAdvice: null,
    error: null,
    isTyping: false,
  },
  states: {
    idle: {
      on: {
        SEND_MESSAGE: {
          target: 'sending',
          actions: ['addUserMessage', 'setTyping'],
        },
        RESET: {
          target: 'idle',
          actions: ['resetChat'],
        },
      },
    },
    sending: {
      on: {
        MESSAGE_STATUS: {
          target: 'processing',
          actions: ['updateMessageStatus'],
        },
        CONVERSATION_STATUS: {
          target: 'processing',
          actions: ['updateConversationStatus'],
        },
        ERROR: {
          target: 'error',
          actions: ['setError'],
        },
      },
    },
    processing: {
      on: {
        TOOL_CALL: {
          actions: ['addToolCall'],
        },
        MESSAGE_CONTENT: {
          target: 'streaming',
          actions: ['addAssistantMessage', 'setTyping'],
        },
        CONVERSATION_STATUS: {
          actions: ['updateConversationStatus'],
        },
        ERROR: {
          target: 'error',
          actions: ['setError'],
        },
        DONE: {
          target: 'complete',
        },
      },
    },
    streaming: {
      on: {
        MESSAGE_CONTENT: {
          actions: ['updateMessageContent'],
        },
        MESSAGE_METADATA: {
          actions: ['setActions', 'setMedicalAdvice'],
        },
        TOOL_CALL: {
          actions: ['updateToolCall'],
        },
        CONVERSATION_STATUS: {
          actions: ['updateConversationStatus'],
        },
        DONE: {
          target: 'complete',
          actions: ['completeMessage'],
        },
        ERROR: {
          target: 'error',
          actions: ['setError', 'completeMessage'],
        },
      },
      entry: ['setTyping'],
    },
    complete: {
      on: {
        SEND_MESSAGE: {
          target: 'sending',
          actions: ['addUserMessage', 'setTyping'],
        },
        RESET: {
          target: 'idle',
          actions: ['resetChat'],
        },
      },
    },
    error: {
      on: {
        RETRY: {
          target: 'sending',
        },
        CANCEL: {
          target: 'idle',
          actions: ['resetChat'],
        },
        SEND_MESSAGE: {
          target: 'sending',
          actions: ['addUserMessage', 'setTyping'],
        },
        RESET: {
          target: 'idle',
          actions: ['resetChat'],
        },
      },
    },
  },
});

// ============ 事件解析器 ============

export function parseServerEvent(event: ChatEvent): ChatEventType | null {
  switch (event.type) {
    case 'conversation:status':
      return {
        type: 'CONVERSATION_STATUS',
        status: event.data.status || 'idle',
        message: event.data.message,
      };

    case 'message:status':
      return {
        type: 'MESSAGE_STATUS',
        messageId: event.data.messageId || '',
        status: event.data.status || 'pending',
        role: event.data.role || 'assistant',
      };

    case 'message:content':
      if (!event.data.delta) return null;
      return {
        type: 'MESSAGE_CONTENT',
        messageId: event.data.messageId || '',
        delta: event.data.delta,
        index: event.data.index || 0,
        isFirst: event.data.isFirst || false,
        isLast: event.data.isLast || false,
      };

    case 'message:metadata':
      return {
        type: 'MESSAGE_METADATA',
        messageId: event.data.messageId || '',
        actions: event.data.actions,
        medicalAdvice: event.data.medicalAdvice,
      };

    case 'tool:call':
      return {
        type: 'TOOL_CALL',
        toolId: event.data.toolId || '',
        toolName: event.data.toolName || '',
        status: event.data.status || 'pending',
        input: event.data.input,
        output: event.data.output,
        duration: event.data.duration,
      };

    case 'conversation:end':
      return { type: 'DONE' };

    case 'error':
      return {
        type: 'ERROR',
        code: event.data.code || 'UNKNOWN_ERROR',
        message: event.data.message || 'Unknown error',
      };

    // 旧事件类型兼容
    case 'agent:content':
      if (!event.data.delta) return null;
      return {
        type: 'MESSAGE_CONTENT',
        messageId: event.data.messageId || '',
        delta: event.data.delta,
        index: event.data.index || 0,
        isFirst: event.data.isFirst || false,
        isLast: event.data.isLast || false,
      };

    case 'agent:tool_call':
      return {
        type: 'TOOL_CALL',
        toolId: (event.data as any).toolId || '',
        toolName: (event.data as any).toolName || (event.data as any).tool || '',
        status: event.data.status || 'pending',
        input: event.data.input,
        output: (event.data as any).output,
      };

    case 'agent:done':
      return { type: 'DONE' };

    case 'agent:error':
      return {
        type: 'ERROR',
        code: event.data.code || 'AGENT_ERROR',
        message: (event.data as any).error || 'Unknown error',
      };

    default:
      return null;
  }
}
