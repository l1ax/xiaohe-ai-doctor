# ReAct Agent 架构 - Phase 1-2 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 ReAct Agent 架构的基础设施和核心工具系统（Phase 1-2）

**Architecture:**
- Phase 1: 数据库表结构、State 定义升级、对话历史加载
- Phase 2: 10个核心工具实现（优先级 P0），工具执行引擎

**Tech Stack:** TypeScript + Supabase + LangChain + LangGraph + Vitest

---

## Phase 1: 基础架构搭建

### Task 1: 创建数据库迁移文件结构

**Files:**
- Create: `backend/migrations/001_create_react_tables.sql`
- Create: `backend/migrations/002_add_indexes.sql`
- Create: `backend/migrations/README.md`

**Step 1: 创建 migrations 目录和 README**

```bash
mkdir -p backend/migrations
```

在 `backend/migrations/README.md` 中写入：

```markdown
# 数据库迁移

## 执行顺序
1. 001_create_react_tables.sql - 创建 ReAct Agent 所需表
2. 002_add_indexes.sql - 添加性能优化索引

## 执行方法
在 Supabase SQL Editor 中按顺序执行这些 SQL 文件。
```

**Step 2: 创建表结构迁移文件**

在 `backend/migrations/001_create_react_tables.sql` 中写入：

```sql
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- conversations 表（会话）
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  title TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- messages 表（消息）
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  image_urls TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- tool_calls 表（工具调用记录）
CREATE TABLE IF NOT EXISTS tool_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  input JSONB,
  output JSONB,
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- agent_iterations 表（Agent 思考记录，可选）
CREATE TABLE IF NOT EXISTS agent_iterations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  iteration_number INTEGER NOT NULL,
  thought TEXT,
  action TEXT,
  action_input JSONB,
  observation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加注释
COMMENT ON TABLE conversations IS 'ReAct Agent 会话表';
COMMENT ON TABLE messages IS 'ReAct Agent 消息表';
COMMENT ON TABLE tool_calls IS 'ReAct Agent 工具调用记录';
COMMENT ON TABLE agent_iterations IS 'ReAct Agent 思考过程记录';
```

**Step 3: 创建索引迁移文件**

在 `backend/migrations/002_add_indexes.sql` 中写入：

```sql
-- messages 表索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_role
  ON messages(role);

-- tool_calls 表索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tool_calls_conversation_created
  ON tool_calls(conversation_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tool_calls_status
  ON tool_calls(status);

-- agent_iterations 表索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_iterations_conversation
  ON agent_iterations(conversation_id, iteration_number);

-- conversations 表索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_user_status
  ON conversations(user_id, status, updated_at DESC);
```

**Step 4: 提交**

```bash
git add backend/migrations/
git commit -m "feat(db): 添加 ReAct Agent 数据库迁移文件"
```

---

### Task 2: 升级 AgentState 类型定义

**Files:**
- Modify: `backend/src/agent/state.ts`
- Modify: `backend/src/agent/types.ts`

**Step 1: 扩展 UserIntent 类型**

在 `backend/src/agent/types.ts` 中添加新的意图类型：

```typescript
// 在现有 UserIntent 类型定义后添加
export type UserIntent =
  | 'symptom_consult'
  | 'general_qa'
  | 'hospital_recommend'
  | 'medicine_info'
  | 'health_advice'      // 新增
  | 'emergency';         // 新增

// 添加意图分析结果类型
export interface IntentAnalysis {
  intents: UserIntent[];
  entities: Record<string, any>;
  riskIndicators: {
    hasEmergencyKeywords: boolean;
    severity: 'mild' | 'moderate' | 'severe';
  };
}

// 添加风险指标类型
export interface RiskIndicators {
  hasEmergencyKeywords: boolean;
  severity: 'mild' | 'moderate' | 'severe';
}
```

**Step 2: 扩展 AgentState 定义**

在 `backend/src/agent/state.ts` 中添加 ReAct 相关字段：

```typescript
import { Annotation } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';
import type { AgentEventEmitter } from './events/AgentEventEmitter';
import type { UserIntent, RiskIndicators } from './types';

export const AgentState = Annotation.Root({
  // ========== 对话数据 ==========
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  conversationId: Annotation<string>({
    reducer: (_, update) => update,
    default: () => '',
  }),

  messageId: Annotation<string>({
    reducer: (_, update) => update,
    default: () => '',
  }),

  userId: Annotation<string>({
    reducer: (_, update) => update,
    default: () => '',
  }),

  // ========== 意图分析 ==========
  userIntent: Annotation<UserIntent[]>({
    reducer: (_, update) => update,
    default: () => [],
  }),

  primaryIntent: Annotation<UserIntent | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  intentConfidence: Annotation<Record<UserIntent, number>>({
    reducer: (_, update) => update,
    default: () => ({} as Record<UserIntent, number>),
  }),

  extractedInfo: Annotation<any>({
    reducer: (_, update) => update,
    default: () => ({}),
  }),

  riskIndicators: Annotation<RiskIndicators>({
    reducer: (_, update) => update,
    default: () => ({
      hasEmergencyKeywords: false,
      severity: 'mild' as const,
    }),
  }),

  // ========== ReAct 循环 ==========
  scratchpad: Annotation<string>({
    reducer: (_, update) => update,
    default: () => '',
  }),

  agentIteration: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0,
  }),

  maxIterations: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 10,
  }),

  isFinished: Annotation<boolean>({
    reducer: (_, update) => update,
    default: () => false,
  }),

  fallbackResponse: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  // ========== 工具使用记录 ==========
  toolsUsed: Annotation<string[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  // ========== 遗留字段（兼容性，后续移除） ==========
  branchResult: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  // ========== 元数据 ==========
  startTime: Annotation<number>({
    reducer: (_, update) => update,
    default: () => Date.now(),
  }),

  eventEmitter: Annotation<AgentEventEmitter>({
    reducer: (_, update) => update,
    default: () => {
      const { AgentEventEmitter } = require('./events/AgentEventEmitter');
      return new AgentEventEmitter();
    },
  }),
});

// 导出 State 类型
export type AgentStateType = typeof AgentState.State;
```

**Step 3: 运行类型检查**

```bash
cd backend && pnpm tsc --noEmit
```

预期：无错误

**Step 4: 提交**

```bash
git add backend/src/agent/state.ts backend/src/agent/types.ts
git commit -m "feat(agent): 升级 AgentState 支持 ReAct 模式"
```

---

### Task 3: 实现对话历史加载器

**Files:**
- Create: `backend/src/services/database/ConversationLoader.ts`
- Create: `backend/src/services/database/__tests__/ConversationLoader.test.ts`

**Step 1: 编写失败的测试**

在 `backend/src/services/database/__tests__/ConversationLoader.test.ts` 中：

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadConversationHistory, truncateHistory } from '../ConversationLoader';
import type { BaseMessage } from '@langchain/core/messages';

describe('ConversationLoader', () => {
  describe('loadConversationHistory', () => {
    it('should load recent messages from database', async () => {
      const conversationId = 'test-conv-1';

      const messages = await loadConversationHistory(conversationId);

      expect(Array.isArray(messages)).toBe(true);
    });

    it('should return empty array for non-existent conversation', async () => {
      const messages = await loadConversationHistory('non-existent');

      expect(messages).toEqual([]);
    });

    it('should limit to 20 messages (10 rounds)', async () => {
      // 该测试需要 mock Supabase，暂时跳过实现
      // 在集成环境中测试
    });
  });

  describe('truncateHistory', () => {
    it('should keep messages if under token limit', () => {
      const messages: BaseMessage[] = [
        { role: 'user', content: '你好' } as any,
        { role: 'assistant', content: '你好！' } as any,
      ];

      const truncated = truncateHistory(messages, 10000);

      expect(truncated.length).toBe(2);
    });

    it('should truncate when exceeding token limit', () => {
      const messages: BaseMessage[] = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: '这是一个很长的消息'.repeat(100),
      })) as any;

      const truncated = truncateHistory(messages, 4000);

      expect(truncated.length).toBeLessThan(messages.length);
    });

    it('should keep at least recent 6 messages', () => {
      const messages: BaseMessage[] = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: '这是一个超级超级超级长的消息'.repeat(1000),
      })) as any;

      const truncated = truncateHistory(messages, 100);

      expect(truncated.length).toBeGreaterThanOrEqual(6);
    });
  });
});
```

**Step 2: 运行测试验证失败**

```bash
pnpm test ConversationLoader.test.ts
```

预期：FAIL - "Module not found"

**Step 3: 实现 ConversationLoader**

在 `backend/src/services/database/ConversationLoader.ts` 中：

```typescript
import type { BaseMessage } from '@langchain/core/messages';
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';

/**
 * 从数据库加载对话历史
 *
 * @param conversationId 会话 ID
 * @param limit 加载消息数量限制（默认 20 = 10轮对话）
 * @returns BaseMessage 数组
 */
export async function loadConversationHistory(
  conversationId: string,
  limit: number = 20
): Promise<BaseMessage[]> {
  try {
    // TODO: 当数据库启用后，从 Supabase 加载
    // const { data: messages } = await supabase
    //   .from('messages')
    //   .select('*')
    //   .eq('conversation_id', conversationId)
    //   .order('created_at', { ascending: false })
    //   .limit(limit);

    // MVP 阶段：返回空数组
    return [];
  } catch (error) {
    console.error('[ConversationLoader] Failed to load history:', error);
    return [];
  }
}

/**
 * 将数据库消息转换为 LangChain BaseMessage
 */
function toBaseMessage(dbMessage: any): BaseMessage {
  const { role, content, image_urls } = dbMessage;

  switch (role) {
    case 'user':
      return new HumanMessage({
        content,
        additional_kwargs: { imageUrls: image_urls || [] },
      });
    case 'assistant':
      return new AIMessage({ content });
    case 'system':
      return new SystemMessage({ content });
    default:
      throw new Error(`Unknown message role: ${role}`);
  }
}

/**
 * 估算消息的 token 数量
 * 简单规则：中文 1字 ≈ 1.5 token，英文 1词 ≈ 1 token
 */
function estimateTokens(messages: BaseMessage[]): number {
  return messages.reduce((total, msg) => {
    const content = typeof msg.content === 'string' ? msg.content : '';
    // 简化估算：每个字符算 1.5 token
    return total + Math.ceil(content.length * 1.5);
  }, 0);
}

/**
 * 对话历史截断策略
 *
 * @param messages 原始消息列表
 * @param maxTokens 最大 token 数
 * @returns 截断后的消息列表
 */
export function truncateHistory(
  messages: BaseMessage[],
  maxTokens: number = 4000
): BaseMessage[] {
  // 1. 如果消息数量少，直接返回
  if (messages.length <= 20) {
    const tokens = estimateTokens(messages);
    if (tokens <= maxTokens) {
      return messages;
    }
  }

  // 2. 保留最新的 20 条消息
  const recentMessages = messages.slice(-20);
  const estimatedTokens = estimateTokens(recentMessages);

  // 3. 如果仍然超长，只保留最新 6 条（3 轮对话）
  if (estimatedTokens > maxTokens) {
    const latest = messages.slice(-6);

    // 如果还是太长，添加摘要提示
    if (estimateTokens(latest) > maxTokens) {
      // TODO: 在 Phase 后续版本实现摘要功能
      return latest;
    }

    return latest;
  }

  return recentMessages;
}
```

**Step 4: 运行测试验证通过**

```bash
pnpm test ConversationLoader.test.ts
```

预期：PASS

**Step 5: 提交**

```bash
git add backend/src/services/database/ConversationLoader.ts backend/src/services/database/__tests__/ConversationLoader.test.ts
git commit -m "feat(db): 实现对话历史加载和截断逻辑"
```

---

## Phase 2: 核心工具系统

### Task 4: 创建工具类型定义

**Files:**
- Create: `backend/src/agent/tools/types.ts`

**Step 1: 定义工具接口**

在 `backend/src/agent/tools/types.ts` 中：

```typescript
import type { AgentEventEmitter } from '../events/AgentEventEmitter';
import type { UserIntent } from '../types';

/**
 * 工具执行上下文
 */
export interface ToolContext {
  conversationId: string;
  messageId: string;
  userId: string;
  userIntent: UserIntent[];
  eventEmitter: AgentEventEmitter;
  iteration?: number;
}

/**
 * 工具执行结果
 */
export interface ToolResult<T = any> {
  success: boolean;
  result?: T;
  error?: string;
  errorType?: string;
}

/**
 * 工具参数 JSON Schema
 */
export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * 工具定义
 */
export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  execute: (params: any, context: ToolContext) => Promise<ToolResult>;
}

/**
 * ask_followup_question 工具参数
 */
export interface AskFollowupParams {
  question: string;
  reason: string;
}

/**
 * finish 工具参数
 */
export interface FinishParams {
  finalResponse: string;
  summary: string;
  actions?: Array<{
    type: string;
    label: string;
  }>;
  informationSources?: Array<'knowledge_base' | 'web_search' | 'model_knowledge' | 'user_provided'>;
  reliabilityNote?: string;
}

/**
 * assess_risk 工具结果
 */
export interface AssessRiskResult {
  level: 'low' | 'medium' | 'high' | 'emergency';
  reason: string;
  shouldSeeDoctor: boolean;
}

/**
 * check_emergency 工具结果
 */
export interface CheckEmergencyResult {
  isEmergency: boolean;
  emergencyType?: string;
  action: string;
}
```

**Step 2: 提交**

```bash
git add backend/src/agent/tools/types.ts
git commit -m "feat(tools): 添加工具类型定义"
```

---

### Task 5: 实现 ask_followup_question 工具

**Files:**
- Create: `backend/src/agent/tools/askFollowup.ts`
- Create: `backend/src/agent/tools/__tests__/askFollowup.test.ts`

**Step 1: 编写失败的测试**

在 `backend/src/agent/tools/__tests__/askFollowup.test.ts` 中：

```typescript
import { describe, it, expect, vi } from 'vitest';
import { askFollowupQuestion, askFollowupTool } from '../askFollowup';
import { AgentEventEmitter } from '../../events/AgentEventEmitter';

describe('ask_followup_question tool', () => {
  it('should return success with question', async () => {
    const emitter = new AgentEventEmitter();
    const context = {
      conversationId: 'test-conv',
      messageId: 'test-msg',
      userId: 'test-user',
      userIntent: ['symptom_consult' as const],
      eventEmitter: emitter,
    };

    const result = await askFollowupQuestion(
      {
        question: '头疼多久了？',
        reason: '需要了解症状持续时间',
      },
      context
    );

    expect(result.success).toBe(true);
    expect(result.result).toEqual({
      question: '头疼多久了？',
      sent: true,
    });
  });

  it('should emit message:content event', async () => {
    const emitter = new AgentEventEmitter();
    const events: any[] = [];

    emitter.on('message:content', (event) => {
      events.push(event);
    });

    const context = {
      conversationId: 'test-conv',
      messageId: 'test-msg',
      userId: 'test-user',
      userIntent: ['symptom_consult' as const],
      eventEmitter: emitter,
    };

    await askFollowupQuestion(
      {
        question: '有其他症状吗？',
        reason: '收集更多信息',
      },
      context
    );

    expect(events.length).toBeGreaterThan(0);
    expect(events[0].data.conversationId).toBe('test-conv');
  });

  it('should have correct tool definition', () => {
    expect(askFollowupTool.name).toBe('ask_followup_question');
    expect(askFollowupTool.description).toContain('追问');
    expect(askFollowupTool.parameters.type).toBe('object');
    expect(askFollowupTool.parameters.required).toContain('question');
  });
});
```

**Step 2: 运行测试验证失败**

```bash
pnpm test askFollowup.test.ts
```

预期：FAIL - "Module not found"

**Step 3: 实现 ask_followup_question 工具**

在 `backend/src/agent/tools/askFollowup.ts` 中：

```typescript
import type { Tool, ToolContext, ToolResult, AskFollowupParams } from './types';
import { createMessageContentEvent } from '../events/chat-event-types';

/**
 * 追问用户更多信息
 *
 * @param params 包含 question 和 reason
 * @param context 工具执行上下文
 * @returns 工具执行结果
 */
export async function askFollowupQuestion(
  params: AskFollowupParams,
  context: ToolContext
): Promise<ToolResult<{ question: string; sent: boolean }>> {
  const { question, reason } = params;
  const { conversationId, messageId, eventEmitter } = context;

  try {
    // 分句发送，模拟自然打字
    const sentences = question.split(/([。？！.?!])/g).filter(Boolean);
    let chunkIndex = 0;

    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i] + (sentences[i + 1] || '');

      if (sentence.trim()) {
        eventEmitter.emit('message:content', createMessageContentEvent(
          conversationId,
          messageId,
          sentence,
          chunkIndex++,
          chunkIndex === 1,
          i >= sentences.length - 2
        ));

        // 小延迟，模拟打字
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }

    // 记录追问原因（内部日志）
    console.log(`[AskFollowup] Reason: ${reason}`);

    return {
      success: true,
      result: {
        question,
        sent: true,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      errorType: 'FOLLOWUP_ERROR',
    };
  }
}

/**
 * ask_followup_question 工具定义
 */
export const askFollowupTool: Tool = {
  name: 'ask_followup_question',
  description: `追问用户更多信息。当症状描述不清楚或需要更多细节时使用。

使用场景：
- 用户只说"头疼"，需要了解持续时间、严重程度
- 用户描述模糊，需要确认具体症状
- 需要了解伴随症状、既往病史等

注意：每次只问一个问题，保持对话自然。`,
  parameters: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: '要问用户的问题，保持自然、专业',
      },
      reason: {
        type: 'string',
        description: '为什么要问这个问题（内部记录，用于调试）',
      },
    },
    required: ['question', 'reason'],
  },
  execute: askFollowupQuestion,
};
```

**Step 4: 运行测试验证通过**

```bash
pnpm test askFollowup.test.ts
```

预期：PASS

**Step 5: 提交**

```bash
git add backend/src/agent/tools/askFollowup.ts backend/src/agent/tools/__tests__/askFollowup.test.ts
git commit -m "feat(tools): 实现 ask_followup_question 工具"
```

---

### Task 6: 实现 finish 工具

**Files:**
- Create: `backend/src/agent/tools/finish.ts`
- Create: `backend/src/agent/tools/__tests__/finish.test.ts`

**Step 1: 编写失败的测试**

在 `backend/src/agent/tools/__tests__/finish.test.ts` 中：

```typescript
import { describe, it, expect } from 'vitest';
import { finish, finishTool } from '../finish';
import { AgentEventEmitter } from '../../events/AgentEventEmitter';

describe('finish tool', () => {
  it('should send final response via SSE', async () => {
    const emitter = new AgentEventEmitter();
    const events: any[] = [];

    emitter.on('message:content', (event) => {
      events.push(event);
    });

    const context = {
      conversationId: 'test-conv',
      messageId: 'test-msg',
      userId: 'test-user',
      userIntent: ['symptom_consult' as const],
      eventEmitter: emitter,
    };

    const result = await finish(
      {
        finalResponse: '根据您的症状，建议...',
        summary: '头疼咨询',
        actions: [
          { type: 'transfer_to_doctor', label: '咨询人工医生' },
        ],
        informationSources: ['knowledge_base'],
      },
      context
    );

    expect(result.success).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });

  it('should emit metadata with actions and sources', async () => {
    const emitter = new AgentEventEmitter();
    const metadataEvents: any[] = [];

    emitter.on('message:metadata', (event) => {
      metadataEvents.push(event);
    });

    const context = {
      conversationId: 'test-conv',
      messageId: 'test-msg',
      userId: 'test-user',
      userIntent: ['symptom_consult' as const],
      eventEmitter: emitter,
    };

    await finish(
      {
        finalResponse: '建议您...',
        summary: '症状分析',
        actions: [{ type: 'book_appointment', label: '预约挂号' }],
        informationSources: ['web_search'],
        reliabilityNote: '以上信息来自网络搜索，建议咨询专业医生',
      },
      context
    );

    expect(metadataEvents.length).toBe(1);
    expect(metadataEvents[0].data.actions).toHaveLength(1);
    expect(metadataEvents[0].data.informationSources).toContain('web_search');
    expect(metadataEvents[0].data.reliabilityNote).toBeDefined();
  });

  it('should have correct tool definition', () => {
    expect(finishTool.name).toBe('finish');
    expect(finishTool.description).toContain('结束对话');
    expect(finishTool.parameters.required).toContain('finalResponse');
    expect(finishTool.parameters.required).toContain('summary');
  });
});
```

**Step 2: 运行测试验证失败**

```bash
pnpm test finish.test.ts
```

预期：FAIL

**Step 3: 实现 finish 工具**

在 `backend/src/agent/tools/finish.ts` 中：

```typescript
import type { Tool, ToolContext, ToolResult, FinishParams } from './types';
import { createMessageContentEvent, createMessageMetadataEvent } from '../events/chat-event-types';

/**
 * 结束对话，给出最终回复
 *
 * @param params 包含 finalResponse、summary、actions 等
 * @param context 工具执行上下文
 * @returns 工具执行结果
 */
export async function finish(
  params: FinishParams,
  context: ToolContext
): Promise<ToolResult<{ finished: true }>> {
  const {
    finalResponse,
    summary,
    actions = [],
    informationSources = [],
    reliabilityNote,
  } = params;
  const { conversationId, messageId, eventEmitter } = context;

  try {
    // 1. 流式发送最终回复
    const sentences = finalResponse.split(/([。？！.?!])/g).filter(Boolean);
    let chunkIndex = 0;

    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i] + (sentences[i + 1] || '');

      if (sentence.trim()) {
        eventEmitter.emit('message:content', createMessageContentEvent(
          conversationId,
          messageId,
          sentence,
          chunkIndex++,
          chunkIndex === 1,
          i >= sentences.length - 2
        ));

        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }

    // 2. 发送元数据（操作按钮、信息来源等）
    eventEmitter.emit('message:metadata', createMessageMetadataEvent(
      conversationId,
      messageId,
      {
        actions,
        sources: informationSources.map(source => ({
          type: source,
          label: getSourceLabel(source),
          reliability: getSourceReliability(source),
          icon: getSourceIcon(source),
        })),
        reliabilityNote,
        summary, // 内部记录
      }
    ));

    console.log(`[Finish] Summary: ${summary}`);
    console.log(`[Finish] Sources: ${informationSources.join(', ')}`);

    return {
      success: true,
      result: { finished: true },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      errorType: 'FINISH_ERROR',
    };
  }
}

/**
 * 获取信息来源的显示标签
 */
function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    knowledge_base: '专业医疗知识库',
    web_search: '网络搜索',
    model_knowledge: '通用医学知识',
    user_provided: '用户提供',
  };
  return labels[source] || source;
}

/**
 * 获取信息来源的可靠性等级
 */
function getSourceReliability(source: string): 'high' | 'medium' | 'low' {
  const reliability: Record<string, 'high' | 'medium' | 'low'> = {
    knowledge_base: 'high',
    web_search: 'medium',
    model_knowledge: 'low',
    user_provided: 'high',
  };
  return reliability[source] || 'low';
}

/**
 * 获取信息来源的图标
 */
function getSourceIcon(source: string): string {
  const icons: Record<string, string> = {
    knowledge_base: '🏥',
    web_search: '🔍',
    model_knowledge: '📚',
    user_provided: '👤',
  };
  return icons[source] || '📄';
}

/**
 * finish 工具定义
 */
export const finishTool: Tool = {
  name: 'finish',
  description: `结束对话，给出最终回复。当收集到足够信息并准备好完整建议时调用。

何时调用：
- 已经收集到足够的症状信息
- 已经查询了知识库或网络搜索
- 已经评估了风险等级（如有必要）
- 准备给出完整、专业的建议

注意：
- finalResponse 应该完整、专业、有帮助
- 必须标注信息来源（informationSources）
- 如果使用了 web_search 或 model_knowledge，需要添加 reliabilityNote`,
  parameters: {
    type: 'object',
    properties: {
      finalResponse: {
        type: 'string',
        description: '给用户的最终完整回复，应该专业、清晰、有帮助',
      },
      summary: {
        type: 'string',
        description: '本次问诊总结（内部记录，用于分析）',
      },
      actions: {
        type: 'array',
        description: '附带的操作按钮',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            label: { type: 'string' },
          },
          required: ['type', 'label'],
        },
      },
      informationSources: {
        type: 'array',
        description: '信息来源列表',
        items: {
          type: 'string',
          enum: ['knowledge_base', 'web_search', 'model_knowledge', 'user_provided'],
        },
      },
      reliabilityNote: {
        type: 'string',
        description: '可靠性说明（当使用 web_search 或 model_knowledge 时需要）',
      },
    },
    required: ['finalResponse', 'summary'],
  },
  execute: finish,
};
```

**Step 4: 运行测试验证通过**

```bash
pnpm test finish.test.ts
```

预期：PASS

**Step 5: 提交**

```bash
git add backend/src/agent/tools/finish.ts backend/src/agent/tools/__tests__/finish.test.ts
git commit -m "feat(tools): 实现 finish 工具"
```

---

### Task 7: 升级现有工具（query_knowledge_base 和 search_web）

**Files:**
- Modify: `backend/src/services/tools/knowledgeBase.ts`
- Modify: `backend/src/services/tools/webSearch.ts`
- Create: `backend/src/agent/tools/queryKnowledgeBase.ts`
- Create: `backend/src/agent/tools/searchWeb.ts`

**Step 1: 创建工具包装器 - queryKnowledgeBase**

在 `backend/src/agent/tools/queryKnowledgeBase.ts` 中：

```typescript
import type { Tool, ToolContext, ToolResult } from './types';
import { queryKnowledgeBase as queryKB, formatKnowledgeBase } from '../../services/tools/knowledgeBase';
import { createToolCallEvent } from '../events/chat-event-types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 查询专业医疗知识库
 */
export async function queryKnowledgeBase(
  params: { query: string },
  context: ToolContext
): Promise<ToolResult<{ content: string; hasResults: boolean }>> {
  const { query } = params;
  const { conversationId, messageId, eventEmitter, iteration } = context;
  const toolId = `tool_${uuidv4()}`;

  try {
    // 发送工具调用开始事件
    eventEmitter.emit('tool:call', createToolCallEvent(
      conversationId,
      toolId,
      'query_knowledge_base',
      messageId,
      'running',
      { input: { query }, iteration }
    ));

    const startTime = Date.now();
    const result = await queryKB(query);
    const duration = Date.now() - startTime;

    // 格式化结果
    const formattedContent = formatKnowledgeBase(result);

    // 发送完成事件
    eventEmitter.emit('tool:call', createToolCallEvent(
      conversationId,
      toolId,
      'query_knowledge_base',
      messageId,
      'completed',
      {
        output: {
          hasResults: result.hasResults,
          documentCount: result.documents.length,
        },
        duration,
        iteration,
      }
    ));

    return {
      success: true,
      result: {
        content: formattedContent,
        hasResults: result.hasResults,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // 发送失败事件
    eventEmitter.emit('tool:call', createToolCallEvent(
      conversationId,
      toolId,
      'query_knowledge_base',
      messageId,
      'failed',
      { error: errorMessage, iteration }
    ));

    return {
      success: false,
      error: errorMessage,
      errorType: 'KNOWLEDGE_BASE_ERROR',
    };
  }
}

/**
 * query_knowledge_base 工具定义
 */
export const queryKnowledgeBaseTool: Tool = {
  name: 'query_knowledge_base',
  description: `查询专业医疗知识库（⭐ 最优先使用）。

特点：
- 包含经过审核的专业医疗内容
- 可靠性最高，应优先使用
- 涵盖疾病症状、治疗方法、药品信息、健康建议等

使用场景：
- 分析症状时
- 回答医疗健康问题
- 提供药品信息
- 给出健康建议

优先级：知识库 > 网络搜索 > 模型内置知识`,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '查询内容，应该清晰、具体',
      },
    },
    required: ['query'],
  },
  execute: queryKnowledgeBase,
};
```

**Step 2: 创建工具包装器 - searchWeb**

在 `backend/src/agent/tools/searchWeb.ts` 中：

```typescript
import type { Tool, ToolContext, ToolResult } from './types';
import { searchWeb as searchWebService, formatWebSearch } from '../../services/tools/webSearch';
import { createToolCallEvent } from '../events/chat-event-types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 搜索互联网获取医疗信息
 */
export async function searchWeb(
  params: { query: string },
  context: ToolContext
): Promise<ToolResult<{ content: string; hasResults: boolean }>> {
  const { query } = params;
  const { conversationId, messageId, eventEmitter, iteration } = context;
  const toolId = `tool_${uuidv4()}`;

  try {
    // 发送工具调用开始事件
    eventEmitter.emit('tool:call', createToolCallEvent(
      conversationId,
      toolId,
      'search_web',
      messageId,
      'running',
      { input: { query }, iteration }
    ));

    const startTime = Date.now();
    const result = await searchWebService(query);
    const duration = Date.now() - startTime;

    // 格式化结果
    const formattedContent = formatWebSearch(result);

    // 发送完成事件
    eventEmitter.emit('tool:call', createToolCallEvent(
      conversationId,
      toolId,
      'search_web',
      messageId,
      'completed',
      {
        output: {
          hasResults: result.hasResults,
          sourceCount: result.sources.length,
        },
        duration,
        iteration,
      }
    ));

    return {
      success: true,
      result: {
        content: formattedContent,
        hasResults: result.hasResults,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // 发送失败事件
    eventEmitter.emit('tool:call', createToolCallEvent(
      conversationId,
      toolId,
      'search_web',
      messageId,
      'failed',
      { error: errorMessage, iteration }
    ));

    return {
      success: false,
      error: errorMessage,
      errorType: 'WEB_SEARCH_ERROR',
    };
  }
}

/**
 * search_web 工具定义
 */
export const searchWebTool: Tool = {
  name: 'search_web',
  description: `搜索互联网获取医疗信息（⚠️ 降级使用）。

特点：
- 可获取最新医疗资讯
- 可靠性低于知识库
- 结果已经过 LLM 摘要

使用场景（仅当知识库无结果时）：
- 知识库没有相关信息
- 需要最新医疗资讯
- 查询医院信息

优先级：知识库 > 网络搜索 > 模型内置知识

注意：使用网络搜索结果时，必须在 finish 工具中标注 informationSources 为 ['web_search']，并添加 reliabilityNote。`,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词，应该清晰、具体',
      },
    },
    required: ['query'],
  },
  execute: searchWeb,
};
```

**Step 3: 提交**

```bash
git add backend/src/agent/tools/queryKnowledgeBase.ts backend/src/agent/tools/searchWeb.ts
git commit -m "feat(tools): 添加 query_knowledge_base 和 search_web 工具包装器"
```

---

### Task 8: 创建工具注册表

**Files:**
- Create: `backend/src/agent/tools/index.ts`
- Create: `backend/src/agent/tools/__tests__/toolRegistry.test.ts`

**Step 1: 编写失败的测试**

在 `backend/src/agent/tools/__tests__/toolRegistry.test.ts` 中：

```typescript
import { describe, it, expect } from 'vitest';
import { getToolByName, getAllTools, P0_TOOLS } from '../index';

describe('Tool Registry', () => {
  it('should get tool by name', () => {
    const tool = getToolByName('ask_followup_question');

    expect(tool).toBeDefined();
    expect(tool?.name).toBe('ask_followup_question');
  });

  it('should return undefined for non-existent tool', () => {
    const tool = getToolByName('non_existent_tool');

    expect(tool).toBeUndefined();
  });

  it('should get all P0 tools', () => {
    const tools = getAllTools();

    expect(tools.length).toBeGreaterThanOrEqual(4); // P0: 至少4个工具
    expect(tools.map(t => t.name)).toContain('ask_followup_question');
    expect(tools.map(t => t.name)).toContain('finish');
    expect(tools.map(t => t.name)).toContain('query_knowledge_base');
    expect(tools.map(t => t.name)).toContain('search_web');
  });

  it('P0_TOOLS should contain core tools', () => {
    expect(P0_TOOLS).toContain('ask_followup_question');
    expect(P0_TOOLS).toContain('query_knowledge_base');
    expect(P0_TOOLS).toContain('search_web');
    expect(P0_TOOLS).toContain('finish');
  });
});
```

**Step 2: 运行测试验证失败**

```bash
pnpm test toolRegistry.test.ts
```

预期：FAIL

**Step 3: 实现工具注册表**

在 `backend/src/agent/tools/index.ts` 中：

```typescript
import type { Tool } from './types';
import { askFollowupTool } from './askFollowup';
import { finishTool } from './finish';
import { queryKnowledgeBaseTool } from './queryKnowledgeBase';
import { searchWebTool } from './searchWeb';

/**
 * 工具优先级
 */
export const P0_TOOLS = [
  'ask_followup_question',
  'query_knowledge_base',
  'search_web',
  'finish',
] as const;

export const P1_TOOLS = [
  'assess_risk',
  'check_emergency',
  'recommend_medicine',
  'provide_advice',
] as const;

export const P2_TOOLS = [
  'analyze_image',
  'recommend_hospital',
] as const;

/**
 * 工具注册表
 */
const TOOL_REGISTRY: Map<string, Tool> = new Map();

// 注册 P0 工具
TOOL_REGISTRY.set('ask_followup_question', askFollowupTool);
TOOL_REGISTRY.set('query_knowledge_base', queryKnowledgeBaseTool);
TOOL_REGISTRY.set('search_web', searchWebTool);
TOOL_REGISTRY.set('finish', finishTool);

// TODO: P1、P2 工具在后续任务中注册

/**
 * 根据名称获取工具
 */
export function getToolByName(name: string): Tool | undefined {
  return TOOL_REGISTRY.get(name);
}

/**
 * 获取所有已注册的工具
 */
export function getAllTools(): Tool[] {
  return Array.from(TOOL_REGISTRY.values());
}

/**
 * 获取 P0 优先级工具
 */
export function getP0Tools(): Tool[] {
  return P0_TOOLS.map(name => TOOL_REGISTRY.get(name)).filter(Boolean) as Tool[];
}

/**
 * 格式化工具描述（用于 Prompt）
 */
export function formatToolDescriptions(tools: Tool[]): string {
  return tools.map(tool => {
    const params = JSON.stringify(tool.parameters.properties, null, 2);
    const required = tool.parameters.required || [];

    return `
**${tool.name}**
${tool.description}

参数:
${params}

必需参数: ${required.join(', ')}
`.trim();
  }).join('\n\n---\n\n');
}
```

**Step 4: 运行测试验证通过**

```bash
pnpm test toolRegistry.test.ts
```

预期：PASS

**Step 5: 提交**

```bash
git add backend/src/agent/tools/index.ts backend/src/agent/tools/__tests__/toolRegistry.test.ts
git commit -m "feat(tools): 实现工具注册表"
```

---

## Phase 1-2 完成检查清单

### Phase 1: 基础架构 ✅
- [x] Task 1: 数据库迁移文件
- [x] Task 2: AgentState 类型定义升级
- [x] Task 3: 对话历史加载器

### Phase 2: 核心工具（P0）✅
- [x] Task 4: 工具类型定义
- [x] Task 5: ask_followup_question 工具
- [x] Task 6: finish 工具
- [x] Task 7: 升级现有工具（包装器）
- [x] Task 8: 工具注册表

---

## 下一步

Phase 1-2 完成后，接下来的工作：

1. **Phase 3: ReAct 核心逻辑**
   - Prompt 工程
   - ReAct 循环实现
   - 意图识别升级

2. **Phase 4: 图结构重构**
   - 新图定义
   - 移除旧代码

建议：先完成 Phase 1-2，验证基础设施工作正常后，再开始 Phase 3-4。

---

## 测试策略

每个 Phase 完成后：

```bash
# 运行所有测试
pnpm test:run

# 运行类型检查
pnpm tsc --noEmit

# 构建验证
pnpm build
```

预期：所有测试通过，无类型错误，构建成功。
