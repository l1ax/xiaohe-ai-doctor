# Agent 架构优化设计方案

**日期**: 2026-01-28
**目标**: 提升 AI 问诊 Agent 响应速度，减少过度追问，优化用户体验

---

## 一、当前问题

### 1.1 过度追问用户
- Prompt 中明确指导"不确定时使用 ask_followup_question"
- 示例对话第一步就是追问
- askFollowup 工具描述鼓励在多种场景下追问
- **影响**: 用户体验差，不符合医疗咨询的快速响应需求

### 1.2 webSearch 过度封装
- 当前流程: Tavily 搜索 → LLM 摘要 (`summarizeWebpageContent`) → 格式化返回
- **问题**: 搜索结果已经清晰，不需要额外 LLM 调用
- **影响**: webSearch 单次调用耗时 3-5s，其中摘要占 2-3s

### 1.3 响应速度慢
- 流程: classifyIntent → reactLoop（多次循环）→ finalResponse
- 每次 reactLoop 都要调用 LLM
- webSearch 内部额外 LLM 调用
- **影响**: 用户等待 15-20s 才能获得结果

---

## 二、设计目标

### 2.1 用户体验
- **快速响应型**: 简单问题 5-8s 内响应
- **减少追问**: 只在极度模糊时才追问
- **保持专业**: 不降低回答质量

### 2.2 技术目标
- 简单咨询响应时间: 15-20s → 5-8s（提升 60-70%）
- webSearch 执行时间: 3-5s → 1-2s（提升 50-60%）
- 保持架构灵活性，支持复杂场景

---

## 三、整体架构设计

### 3.1 新的 Agent 流程

```
用户消息
  ↓
classifyIntent (意图分类 + 路由决策)
  ↓
  ├─→ 简单意图 → quickResponse (快速通道)
  │     ↓
  │   并行调用: [知识库, webSearch]
  │     ↓
  │   知识库有结果？用知识库 : 用webSearch
  │     ↓
  │   单次LLM生成最终回复
  │     ↓
  │   END
  │
  └─→ 复杂意图 → reactLoop (ReAct循环)
        ↓
      Think-Act-Observe (多轮)
        ↓
      finalResponse
        ↓
      END
```

### 3.2 意图分类与路由规则

**快速通道（Quick Route）**
- `symptom_inquiry` - 症状咨询
- `medication_inquiry` - 用药咨询
- `health_advice` - 健康建议

**ReAct 循环（React Route）**
- `emergency_triage` - 紧急情况
- `complex_diagnosis` - 复杂诊断
- `multi_symptom` - 多症状综合

**路由策略**
- 默认走 ReAct（保守策略）
- 明确识别为简单意图才走快速通道

---

## 四、详细设计

### 4.1 webSearch 工具优化

#### 当前实现问题
```typescript
searchWeb(query) {
  1. Tavily 搜索 (网络请求)
  2. summarizeWebpageContent() // ❌ 额外的 LLM 调用
  3. formatWebSearch()
  4. 返回
}
```

#### 优化后实现
```typescript
searchWeb(query) {
  1. Tavily 搜索 (网络请求)
  2. formatWebSearch() // ✅ 仅格式化，不调用 LLM
  3. 返回原始内容
}
```

#### 具体改动
- **删除**: `summarizeWebpageContent()` 函数及其调用
- **删除**: `SUMMARIZE_WEBPAGE_PROMPT` 相关代码
- **保留**: `formatWebSearch()` - 格式化为易读的结构
- **返回**: `title, url, content`（Tavily 原始内容）

#### 预期效果
- webSearch 执行时间: 3-5s → 1-2s
- 去掉一次不必要的 LLM 调用
- Agent 收到更完整的原始信息

---

### 4.2 quickResponse 节点

#### 职责
处理简单意图的快速响应通道

#### 执行流程

```typescript
async function quickResponse(state: AgentStateType) {
  // 1. 并行调用工具
  const [kbResult, webResult] = await Promise.all([
    queryKnowledgeBase({ query: userQuery }),
    searchWeb({ query: userQuery })
  ]);

  // 2. 选择数据源（知识库优先）
  const useKnowledgeBase = kbResult.success && kbResult.result.hasResults;
  const selectedResult = useKnowledgeBase ? kbResult : webResult;
  const informationSource = useKnowledgeBase ? 'knowledge_base' : 'web_search';

  // 3. 构建 Prompt
  const prompt = `
    用户问题: ${userQuery}

    ${useKnowledgeBase ? '知识库结果' : '网络搜索结果'}:
    ${selectedResult.result.content}

    请基于以上信息，给出专业、简洁的医疗建议。
  `;

  // 4. 单次 LLM 调用生成最终回复
  const response = await llm.invoke(prompt);

  // 5. 流式发送给用户
  // 通过 eventEmitter 发送 message:content 事件

  return { isFinished: true };
}
```

#### 关键特性
- 使用 `Promise.all` 并行调用，节省时间
- 知识库优先逻辑清晰
- 只调用一次 LLM，直接生成最终回复
- 通过 eventEmitter 流式发送（复用现有机制）

---

### 4.3 classifyIntent 改造

#### 新增输出
- `routeDecision`: 'quick' | 'react'

#### 路由决策逻辑

```typescript
// 快速通道意图
const QUICK_INTENTS = [
  'symptom_inquiry',
  'medication_inquiry',
  'health_advice',
];

// ReAct 循环意图
const REACT_INTENTS = [
  'emergency_triage',
  'complex_diagnosis',
  'multi_symptom',
];

function determineRoute(userIntent: string): 'quick' | 'react' {
  if (QUICK_INTENTS.includes(userIntent)) return 'quick';
  if (REACT_INTENTS.includes(userIntent)) return 'react';
  return 'react'; // 默认走 ReAct（保守策略）
}
```

#### graph.ts 路由实现

```typescript
function shouldUseQuickResponse(state: AgentState.State): string {
  const { routeDecision } = state;

  if (routeDecision === 'quick') {
    return 'quickResponse';
  }
  return 'reactLoop';
}

// 在 graph 中添加条件边
.addConditionalEdges(
  'classifyIntent',
  shouldUseQuickResponse,
  {
    quickResponse: 'quickResponse',
    reactLoop: 'reactLoop'
  }
)
```

---

### 4.4 Prompt 优化（减少过度追问）

#### reactSystem.ts - ReAct Prompt 调整

**当前问题**
```typescript
"不确定时 → 使用 ask_followup_question 收集更多信息"
```

**优化后原则**
```typescript
"2. **医疗安全**：
   - 遇到紧急症状（胸痛、呼吸困难、严重外伤等）→ 立即建议就医
   - ⚠️ 只有在信息极度缺乏时才追问（如用户只说"不舒服"）
   - 优先尝试基于现有信息给出建议
   - 提供建议时 → 说明这不能替代专业医生诊断"
```

#### askFollowup 工具描述调整

**当前描述（过于激进）**
```typescript
description: `追问用户更多信息。当症状描述不清楚或需要更多细节时使用。

使用场景：
- 用户只说"头疼"，需要了解持续时间、严重程度
- 用户描述模糊，需要确认具体症状
- 需要了解伴随症状、既往病史等`
```

**优化后描述**
```typescript
description: `追问用户更多信息。⚠️ 仅在信息极度缺乏时使用。

使用场景：
- 用户只说"我不舒服"/"哪里疼" 等极度模糊的描述
- 紧急症状需要确认严重程度时（如"胸痛"需确认是否持续、是否伴随呼吸困难）

不要追问的情况：
- 用户已提供基本症状和持续时间（如"头疼三天"）→ 直接给建议
- 用户描述相对清晰 → 基于现有信息回答`
```

---

## 五、预期效果

### 5.1 性能提升

| 场景 | 当前耗时 | 优化后 | 提升 |
|------|---------|--------|------|
| 简单症状咨询 | 15-20s | 5-8s | **60-70%** |
| 用药咨询 | 15-20s | 5-8s | **60-70%** |
| 复杂诊断 | 20-30s | 15-25s | 20-30% |
| webSearch 单次调用 | 3-5s | 1-2s | **50-60%** |

### 5.2 用户体验改善
- 简单问题快速响应，减少等待焦虑
- 减少不必要的追问，提升对话流畅度
- 保持复杂场景的深度推理能力

### 5.3 架构优势
- 保留 ReAct 架构灵活性
- 快速通道与 ReAct 循环并存
- 易于根据实际效果调整路由规则

---

## 六、实施计划

### 6.1 需要修改的文件

**新增**
- `backend/src/agent/nodes/quickResponse.ts` - 快速响应节点

**修改**
- `backend/src/agent/graph.ts` - 添加路由逻辑和 quickResponse 节点
- `backend/src/agent/nodes/classifyIntent.ts` - 添加 routeDecision 输出
- `backend/src/agent/state.ts` - 添加 routeDecision 字段
- `backend/src/services/tools/webSearch.ts` - 删除 LLM 摘要
- `backend/src/agent/prompts/reactSystem.ts` - 优化 Prompt
- `backend/src/agent/tools/askFollowup.ts` - 优化工具描述

**测试文件**
- `backend/src/agent/nodes/__tests__/quickResponse.test.ts` - 新增
- 更新相关集成测试

### 6.2 实施顺序

1. **webSearch 优化**（独立，影响最小）
   - 删除 `summarizeWebpageContent()` 调用
   - 测试验证搜索结果正确性

2. **Prompt 优化**（独立，立即见效）
   - 修改 reactSystem.ts
   - 修改 askFollowup.ts 工具描述

3. **quickResponse 节点开发**
   - 实现并行调用逻辑
   - 实现知识库优先策略
   - 单元测试

4. **classifyIntent 改造 + graph 路由**
   - 添加 routeDecision 输出
   - 实现路由决策函数
   - 修改 graph.ts 添加条件边

5. **集成测试**
   - 测试快速通道端到端流程
   - 测试 ReAct 循环未受影响
   - 性能测试验证提升效果

### 6.3 风险与应对

**风险1**: 快速通道回答质量下降
- **应对**: 保留详细日志，监控用户反馈，必要时调整路由规则

**风险2**: 并行调用失败处理
- **应对**: 实现完善的错误处理，单个工具失败不影响整体流程

**风险3**: 意图分类不准确
- **应对**: 默认走 ReAct（保守策略），逐步优化分类准确率

---

## 七、后续优化方向

1. **动态路由调整**: 基于用户反馈和性能数据，自动调整路由规则
2. **缓存机制**: 对高频问题缓存知识库/搜索结果
3. **预加载优化**: 在用户输入时预判意图，提前加载数据
4. **流式优化**: 工具结果边返回边处理，进一步减少延迟

---

**设计评审**: 已通过
**下一步**: 创建实施计划，进入开发阶段
