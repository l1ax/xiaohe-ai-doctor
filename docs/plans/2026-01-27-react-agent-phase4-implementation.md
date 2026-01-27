# ReAct Agent Phase 4 实施计划 - 图结构重构

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 简化 Agent 图结构，移除旧的分支节点，改用 ReAct 循环统一处理所有意图

**Architecture:** 新图流程为 `classifyIntent → reactLoop (循环) → finalResponse → END`，reactLoop 通过 `isFinished` 标志控制循环，完成后进入 finalResponse 发送最终事件

**Tech Stack:** TypeScript + LangGraph + Vitest

---

## 前置条件

Phase 1-3 已完成：
- ✅ AgentState 包含 ReAct 字段（scratchpad, agentIteration, isFinished, fallbackResponse）
- ✅ classifyIntent 节点支持多意图识别
- ✅ reactLoop 节点实现完整（返回 isFinished 标志）
- ✅ 所有 P0 工具已实现

---

## Phase 4 任务概览

### 4.1 创建 finalResponse 节点（Task 1）
实现最终响应节点，发送会话结束事件

### 4.2 重构图结构（Task 2）
简化图为新流程，添加循环逻辑

### 4.3 删除旧代码（Task 3）
移除旧分支节点和路由文件

---

## Task 1: 创建 finalResponse 节点

**目标**: 实现 finalResponse 节点，处理 ReAct 循环完成后的最终响应

**Files:**
- Create: `backend/src/agent/nodes/finalResponse.ts`
- Create: `backend/src/agent/nodes/__tests__/finalResponse.test.ts`

**Step 1: 编写测试验证 finalResponse 行为**

在 `backend/src/agent/nodes/__tests__/finalResponse.test.ts` 中：

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { finalResponse } from '../finalResponse';
import { AgentEventEmitter } from '../../events/AgentEventEmitter';
import type { AgentStateType } from '../../state';

describe('finalResponse', () => {
  let mockEmitter: AgentEventEmitter;

  beforeEach(() => {
    mockEmitter = new AgentEventEmitter();
    vi.spyOn(mockEmitter, 'emit');
  });

  it('should emit conversation:end event with correct duration', async () => {
    const state: Partial<AgentStateType> = {
      conversationId: 'conv123',
      messageId: 'msg456',
      startTime: Date.now() - 5000, // 5秒前
      eventEmitter: mockEmitter,
      isFinished: true,
      fallbackResponse: null,
    };

    await finalResponse(state as AgentStateType);

    expect(mockEmitter.emit).toHaveBeenCalledWith(
      'conversation:end',
      expect.objectContaining({
        conversationId: 'conv123',
        messageId: 'msg456',
      })
    );
  });

  it('should handle fallback response when present', async () => {
    const state: Partial<AgentStateType> = {
      conversationId: 'conv123',
      messageId: 'msg456',
      startTime: Date.now(),
      eventEmitter: mockEmitter,
      isFinished: true,
      fallbackResponse: '抱歉，我遇到了一些困难。',
    };

    const result = await finalResponse(state as AgentStateType);

    expect(result).toEqual({
      fallbackResponse: '抱歉，我遇到了一些困难。',
    });
  });

  it('should return empty object when no fallback response', async () => {
    const state: Partial<AgentStateType> = {
      conversationId: 'conv123',
      messageId: 'msg456',
      startTime: Date.now(),
      eventEmitter: mockEmitter,
      isFinished: true,
      fallbackResponse: null,
    };

    const result = await finalResponse(state as AgentStateType);

    expect(result).toEqual({});
  });
});
```

**Step 2: 运行测试验证失败**

```bash
pnpm test finalResponse.test.ts
```

预期：FAIL - "Module not found"

**Step 3: 实现 finalResponse 节点**

在 `backend/src/agent/nodes/finalResponse.ts` 中：

```typescript
import type { AgentStateType } from '../state';
import { createConversationEndEvent } from '../events/chat-event-types';

/**
 * 最终响应节点 - 处理 ReAct 循环完成后的收尾工作
 *
 * 职责：
 * - 发送会话结束事件
 * - 处理 fallback 响应（如果有）
 * - 结束对话流程
 */
export async function finalResponse(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const {
    conversationId,
    messageId,
    startTime,
    eventEmitter,
    fallbackResponse,
    messages,
  } = state;

  // 计算对话持续时间
  const duration = startTime ? Date.now() - startTime : 0;

  // 发送会话结束事件
  eventEmitter.emit(
    'conversation:end',
    createConversationEndEvent(
      conversationId,
      messageId || `msg_${Date.now()}`,
      duration,
      messages.length
    )
  );

  console.log(`✅ Conversation ${conversationId} completed, duration: ${duration}ms`);

  // 如果有 fallback 响应，返回它
  if (fallbackResponse) {
    return { fallbackResponse };
  }

  // 不需要返回 messages，因为 reactLoop 中的工具（如 finish）已经通过 SSE 发送了消息
  return {};
}
```

**Step 4: 运行测试验证通过**

```bash
pnpm test finalResponse.test.ts
```

预期：PASS - 3/3 tests passing

**Step 5: 提交**

```bash
git add src/agent/nodes/finalResponse.ts src/agent/nodes/__tests__/finalResponse.test.ts
git commit -m "feat(nodes): 实现 finalResponse 最终响应节点"
```

---

## Task 2: 重构图结构

**目标**: 重构 graph.ts，移除旧分支节点，实现新的简化流程

**Files:**
- Modify: `backend/src/agent/graph.ts`
- Create: `backend/src/agent/__tests__/graph.test.ts`

**Step 1: 编写测试验证新图结构**

在 `backend/src/agent/__tests__/graph.test.ts` 中：

```typescript
import { describe, it, expect } from 'vitest';
import { createAgentGraph } from '../graph';

describe('Agent Graph Structure', () => {
  it('should compile graph without errors', () => {
    expect(() => createAgentGraph()).not.toThrow();
  });

  it('should have correct node names', () => {
    const graph = createAgentGraph();
    const graphStr = JSON.stringify(graph);

    // 应该包含新节点
    expect(graphStr).toContain('classifyIntent');
    expect(graphStr).toContain('reactLoop');
    expect(graphStr).toContain('finalResponse');

    // 不应该包含旧节点
    expect(graphStr).not.toContain('symptomAnalysis');
    expect(graphStr).not.toContain('consultation');
    expect(graphStr).not.toContain('hospitalRecommend');
    expect(graphStr).not.toContain('medicineInfo');
    expect(graphStr).not.toContain('synthesizeResponse');
  });
});
```

**Step 2: 运行测试验证失败**

```bash
pnpm test graph.test.ts
```

预期：FAIL - "Module not found" 或测试失败（因为旧节点还在图中）

**Step 3: 重构 graph.ts**

在 `backend/src/agent/graph.ts` 中完全重写：

```typescript
import 'dotenv/config';
import { StateGraph, END } from '@langchain/langgraph';
import { AgentState } from './state';
import { classifyIntent } from './nodes/classifyIntent';
import { reactLoop } from './nodes/reactLoop';
import { finalResponse } from './nodes/finalResponse';

/**
 * 决定 ReAct 循环是否继续
 */
function shouldContinueLoop(state: typeof AgentState.State): string {
  const { isFinished } = state;

  if (isFinished) {
    return 'finalResponse';
  }

  return 'reactLoop';
}

/**
 * 创建 Agent 图
 *
 * 流程：classifyIntent → reactLoop (循环) → finalResponse → END
 */
export function createAgentGraph() {
  const workflow = new StateGraph(AgentState)
    // 添加节点
    .addNode('classifyIntent', classifyIntent)
    .addNode('reactLoop', reactLoop)
    .addNode('finalResponse', finalResponse)

    // 入口：意图分类
    .addEdge('__start__', 'classifyIntent')

    // 意图分类后进入 ReAct 循环
    .addEdge('classifyIntent', 'reactLoop')

    // ReAct 循环条件边：根据 isFinished 决定继续循环还是进入最终响应
    .addConditionalEdges(
      'reactLoop',
      shouldContinueLoop,
      {
        reactLoop: 'reactLoop',         // 继续循环
        finalResponse: 'finalResponse',  // 结束循环
      }
    )

    // 最终响应后结束
    .addEdge('finalResponse', END);

  return workflow.compile();
}
```

**Step 4: 运行测试验证通过**

```bash
pnpm test graph.test.ts
```

预期：PASS - 2/2 tests passing

**Step 5: 运行所有 Agent 相关测试**

```bash
pnpm test src/agent
```

预期：所有 Phase 3 和 Phase 4 的测试通过

**Step 6: 提交**

```bash
git add src/agent/graph.ts src/agent/__tests__/graph.test.ts
git commit -m "refactor(graph): 重构图结构使用 ReAct 循环"
```

---

## Task 3: 删除旧代码

**目标**: 删除旧的分支节点文件和路由文件

**Files:**
- Delete: `backend/src/agent/nodes/symptomAnalysis.ts`
- Delete: `backend/src/agent/nodes/consultation.ts`
- Delete: `backend/src/agent/nodes/hospitalRecommend.ts`
- Delete: `backend/src/agent/nodes/medicineInfo.ts`
- Delete: `backend/src/agent/nodes/synthesizeResponse.ts`
- Delete: `backend/src/agent/router.ts`

**Step 1: 检查是否有其他文件引用这些旧节点**

```bash
# 搜索旧节点的引用
grep -r "symptomAnalysis\|consultation\|hospitalRecommend\|medicineInfo\|synthesizeResponse" src/ --include="*.ts" --exclude-dir=__tests__ | grep -v "node_modules"
```

预期：应该只在 graph.ts 中有引用（已在 Task 2 中移除）

**Step 2: 搜索 router.ts 的引用**

```bash
grep -r "routeByIntent\|router" src/ --include="*.ts" --exclude-dir=__tests__ | grep -v "node_modules"
```

预期：应该只在 graph.ts 中有引用（已在 Task 2 中移除）

**Step 3: 删除旧节点文件**

```bash
rm src/agent/nodes/symptomAnalysis.ts
rm src/agent/nodes/consultation.ts
rm src/agent/nodes/hospitalRecommend.ts
rm src/agent/nodes/medicineInfo.ts
rm src/agent/nodes/synthesizeResponse.ts
```

**Step 4: 删除路由文件**

```bash
rm src/agent/router.ts
```

**Step 5: 验证构建和测试**

```bash
# 确保没有编译错误
pnpm build

# 运行 Agent 相关测试
pnpm test src/agent
```

预期：构建成功，所有测试通过

**Step 6: 提交**

```bash
git add -A
git commit -m "refactor(agent): 删除旧的分支节点和路由文件"
```

---

## 验收标准

**Phase 4 完成后应满足：**

1. ✅ 新图结构实现：`classifyIntent → reactLoop (循环) → finalResponse → END`
2. ✅ reactLoop 通过 `isFinished` 标志正确控制循环
3. ✅ finalResponse 正确发送会话结束事件
4. ✅ 所有旧节点文件已删除（symptomAnalysis, consultation, hospitalRecommend, medicineInfo, synthesizeResponse）
5. ✅ router.ts 已删除
6. ✅ 构建成功，无编译错误
7. ✅ 所有 Phase 3-4 测试通过

**测试验证命令：**

```bash
# 运行所有 Agent 测试
pnpm test src/agent

# 验证构建
pnpm build

# 检查图结构
pnpm test graph.test.ts -v
```

---

## 注意事项

1. **循环控制**：确保 `shouldContinueLoop` 函数正确检查 `isFinished` 标志
2. **事件发送**：finalResponse 中的事件发送应该在所有工具执行完成后
3. **向后兼容**：删除旧节点前确保没有其他地方引用它们
4. **错误处理**：如果 reactLoop 返回 fallbackResponse，finalResponse 应该正确处理

---

**计划创建时间**：2026-01-27
**预计实施时间**：30-45 分钟（3个任务 × 10-15分钟）
