# 前端架构重构设计方案

**日期**: 2026-01-28
**目标**: 重构前端数据结构和连接管理，从事件驱动转为数据驱动，简化架构并提升可维护性

---

## 一、当前问题

### 1.1 数据结构不清晰

- XState 状态机管理复杂，messages、toolCalls、actions 分散在不同字段
- 缺乏明确的"对话"和"视图"概念
- 难以理解 SSE 事件如何映射到 UI 展示

### 1.2 SSEClientManager 过度设计

- 维护 Map<conversationId, SSEClient>，但实际上每次只有一个活跃连接
- 增加了不必要的抽象层
- 生命周期管理复杂

### 1.3 渲染逻辑混乱

- 组件直接消费 XState context
- 缺乏统一的渲染器匹配机制
- 类型安全性差（大量 any 和类型断言）

---

## 二、设计目标

### 2.1 核心思路

**从事件驱动到数据驱动的转变：**
- **当前**: SSE 事件 → XState 状态机 → React 组件
- **新架构**: SSE 事件 → Conversation 模型（MobX observable）→ React 自动更新

### 2.2 关键原则

1. **类型安全**: TypeScript 类 + 继承体系
2. **响应式更新**: MobX observable 自动追踪依赖
3. **清晰职责**: Conversation 管理数据，SSEClient 管理连接
4. **易于渲染**: ConversationItem 数组顺序遍历即可

---

## 三、整体架构

### 3.1 三层架构

```
┌─────────────────────────────────────────┐
│          View 层（React 组件）           │
│  - ChatPage                              │
│  - MessageList (observer)                │
│  - EventRenderer (类型匹配)             │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│       Model 层（MobX Observable）        │
│  - Conversation (管理对话生命周期)      │
│  - ConversationItem (用户/Agent)         │
│  - AgentView (Event 数组)                │
│  - Event 类族 (ToolCall, Message, etc)   │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│       Connection 层（SSE 连接）          │
│  - SSEClient (保持不变)                  │
│  - Conversation 直接管理 client 实例     │
└─────────────────────────────────────────┘
```

---

## 四、Model 层详细设计

### 4.1 Event 类族（核心抽象）

```typescript
// Event 基类
abstract class Event {
  @observable id: string;
  @observable timestamp: Date;
  abstract readonly type: string;

  constructor(id: string) {
    makeObservable(this);
    this.id = id;
    this.timestamp = new Date();
  }

  abstract update(data: any): void;
}

// 1. 工具调用事件
class ToolCallEvent extends Event {
  readonly type = 'tool_call';
  @observable toolId: string;
  @observable name: string;
  @observable status: 'running' | 'completed' | 'failed';
  @observable input?: Record<string, any>;
  @observable output?: Record<string, any>;
  @observable duration?: number;

  update(data: Partial<ToolCallEvent>) {
    if (data.status) this.status = data.status;
    if (data.output) this.output = data.output;
    if (data.duration) this.duration = data.duration;
  }
}

// 2. 消息内容事件（流式）
class MessageContentEvent extends Event {
  readonly type = 'message_content';
  @observable content: string = '';
  @observable isComplete: boolean = false;

  update(data: { delta?: string; isLast?: boolean }) {
    if (data.delta) this.content += data.delta;
    if (data.isLast) this.isComplete = true;
  }
}

// 3. 思考状态事件
class ThinkingEvent extends Event {
  readonly type = 'thinking';
  update() {} // 无需更新
}

// 4. 错误事件
class ErrorEvent extends Event {
  readonly type = 'error';
  @observable message: string;
  @observable code: string;

  update(data: Partial<ErrorEvent>) {
    if (data.message) this.message = data.message;
    if (data.code) this.code = data.code;
  }
}

// 5. 对话状态事件（可选）
class ConversationStatusEvent extends Event {
  readonly type = 'conversation_status';
  @observable status: string;
  @observable message?: string;

  update(data: Partial<ConversationStatusEvent>) {
    if (data.status) this.status = data.status;
    if (data.message) this.message = data.message;
  }
}
```

**关键特性：**
- 使用 MobX `@observable` 装饰器，属性变化自动触发 React 更新
- 每个 Event 类型有自己的 `update()` 方法处理状态更新
- `type` 字段用于渲染器类型匹配

### 4.2 AgentView（Agent 输出视图）

```typescript
class AgentView {
  @observable events: Event[] = [];

  constructor() {
    makeObservable(this);
  }

  addEvent(event: Event) {
    // 避免重复添加
    const exists = this.events.some(e => e.id === event.id);
    if (!exists) {
      this.events.push(event);
    }
  }

  findEvent(eventId: string): Event | undefined {
    return this.events.find(e => e.id === eventId);
  }

  removeEvent(eventId: string) {
    const index = this.events.findIndex(e => e.id === eventId);
    if (index !== -1) this.events.splice(index, 1);
  }

  updateOrAddEvent(event: Event) {
    const existing = this.findEvent(event.id);
    if (existing) {
      existing.update(event);
    } else {
      this.addEvent(event);
    }
  }
}
```

**职责：**
- 维护 Event 数组（按后端 SSE 事件顺序）
- 提供 Event 查找、添加、删除、更新方法
- 支持流式更新（如 MessageContentEvent 的增量 delta）

### 4.3 ConversationItem（对话项）

```typescript
// 用户消息
class UserMessage {
  readonly type = 'user';
  @observable content: string;
  @observable imageUrls?: string[];
  @observable timestamp: Date;

  constructor(content: string, imageUrls?: string[]) {
    makeObservable(this);
    this.content = content;
    this.imageUrls = imageUrls;
    this.timestamp = new Date();
  }

  get hasImages(): boolean {
    return !!this.imageUrls && this.imageUrls.length > 0;
  }

  get displayText(): string {
    if (!this.content && this.hasImages) {
      return '[图片]';
    }
    return this.content;
  }
}

// Agent 响应
class AgentResponse {
  readonly type = 'agent';
  @observable view: AgentView;
  @observable timestamp: Date;

  constructor() {
    makeObservable(this);
    this.view = new AgentView();
    this.timestamp = new Date();
  }
}

// 联合类型
type ConversationItem = UserMessage | AgentResponse;
```

**设计说明：**
- `ConversationItem` 是联合类型，可以是 UserMessage 或 AgentResponse
- 按时间顺序存储在 Conversation.items 数组中
- AgentResponse 包含 AgentView，AgentView 包含 Event 数组

### 4.4 Conversation（对话核心类）

```typescript
class Conversation {
  @observable id: string;
  @observable items: ConversationItem[] = [];
  @observable status: 'idle' | 'processing' | 'error' = 'idle';
  @observable connectionStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';

  private currentClient: SSEClient | null = null;
  private currentResponse: AgentResponse | null = null;

  constructor(id?: string) {
    makeObservable(this);
    this.id = id || `conv_${Date.now()}`;
  }

  // ========== 公开方法 ==========

  @action
  sendMessage(content: string, imageUrls?: string[]) {
    // 1. 添加用户消息
    const userMsg = new UserMessage(content, imageUrls);
    this.items.push(userMsg);

    // 2. 创建 Agent 响应占位
    const agentResponse = new AgentResponse();
    this.items.push(agentResponse);
    this.currentResponse = agentResponse;

    // 3. 添加思考状态
    const thinkingEvent = new ThinkingEvent(`thinking_${Date.now()}`);
    agentResponse.view.addEvent(thinkingEvent);

    // 4. 关闭旧连接，创建新连接
    this.currentClient?.close();
    this.status = 'processing';
    this.connectSSE(content, imageUrls);
  }

  @action
  retry() {
    // 重试最后一条用户消息
    const lastUserMsg = [...this.items]
      .reverse()
      .find(item => item.type === 'user') as UserMessage;

    if (lastUserMsg) {
      // 移除失败的 AgentResponse
      const lastAgentIndex = this.items.findLastIndex(item => item.type === 'agent');
      if (lastAgentIndex !== -1) {
        this.items.splice(lastAgentIndex, 1);
      }

      this.sendMessage(lastUserMsg.content, lastUserMsg.imageUrls);
    }
  }

  @action
  cleanup() {
    this.currentClient?.close();
    this.currentClient = null;
  }

  // ========== 私有方法 ==========

  private async connectSSE(message: string, imageUrls?: string[]) {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

    this.currentClient = new SSEClient({
      url: `${API_BASE_URL}/api/ai-chat/stream`,
      method: 'POST',
      conversationId: this.id,
      message,
      imageUrls,
      onEvent: (event) => this.handleSSEEvent(event),
      onError: (error) => this.handleError(error),
      onClose: () => this.handleClose(),
      onOpen: () => this.handleOpen(),
    });

    await this.currentClient.connect();
  }

  @action
  private handleOpen() {
    this.connectionStatus = 'connected';
  }

  @action
  private handleSSEEvent(sseEvent: any) {
    // 收到第一个真实内容时，移除 ThinkingEvent
    if (sseEvent.type === 'message_content' && sseEvent.data.isFirst) {
      this.currentResponse?.view.events
        .filter(e => e.type === 'thinking')
        .forEach(e => this.currentResponse?.view.removeEvent(e.id));
    }

    // 将 SSE 事件转换为 Event 实例
    const event = EventFactory.createFromSSE(sseEvent);

    if (event && this.currentResponse) {
      // 特殊处理 MessageContentEvent（流式更新）
      if (event instanceof MessageContentEvent) {
        const existing = this.currentResponse.view.findEvent(event.id);
        if (existing && existing instanceof MessageContentEvent) {
          existing.update({ delta: sseEvent.data.delta, isLast: sseEvent.data.isLast });
          return;
        }
      }

      // 其他 Event 类型：更新或添加
      this.currentResponse.view.updateOrAddEvent(event);
    }

    // conversation:end 事件处理
    if (sseEvent.type === 'conversation_end' || sseEvent.type === 'conversation:end') {
      this.currentResponse?.view.events
        .filter(e => e.type === 'thinking')
        .forEach(e => this.currentResponse?.view.removeEvent(e.id));
    }
  }

  @action
  private handleClose() {
    this.status = 'idle';
    this.connectionStatus = 'disconnected';
    this.currentClient = null;
  }

  @action
  private handleError(error: Error) {
    this.status = 'error';
    this.connectionStatus = 'error';

    // 添加错误事件到当前响应
    if (this.currentResponse) {
      const errorEvent = new ErrorEvent({
        id: `error_${Date.now()}`,
        message: error.message,
        code: 'CONNECTION_ERROR',
      });
      this.currentResponse.view.addEvent(errorEvent);
    }
  }
}
```

**关键特性：**
- 使用 MobX `@action` 装饰器标记修改状态的方法
- `sendMessage()` 创建用户消息 + Agent 响应占位 + SSE 连接
- `handleSSEEvent()` 将 SSE 事件转换为 Event 实例并更新 AgentView
- 支持重试、清理、错误处理等边界情况

### 4.5 EventFactory（事件工厂）

```typescript
class EventFactory {
  static createFromSSE(sseEvent: ChatEvent): Event | null {
    const { type, data } = sseEvent;

    switch (type) {
      case 'tool_call':
      case 'tool:call':
        return new ToolCallEvent({
          id: data.toolId || `tool_${Date.now()}`,
          toolId: data.toolId,
          name: data.toolName,
          status: data.status,
          input: data.input,
          output: data.output,
          duration: data.duration,
        });

      case 'message_content':
      case 'message:content':
        return new MessageContentEvent({
          id: data.messageId || `msg_${Date.now()}`,
          delta: data.delta,
          isLast: data.isLast,
        });

      case 'error':
        return new ErrorEvent({
          id: `error_${Date.now()}`,
          message: data.message || 'Unknown error',
          code: data.code || 'UNKNOWN_ERROR',
        });

      case 'conversation_status':
      case 'conversation:status':
        return new ConversationStatusEvent({
          id: `status_${Date.now()}`,
          status: data.status || 'idle',
          message: data.message,
        });

      // 忽略的事件类型
      case 'agent:intent':
      case 'intent':
      case 'thinking':
      case 'conversation_end':
      case 'conversation:end':
        return null;

      default:
        console.log('[EventFactory] Unknown event type:', type);
        return null;
    }
  }
}
```

---

## 五、React 渲染层设计

### 5.1 组件层次结构

```
ChatPage (observer)
  └─ MessageList (observer)
       └─ ConversationItemRenderer (observer)
            ├─ UserMessageCard (type === 'user')
            └─ AgentResponseCard (type === 'agent')
                 └─ AgentViewRenderer (observer)
                      └─ EventRenderer (observer)
                           ├─ ToolCallCard (type === 'tool_call')
                           ├─ MessageContentCard (type === 'message_content')
                           ├─ ThinkingDots (type === 'thinking')
                           └─ ErrorCard (type === 'error')
```

### 5.2 核心组件实现

```typescript
// 主聊天页面
const ChatPage: React.FC = observer(() => {
  const [conversation] = useState(() => new Conversation());
  const [input, setInput] = useState('');

  useEffect(() => {
    return () => {
      // 组件卸载时清理连接
      conversation.cleanup();
    };
  }, [conversation]);

  const handleSend = () => {
    if (!input.trim()) return;
    conversation.sendMessage(input);
    setInput('');
  };

  return (
    <div className="chat-container">
      <MessageList conversation={conversation} />
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={conversation.status === 'processing'}
      />
    </div>
  );
});

// 消息列表
const MessageList: React.FC<{ conversation: Conversation }> = observer(({ conversation }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.items.length]);

  return (
    <div className="messages">
      {conversation.items.map((item, index) => (
        <ConversationItemRenderer key={index} item={item} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
});

// ConversationItem 渲染器
const ConversationItemRenderer: React.FC<{ item: ConversationItem }> = observer(({ item }) => {
  if (item.type === 'user') {
    return <UserMessageCard message={item} />;
  }

  return (
    <div className="agent-response">
      <AgentViewRenderer view={item.view} />
    </div>
  );
});

// AgentView 渲染器
const AgentViewRenderer: React.FC<{ view: AgentView }> = observer(({ view }) => {
  return (
    <>
      {view.events.map((event) => (
        <EventRenderer key={event.id} event={event} />
      ))}
    </>
  );
});

// Event 渲染器（类型匹配核心）
const EventRenderer: React.FC<{ event: Event }> = observer(({ event }) => {
  switch (event.type) {
    case 'tool_call':
      return <ToolCallCard event={event as ToolCallEvent} />;
    case 'message_content':
      return <MessageContentCard event={event as MessageContentEvent} />;
    case 'thinking':
      return <ThinkingDots />;
    case 'error':
      return <ErrorCard event={event as ErrorEvent} />;
    case 'conversation_status':
      return <StatusBadge event={event as ConversationStatusEvent} />;
    default:
      return null;
  }
});
```

**关键特性：**
- 所有组件用 `observer` 包裹，MobX 自动追踪依赖并触发更新
- 无需手动 setState 或 dispatch，修改 observable 数据即可
- EventRenderer 根据 event.type 匹配对应的渲染组件
- 类型断言（as）确保类型安全

---

## 六、Connection 层简化

### 6.1 SSEClient 保持不变

```typescript
// services/sseClient.ts
export class SSEClient {
  private config: SSEConfig;
  private abortController: AbortController | null = null;
  private isConnected: boolean = false;
  private isManualClose: boolean = false;

  constructor(config: SSEConfig) {
    this.config = config;
  }

  async connect(): Promise<void> { /* ... */ }
  close(): void { /* ... */ }
  getConnected(): boolean { /* ... */ }
}
```

**保留原因：**
- SSEClient 职责单一，只负责底层连接
- 与后端 SSE 协议紧密耦合，无需改动

### 6.2 移除 SSEClientManager

```typescript
// ❌ 删除这段代码
class SSEClientManager {
  private clients: Map<string, SSEClient> = new Map();
  // ...
}

export const sseClientManager = new SSEClientManager();
```

**移除原因：**
- 过度设计，维护 Map 但实际只有一个活跃连接
- Conversation 直接管理 SSEClient 实例更简单
- 减少抽象层，代码更直观

---

## 七、文件组织结构

```
frontend/src/
├── models/
│   ├── conversation/
│   │   ├── Conversation.ts          # Conversation 类
│   │   ├── ConversationItem.ts      # UserMessage, AgentResponse
│   │   └── AgentView.ts             # AgentView 类
│   ├── events/
│   │   ├── Event.ts                 # Event 基类
│   │   ├── ToolCallEvent.ts
│   │   ├── MessageContentEvent.ts
│   │   ├── ThinkingEvent.ts
│   │   ├── ErrorEvent.ts
│   │   ├── ConversationStatusEvent.ts
│   │   ├── EventFactory.ts          # 事件工厂
│   │   └── index.ts
│   └── index.ts
├── services/
│   ├── sseClient.ts                 # 保留 SSEClient，移除 Manager
│   └── index.ts
├── components/
│   ├── chat/
│   │   ├── ChatPage.tsx             # 重构后的主页面
│   │   ├── MessageList.tsx
│   │   ├── ConversationItemRenderer.tsx
│   │   ├── AgentViewRenderer.tsx
│   │   ├── EventRenderer.tsx
│   │   └── ChatInput.tsx
│   ├── events/                      # Event 对应的渲染组件
│   │   ├── ToolCallCard.tsx
│   │   ├── MessageContentCard.tsx
│   │   ├── ThinkingDots.tsx
│   │   ├── ErrorCard.tsx
│   │   ├── StatusBadge.tsx
│   │   └── index.ts
│   └── message/
│       └── UserMessageCard.tsx
```

**需要删除的文件：**
- ❌ `machines/chatMachine.ts` - XState 状态机
- ❌ `services/sseClient.ts`（部分）- SSEClientManager 类

**需要创建的文件：**
- ✅ `models/` 目录及所有类
- ✅ `components/chat/` 新的渲染组件
- ✅ `components/events/` Event 渲染组件

---

## 八、迁移步骤

### 8.1 准备阶段

**1. 安装依赖**
```bash
npm install mobx mobx-react-lite
npm uninstall xstate @xstate/react
```

**2. 配置 TypeScript**
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "useDefineForClassFields": false
  }
}
```

### 8.2 实施步骤

**Step 1: 创建 Model 层（不影响现有代码）**
- 创建 `models/events/` 目录
- 实现 Event 基类和所有子类
- 实现 EventFactory
- 创建 `models/conversation/` 目录
- 实现 AgentView、ConversationItem
- 实现 Conversation 类

**Step 2: 重构渲染层（并行开发）**
- 创建 `components/events/` 目录
- 实现 Event 对应的渲染组件（ToolCallCard 等）
- 创建 `components/chat/` 目录
- 实现 EventRenderer、AgentViewRenderer 等
- 保持与旧组件接口兼容

**Step 3: 替换 Chat 页面**
- 创建 `ChatPage.new.tsx`
- 使用新的 Conversation 模型
- 移除 XState 依赖
- 测试完成后替换旧文件

**Step 4: 清理**
- 删除 `machines/chatMachine.ts`
- 删除 `SSEClientManager` 相关代码
- 移除 XState 依赖
- 清理未使用的组件

---

## 九、关键优势总结

### 9.1 代码质量

- **类型安全**: TypeScript 类 + 继承，编译时捕获错误
- **代码量减少**: 移除 XState 复杂状态机，代码更简洁
- **易于理解**: 类 + MobX 比状态机更直观
- **易于扩展**: 新增 Event 类型只需继承 Event 基类

### 9.2 性能优化

- **细粒度更新**: MobX 只更新依赖变化的组件
- **避免整树渲染**: 不像 XState context 变化导致整颗树 re-render
- **内存优化**: 移除不必要的 SSEClientManager Map

### 9.3 开发体验

- **直观的数据流**: Conversation → ConversationItem → AgentView → Event
- **自动更新**: 修改 observable 属性，UI 自动同步
- **调试友好**: MobX DevTools 可视化状态变化
- **可测试性**: 类实例易于单元测试（mock 更简单）

### 9.4 可维护性

- **清晰的职责划分**: Model、Connection、View 三层分离
- **统一的渲染逻辑**: EventRenderer 类型匹配，易于添加新类型
- **简化的生命周期**: Conversation 直接管理 SSEClient

---

## 十、后续优化方向

1. **持久化**: 使用 MobX persist 插件保存对话历史到 localStorage
2. **流式优化**: 研究 React 18 Suspense + Streaming 进一步优化
3. **虚拟滚动**: 对话历史过长时使用 react-window 优化渲染
4. **离线支持**: Service Worker 缓存历史对话
5. **多标签同步**: BroadcastChannel API 同步多标签页状态

---

**设计完成日期**: 2026-01-28
**预计实施周期**: 2-3 天
**预计代码减少**: ~30%（移除 XState 相关代码）
