# AI 对话功能实施计划

> **For Claude:** REQUIRED SUB-SKILL: 使用 superpowers:using-git-worktrees 创建隔离工作区，然后使用 superpowers:writing-plans 创建详细实现计划，最后使用 superpowers:subagent-driven-development 执行开发。

**Goal:** 实现完整的 AI 对话功能，包括后端事件状态机改造、前端 XState 状态机、消息渲染器，以及与后端 Agent 的 SSE 流式对接。

**Architecture:**
- 后端：事件状态机管理所有事件类型
- 前端：XState 管理对话/消息状态机，组件化消息渲染器
- 通信：SSE 流式传输，事件驱动架构

**Tech Stack:** React 18 + TypeScript + XState + SSE + Tailwind CSS

---

## 后端改造（第一阶段）

### Task 1.1: 创建统一事件类型定义

**文件：**
- Create: `backend/src/agent/events/chat-event-types.ts`
- Create: `backend/src/agent/events/EventStateMachine.ts`
- Modify: `backend/src/agent/events/types.ts`（保留兼容）

**Step 1: 创建统一事件类型**

```typescript
// backend/src/agent/events/chat-event-types.ts

import { UserIntent } from '../types';

// 状态定义
export type ConversationStatus = 'idle' | 'sending' | 'processing' | 'streaming' | 'complete' | 'error' | 'closed';
export type MessageStatus = 'pending' | 'sending' | 'streaming' | 'complete' | 'failed';
export type ToolStatus = 'pending' | 'running' | 'completed' | 'failed';

// 基础事件接口
export interface BaseEvent {
  type: string;
  data: {
    conversationId: string;
    timestamp: string;
  };
}

// 对话状态事件
export interface ConversationStatusEvent extends BaseEvent {
  type: 'conversation:status';
  data: BaseEvent['data'] & {
    status: ConversationStatus;
    previousStatus?: ConversationStatus;
    message?: string;
    reason?: string;
  };
}

// 消息状态事件
export interface MessageStatusEvent extends BaseEvent {
  type: 'message:status';
  data: BaseEvent['data'] & {
    messageId: string;
    status: MessageStatus;
    role: 'user' | 'assistant';
  };
}

// 消息内容事件
export interface MessageContentEvent extends BaseEvent {
  type: 'message:content';
  data: BaseEvent['data'] & {
    messageId: string;
    delta: string;
    index: number;
    isFirst: boolean;
    isLast: boolean;
  };
}

// 消息元数据事件
export interface MessageMetadataEvent extends BaseEvent {
  type: 'message:metadata';
  data: BaseEvent['data'] & {
    messageId: string;
    sources?: Array<{ title: string; url: string; snippet: string }>;
    actions?: Array<{
      type: 'transfer_to_doctor' | 'view_more' | 'book_appointment' | 'retry' | 'cancel';
      label: string;
      data?: Record<string, any>;
    }>;
    medicalAdvice?: {
      symptoms: string[];
      possibleConditions: string[];
      suggestions: string[];
      urgencyLevel: 'low' | 'medium' | 'high';
    };
  };
}

// 工具调用事件
export interface ToolCallEvent extends BaseEvent {
  type: 'tool:call';
  data: BaseEvent['data'] & {
    toolId: string;
    toolName: string;
    messageId: string;
    status: ToolStatus;
    input?: Record<string, any>;
    output?: Record<string, any>;
    error?: string;
    duration?: number;
  };
}

// 错误事件
export interface ErrorEvent extends BaseEvent {
  type: 'error';
  data: BaseEvent['data'] & {
    messageId?: string;
    code: string;
    message: string;
    recoverable: boolean;
    suggestion?: string;
  };
}

// 会话结束事件
export interface ConversationEndEvent extends BaseEvent {
  type: 'conversation:end';
  data: BaseEvent['data'] & {
    messageId: string;
    duration: number;
    messageCount: number;
  };
}

// 统一事件类型
export type ChatEvent =
  | ConversationStatusEvent
  | MessageStatusEvent
  | MessageContentEvent
  | MessageMetadataEvent
  | ToolCallEvent
  | ErrorEvent
  | ConversationEndEvent;

// 事件工厂函数
export function createConversationStatusEvent(...): ConversationStatusEvent { ... }
export function createMessageStatusEvent(...): MessageStatusEvent { ... }
export function createMessageContentEvent(...): MessageContentEvent { ... }
export function createToolCallEvent(...): ToolCallEvent { ... }
export function createErrorEvent(...): ErrorEvent { ... }
```

**Step 2: 创建事件状态机**

```typescript
// backend/src/agent/events/EventStateMachine.ts

import { EventEmitter } from 'events';
import {
  ChatEvent,
  ConversationStatus,
  MessageStatus,
  ToolStatus,
  createConversationStatusEvent,
  createMessageStatusEvent,
  createMessageContentEvent,
  createToolCallEvent,
  createErrorEvent,
} from './chat-event-types';
import { logger } from '../../utils/logger';

interface ConversationContext {
  conversationId: string;
  currentStatus: ConversationStatus;
  messageId: string | null;
  toolCalls: Map<string, { name: string; status: ToolStatus }>;
  createdAt: Date;
  lastEventAt: Date;
}

interface MessageContext {
  messageId: string;
  role: 'user' | 'assistant';
  content: string;
  chunks: string[];
  status: MessageStatus;
  sources: any[];
  actions: any[];
  medicalAdvice: any | null;
}

export class EventStateMachine extends EventEmitter {
  private conversations: Map<string, ConversationContext> = new Map();
  private messages: Map<string, MessageContext> = new Map();

  constructor() {
    super();
    this.setupDefaultHandlers();
  }

  private setupDefaultHandlers(): void {
    this.on('conversation:status', this.handleConversationStatus.bind(this));
    this.on('message:status', this.handleMessageStatus.bind(this));
    this.on('message:content', this.handleMessageContent.bind(this));
    this.on('message:metadata', this.handleMessageMetadata.bind(this));
    this.on('tool:call', this.handleToolCall.bind(this));
    this.on('error', this.handleError.bind(this));
  }

  private isValidStatusTransition(from: ConversationStatus, to: ConversationStatus): boolean {
    const valid: Record<ConversationStatus, ConversationStatus[]> = {
      idle: ['sending', 'closed'],
      sending: ['processing', 'error', 'closed'],
      processing: ['streaming', 'error', 'closed'],
      streaming: ['complete', 'error', 'closed'],
      complete: ['idle', 'closed'],
      error: ['idle', 'closed'],
      closed: [],
    };
    return valid[from]?.includes(to) ?? false;
  }

  private handleConversationStatus(event: ChatEvent): void { /* ... */ }
  private handleMessageStatus(event: ChatEvent): void { /* ... */ }
  private handleMessageContent(event: ChatEvent): void { /* ... */ }
  private handleMessageMetadata(event: ChatEvent): void { /* ... */ }
  private handleToolCall(event: ChatEvent): void { /* ... */ }
  private handleError(event: ChatEvent): void { /* ... */ }

  // 公共方法
  startConversation(conversationId: string): ConversationContext { /* ... */ }
  getConversation(id: string): ConversationContext | undefined { /* ... */ }
  getMessage(id: string): MessageContext | undefined { /* ... */ }
  resetConversation(id: string): void { /* ... */ }
  closeConversation(id: string): void { /* ... */ }
}

export const eventStateMachine = new EventStateMachine();
```

**Step 3: 提交**

```bash
git add backend/src/agent/events/
git commit -m "feat: add unified event types and state machine"
```

---

### Task 1.2: 修改 Agent 节点发送事件

**文件：**
- Modify: `backend/src/agent/nodes/classifyIntent.ts`
- Modify: `backend/src/agent/nodes/symptomAnalysis.ts`
- Modify: `backend/src/agent/nodes/consultation.ts`
- Modify: `backend/src/agent/nodes/hospitalRecommend.ts`
- Modify: `backend/src/agent/nodes/medicineInfo.ts`
- Modify: `backend/src/agent/nodes/synthesizeResponse.ts`

**Step 1: 修改 classifyIntent.ts**

```typescript
// backend/src/agent/nodes/classifyIntent.ts

import { NodeConnection, NodeInput, NodeOutput } from '@langchain/langgraph';
import { AgentState } from '../state';
import {
  createConversationStatusEvent,
  createMessageStatusEvent,
  createMessageContentEvent,
  createToolCallEvent,
} from '../events/chat-event-types';
import { UserIntent } from '../types';
import { logger } from '../../utils/logger';

export function classifyIntent(state: typeof AgentState.State): NodeOutput {
  const { messages, conversationId, eventEmitter } = state;
  const lastMessage = messages[messages.length - 1];

  // 发送对话状态
  eventEmitter.emit('conversation:status', createConversationStatusEvent(
    conversationId,
    'processing',
    { previousStatus: 'sending', message: '正在分析您的问题...' }
  ));

  // 发送消息状态
  const messageId = `msg_${Date.now()}`;
  eventEmitter.emit('message:status', createMessageStatusEvent(
    conversationId,
    messageId,
    'sending',
    'assistant'
  ));

  // 意图分类逻辑
  const content = lastMessage.content.toLowerCase();
  let intent: UserIntent = 'general_qa';

  // 症状关键词检测
  const symptomKeywords = ['疼', '痛', '不舒服', '症状', '难受', '发热', '发烧', '咳嗽'];
  if (symptomKeywords.some(kw => content.includes(kw))) {
    intent = 'symptom_consult';
  }
  // 医院关键词检测
  else if (content.includes('医院') || content.includes('医生') || content.includes('科室')) {
    intent = 'hospital_recommend';
  }
  // 药品关键词检测
  else if (content.includes('药') || content.includes('药片') || content.includes('服用')) {
    intent = 'medicine_info';
  }

  logger.info(`Intent classified: ${intent}`, { conversationId });

  return {
    userIntent: intent,
  };
}
```

**Step 2: 修改 symptomAnalysis.ts**

```typescript
// backend/src/agent/nodes/symptomAnalysis.ts

import { AgentState } from '../state';
import {
  createConversationStatusEvent,
  createToolCallEvent,
  createMessageContentEvent,
} from '../events/chat-event-types';

export function symptomAnalysis(state: typeof AgentState.State): NodeOutput {
  const { messages, conversationId, eventEmitter } = state;

  // 发送工具调用开始事件
  eventEmitter.emit('tool:call', createToolCallEvent(
    conversationId,
    `tool_${Date.now()}`,
    'symptom_analysis',
    state.messageId || '',
    'running',
    { input: { message: messages[messages.length - 1].content } }
  ));

  // 模拟症状分析结果
  const analysisResult = '根据您描述的症状，可能是上呼吸道感染引起的。建议您多休息，多喝水...';

  // 发送内容流
  const words = analysisResult.split('');
  words.forEach((word, index) => {
    eventEmitter.emit('message:content', createMessageContentEvent(
      conversationId,
      state.messageId || '',
      word,
      index,
      index === 0,
      index === words.length - 1
    ));
  });

  // 工具调用完成
  eventEmitter.emit('tool:call', createToolCallEvent(
    conversationId,
    `tool_${Date.now()}`,
    'symptom_analysis',
    state.messageId || '',
    'completed',
    { output: { result: analysisResult }, duration: 1500 }
  ));

  return {
    branchResult: analysisResult,
  };
}
```

**Step 3: 修改 synthesizeResponse.ts**

```typescript
// backend/src/agent/nodes/synthesizeResponse.ts

import { AgentState } from '../state';
import {
  createConversationStatusEvent,
  createMessageMetadataEvent,
  createMessageContentEvent,
} from '../events/chat-event-types';

export function synthesizeResponse(state: typeof AgentState.State): NodeOutput {
  const { branchResult, conversationId, eventEmitter } = state;

  // 发送流式内容
  const words = (branchResult || '').split('');
  words.forEach((word, index) => {
    eventEmitter.emit('message:content', createMessageContentEvent(
      conversationId,
      state.messageId || '',
      word,
      index,
      index === 0,
      index === words.length - 1
    ));
  });

  // 发送元数据（医疗建议卡片）
  eventEmitter.emit('message:metadata', createMessageMetadataEvent(
    conversationId,
    state.messageId || '',
    undefined,
    [
      { type: 'transfer_to_doctor', label: '咨询人工医生', data: { action: 'transfer' } },
      { type: 'book_appointment', label: '预约挂号', data: { action: 'booking' } },
    ],
    {
      symptoms: ['发热', '咳嗽', '乏力'],
      possibleConditions: ['上呼吸道感染', '流感'],
      suggestions: ['多休息', '多喝水', '必要时就医'],
      urgencyLevel: 'medium',
    }
  ));

  // 发送对话完成状态
  eventEmitter.emit('conversation:status', createConversationStatusEvent(
    conversationId,
    'complete',
    { message: '对话完成' }
  ));

  return {
    messages: [...state.messages, { role: 'assistant', content: branchResult || '' }],
  };
}
```

**Step 4: 提交**

```bash
git add backend/src/agent/nodes/
git commit -m "feat: update agent nodes to emit state machine events"
```

---

### Task 1.3: 修改 SSE Handler 支持新事件

**文件：**
- Modify: `backend/src/services/streaming/SSEHandler.ts`

**Step 1: 更新 SSEHandler**

```typescript
// backend/src/services/streaming/SSEHandler.ts

import { EventEmitter } from 'events';
import { Request, Response } from 'express';
import { ChatEvent } from '../../agent/events/chat-event-types';

interface SSEConnection {
  id: string;
  conversationId: string;
  response: Response;
  lastEventAt: Date;
}

interface SSEConfig {
  heartbeatInterval: number;
  timeout: number;
  retryDelay: number;
}

export class SSEHandler extends EventEmitter {
  private connections: Map<string, SSEConnection> = new Map();
  private config: SSEConfig;
  private heartbeatTimer?: NodeJS.Timeout;
  private eventStateMachine: any;

  constructor(config: SSEConfig, eventStateMachine?: any) {
    super();
    this.config = config;
    this.eventStateMachine = eventStateMachine;
    this.startHeartbeat();
  }

  // 处理 SSE 连接
  handleConnection(req: Request, res: Response, conversationId: string): void {
    // 设置 SSE 头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const connectionId = `${conversationId}_${Date.now()}`;

    // 保存连接
    this.connections.set(connectionId, {
      id: connectionId,
      conversationId,
      response: res,
      lastEventAt: new Date(),
    });

    // 发送初始连接事件
    this.sendToConnection(connectionId, {
      type: 'connection:established',
      data: { conversationId, timestamp: new Date().toISOString() },
    });

    // 监听状态机事件并转发
    if (this.eventStateMachine) {
      const forwardHandler = (event: ChatEvent) => {
        this.sendToConversation(conversationId, event);
      };
      this.eventStateMachine.on('*', forwardHandler);

      // 清理监听器
      req.on('close', () => {
        this.eventStateMachine.off('*', forwardHandler);
        this.removeConnection(connectionId);
      });
    }

    req.on('close', () => {
      this.removeConnection(connectionId);
    });

    logger.info(`SSE connection established: ${connectionId}`);
  }

  // 发送事件到指定连接
  sendToConnection(connectionId: string, event: object): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      const data = JSON.stringify(event);
      connection.response.write(`event: ${(event as any).type}\n`);
      connection.response.write(`data: ${data}\n\n`);
      connection.lastEventAt = new Date();
    } catch (error) {
      logger.error(`Failed to send event to ${connectionId}:`, error);
      this.removeConnection(connectionId);
    }
  }

  // 发送事件到指定会话的所有连接
  sendToConversation(conversationId: string, event: object): void {
    for (const [connectionId, connection] of this.connections.entries()) {
      if (connection.conversationId === conversationId) {
        this.sendToConnection(connectionId, event);
      }
    }
  }

  // 启动心跳
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      const now = new Date();
      for (const [connectionId, connection] of this.connections.entries()) {
        if (now.getTime() - connection.lastEventAt.getTime() > this.config.timeout) {
          this.sendToConnection(connectionId, {
            type: 'heartbeat',
            data: { timestamp: now.toISOString() },
          });
          connection.lastEventAt = now;
        }
      }
    }, this.config.heartbeatInterval);
  }

  private removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      try {
        connection.response.end();
      } catch (error) {
        // 忽略关闭错误
      }
      this.connections.delete(connectionId);
      logger.info(`SSE connection removed: ${connectionId}`);
    }
  }

  closeAllConnections(): void {
    for (const connectionId of this.connections.keys()) {
      this.removeConnection(connectionId);
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
  }
}
```

**Step 2: 提交**

```bash
git add backend/src/services/streaming/
git commit -m "feat: update SSE handler for new event protocol"
```

---

## 前端开发（第二阶段）

### Task 2.1: 创建 XState 状态机

**文件：**
- Create: `frontend/src/store/chat/chatMachine.ts`
- Create: `frontend/src/store/chat/messageMachine.ts`

**Step 1: 安装 XState**

```bash
npm install xstate @xstate/react
```

**Step 2: 创建对话状态机**

```typescript
// frontend/src/store/chat/chatMachine.ts

import { setup, assign, fromPromise } from 'xstate';
import { ChatEvent } from '../../types/chat-events';

export interface ChatContext {
  conversationId: string | null;
  messages: Map<string, MessageContext>;
  activeToolCall: ToolCallContext | null;
  error: { code: string; message: string } | null;
  inputText: string;
}

export interface MessageContext {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'pending' | 'streaming' | 'complete' | 'failed';
  sources?: Array<{ title: string; url: string; snippet: string }>;
  actions?: Array<{ type: string; label: string; data?: any }>;
  medicalAdvice?: {
    symptoms: string[];
    possibleConditions: string[];
    suggestions: string[];
    urgencyLevel: 'low' | 'medium' | 'high';
  };
}

export interface ToolCallContext {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input?: any;
  output?: any;
  error?: string;
}

export const chatMachine = setup({
  types: {
    context: {} as ChatContext,
    events: {} as
      | { type: 'INPUT_CHANGED'; text: string }
      | { type: 'SEND_MESSAGE' }
      | { type: 'CANCEL' }
      | { type: 'RETRY' }
      | { type: 'EVENT_RECEIVED'; event: ChatEvent }
      | { type: 'CLEAR_ERROR' },
  },
  actions: {
    setInputText: assign({
      inputText: ({ event }) => event.type === 'INPUT_CHANGED' ? event.text : '',
    }),
    addUserMessage: assign({
      messages: ({ context }) => {
        const newId = `msg_${Date.now()}`;
        const messages = new Map(context.messages);
        messages.set(newId, {
          id: newId,
          role: 'user',
          content: context.inputText,
          status: 'pending',
        });
        return messages;
      },
      inputText: () => '',
    }),
    updateMessageContent: assign({
      messages: ({ context, event }) => {
        if (event.type !== 'EVENT_RECEIVED') return context.messages;
        const { event: chatEvent } = event.data;
        if (chatEvent.type !== 'message:content') return context.messages;

        const messages = new Map(context.messages);
        const msg = messages.get(chatEvent.data.messageId);
        if (msg) {
          messages.set(chatEvent.data.messageId, {
            ...msg,
            content: msg.content + chatEvent.data.delta,
            status: chatEvent.data.isLast ? 'complete' : 'streaming',
          });
        }
        return messages;
      },
    }),
    setMessageStatus: assign({
      messages: ({ context, event }) => {
        if (event.type !== 'EVENT_RECEIVED') return context.messages;
        const { event: chatEvent } = event.data;
        if (chatEvent.type !== 'message:status') return context.messages;

        const messages = new Map(context.messages);
        messages.set(chatEvent.data.messageId, {
          id: chatEvent.data.messageId,
          role: chatEvent.data.role,
          content: '',
          status: chatEvent.data.status === 'sending' ? 'streaming' : chatEvent.data.status,
        });
        return messages;
      },
    }),
    updateMessageMetadata: assign({
      messages: ({ context, event }) => {
        if (event.type !== 'EVENT_RECEIVED') return context.messages;
        const { event: chatEvent } = event.data;
        if (chatEvent.type !== 'message:metadata') return context.messages;

        const messages = new Map(context.messages);
        const msg = messages.get(chatEvent.data.messageId);
        if (msg) {
          messages.set(chatEvent.data.messageId, {
            ...msg,
            sources: chatEvent.data.sources,
            actions: chatEvent.data.actions,
            medicalAdvice: chatEvent.data.medicalAdvice,
          });
        }
        return messages;
      },
    }),
    updateActiveToolCall: assign({
      activeToolCall: ({ context, event }) => {
        if (event.type !== 'EVENT_RECEIVED') return context.activeToolCall;
        const { event: chatEvent } = event.data;
        if (chatEvent.type !== 'tool:call') return context.activeToolCall;

        return {
          id: chatEvent.data.toolId,
          name: chatEvent.data.toolName,
          status: chatEvent.data.status,
          input: chatEvent.data.input,
          output: chatEvent.data.output,
          error: chatEvent.data.error,
        };
      },
    }),
    setError: assign({
      error: ({ event }) => {
        if (event.type !== 'EVENT_RECEIVED') return null;
        const { event: chatEvent } = event.data;
        if (chatEvent.type !== 'error') return null;
        return { code: chatEvent.data.code, message: chatEvent.data.message };
      },
    }),
    clearError: assign({ error: () => null }),
  },
}).createMachine({
  id: 'chat',
  initial: 'idle',
  context: {
    conversationId: null,
    messages: new Map(),
    activeToolCall: null,
    error: null,
    inputText: '',
  },
  states: {
    idle: {
      on: {
        INPUT_CHANGED: { actions: 'setInputText' },
        SEND_MESSAGE: { target: 'sending' },
      },
    },
    sending: {
      entry: ['addUserMessage'],
      after: {
        100: { target: 'processing' },
      },
      on: {
        EVENT_RECEIVED: [
          { guard: ({ event }) => event.event.type === 'message:status', actions: 'setMessageStatus' },
          { guard: ({ event }) => event.event.type === 'message:content', actions: 'updateMessageContent' },
          { guard: ({ event }) => event.event.type === 'message:metadata', actions: 'updateMessageMetadata' },
          { guard: ({ event }) => event.event.type === 'tool:call', actions: 'updateActiveToolCall' },
          { guard: ({ event }) => event.event.type === 'error', actions: 'setError', target: 'error' },
        ],
        CANCEL: { target: 'idle' },
      },
    },
    processing: {
      on: {
        EVENT_RECEIVED: [
          { guard: ({ event }) => event.event.type === 'message:content', actions: 'updateMessageContent' },
          { guard: ({ event }) => event.event.type === 'message:metadata', actions: 'updateMessageMetadata' },
          { guard: ({ event }) => event.event.type === 'tool:call', actions: 'updateActiveToolCall' },
          { guard: ({ event }) => event.event.type === 'conversation:status' && event.event.data.status === 'complete', target: 'idle' },
          { guard: ({ event }) => event.event.type === 'error', actions: 'setError', target: 'error' },
        ],
        CANCEL: { target: 'idle' },
      },
    },
    error: {
      on: {
        RETRY: { target: 'sending' },
        CLEAR_ERROR: { target: 'idle' },
        EVENT_RECEIVED: { target: 'idle' },
      },
    },
  },
});
```

**Step 3: 提交**

```bash
git add frontend/src/store/chat/
git commit -m "feat: add XState chat machine"
```

---

### Task 2.2: 创建消息类型和渲染器

**文件：**
- Create: `frontend/src/types/chat-events.ts`
- Create: `frontend/src/components/MessageRenderer/`
- Create: `frontend/src/components/MessageRenderer/index.tsx`
- Create: `frontend/src/components/MessageRenderer/components/`

**Step 1: 创建消息类型定义**

```typescript
// frontend/src/types/chat-events.ts

export type ConversationStatus = 'idle' | 'sending' | 'processing' | 'streaming' | 'complete' | 'error' | 'closed';
export type MessageStatus = 'pending' | 'sending' | 'streaming' | 'complete' | 'failed';
export type ToolStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface BaseEvent {
  type: string;
  data: {
    conversationId: string;
    timestamp: string;
  };
}

export interface ConversationStatusEvent extends BaseEvent {
  type: 'conversation:status';
  data: BaseEvent['data'] & {
    status: ConversationStatus;
    previousStatus?: ConversationStatus;
    message?: string;
    reason?: string;
  };
}

export interface MessageStatusEvent extends BaseEvent {
  type: 'message:status';
  data: BaseEvent['data'] & {
    messageId: string;
    status: MessageStatus;
    role: 'user' | 'assistant';
  };
}

export interface MessageContentEvent extends BaseEvent {
  type: 'message:content';
  data: BaseEvent['data'] & {
    messageId: string;
    delta: string;
    index: number;
    isFirst: boolean;
    isLast: boolean;
  };
}

export interface MessageMetadataEvent extends BaseEvent {
  type: 'message:metadata';
  data: BaseEvent['data'] & {
    messageId: string;
    sources?: Array<{ title: string; url: string; snippet: string }>;
    actions?: Array<{
      type: 'transfer_to_doctor' | 'view_more' | 'book_appointment' | 'retry' | 'cancel';
      label: string;
      data?: Record<string, any>;
    }>;
    medicalAdvice?: {
      symptoms: string[];
      possibleConditions: string[];
      suggestions: string[];
      urgencyLevel: 'low' | 'medium' | 'high';
    };
  };
}

export interface ToolCallEvent extends BaseEvent {
  type: 'tool:call';
  data: BaseEvent['data'] & {
    toolId: string;
    toolName: string;
    messageId: string;
    status: ToolStatus;
    input?: Record<string, any>;
    output?: Record<string, any>;
    error?: string;
    duration?: number;
  };
}

export interface ErrorEvent extends BaseEvent {
  type: 'error';
  data: BaseEvent['data'] & {
    messageId?: string;
    code: string;
    message: string;
    recoverable: boolean;
    suggestion?: string;
  };
}

export type ChatEvent =
  | ConversationStatusEvent
  | MessageStatusEvent
  | MessageContentEvent
  | MessageMetadataEvent
  | ToolCallEvent
  | ErrorEvent;
```

**Step 2: 创建 TextMessage 渲染器**

```tsx
// frontend/src/components/MessageRenderer/components/TextMessage.tsx

import { observer } from 'mobx-react-lite';
import ReactMarkdown from 'react-markdown';

interface TextMessageProps {
  content: string;
  isStreaming?: boolean;
}

const TextMessage = observer(function TextMessage({ content, isStreaming }: TextMessageProps) {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-primary">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
        }}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-1 bg-primary animate-pulse" />
      )}
    </div>
  );
});

export default TextMessage;
```

**Step 3: 创建 ActionCard 渲染器**

```tsx
// frontend/src/components/MessageRenderer/components/ActionCard.tsx

import { observer } from 'mobx-react-lite';

interface Action {
  type: string;
  label: string;
  data?: Record<string, any>;
}

interface ActionCardProps {
  actions: Action[];
  onAction: (action: Action) => void;
}

const ActionCard = observer(function ActionCard({ actions, onAction }: ActionCardProps) {
  const getActionIcon = (type: string) => {
    switch (type) {
      case 'transfer_to_doctor': return 'person';
      case 'book_appointment': return 'calendar_month';
      case 'view_more': return 'visibility';
      case 'retry': return 'refresh';
      case 'cancel': return 'close';
      default: return 'arrow_forward';
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case 'transfer_to_doctor': return 'bg-blue-500 hover:bg-blue-600';
      case 'book_appointment': return 'bg-green-500 hover:bg-green-600';
      case 'view_more': return 'bg-gray-500 hover:bg-gray-600';
      case 'retry': return 'bg-yellow-500 hover:bg-yellow-600';
      default: return 'bg-primary hover:bg-primary-dark';
    }
  };

  if (!actions || actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {actions.map((action, index) => (
        <button
          key={index}
          onClick={() => onAction(action)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-medium transition-colors ${getActionColor(action.type)}`}
        >
          <span className="material-symbols-outlined text-[16px]">
            {getActionIcon(action.type)}
          </span>
          {action.label}
        </button>
      ))}
    </div>
  );
});

export default ActionCard;
```

**Step 4: 创建 MedicalAdviceCard 渲染器**

```tsx
// frontend/src/components/MessageRenderer/components/MedicalAdviceCard.tsx

import { observer } from 'mobx-react-lite';

interface MedicalAdvice {
  symptoms: string[];
  possibleConditions: string[];
  suggestions: string[];
  urgencyLevel: 'low' | 'medium' | 'high';
}

interface MedicalAdviceCardProps {
  advice: MedicalAdvice;
}

const MedicalAdviceCard = observer(function MedicalAdviceCard({ advice }: MedicalAdviceCardProps) {
  const getUrgencyColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-500 bg-red-50 dark:bg-red-900/20';
      case 'medium': return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'low': return 'text-green-500 bg-green-50 dark:bg-green-900/20';
      default: return 'text-gray-500 bg-gray-50';
    }
  };

  const getUrgencyLabel = (level: string) => {
    switch (level) {
      case 'high': return '建议尽快就医';
      case 'medium': return '建议关注';
      case 'low': return '注意观察';
      default: return '请咨询医生';
    }
  };

  return (
    <div className={`rounded-xl p-4 mt-3 border ${getUrgencyColor(advice.urgencyLevel)}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined">health_and_safety</span>
        <span className="font-semibold">健康建议</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-white/50">
          {getUrgencyLabel(advice.urgencyLevel)}
        </span>
      </div>

      {advice.symptoms.length > 0 && (
        <div className="mb-2">
          <p className="text-xs opacity-70 mb-1">可能症状</p>
          <div className="flex flex-wrap gap-1">
            {advice.symptoms.map((symptom, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded bg-white/50">
                {symptom}
              </span>
            ))}
          </div>
        </div>
      )}

      {advice.possibleConditions.length > 0 && (
        <div className="mb-2">
          <p className="text-xs opacity-70 mb-1">可能情况</p>
          <div className="flex flex-wrap gap-1">
            {advice.possibleConditions.map((condition, i) => (
              <span key={i} className="text-xs px-2 py-0.5 rounded bg-white/50">
                {condition}
              </span>
            ))}
          </div>
        </div>
      )}

      {advice.suggestions.length > 0 && (
        <div>
          <p className="text-xs opacity-70 mb-1">建议</p>
          <ul className="text-xs list-disc pl-4">
            {advice.suggestions.map((suggestion, i) => (
              <li key={i}>{suggestion}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
});

export default MedicalAdviceCard;
```

**Step 5: 创建 ToolCall 渲染器**

```tsx
// frontend/src/components/MessageRenderer/components/ToolCallRenderer.tsx

import { observer } from 'mobx-react-lite';

interface ToolCall {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input?: any;
  output?: any;
  error?: string;
  duration?: number;
}

interface ToolCallRendererProps {
  toolCall: ToolCall;
}

const ToolCallRenderer = observer(function ToolCallRenderer({ toolCall }: ToolCallRendererProps) {
  const getToolIcon = (name: string) => {
    switch (name) {
      case 'symptom_analysis': return 'monitor_heart';
      case 'hospital_query': return 'local_hospital';
      case 'medicine_query': return 'medication';
      case 'ocr': return 'document_scanner';
      case 'web_search': return 'search';
      case 'coze_knowledge': return 'auto_awesome';
      default: return 'build';
    }
  };

  const getToolName = (name: string) => {
    const names: Record<string, string> = {
      symptom_analysis: '症状分析',
      hospital_query: '医院查询',
      medicine_query: '药品查询',
      ocr: '图片识别',
      web_search: '网络搜索',
      coze_knowledge: '知识库查询',
    };
    return names[name] || name;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'animate-spin text-blue-500';
      case 'completed': return 'text-green-500';
      case 'failed': return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running': return '分析中...';
      case 'completed': return '完成';
      case 'failed': return '失败';
      default: return '等待中';
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
      <div className={`material-symbols-outlined ${getStatusColor(toolCall.status)}`}>
        {getToolIcon(toolCall.name)}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{getToolName(toolCall.name)}</p>
        <p className="text-xs text-gray-500">{getStatusText(toolCall.status)}</p>
      </div>
      {toolCall.duration && (
        <span className="text-xs text-gray-400">{(toolCall.duration / 1000).toFixed(1)}s</span>
      )}
    </div>
  );
});

export default ToolCallRenderer;
```

**Step 6: 创建主渲染器**

```tsx
// frontend/src/components/MessageRenderer/index.tsx

import { observer } from 'mobx-react-lite';
import TextMessage from './components/TextMessage';
import ActionCard from './components/ActionCard';
import MedicalAdviceCard from './components/MedicalAdviceCard';
import ToolCallRenderer from './components/ToolCallRenderer';

interface MessageContext {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  status: 'pending' | 'streaming' | 'complete' | 'failed';
  sources?: Array<{ title: string; url: string; snippet: string }>;
  actions?: Array<{ type: string; label: string; data?: any }>;
  medicalAdvice?: {
    symptoms: string[];
    possibleConditions: string[];
    suggestions: string[];
    urgencyLevel: 'low' | 'medium' | 'high';
  };
}

interface ToolCallContext {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  input?: any;
  output?: any;
  error?: string;
}

interface MessageRendererProps {
  message: MessageContext;
  toolCall?: ToolCallContext | null;
  onAction?: (action: any) => void;
}

const MessageRenderer = observer(function MessageRenderer({
  message,
  toolCall,
  onAction,
}: MessageRendererProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* 头像 */}
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
      }`}>
        <span className="material-symbols-outlined text-white text-[18px]">
          {isUser ? 'person' : 'smart_toy'}
        </span>
      </div>

      {/* 消息内容 */}
      <div className={`flex flex-col max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-2xl px-4 py-2 ${
          isUser
            ? 'bg-primary text-white rounded-br-md'
            : 'bg-white dark:bg-slate-800 rounded-bl-md shadow-sm'
        }`}>
          {/* 工具调用显示 */}
          {toolCall && (
            <ToolCallRenderer toolCall={toolCall} />
          )}

          {/* 文本消息 */}
          {message.content && (
            <TextMessage
              content={message.content}
              isStreaming={message.status === 'streaming'}
            />
          )}
        </div>

        {/* 操作按钮 */}
        {message.actions && message.actions.length > 0 && (
          <ActionCard
            actions={message.actions}
            onAction={onAction || (() => {})}
          />
        )}

        {/* 医疗建议卡片 */}
        {message.medicalAdvice && (
          <MedicalAdviceCard advice={message.medicalAdvice} />
        )}

        {/* 参考来源 */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 text-xs text-gray-500">
            <span className="material-symbols-outlined text-[12px] mr-1">link</span>
            参考来源
          </div>
        )}
      </div>
    </div>
  );
});

export default MessageRenderer;
```

**Step 7: 提交**

```bash
git add frontend/src/components/MessageRenderer/
git commit -m "feat: add message renderers (Text, ActionCard, MedicalAdvice, ToolCall)"
```

---

### Task 2.3: 创建 Chat 页面

**文件：**
- Create: `frontend/src/pages/Chat/index.tsx`
- Create: `frontend/src/pages/Chat/components/ChatInput.tsx`
- Create: `frontend/src/pages/Chat/components/MessageList.tsx`

**Step 1: 创建 Chat 主页面**

```tsx
// frontend/src/pages/Chat/index.tsx

import { useEffect, useRef } from 'react';
import { useActor } from '@xstate/react';
import { observer } from 'mobx-react-lite';
import { chatMachine } from '../../store/chat/chatMachine';
import { userStore } from '../../store';
import { SSEClient } from '../../services/sse';
import MessageRenderer from '../../components/MessageRenderer';
import ChatInput from './components/ChatInput';

const Chat = observer(function Chat() {
  const [state, send] = useActor(chatMachine);
  const { messages, conversationId, inputText, activeToolCall, error } = state.context;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sseClientRef = useRef<SSEClient | null>(null);

  // 初始化 SSE 连接
  useEffect(() => {
    const initChat = async () => {
      // 创建新会话
      try {
        const response = await fetch('/api/ai-chat/conversations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userStore.accessToken}`,
          },
          body: JSON.stringify({ type: 'ai', patientId: userStore.user?.id }),
        });
        const data = await response.json();
        if (data.code === 'SUCCESS') {
          send({ type: 'EVENT_RECEIVED', event: { type: 'conversation:created', data: { conversationId: data.data.id } } });
        }
      } catch (err) {
        console.error('Failed to create conversation:', err);
      }
    };

    initChat();

    return () => {
      sseClientRef.current?.disconnect();
    };
  }, []);

  // 监听状态变化建立 SSE 连接
  useEffect(() => {
    if (conversationId && (state.matches('sending') || state.matches('processing'))) {
      sseClientRef.current = new SSEClient(conversationId, (event) => {
        send({ type: 'EVENT_RECEIVED', event });
      });
    }
  }, [conversationId, state.value]);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    send({ type: 'SEND_MESSAGE' });
  };

  const handleAction = (action: any) => {
    switch (action.type) {
      case 'transfer_to_doctor':
        // 跳转专家问诊
        break;
      case 'book_appointment':
        // 跳转预约挂号
        break;
      case 'view_more':
        // 查看更多
        break;
    }
  };

  const handleRetry = () => {
    send({ type: 'RETRY' });
  };

  const handleCancel = () => {
    send({ type: 'CANCEL' });
  };

  return (
    <div className="flex flex-col h-screen bg-background-light dark:bg-background-dark">
      {/* 头部 */}
      <header className="shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => window.history.back()} className="p-1">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <h1 className="font-bold">AI 智能问诊</h1>
              <p className="text-xs text-gray-500">基于 AI 的健康咨询助手</p>
            </div>
          </div>
          <button className="p-2">
            <span className="material-symbols-outlined">more_vert</span>
          </button>
        </div>
      </header>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* 欢迎消息 */}
        {messages.size === 0 && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
              <span className="material-symbols-outlined text-primary text-[32px] filled">smart_toy</span>
            </div>
            <h2 className="text-lg font-bold mb-2">您好，我是小禾 AI 医生</h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              我可以帮您分析症状、推荐医院、查询药品信息。请描述您的不适或健康问题。
            </p>
          </div>
        )}

        {/* 消息列表 */}
        {Array.from(messages.values()).map((msg) => (
          <MessageRenderer
            key={msg.id}
            message={msg}
            toolCall={msg.id === activeToolCall?.id ? activeToolCall : undefined}
            onAction={handleAction}
          />
        ))}

        {/* 错误提示 */}
        {state.matches('error') && error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-red-500">error</span>
              <div className="flex-1">
                <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>
                {error.code && (
                  <p className="text-xs text-red-400 mt-1">错误码: {error.code}</p>
                )}
              </div>
              <button onClick={handleRetry} className="text-sm text-primary hover:underline">
                重试
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <ChatInput
        value={inputText}
        onChange={(text) => send({ type: 'INPUT_CHANGED', text })}
        onSend={handleSend}
        onCancel={handleCancel}
        disabled={state.matches('processing') || state.matches('streaming')}
        loading={state.matches('processing') || state.matches('streaming')}
      />
    </div>
  );
});

export default Chat;
```

**Step 2: 创建 ChatInput 组件**

```tsx
// frontend/src/pages/Chat/components/ChatInput.tsx

import { observer } from 'mobx-react-lite';

interface ChatInputProps {
  value: string;
  onChange: (text: string) => void;
  onSend: () => void;
  onCancel?: () => void;
  disabled?: boolean;
  loading?: boolean;
}

const ChatInput = observer(function ChatInput({
  value,
  onChange,
  onSend,
  onCancel,
  disabled,
  loading,
}: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="shrink-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 px-4 py-3">
      <div className="flex items-end gap-2">
        <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          <span className="material-symbols-outlined">add_circle</span>
        </button>

        <div className="flex-1 relative">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="描述您的症状或问题..."
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-2.5 pr-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900 focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none text-sm disabled:opacity-50"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={() => {}}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <span className="material-symbols-outlined text-[20px]">emoji_emotions</span>
          </button>
        </div>

        {loading ? (
          <button
            onClick={onCancel}
            className="p-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!value.trim() || disabled}
            className="p-2.5 rounded-xl bg-primary text-white hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        )}
      </div>

      <p className="text-xs text-center text-gray-400 mt-2">
        AI 仅供参考，具体诊疗请咨询专业医生
      </p>
    </div>
  );
});

export default ChatInput;
```

**Step 3: 提交**

```bash
git add frontend/src/pages/Chat/
git commit -m "feat: add Chat page with input and message list"
```

---

### Task 2.4: 创建 SSE 服务

**文件：**
- Create: `frontend/src/services/sse.ts`

**Step 1: 创建 SSE 客户端**

```typescript
// frontend/src/services/sse.ts

import { ChatEvent } from '../types/chat-events';

type EventHandler = (event: ChatEvent) => void;

export class SSEClient {
  private eventSource: EventSource | null = null;
  private eventHandlers: Set<EventHandler> = new Set();
  private reconnectTimer?: NodeJS.Timeout;
  private maxRetries = 3;
  private retryCount = 0;
  private baseUrl: string;

  constructor(conversationId: string, handler: EventHandler) {
    this.baseUrl = `/api/ai-chat/stream?conversationId=${conversationId}`;
    this.eventHandlers.add(handler);
    this.connect();
  }

  private connect(): void {
    // 使用 EventSource 进行 SSE 连接
    this.eventSource = new EventSource(this.baseUrl);

    this.eventSource.onopen = () => {
      console.log('[SSE] Connection established');
      this.retryCount = 0;
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const chatEvent = data as ChatEvent;
        this.eventHandlers.forEach((handler) => handler(chatEvent));
      } catch (error) {
        console.error('[SSE] Failed to parse event:', error);
      }
    };

    this.eventSource.addEventListener('message:content', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const chatEvent = data as ChatEvent;
        this.eventHandlers.forEach((handler) => handler(chatEvent));
      } catch (error) {
        console.error('[SSE] Failed to parse content event:', error);
      }
    });

    this.eventSource.addEventListener('tool:call', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const chatEvent = data as ChatEvent;
        this.eventHandlers.forEach((handler) => handler(chatEvent));
      } catch (error) {
        console.error('[SSE] Failed to parse tool event:', error);
      }
    });

    this.eventSource.addEventListener('error', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const chatEvent = data as ChatEvent;
        this.eventHandlers.forEach((handler) => handler(chatEvent));
      } catch (error) {
        console.error('[SSE] Failed to parse error event:', error);
      }
    });

    this.eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);
      this.handleDisconnect();
    };
  }

  private handleDisconnect(): void {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      const delay = Math.min(1000 * Math.pow(2, this.retryCount), 30000);
      console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${this.retryCount})`);
      this.reconnectTimer = setTimeout(() => this.connect(), delay);
    } else {
      console.error('[SSE] Max retries reached');
      this.eventHandlers.forEach((handler) =>
        handler({
          type: 'error',
          data: {
            conversationId: '',
            code: 'SSE_ERROR',
            message: '连接失败，请检查网络后重试',
            recoverable: true,
            timestamp: new Date().toISOString(),
          },
        })
      );
    }
  }

  on(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  off(handler: EventHandler): void {
    this.eventHandlers.delete(handler);
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.eventHandlers.clear();
  }
}
```

**Step 2: 提交**

```bash
git add frontend/src/services/sse.ts
git commit -m "feat: add SSE client service"
```

---

### Task 2.5: 更新路由配置

**文件：**
- Modify: `frontend/src/router.tsx`
- Modify: `frontend/src/pages/Home/components/FeatureCard.tsx`

**Step 1: 更新路由**

```typescript
// frontend/src/router.tsx

import { createBrowserRouter } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import Chat from './pages/Chat';
// ... 其他导入

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/', element: <Home /> },
  { path: '/chat', element: <Chat /> },
  // ... 其他路由
]);
```

**Step 2: 更新首页 AI 问诊卡片跳转**

```tsx
// 在 FeatureCard 或 Home/index.tsx 中
<FeatureCard
  title="AI 智能问诊"
  subtitle="全天候极速响应"
  icon="smart_toy"
  gradientFrom="primary"
  gradientTo="primary-dark"
  to="/chat"  // 修改这里
  className="col-span-1"
/>
```

**Step 3: 提交**

```bash
git add frontend/src/router.tsx frontend/src/pages/Home/index.tsx
git commit -m "feat: add chat route and update navigation"
```

---

### Task 2.6: 安装依赖

**文件：**
- Modify: `frontend/package.json`

**Step 1: 添加依赖**

```bash
npm install xstate @xstate/react react-markdown
```

**Step 2: 提交**

```bash
git add frontend/package.json
git commit -m "chore: add xstate and react-markdown dependencies"
```

---

### Task 2.7: 构建和测试

**Step 1: 运行构建**

```bash
npm run build
```

**Step 2: 运行类型检查**

```bash
npx tsc --noEmit
```

**Step 3: 提交**

```bash
git add -A
git commit -m "chore: verify build and types"
```

---

## 任务列表

| 任务 | 描述 |
|------|------|
| Task 1.1 | 创建统一事件类型定义和状态机 |
| Task 1.2 | 修改 Agent 节点发送新事件 |
| Task 1.3 | 修改 SSE Handler 支持新事件 |
| Task 2.1 | 创建 XState 状态机 |
| Task 2.2 | 创建消息类型和渲染器 |
| Task 2.3 | 创建 Chat 页面 |
| Task 2.4 | 创建 SSE 服务 |
| Task 2.5 | 更新路由配置 |
| Task 2.6 | 安装依赖 |
| Task 2.7 | 构建和测试 |

---

## 快速参考

### 后端事件流程

```
用户发送消息
    ↓
conversation:status (sending)
    ↓
message:status (sending)
    ↓
conversation:status (processing)
    ↓
tool:call (running) - 症状分析等
    ↓
message:content (流式输出)
    ↓
message:metadata (sources, actions, medicalAdvice)
    ↓
tool:call (completed)
    ↓
conversation:status (complete)
```

### 前端状态机

```
idle ←─────────────────────────────────────────┐
  │ INPUT_CHANGED                              │
  ↓                                           │
sending → processing → streaming → complete   │
  │    ↑                      │               │
  │    │                      ↓               │
  │    └────────── error ─────┘               │
  ↓                                           │
CANCEL / CLEAR_ERROR → idle                   │
```

---

## 设计稿参考

- AI 对话页面：`frontendDesign/aichat.html`
