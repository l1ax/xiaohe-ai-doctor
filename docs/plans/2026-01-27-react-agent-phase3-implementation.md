# ReAct Agent Phase 3 实施计划 - ReAct 核心逻辑

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 实现 ReAct Agent 的核心推理循环，包括 Prompt 工程、输出解析和意图识别升级

**Architecture:** 采用 ReAct (Reasoning + Acting) 模式，Agent 通过 Think → Act → Observe 循环进行推理和工具调用，支持多意图识别和优先级指导

**Tech Stack:** TypeScript + LangChain + LangGraph + Zhipu AI + Vitest

---

## 前置条件

Phase 1-2 已完成：
- ✅ 数据库迁移文件
- ✅ AgentState 类型定义（含 ReAct 字段）
- ✅ 对话历史加载器
- ✅ 工具类型定义
- ✅ P0 核心工具（ask_followup_question, finish, query_knowledge_base, search_web）
- ✅ 工具注册表

---

## Phase 3 任务概览

### 3.1 Prompt 工程（Task 1-3）
创建 ReAct 系统提示词、工具描述和优先级指导

### 3.2 ReAct 循环实现（Task 4-6）
实现输出解析器、scratchpad 管理和 ReAct Loop 节点

### 3.3 意图识别升级（Task 7）
升级 classifyIntent 支持多意图和风险指标提取

---

## Task 1: 创建 ReAct System Prompt

**目标**: 编写 ReAct 系统提示词，指导 LLM 进行 Think → Act → Observe 循环

**Files:**
- Create: `backend/src/agent/prompts/reactSystem.ts`
- Create: `backend/src/agent/prompts/__tests__/reactSystem.test.ts`

**Step 1: 编写测试验证 Prompt 结构**

在 `backend/src/agent/prompts/__tests__/reactSystem.test.ts` 中：

```typescript
import { describe, it, expect } from 'vitest';
import { buildReActSystemPrompt } from '../reactSystem';

describe('ReAct System Prompt', () => {
  it('should include ReAct format instructions', () => {
    const prompt = buildReActSystemPrompt();

    expect(prompt).toContain('Thought:');
    expect(prompt).toContain('Action:');
    expect(prompt).toContain('Action Input:');
    expect(prompt).toContain('Observation:');
  });

  it('should include medical guidelines', () => {
    const prompt = buildReActSystemPrompt();

    expect(prompt).toContain('专业医疗建议');
    expect(prompt).toContain('风险评估');
  });

  it('should include information priority', () => {
    const prompt = buildReActSystemPrompt();

    expect(prompt).toContain('knowledge_base');
    expect(prompt).toContain('web_search');
    expect(prompt).toContain('model_knowledge');
  });
});
```

**Step 2: 运行测试验证失败**

```bash
pnpm test reactSystem.test.ts
```

预期：FAIL - "Module not found"

**Step 3: 实现 ReAct System Prompt**

在 `backend/src/agent/prompts/reactSystem.ts` 中：

```typescript
/**
 * ReAct System Prompt - 指导 Agent 进行推理和行动
 */
export function buildReActSystemPrompt(): string {
  return `你是小荷AI医生助手，一个专业、耐心的医疗咨询 Agent。

# 你的能力

你可以使用以下工具来帮助用户：
{tool_descriptions}

# 工作方式 - ReAct 模式

你必须按照以下格式思考和行动：

Thought: [你的思考过程，分析当前情况，决定下一步做什么]
Action: [工具名称]
Action Input: [工具参数，JSON格式]
Observation: [工具执行结果，由系统填充]

然后重复这个循环，直到你准备好给出最终回复。

## 重要规则

1. **信息优先级**（从高到低）：
   - knowledge_base（专业医疗知识库）- 最可靠，优先使用
   - web_search（网络搜索）- 次选，需注明来源
   - model_knowledge（你的内置知识）- 最后，需添加免责声明

2. **医疗安全**：
   - 遇到紧急症状（胸痛、呼吸困难、严重外伤等）→ 立即建议就医
   - 不确定时 → 使用 ask_followup_question 收集更多信息
   - 提供建议时 → 说明这不能替代专业医生诊断

3. **对话自然**：
   - 每次只问一个问题（使用 ask_followup_question）
   - 回复要专业但易懂
   - 保持同理心和耐心

4. **完成对话**：
   - 收集足够信息后 → 使用 finish 工具给出完整建议
   - 必须标注 informationSources（信息来源）
   - 使用 web_search 或 model_knowledge 时 → 添加 reliabilityNote

# 示例

用户: 我头疼三天了

Thought: 用户描述头疼症状，持续三天。我需要了解更多细节（疼痛部位、程度、伴随症状）来做出准确判断。先追问获取详细信息。
Action: ask_followup_question
Action Input: {"question": "头疼具体在什么部位？疼痛程度如何？有没有伴随恶心、呕吐等症状？", "reason": "需要了解头疼的详细特征来判断可能原因"}
Observation: 用户回复: 太阳穴两侧疼，跳着疼，有点恶心

Thought: 用户描述太阳穴两侧跳痛，伴有恶心。这可能是偏头痛症状。我应该查询知识库获取专业信息。
Action: query_knowledge_base
Action Input: {"query": "偏头痛症状 太阳穴跳痛 恶心"}
Observation: [知识库返回: 偏头痛典型症状包括...]

Thought: 知识库确认了偏头痛的可能性。我已经有足够信息给出建议。使用 finish 工具完成对话。
Action: finish
Action Input: {
  "finalResponse": "根据您的症状描述，太阳穴两侧跳痛并伴有恶心，这很可能是偏头痛...",
  "summary": "偏头痛咨询，提供缓解建议",
  "informationSources": ["knowledge_base"],
  "actions": [
    {"type": "book_appointment", "label": "预约神经内科"}
  ]
}

现在开始处理用户的问题。记住：Thought → Action → Action Input，等待 Observation 后继续。`;
}

/**
 * 在 Prompt 中插入工具描述
 */
export function injectToolDescriptions(
  systemPrompt: string,
  toolDescriptions: string
): string {
  return systemPrompt.replace('{tool_descriptions}', toolDescriptions);
}
```

**Step 4: 运行测试验证通过**

```bash
pnpm test reactSystem.test.ts
```

预期：PASS - 3/3 tests

**Step 5: 提交**

```bash
git add backend/src/agent/prompts/reactSystem.ts backend/src/agent/prompts/__tests__/reactSystem.test.ts
git commit -m "feat(prompts): 实现 ReAct System Prompt"
```

---

## Task 2: 实现工具描述格式化

**目标**: 将工具注册表中的工具格式化为 LLM 可理解的描述

**Files:**
- Modify: `backend/src/agent/tools/index.ts`（已有 formatToolDescriptions，需增强）
- Create: `backend/src/agent/prompts/__tests__/toolFormat.test.ts`

**Step 1: 编写测试验证工具描述格式**

在 `backend/src/agent/prompts/__tests__/toolFormat.test.ts` 中：

```typescript
import { describe, it, expect } from 'vitest';
import { formatToolDescriptions, getP0Tools } from '../../tools/index';

describe('Tool Description Formatting', () => {
  it('should format tool with JSON schema parameters', () => {
    const tools = getP0Tools();
    const formatted = formatToolDescriptions(tools);

    expect(formatted).toContain('ask_followup_question');
    expect(formatted).toContain('question');
    expect(formatted).toContain('reason');
  });

  it('should include tool descriptions', () => {
    const tools = getP0Tools();
    const formatted = formatToolDescriptions(tools);

    expect(formatted).toContain('追问用户');
    expect(formatted).toContain('结束对话');
  });

  it('should format all P0 tools', () => {
    const tools = getP0Tools();
    const formatted = formatToolDescriptions(tools);

    expect(formatted).toContain('ask_followup_question');
    expect(formatted).toContain('finish');
    expect(formatted).toContain('query_knowledge_base');
    expect(formatted).toContain('search_web');
  });
});
```

**Step 2: 运行测试验证通过**（函数已存在）

```bash
pnpm test toolFormat.test.ts
```

预期：PASS - 3/3 tests（formatToolDescriptions 已在 Task 8 实现）

**Step 3: 提交测试**

```bash
git add backend/src/agent/prompts/__tests__/toolFormat.test.ts
git commit -m "test(prompts): 添加工具描述格式化测试"
```

---

## Task 3: 创建意图指导 Prompt

**目标**: 根据识别的用户意图，生成针对性的指导信息

**Files:**
- Create: `backend/src/agent/prompts/intentGuidance.ts`
- Create: `backend/src/agent/prompts/__tests__/intentGuidance.test.ts`

**Step 1: 编写测试**

在 `backend/src/agent/prompts/__tests__/intentGuidance.test.ts` 中：

```typescript
import { describe, it, expect } from 'vitest';
import { buildIntentGuidance } from '../intentGuidance';

describe('Intent Guidance', () => {
  it('should provide guidance for symptom consultation', () => {
    const guidance = buildIntentGuidance(['symptom_consult'], {});

    expect(guidance).toContain('症状');
    expect(guidance).toContain('query_knowledge_base');
  });

  it('should provide guidance for emergency', () => {
    const guidance = buildIntentGuidance(['emergency'], {
      hasEmergencyKeywords: true,
      severity: 'severe'
    });

    expect(guidance).toContain('紧急');
    expect(guidance).toContain('就医');
  });

  it('should handle multiple intents', () => {
    const guidance = buildIntentGuidance(
      ['symptom_consult', 'medicine_info'],
      {}
    );

    expect(guidance).toContain('症状');
    expect(guidance).toContain('药品');
  });
});
```

**Step 2: 运行测试验证失败**

```bash
pnpm test intentGuidance.test.ts
```

预期：FAIL - "Module not found"

**Step 3: 实现意图指导**

在 `backend/src/agent/prompts/intentGuidance.ts` 中：

```typescript
import type { UserIntent, RiskIndicators } from '../types';

/**
 * 根据用户意图生成指导信息
 */
export function buildIntentGuidance(
  intents: UserIntent[],
  riskIndicators: Partial<RiskIndicators>
): string {
  const guidances: string[] = [];

  // 紧急情况优先
  if (intents.includes('emergency') || riskIndicators.hasEmergencyKeywords) {
    guidances.push(`
⚠️ **紧急情况处理**：
- 用户可能处于紧急状态
- 优先询问关键症状（持续时间、严重程度）
- 如确认紧急 → 立即建议就医，不要延误
- 可以拨打 120 急救电话
`);
  }

  // 症状咨询
  if (intents.includes('symptom_consult')) {
    guidances.push(`
📋 **症状咨询流程**：
1. 收集症状详情（部位、程度、持续时间、伴随症状）
2. 使用 query_knowledge_base 查询专业信息
3. 评估风险等级
4. 给出建议（缓解方法、就医建议）
`);
  }

  // 药品咨询
  if (intents.includes('medicine_info')) {
    guidances.push(`
💊 **药品咨询流程**：
1. 了解用途（治疗什么症状）
2. 使用 query_knowledge_base 查询药品信息
3. 说明用法用量、注意事项
4. 提醒：具体用药需遵医嘱
`);
  }

  // 医院推荐
  if (intents.includes('hospital_recommend')) {
    guidances.push(`
🏥 **医院推荐流程**：
1. 了解就诊需求（科室、地区）
2. 使用 search_web 查询医院信息
3. 推荐合适的医院和科室
`);
  }

  // 健康建议
  if (intents.includes('health_advice')) {
    guidances.push(`
🌿 **健康建议流程**：
1. 了解用户健康目标
2. 使用 query_knowledge_base 获取科学建议
3. 给出实用、安全的建议
`);
  }

  // 通用咨询
  if (intents.includes('general_qa')) {
    guidances.push(`
❓ **通用咨询流程**：
1. 理解用户问题
2. 优先使用 query_knowledge_base
3. 必要时使用 search_web
4. 清晰回答，必要时追问
`);
  }

  return guidances.join('\n');
}

/**
 * 生成优先级提醒
 */
export function buildPriorityReminder(): string {
  return `
📌 **信息来源优先级提醒**：
1. knowledge_base（知识库）→ 最可靠，优先使用
2. web_search（网络搜索）→ 次选，需注明"以上信息来自网络搜索"
3. model_knowledge（内置知识）→ 最后，需添加"以上建议仅供参考，不能替代医生诊断"
`;
}
```

**Step 4: 运行测试验证通过**

```bash
pnpm test intentGuidance.test.ts
```

预期：PASS - 3/3 tests

**Step 5: 提交**

```bash
git add backend/src/agent/prompts/intentGuidance.ts backend/src/agent/prompts/__tests__/intentGuidance.test.ts
git commit -m "feat(prompts): 实现意图指导生成"
```

---

## Task 4: 实现 ReAct 输出解析器

**目标**: 解析 LLM 输出，提取 Thought、Action、Action Input

**Files:**
- Create: `backend/src/agent/parser/reactParser.ts`
- Create: `backend/src/agent/parser/__tests__/reactParser.test.ts`

**Step 1: 编写测试**

在 `backend/src/agent/parser/__tests__/reactParser.test.ts` 中：

```typescript
import { describe, it, expect } from 'vitest';
import { parseReActOutput, ReActParseResult } from '../reactParser';

describe('ReAct Output Parser', () => {
  it('should parse valid ReAct output', () => {
    const output = `
Thought: 用户询问头疼原因
Action: ask_followup_question
Action Input: {"question": "头疼多久了？", "reason": "需要了解持续时间"}
`;

    const result = parseReActOutput(output);

    expect(result.thought).toBe('用户询问头疼原因');
    expect(result.action).toBe('ask_followup_question');
    expect(result.actionInput).toEqual({
      question: '头疼多久了？',
      reason: '需要了解持续时间',
    });
    expect(result.isFinished).toBe(false);
  });

  it('should handle finish action', () => {
    const output = `
Thought: 已收集足够信息
Action: finish
Action Input: {"finalResponse": "建议您...", "summary": "头疼咨询"}
`;

    const result = parseReActOutput(output);

    expect(result.action).toBe('finish');
    expect(result.isFinished).toBe(true);
  });

  it('should handle JSON parsing errors gracefully', () => {
    const output = `
Thought: 测试
Action: test_tool
Action Input: {invalid json}
`;

    const result = parseReActOutput(output);

    expect(result.parseError).toBeDefined();
    expect(result.action).toBe('test_tool');
  });

  it('should extract thought even without action', () => {
    const output = `Thought: 仅有思考内容`;

    const result = parseReActOutput(output);

    expect(result.thought).toBe('仅有思考内容');
    expect(result.action).toBeNull();
  });
});
```

**Step 2: 运行测试验证失败**

```bash
pnpm test reactParser.test.ts
```

预期：FAIL - "Module not found"

**Step 3: 实现解析器**

在 `backend/src/agent/parser/reactParser.ts` 中：

```typescript
/**
 * ReAct 输出解析结果
 */
export interface ReActParseResult {
  thought: string | null;
  action: string | null;
  actionInput: any;
  isFinished: boolean;
  parseError?: string;
}

/**
 * 解析 LLM 的 ReAct 格式输出
 *
 * @param output LLM 输出文本
 * @returns 解析结果
 */
export function parseReActOutput(output: string): ReActParseResult {
  const result: ReActParseResult = {
    thought: null,
    action: null,
    actionInput: null,
    isFinished: false,
  };

  try {
    // 提取 Thought
    const thoughtMatch = output.match(/Thought:\s*(.+?)(?=\n(?:Action:|$))/s);
    if (thoughtMatch) {
      result.thought = thoughtMatch[1].trim();
    }

    // 提取 Action
    const actionMatch = output.match(/Action:\s*(\w+)/);
    if (actionMatch) {
      result.action = actionMatch[1].trim();

      // 检查是否是 finish 动作
      if (result.action === 'finish') {
        result.isFinished = true;
      }
    }

    // 提取 Action Input（JSON）
    const actionInputMatch = output.match(/Action Input:\s*(\{[\s\S]*?\})/);
    if (actionInputMatch) {
      try {
        // 尝试解析 JSON
        const jsonStr = actionInputMatch[1].trim();
        result.actionInput = JSON.parse(jsonStr);
      } catch (error) {
        result.parseError = `JSON parse error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.actionInput = null;
      }
    }
  } catch (error) {
    result.parseError = `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }

  return result;
}

/**
 * 验证解析结果是否有效（有 action 且有 actionInput）
 */
export function isValidReActOutput(result: ReActParseResult): boolean {
  return result.action !== null && result.actionInput !== null && !result.parseError;
}

/**
 * 格式化解析错误信息
 */
export function formatParseError(result: ReActParseResult): string {
  if (!result.parseError) {
    return '';
  }

  return `解析 ReAct 输出时出错：${result.parseError}\n请确保按照以下格式输出：
Thought: [你的思考]
Action: [工具名称]
Action Input: [JSON格式参数]`;
}
```

**Step 4: 运行测试验证通过**

```bash
pnpm test reactParser.test.ts
```

预期：PASS - 4/4 tests

**Step 5: 提交**

```bash
git add backend/src/agent/parser/reactParser.ts backend/src/agent/parser/__tests__/reactParser.test.ts
git commit -m "feat(parser): 实现 ReAct 输出解析器"
```

---

## Task 5: 实现 Scratchpad 管理

**目标**: 管理 ReAct 循环的思考记录（scratchpad）

**Files:**
- Create: `backend/src/agent/utils/scratchpad.ts`
- Create: `backend/src/agent/utils/__tests__/scratchpad.test.ts`

**Step 1: 编写测试**

在 `backend/src/agent/utils/__tests__/scratchpad.test.ts` 中：

```typescript
import { describe, it, expect } from 'vitest';
import {
  appendToScratchpad,
  formatScratchpadEntry,
  parseScratchpad,
} from '../scratchpad';

describe('Scratchpad Management', () => {
  it('should format scratchpad entry', () => {
    const entry = formatScratchpadEntry({
      thought: '用户询问头疼',
      action: 'ask_followup_question',
      actionInput: { question: '头疼多久了？' },
      observation: '用户回复: 三天了',
    });

    expect(entry).toContain('Thought: 用户询问头疼');
    expect(entry).toContain('Action: ask_followup_question');
    expect(entry).toContain('Observation: 用户回复: 三天了');
  });

  it('should append to existing scratchpad', () => {
    const existing = 'Thought: 第一轮\nAction: tool1\nObservation: 结果1\n\n';
    const newEntry = formatScratchpadEntry({
      thought: '第二轮',
      action: 'tool2',
      actionInput: {},
      observation: '结果2',
    });

    const updated = appendToScratchpad(existing, newEntry);

    expect(updated).toContain('第一轮');
    expect(updated).toContain('第二轮');
  });

  it('should parse scratchpad into iterations', () => {
    const scratchpad = `
Thought: 第一次思考
Action: tool1
Action Input: {"param": "value"}
Observation: 结果1

Thought: 第二次思考
Action: tool2
Action Input: {"param": "value2"}
Observation: 结果2
`;

    const iterations = parseScratchpad(scratchpad);

    expect(iterations).toHaveLength(2);
    expect(iterations[0].thought).toBe('第一次思考');
    expect(iterations[1].action).toBe('tool2');
  });
});
```

**Step 2: 运行测试验证失败**

```bash
pnpm test scratchpad.test.ts
```

预期：FAIL - "Module not found"

**Step 3: 实现 Scratchpad 管理**

在 `backend/src/agent/utils/scratchpad.ts` 中：

```typescript
/**
 * Scratchpad 条目
 */
export interface ScratchpadEntry {
  thought: string;
  action: string;
  actionInput: any;
  observation: string;
}

/**
 * 格式化单个 scratchpad 条目
 */
export function formatScratchpadEntry(entry: ScratchpadEntry): string {
  const actionInputStr = JSON.stringify(entry.actionInput, null, 2);

  return `Thought: ${entry.thought}
Action: ${entry.action}
Action Input: ${actionInputStr}
Observation: ${entry.observation}

`;
}

/**
 * 追加到现有 scratchpad
 */
export function appendToScratchpad(
  existing: string,
  newEntry: string
): string {
  return existing + newEntry;
}

/**
 * 解析 scratchpad 为迭代列表
 */
export function parseScratchpad(scratchpad: string): ScratchpadEntry[] {
  const iterations: ScratchpadEntry[] = [];

  // 按双换行符分割迭代
  const blocks = scratchpad.split('\n\n').filter(Boolean);

  for (const block of blocks) {
    const thoughtMatch = block.match(/Thought:\s*(.+?)(?=\nAction:|$)/s);
    const actionMatch = block.match(/Action:\s*(\w+)/);
    const actionInputMatch = block.match(/Action Input:\s*(\{[\s\S]*?\})/);
    const observationMatch = block.match(/Observation:\s*(.+?)$/s);

    if (thoughtMatch && actionMatch) {
      iterations.push({
        thought: thoughtMatch[1].trim(),
        action: actionMatch[1].trim(),
        actionInput: actionInputMatch
          ? JSON.parse(actionInputMatch[1].trim())
          : {},
        observation: observationMatch ? observationMatch[1].trim() : '',
      });
    }
  }

  return iterations;
}

/**
 * 截断过长的 scratchpad（保留最近 N 次迭代）
 */
export function truncateScratchpad(
  scratchpad: string,
  maxIterations: number = 5
): string {
  const iterations = parseScratchpad(scratchpad);

  if (iterations.length <= maxIterations) {
    return scratchpad;
  }

  // 保留最近的 maxIterations 次
  const recent = iterations.slice(-maxIterations);
  return recent.map(formatScratchpadEntry).join('');
}
```

**Step 4: 运行测试验证通过**

```bash
pnpm test scratchpad.test.ts
```

预期：PASS - 3/3 tests

**Step 5: 提交**

```bash
git add backend/src/agent/utils/scratchpad.ts backend/src/agent/utils/__tests__/scratchpad.test.ts
git commit -m "feat(utils): 实现 Scratchpad 管理工具"
```

---

## Task 6: 实现 ReAct Loop 节点

**目标**: 实现核心的 ReAct 循环节点，整合 Prompt、解析、工具执行

**Files:**
- Create: `backend/src/agent/nodes/reactLoop.ts`
- Create: `backend/src/agent/nodes/__tests__/reactLoop.test.ts`

**注意**: 这是复杂任务，需要 mock LLM 和工具调用

**Step 1: 编写测试（使用 mock）**

在 `backend/src/agent/nodes/__tests__/reactLoop.test.ts` 中：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactLoop } from '../reactLoop';
import type { AgentStateType } from '../../state';
import { AgentEventEmitter } from '../../events/AgentEventEmitter';

// Mock LLM
vi.mock('@langchain/community/chat_models/zhipuai', () => ({
  ChatZhipuAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue({
      content: `Thought: 用户询问头疼
Action: ask_followup_question
Action Input: {"question": "头疼多久了？", "reason": "需要了解持续时间"}`,
    }),
  })),
}));

describe('ReAct Loop Node', () => {
  let mockState: Partial<AgentStateType>;

  beforeEach(() => {
    mockState = {
      messages: [
        { role: 'user', content: '我头疼' } as any,
      ],
      conversationId: 'test-conv',
      messageId: 'test-msg',
      userId: 'test-user',
      userIntent: ['symptom_consult'],
      eventEmitter: new AgentEventEmitter(),
      agentIteration: 0,
      maxIterations: 10,
      scratchpad: '',
      isFinished: false,
      toolsUsed: [],
    };
  });

  it('should perform one ReAct iteration', async () => {
    const result = await reactLoop(mockState as AgentStateType);

    expect(result.agentIteration).toBe(1);
    expect(result.scratchpad).toContain('Thought:');
    expect(result.scratchpad).toContain('Action:');
  });

  it('should stop when max iterations reached', async () => {
    mockState.agentIteration = 10;
    mockState.maxIterations = 10;

    const result = await reactLoop(mockState as AgentStateType);

    expect(result.isFinished).toBe(true);
    expect(result.fallbackResponse).toContain('最大迭代');
  });

  it('should mark as finished when finish tool is called', async () => {
    // Mock LLM 返回 finish action
    vi.mocked(require('@langchain/community/chat_models/zhipuai').ChatZhipuAI)
      .mockImplementationOnce(() => ({
        invoke: vi.fn().mockResolvedValue({
          content: `Thought: 已收集足够信息
Action: finish
Action Input: {"finalResponse": "建议您...", "summary": "咨询"}`,
        }),
      }));

    const result = await reactLoop(mockState as AgentStateType);

    expect(result.isFinished).toBe(true);
  });
});
```

**Step 2: 运行测试验证失败**

```bash
pnpm test reactLoop.test.ts
```

预期：FAIL - "Module not found"

**Step 3: 实现 ReAct Loop 节点**

在 `backend/src/agent/nodes/reactLoop.ts` 中：

```typescript
import { ChatZhipuAI } from '@langchain/community/chat_models/zhipuai';
import type { AgentStateType } from '../state';
import { buildReActSystemPrompt, injectToolDescriptions } from '../prompts/reactSystem';
import { buildIntentGuidance, buildPriorityReminder } from '../prompts/intentGuidance';
import { formatToolDescriptions, getP0Tools } from '../tools/index';
import { parseReActOutput, isValidReActOutput, formatParseError } from '../parser/reactParser';
import { formatScratchpadEntry, appendToScratchpad } from '../utils/scratchpad';
import { getToolByName } from '../tools/index';

/**
 * ReAct Loop 节点 - 执行一次 Think → Act → Observe 循环
 */
export async function reactLoop(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const {
    messages,
    conversationId,
    messageId,
    userId,
    userIntent,
    riskIndicators,
    eventEmitter,
    agentIteration,
    maxIterations,
    scratchpad,
    isFinished,
    toolsUsed,
  } = state;

  // 检查是否已完成
  if (isFinished) {
    return { isFinished: true };
  }

  // 检查是否达到最大迭代次数
  if (agentIteration >= maxIterations) {
    return {
      isFinished: true,
      fallbackResponse: '抱歉，我遇到了一些困难。请您换个方式描述问题，或者联系人工客服。',
    };
  }

  try {
    // 1. 构建 Prompt
    const tools = getP0Tools();
    const toolDescriptions = formatToolDescriptions(tools);
    const systemPrompt = injectToolDescriptions(
      buildReActSystemPrompt(),
      toolDescriptions
    );
    const intentGuidance = buildIntentGuidance(userIntent, riskIndicators);
    const priorityReminder = buildPriorityReminder();

    // 2. 构建完整输入
    const fullPrompt = `${systemPrompt}

${intentGuidance}

${priorityReminder}

# 当前对话历史

${scratchpad}

用户最新消息: ${messages[messages.length - 1].content}

现在，按照 ReAct 格式开始你的思考和行动：`;

    // 3. 调用 LLM
    const llm = new ChatZhipuAI({
      model: 'glm-4-plus',
      temperature: 0.7,
    });

    const response = await llm.invoke(fullPrompt);
    const llmOutput = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    // 4. 解析输出
    const parsed = parseReActOutput(llmOutput);

    // 5. 验证解析结果
    if (!isValidReActOutput(parsed)) {
      console.error('[ReactLoop] Parse error:', formatParseError(parsed));
      return {
        agentIteration: agentIteration + 1,
        scratchpad: appendToScratchpad(
          scratchpad,
          `Thought: ${parsed.thought || 'Parse error'}\n\n`
        ),
      };
    }

    // 6. 执行工具
    const tool = getToolByName(parsed.action!);
    if (!tool) {
      console.error(`[ReactLoop] Tool not found: ${parsed.action}`);
      return {
        agentIteration: agentIteration + 1,
        scratchpad: appendToScratchpad(
          scratchpad,
          `Thought: ${parsed.thought}\nAction: ${parsed.action}\nObservation: 工具不存在\n\n`
        ),
      };
    }

    const toolResult = await tool.execute(parsed.actionInput, {
      conversationId,
      messageId,
      userId,
      userIntent,
      eventEmitter,
      iteration: agentIteration + 1,
    });

    // 7. 更新 scratchpad
    const observation = toolResult.success
      ? JSON.stringify(toolResult.result)
      : `Error: ${toolResult.error}`;

    const newEntry = formatScratchpadEntry({
      thought: parsed.thought!,
      action: parsed.action!,
      actionInput: parsed.actionInput,
      observation,
    });

    const updatedScratchpad = appendToScratchpad(scratchpad, newEntry);

    // 8. 返回更新
    return {
      agentIteration: agentIteration + 1,
      scratchpad: updatedScratchpad,
      isFinished: parsed.isFinished,
      toolsUsed: [...toolsUsed, parsed.action!],
    };
  } catch (error) {
    console.error('[ReactLoop] Error:', error);
    return {
      agentIteration: agentIteration + 1,
      isFinished: true,
      fallbackResponse: '抱歉，我遇到了技术问题。请稍后再试。',
    };
  }
}
```

**Step 4: 运行测试验证通过**

```bash
pnpm test reactLoop.test.ts
```

预期：PASS - 3/3 tests

**Step 5: 提交**

```bash
git add backend/src/agent/nodes/reactLoop.ts backend/src/agent/nodes/__tests__/reactLoop.test.ts
git commit -m "feat(nodes): 实现 ReAct Loop 核心节点"
```

---

## Task 7: 升级 classifyIntent 支持多意图

**目标**: 升级意图识别节点，支持识别多个意图和提取风险指标

**Files:**
- Modify: `backend/src/agent/nodes/classifyIntent.ts`
- Create: `backend/src/agent/nodes/__tests__/classifyIntentMulti.test.ts`

**Step 1: 编写测试**

在 `backend/src/agent/nodes/__tests__/classifyIntentMulti.test.ts` 中：

```typescript
import { describe, it, expect, vi } from 'vitest';
import { classifyIntent } from '../classifyIntent';
import type { AgentStateType } from '../../state';
import { AgentEventEmitter } from '../../events/AgentEventEmitter';

// Mock LLM
vi.mock('@langchain/community/chat_models/zhipuai', () => ({
  ChatZhipuAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        intents: ['symptom_consult', 'medicine_info'],
        entities: {
          symptoms: ['头疼'],
          bodyParts: ['头部'],
        },
        riskIndicators: {
          hasEmergencyKeywords: false,
          severity: 'mild',
        },
      }),
    }),
  })),
}));

describe('classifyIntent - Multi-Intent Support', () => {
  it('should identify multiple intents', async () => {
    const mockState: Partial<AgentStateType> = {
      messages: [
        { role: 'user', content: '我头疼，该吃什么药？' } as any,
      ],
      conversationId: 'test-conv',
      eventEmitter: new AgentEventEmitter(),
    };

    const result = await classifyIntent(mockState as AgentStateType);

    expect(result.userIntent).toContain('symptom_consult');
    expect(result.userIntent).toContain('medicine_info');
    expect(result.primaryIntent).toBe('symptom_consult');
  });

  it('should extract risk indicators', async () => {
    vi.mocked(require('@langchain/community/chat_models/zhipuai').ChatZhipuAI)
      .mockImplementationOnce(() => ({
        invoke: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            intents: ['emergency'],
            entities: { symptoms: ['胸痛', '呼吸困难'] },
            riskIndicators: {
              hasEmergencyKeywords: true,
              severity: 'severe',
            },
          }),
        }),
      }));

    const mockState: Partial<AgentStateType> = {
      messages: [
        { role: 'user', content: '胸痛，呼吸困难' } as any,
      ],
      conversationId: 'test-conv',
      eventEmitter: new AgentEventEmitter(),
    };

    const result = await classifyIntent(mockState as AgentStateType);

    expect(result.riskIndicators.hasEmergencyKeywords).toBe(true);
    expect(result.riskIndicators.severity).toBe('severe');
  });
});
```

**Step 2: 运行测试验证失败**

```bash
pnpm test classifyIntentMulti.test.ts
```

预期：FAIL（因为当前 classifyIntent 返回单个意图）

**Step 3: 修改 classifyIntent 实现**

在 `backend/src/agent/nodes/classifyIntent.ts` 中：

```typescript
// 找到现有的 classifyIntent 函数，修改以支持多意图

import { ChatZhipuAI } from '@langchain/community/chat_models/zhipuai';
import type { AgentStateType } from '../state';
import type { UserIntent } from '../types';

/**
 * 意图识别节点 - 升级支持多意图和风险指标
 */
export async function classifyIntent(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const { messages, conversationId, eventEmitter } = state;
  const latestMessage = messages[messages.length - 1];

  try {
    const llm = new ChatZhipuAI({
      model: 'glm-4-plus',
      temperature: 0.3,
    });

    const prompt = `你是医疗意图识别助手。分析用户消息，识别所有意图并提取信息。

可能的意图类型：
- symptom_consult: 症状咨询
- medicine_info: 药品信息
- hospital_recommend: 医院推荐
- health_advice: 健康建议
- general_qa: 通用问答
- emergency: 紧急情况

用户消息: ${latestMessage.content}

请以 JSON 格式返回：
{
  "intents": ["主要意图", "次要意图"],
  "entities": {
    "symptoms": ["症状1"],
    "medicines": ["药品1"],
    "bodyParts": ["部位1"]
  },
  "riskIndicators": {
    "hasEmergencyKeywords": false,
    "severity": "mild"  // mild | moderate | severe
  }
}`;

    const response = await llm.invoke(prompt);
    const content = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    // 清理可能的 markdown 代码块
    const cleanContent = content
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const parsed = JSON.parse(cleanContent);

    // 提取意图列表
    const intents: UserIntent[] = parsed.intents || [];
    const primaryIntent = intents[0] || 'general_qa';

    // 计算置信度（简化版）
    const intentConfidence: Record<UserIntent, number> = {};
    intents.forEach((intent: UserIntent, index: number) => {
      intentConfidence[intent] = 1.0 - (index * 0.2);
    });

    // 发送意图识别事件
    eventEmitter.emit('agent:intent', {
      conversationId,
      intents,
      primaryIntent,
      entities: parsed.entities || {},
      riskIndicators: parsed.riskIndicators || {
        hasEmergencyKeywords: false,
        severity: 'mild',
      },
    });

    return {
      userIntent: intents,
      primaryIntent,
      intentConfidence,
      extractedInfo: parsed.entities || {},
      riskIndicators: parsed.riskIndicators || {
        hasEmergencyKeywords: false,
        severity: 'mild',
      },
    };
  } catch (error) {
    console.error('[ClassifyIntent] Error:', error);

    // 降级：返回通用意图
    return {
      userIntent: ['general_qa'],
      primaryIntent: 'general_qa',
      intentConfidence: { general_qa: 0.5 },
      extractedInfo: {},
      riskIndicators: {
        hasEmergencyKeywords: false,
        severity: 'mild',
      },
    };
  }
}
```

**Step 4: 运行测试验证通过**

```bash
pnpm test classifyIntentMulti.test.ts
```

预期：PASS - 2/2 tests

**Step 5: 提交**

```bash
git add backend/src/agent/nodes/classifyIntent.ts backend/src/agent/nodes/__tests__/classifyIntentMulti.test.ts
git commit -m "feat(nodes): 升级 classifyIntent 支持多意图和风险指标"
```

---

## Phase 3 完成检查清单

### 3.1 Prompt 工程 ✅
- [x] Task 1: ReAct System Prompt
- [x] Task 2: 工具描述格式化（测试补充）
- [x] Task 3: 意图指导生成

### 3.2 ReAct 循环实现 ✅
- [x] Task 4: ReAct 输出解析器
- [x] Task 5: Scratchpad 管理
- [x] Task 6: ReAct Loop 节点

### 3.3 意图识别升级 ✅
- [x] Task 7: 多意图识别和风险指标提取

---

## 下一步

Phase 3 完成后，接下来：

1. **Phase 4: 图结构重构**
   - 新图定义（简化为 classifyIntent → reactLoop → END）
   - 移除旧的分支节点

2. **Phase 5: SSE 事件系统升级**
   - 新增 agent:thought、agent:iteration 事件

3. **Phase 6: 数据持久化完善**
   - MessageWriter 升级
   - 保存工具调用记录

---

## 测试策略

每个 Task 完成后：

```bash
# 运行单元测试
pnpm test <test-file>

# 运行所有新增测试
pnpm test reactSystem.test toolFormat.test intentGuidance.test reactParser.test scratchpad.test reactLoop.test classifyIntentMulti.test

# 类型检查
pnpm tsc --noEmit
```

Phase 3 完成后：

```bash
# 运行完整测试套件
pnpm test:run

# 验证构建
pnpm build
```

预期：所有新增测试通过，无类型错误，构建成功。
