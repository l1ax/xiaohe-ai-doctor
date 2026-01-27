# 小禾AI医生 - ReAct Agent 架构设计

**日期**: 2026-01-27
**作者**: AI Assistant with User
**状态**: 设计完成，待实施

---

## 目录

1. [设计目标](#设计目标)
2. [整体架构](#整体架构)
3. [ReAct 循环设计](#react-循环设计)
4. [工具系统设计](#工具系统设计)
5. [数据库设计](#数据库设计)
6. [ReAct Prompt 工程](#react-prompt-工程)
7. [意图识别升级](#意图识别升级)
8. [信息来源优先级](#信息来源优先级)
9. [错误处理与容错](#错误处理与容错)
10. [SSE 事件系统](#sse-事件系统)
11. [性能优化策略](#性能优化策略)
12. [测试策略](#测试策略)
13. [实施路线图](#实施路线图)

---

## 设计目标

### 当前架构的核心限制

1. **单轮对话** - 无上下文记忆，无法多轮追问
2. **固定意图分支** - 缺少灵活性，无法自主决策工具使用
3. **串行工具执行** - 效率低，缺少智能编排
4. **医疗场景特殊性未充分考虑** - 缺少风险评估和紧急识别

### 新架构要实现的能力

**A. 多轮对话能力**
- 保存对话历史（数据库持久化）
- 理解上下文和指代
- 支持多轮追问症状细节

**B. 智能意图识别**
- 支持复合意图（如"肚子疼是什么病，该吃什么药"）
- 提供上下文信息而非强制控制流程

**D. Agent 自主决策**
- 采用 ReAct (Reasoning + Acting) 模式
- Agent 自主选择工具和行动顺序
- 智能判断何时结束对话

**C. 医疗风险控制**（隐含在工具设计中）
- 风险评估工具 (`assess_risk`)
- 紧急情况识别 (`check_emergency`)

---

## 整体架构

### 架构图

```
HTTP Request → AIChatController
                    ↓
            [数据库加载历史]
              加载最近 10 轮对话
                    ↓
            ┌───────────────┐
            │ classifyIntent│ (支持复合意图)
            │  识别用户意图  │
            └───────┬───────┘
                    │
            ┌───────▼───────┐
            │  ReAct Agent  │
            │  循环执行：     │
            │  Think → Act  │
            │  → Observe    │
            └───────┬───────┘
                    │
            [数据库持久化]
            保存所有消息和工具调用
                    ↓
            SSE 流式返回给前端
```

### 核心变化

| 组件 | 原架构 | 新架构 |
|------|--------|--------|
| **对话历史** | 单轮，无记忆 | 加载最近 10 轮，持久化 |
| **意图识别** | 单一意图 | 复合意图，提供上下文 |
| **执行模式** | 固定分支节点 | ReAct 循环，自主决策 |
| **工具系统** | 固定编排器 | 10 个工具，Agent 自主选择 |
| **结束判断** | 分支自然结束 | Agent 调用 `finish` 工具 |

### 移除的组件

- ❌ `symptomAnalysis` / `consultation` / `hospitalRecommend` / `medicineInfo` 节点
- ❌ `synthesizeResponse` 节点
- ❌ `orchestrateTools` 工具编排器

---

## ReAct 循环设计

### State 定义

```typescript
interface AgentState {
  // 对话数据
  messages: BaseMessage[];              // 完整对话历史（最近10轮）
  conversationId: string;
  messageId: string;
  userId: string;

  // 意图分析
  userIntent: UserIntent[];             // 支持多意图
  primaryIntent: UserIntent;            // 主要意图
  intentConfidence: Record<UserIntent, number>;
  extractedInfo: any;                   // 实体信息
  riskIndicators: {
    hasEmergencyKeywords: boolean;
    severity: 'mild' | 'moderate' | 'severe';
  };

  // ReAct 循环
  scratchpad: string;                   // Agent 的思考记录
  agentIteration: number;               // 当前迭代次数
  maxIterations: number;                // 安全上限（默认 10）
  isFinished: boolean;                  // 是否结束

  // 元数据
  startTime: number;
  eventEmitter: AgentEventEmitter;
}
```

### 图结构

```
__start__ → classifyIntent → reactLoop → finalResponse → END
```

### ReAct 循环逻辑

每次迭代：
1. **构建 Prompt** - 包含历史 + 工具列表 + scratchpad
2. **LLM 生成** - 输出 `Thought` + `Action` + `Action Input`
3. **解析 Action** - 提取工具名称和参数
4. **执行工具** - 调用工具，获得 `Observation`
5. **更新 scratchpad** - 追加本轮记录
6. **判断结束** - 检查是否调用 `finish` 工具

### 结束条件

- Agent 调用 `finish` 工具 → 正常结束
- 达到 `maxIterations` → 强制结束，生成兜底回复
- 发生错误 → 返回错误信息

### 输出格式

```
Thought: [分析当前情况，决定下一步]
Action: [工具名称]
Action Input: [JSON 格式参数]
```

---

## 工具系统设计

### 工具清单

| 工具名称 | 类型 | 描述 | 优先级 |
|---------|------|------|--------|
| `ask_followup_question` | 信息收集 | 追问用户症状细节 | P0 |
| `analyze_image` | 信息收集 | 分析医疗图片 | P2 |
| `query_knowledge_base` | 知识查询 | 查询专业医疗知识库（⭐最高优先级） | P0 |
| `search_web` | 知识查询 | 网络搜索（知识库无结果时降级使用） | P0 |
| `assess_risk` | 评估决策 | 评估症状风险等级 | P1 |
| `check_emergency` | 评估决策 | 检查是否需要立即就医 | P1 |
| `recommend_hospital` | 建议生成 | 推荐医院/科室 | P2 |
| `recommend_medicine` | 建议生成 | 药品使用建议 | P1 |
| `provide_advice` | 建议生成 | 健康建议 | P1 |
| `finish` | 流程控制 | 结束对话，给出最终回复 | P0 |

### 关键工具详细说明

#### 1. ask_followup_question

```typescript
{
  name: "ask_followup_question",
  description: "追问用户更多信息。当症状描述不清楚或需要更多细节时使用",
  parameters: {
    question: "string, 要问用户的问题",
    reason: "string, 为什么要问这个问题（内部记录）"
  }
}
```

**特殊处理**：
- 发送 SSE 消息给用户
- 暂停 ReAct 循环
- 等待下一次用户请求返回

#### 2. query_knowledge_base

```typescript
{
  name: "query_knowledge_base",
  description: "查询专业医疗知识库（⭐ 最优先使用）。包含经过审核的专业内容，可靠性最高",
  parameters: {
    query: "string, 查询内容"
  }
}
```

#### 3. assess_risk

```typescript
{
  name: "assess_risk",
  description: "评估症状的风险等级",
  parameters: {
    symptoms: "string[], 症状列表",
    duration: "string, 持续时间（可选）"
  },
  returns: {
    level: "low | medium | high | emergency",
    reason: "string, 评估原因",
    shouldSeeDoctor: "boolean"
  }
}
```

#### 4. finish

```typescript
{
  name: "finish",
  description: "结束对话，给出最终回复。当收集到足够信息并准备好完整建议时调用",
  parameters: {
    finalResponse: "string, 给用户的最终完整回复",
    summary: "string, 本次问诊总结（内部记录）",
    actions: "array, 附带的操作按钮（如'咨询人工医生'、'预约挂号'）",
    informationSources: "array, 信息来源（knowledge_base/web_search/model_knowledge）",
    reliabilityNote: "string, 可靠性说明（可选）"
  }
}
```

---

## 数据库设计

### 表结构

#### conversations 表

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  title TEXT,
  status TEXT DEFAULT 'active',  -- active | archived | deleted
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);
```

#### messages 表

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id),
  role TEXT NOT NULL,            -- user | assistant | system
  content TEXT NOT NULL,
  image_urls TEXT[],
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_created
  ON messages(conversation_id, created_at DESC);
```

#### tool_calls 表

```sql
CREATE TABLE tool_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id),
  message_id UUID REFERENCES messages(id),
  tool_name TEXT NOT NULL,
  status TEXT NOT NULL,          -- running | completed | failed
  input JSONB,
  output JSONB,
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tool_calls_conversation_created
  ON tool_calls(conversation_id, created_at DESC);
```

#### agent_iterations 表（可选，用于"查看思考过程"）

```sql
CREATE TABLE agent_iterations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id),
  iteration_number INTEGER,
  thought TEXT,
  action TEXT,
  action_input JSONB,
  observation TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 对话历史加载策略

```typescript
async function loadConversationHistory(conversationId: string) {
  // 加载最近 20 条消息（10 轮对话）
  const messages = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(20);

  return messages.reverse().map(toBaseMessage);
}
```

### 持久化策略

- **实时写入** - 不再批量，每条消息立即写入
- **分开保存** - 消息和工具调用分别保存到不同表
- **思考记录可选** - agent_iterations 表按需保存

---

## ReAct Prompt 工程

### System Prompt 结构

```typescript
const REACT_SYSTEM_PROMPT = `
你是小禾AI医生，一位专业的医疗健康顾问助手。

## 你的职责
- 通过多轮对话收集症状信息
- 提供专业的健康建议和就医指导
- 评估症状风险，识别紧急情况
- 推荐合适的医院、科室和药品信息

## 工作模式：ReAct (Reasoning + Acting)
你需要循环执行以下步骤直到给出完整建议：

1. **Thought (思考)**：分析当前情况，决定下一步行动
2. **Action (行动)**：调用一个工具
3. **Observation (观察)**：查看工具返回的结果

## 可用工具
${formatToolDescriptions(tools)}

## 输出格式
每次必须严格按照以下格式输出：

Thought: [你的思考过程，分析当前掌握的信息和下一步计划]
Action: [工具名称]
Action Input: [JSON格式的参数]

## 信息来源优先级原则 ⚠️ 重要

1. **知识库优先**（最可靠）
   - 使用 query_knowledge_base 查询专业医疗知识
   - 这是经过审核的专业内容，可靠性最高
   - 只要知识库有相关信息，就应该基于知识库回答

2. **网络搜索降级**（次可靠）
   - 仅当知识库无结果时使用 search_web
   - 网络信息可能包含不准确内容，需谨慎引用
   - 建议在回复中说明"根据网络信息"

3. **模型知识兜底**（可靠性最低）
   - 仅当知识库和网络都无法获取信息时，使用你的内置知识
   - 必须在回复中说明"根据一般医学知识"
   - 并建议用户"咨询专业医生确认"

## 重要原则
1. **安全第一**：发现高风险症状立即使用 check_emergency 或 assess_risk
2. **信息充分**：在给建议前确保收集到足够信息
3. **专业谨慎**：药品建议必须强调"遵医嘱"，不可替代医生诊断
4. **自然对话**：追问要自然，不要像填表
5. **适时结束**：信息充足后使用 finish 工具给出完整建议

## 当前对话意图
${formatUserIntent(state.userIntent, state.extractedInfo, state.riskIndicators)}
`;
```

### 意图指导生成

```typescript
function generateIntentGuidance(intents: UserIntent[]): string {
  // 紧急情况特殊提示
  if (intents.includes('emergency')) {
    return '⚠️ 检测到可能的紧急情况，请优先使用 check_emergency 评估风险';
  }

  // 症状 + 药品复合意图
  const hasSymptom = intents.includes('symptom_consult');
  const hasMedicine = intents.includes('medicine_info');

  if (hasSymptom && hasMedicine) {
    return `用户同时询问症状和药品，建议流程：
1. 先分析症状（可能需要追问细节）
2. 基于症状分析给出药品建议
建议工具顺序：ask_followup_question → query_knowledge_base → recommend_medicine → finish`;
  }

  // 默认：让 Agent 自己决定
  return '请根据用户问题，灵活选择合适的工具和行动顺序。';
}
```

### 输出解析

```typescript
function parseReActOutput(llmOutput: string) {
  const thoughtMatch = llmOutput.match(/Thought:\s*(.+?)(?=\nAction:|$)/s);
  const actionMatch = llmOutput.match(/Action:\s*(.+?)(?=\n|$)/);
  const actionInputMatch = llmOutput.match(/Action Input:\s*(.+?)$/s);

  if (!thoughtMatch || !actionMatch || !actionInputMatch) {
    throw new Error('Invalid ReAct output format');
  }

  return {
    thought: thoughtMatch[1].trim(),
    action: actionMatch[1].trim(),
    actionInput: JSON.parse(actionInputMatch[1].trim())
  };
}
```

---

## 意图识别升级

### 意图类型

```typescript
export type UserIntent =
  | 'symptom_consult'      // 症状咨询
  | 'general_qa'           // 通用问答
  | 'hospital_recommend'   // 医院推荐
  | 'medicine_info'        // 药品咨询
  | 'health_advice'        // 健康建议
  | 'emergency';           // 紧急情况
```

### 意图识别输出

```json
{
  "intents": ["symptom_consult", "medicine_info"],
  "entities": {
    "symptoms": ["肚子疼"],
    "duration": null,
    "medicines": [],
    "location": null
  },
  "riskIndicators": {
    "hasEmergencyKeywords": false,
    "severity": "mild"
  }
}
```

### 设计原则

1. **识别所有意图** - 不判断优先级，全部识别出来
2. **提供上下文** - 给 ReAct Agent 参考，不强制控制流程
3. **仅紧急情况特殊处理** - 其他情况让 Agent 自主决策

---

## 信息来源优先级

### 三级优先级

```
1. query_knowledge_base（专业知识库）
   ↓ 无结果时降级
2. search_web（网络搜索）
   ↓ 仍无结果时
3. 模型内置知识（需注明可靠性限制）
```

### 在 Prompt 中体现

- **工具描述中标注** - `query_knowledge_base` 标注"⭐ 最优先使用"
- **System Prompt 中强调** - 明确说明优先级原则
- **finish 工具要求标注来源** - `informationSources` 和 `reliabilityNote` 字段

### 前端展示

```typescript
// 消息元数据包含来源信息
{
  "sources": [
    {
      "type": "knowledge_base",
      "label": "专业医疗知识库",
      "reliability": "high",
      "icon": "🏥"
    }
  ],
  "reliabilityNote": null
}

// 前端显示徽章
// [🏥 专业知识库] 根据专业医疗资料，您的症状...
```

---

## 错误处理与容错

### 三层错误处理

#### 1. 工具层

```typescript
async function executeTool(toolName, params, context) {
  try {
    const result = await tool.execute(params, context);
    return { success: true, result };
  } catch (error) {
    logger.error(`Tool ${toolName} failed`, { error, params });

    // 发送失败事件
    emitter.emit('tool:call', createToolCallEvent(
      context.conversationId,
      toolId,
      toolName,
      context.messageId,
      'failed',
      { error: errorMessage }
    ));

    return {
      success: false,
      error: errorMessage,
      errorType: 'TOOL_EXECUTION_ERROR'
    };
  }
}
```

#### 2. ReAct 循环层

```typescript
// 工具失败 → 将错误作为 Observation，让 Agent 选择其他策略
if (!toolResult.success) {
  state.scratchpad += `
Observation: ⚠️ Tool execution failed: ${toolResult.error}. Please try another approach.
`;
  continue; // 继续下一轮
}

// 解析错误 → 提示 Agent 正确格式
if (error instanceof SyntaxError) {
  state.scratchpad += `
Observation: ⚠️ Output format error. Please strictly follow the format:
Thought: [your reasoning]
Action: [tool name]
Action Input: [JSON parameters]
`;
  continue;
}
```

#### 3. 顶层

```typescript
// 达到最大迭代次数 → 生成兜底回复
if (state.agentIteration >= state.maxIterations && !state.isFinished) {
  state.fallbackResponse = await generateFallbackResponse(state);
  state.isFinished = true;
}
```

### 错误处理原则

1. **工具失败不中断** - 作为 Observation 返回，Agent 可选择其他方案
2. **解析错误给提示** - 提示正确格式，允许重试
3. **达到上限生成兜底** - 不显示"失败"，给出基于现有信息的建议
4. **用户友好的错误信息** - 技术错误转换为用户能理解的提示

---

## SSE 事件系统

### 新增事件类型

#### agent:thought（思考过程）

```typescript
{
  type: 'agent:thought',
  data: {
    conversationId: string;
    messageId: string;
    iteration: number;
    thought: string;
    action: string;
    actionInput: any;
    timestamp: string;
  }
}
```

#### agent:iteration（迭代状态）

```typescript
{
  type: 'agent:iteration',
  data: {
    conversationId: string;
    iteration: number;
    status: 'started' | 'completed';
    totalIterations?: number;
    timestamp: string;
  }
}
```

#### 扩展 tool:call

```typescript
{
  type: 'tool:call',
  data: {
    // ... 原有字段
    iteration?: number;  // 新增：属于第几次迭代
  }
}
```

### 前端展示设计

#### 可折叠的思考过程

```jsx
<MessageBubble>
  <MessageContent>{message}</MessageContent>

  {hasThinkingProcess && (
    <ThinkingProcessCollapsible>
      <ThinkingProcessToggle>
        💭 查看 AI 思考过程 ({iterations} 轮)
      </ThinkingProcessToggle>

      <ThinkingProcessContent>
        {iterations.map(iter => (
          <IterationCard>
            <IterationHeader>第 {iter.iteration} 轮</IterationHeader>
            <ThoughtText>💭 {iter.thought}</ThoughtText>
            <ActionText>🔧 {iter.action}</ActionText>
            <ObservationText>👀 {iter.observation}</ObservationText>
          </IterationCard>
        ))}
      </ThinkingProcessContent>
    </ThinkingProcessCollapsible>
  )}

  {/* 信息来源标识 */}
  <SourceBadges>
    {message.sources.map(source => (
      <Badge variant={source.reliability}>
        {source.icon} {source.label}
      </Badge>
    ))}
  </SourceBadges>
</MessageBubble>
```

---

## 性能优化策略

### 1. 对话历史截断

```typescript
function truncateHistory(messages: BaseMessage[], maxTokens = 4000) {
  // 保留最新 10 轮（20 条消息）
  const recentMessages = messages.slice(-20);

  // 如果仍超长，生成早期摘要
  const estimatedTokens = estimateTokens(recentMessages);
  if (estimatedTokens > maxTokens) {
    const latest = messages.slice(-6);  // 最新 3 轮
    const earlier = messages.slice(0, -6);
    const summary = await summarizeHistory(earlier);

    return [
      { role: 'system', content: `早期对话摘要：${summary}` },
      ...latest
    ];
  }

  return recentMessages;
}
```

### 2. 数据库查询优化

```typescript
// 并行加载
const [messages, toolCalls, metadata] = await Promise.all([
  supabase.from('messages').select('*')...
  supabase.from('tool_calls').select('*')...
  supabase.from('conversations').select('*')...
]);

// 添加索引
CREATE INDEX CONCURRENTLY idx_messages_conversation_created
  ON messages(conversation_id, created_at DESC);
```

### 3. 缓存策略

```typescript
// 知识库查询缓存
class KnowledgeBaseCache {
  private cache = new Map();
  private ttl = 3600000; // 1小时

  async query(query: string) {
    const cacheKey = this.hashQuery(query);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.result;
    }

    const result = await queryKnowledgeBase(query);
    this.cache.set(cacheKey, { result, timestamp: Date.now() });
    return result;
  }
}

// 图片识别缓存（同一图片不重复识别）
class ImageRecognitionCache {
  private cache = new Map<string, ImageRecognitionResult>();

  async recognize(imageUrl: string, config: any) {
    if (this.cache.has(imageUrl)) {
      return this.cache.get(imageUrl)!;
    }

    const result = await recognizeImage(imageUrl, config);
    this.cache.set(imageUrl, result);
    return result;
  }
}
```

### 4. 流式输出优化

```typescript
// 按句子边界分块，而非固定字符数
function splitBySentence(text: string): string[] {
  return text.split(/([。？！])/g).reduce((acc, part, i, arr) => {
    if (i % 2 === 0 && part) {
      acc.push(part + (arr[i + 1] || ''));
    }
    return acc;
  }, [] as string[]);
}
```

---

## 测试策略

### 1. 单元测试（目标覆盖率 80%）

#### 工具测试
```typescript
describe('query_knowledge_base tool', () => {
  it('should return knowledge base results', async () => {
    const result = await queryKnowledgeBase('感冒症状');
    expect(result.hasResults).toBe(true);
    expect(result.source).toBe('knowledge_base');
  });
});

describe('assess_risk tool', () => {
  it('should identify high-risk symptoms', async () => {
    const result = await assessRisk({
      symptoms: ['胸痛', '呼吸困难'],
      duration: '2小时'
    });
    expect(result.level).toBe('high');
  });
});
```

#### ReAct 解析测试
```typescript
describe('ReAct output parser', () => {
  it('should parse valid ReAct output', () => {
    const output = `
Thought: 用户描述头疼
Action: ask_followup_question
Action Input: {"question": "头疼多久了？"}
`;
    const parsed = parseReActOutput(output);
    expect(parsed.action).toBe('ask_followup_question');
  });
});
```

### 2. 集成测试

#### 完整 ReAct 流程
```typescript
describe('ReAct Agent Flow', () => {
  it('should complete a symptom consultation', async () => {
    const result = await runAgent({
      messages: [{ role: 'user', content: '我头疼三天了' }],
      conversationId: 'test_conv',
      messageId: 'test_msg',
      userId: 'test_user'
    });

    expect(result.isFinished).toBe(true);
    expect(result.toolsUsed).toContain('query_knowledge_base');
  });
});
```

#### 多轮对话测试
```typescript
it('should handle multi-turn conversation', async () => {
  // 第一轮
  let result = await runAgent({
    messages: [{ role: 'user', content: '头疼' }],
    conversationId: 'test_conv_2'
  });
  expect(result.scratchpad).toContain('ask_followup_question');

  // 第二轮
  result = await runAgent({
    messages: [
      { role: 'user', content: '头疼' },
      { role: 'assistant', content: '头疼多久了？' },
      { role: 'user', content: '三天了' }
    ],
    conversationId: 'test_conv_2'
  });
  expect(result.isFinished).toBe(true);
});
```

### 3. E2E 测试

```typescript
describe('AI Chat E2E', () => {
  it('should handle complete flow via SSE', async () => {
    const eventSource = new EventSource(...);
    const events = [];

    eventSource.onmessage = (event) => {
      events.push(JSON.parse(event.data));
    };

    await waitFor(() => {
      return events.some(e => e.type === 'conversation:end');
    }, 30000);

    expect(events).toContainEqual(
      expect.objectContaining({ type: 'tool:call' })
    );
  });
});
```

### 4. LLM 行为测试

```typescript
describe('ReAct Prompt Behavior', () => {
  it('should follow information source priority', async () => {
    const result = await runAgent({
      messages: [{ role: 'user', content: '感冒症状' }]
    });

    const toolSequence = extractToolSequence(result.scratchpad);
    expect(toolSequence[0]).toBe('query_knowledge_base');
  });

  it('should ask follow-up for insufficient info', async () => {
    const result = await runAgent({
      messages: [{ role: 'user', content: '头疼' }]
    });

    const toolSequence = extractToolSequence(result.scratchpad);
    expect(toolSequence).toContain('ask_followup_question');
  });
});
```

---

## 实施路线图

### 时间估算：8 周

| 阶段 | 时间 | 任务 | 交付物 | 验收标准 |
|------|------|------|--------|---------|
| **Phase 1-2** | Week 1-3 | 基础架构 + 工具系统 | 数据库表、工具实现 | 工具可独立运行 |
| **Phase 3-4** | Week 3-4 | ReAct 核心 + 图重构 | ReAct 循环、新图结构 | 可完成单轮对话 |
| **Phase 5-6** | Week 5 | 事件系统 + 持久化 | SSE 事件、数据库集成 | 可完成多轮对话 |
| **Phase 7-8** | Week 6-7 | 优化 + 测试 | 缓存、测试用例 | 测试覆盖率达标 |
| **Phase 9-10** | Week 7-8 | 前端 + 发布 | 前端适配、灰度发布 | 全量上线 |

### Phase 1: 基础架构搭建 (Week 1-2)

#### 1.1 数据库迁移
- 创建新表（conversations, messages, tool_calls, agent_iterations）
- 添加索引
- 数据迁移脚本

**文件**：
- `migrations/001_create_react_tables.sql`
- `migrations/002_add_indexes.sql`

**验收**：表结构创建成功，可读写

#### 1.2 State 定义升级
- 扩展 AgentState 支持 ReAct 字段
- 更新意图识别支持多意图
- 添加 scratchpad、agentIteration 等字段

**文件**：
- `src/agent/state.ts`
- `src/agent/types.ts`

**验收**：编译无错误

#### 1.3 对话历史加载
- 实现 `loadConversationHistory()`
- 实现历史截断逻辑
- 集成到 AIChatController

**文件**：
- `src/services/database/ConversationLoader.ts`
- `src/controllers/aiChatController.ts`

**验收**：可加载最近 10 轮对话

---

### Phase 2: 工具系统实现 (Week 2-3)

#### 2.1 核心工具开发

**优先级 P0**：
- `ask_followup_question`
- `query_knowledge_base` (已有，升级)
- `search_web` (已有，升级)
- `finish`

**优先级 P1**：
- `assess_risk`
- `check_emergency`
- `recommend_medicine`
- `provide_advice`

**优先级 P2**：
- `analyze_image` (已有，升级)
- `recommend_hospital`

**文件**：
- `src/agent/tools/askFollowup.ts`
- `src/agent/tools/assessRisk.ts`
- `src/agent/tools/checkEmergency.ts`
- `src/agent/tools/finish.ts`
- `src/agent/tools/index.ts`

**验收**：每个工具独立测试通过

#### 2.2 工具执行引擎
- 实现 `executeTool()` 统一调用接口
- 工具结果格式化
- 错误处理和重试逻辑

**文件**：
- `src/agent/tools/executor.ts`

**验收**：可根据名称调用任意工具，错误处理正确

---

### Phase 3: ReAct 核心逻辑 (Week 3-4)

#### 3.1 Prompt 工程
- 编写 ReAct System Prompt
- 编写工具描述 Prompt
- 编写信息优先级指导
- 测试 Prompt 效果

**文件**：
- `src/agent/prompts/reactSystem.ts`
- `src/agent/prompts/toolDescriptions.ts`
- `src/agent/prompts/intentGuidance.ts`

**验收**：LLM 输出正确格式，遵循优先级原则

#### 3.2 ReAct 循环实现
- 实现 `reactLoop()` 节点
- 实现 `parseReActOutput()`
- 实现 scratchpad 管理
- 实现循环结束判断

**文件**：
- `src/agent/nodes/reactLoop.ts`
- `src/agent/parser/reactParser.ts`

**验收**：可完成完整 ReAct 循环，事件发送正确

#### 3.3 意图识别升级
- 升级 `classifyIntent` 支持多意图
- 提取风险指标
- 生成意图指导信息

**文件**：
- `src/agent/nodes/classifyIntent.ts` (重构)

**验收**：可识别复合意图，提取实体信息

---

### Phase 4: 图结构重构 (Week 4)

#### 4.1 新图定义
- 移除旧的分支节点
- 添加 `reactLoop` 节点
- 添加 `finalResponse` 节点
- 更新路由逻辑

**文件**：
- `src/agent/graph.ts` (重构)
- `src/agent/router.ts` (简化)

**新流程**：
```
__start__ → classifyIntent → reactLoop → finalResponse → END
```

**验收**：图编译成功，流程执行正确

#### 4.2 移除旧代码
- 移除旧分支节点（symptomAnalysis, consultation, hospitalRecommend, medicineInfo, synthesizeResponse）
- 移除 `toolOrchestrator.ts`

**验收**：旧代码完全移除，无编译错误

---

### Phase 5: SSE 事件系统升级 (Week 5)

#### 5.1 新增事件类型
- 定义 `agent:thought` 事件
- 定义 `agent:iteration` 事件
- 扩展 `tool:call` 事件

**文件**：
- `src/agent/events/chat-event-types.ts`

**验收**：事件类型完整，前端可解析

#### 5.2 事件发送集成
- 在 `reactLoop` 中发送事件
- 在工具执行中发送事件
- 流式消息发送优化

**文件**：
- `src/agent/nodes/reactLoop.ts`
- `src/agent/tools/executor.ts`

**验收**：前端可接收所有事件，顺序正确

---

### Phase 6: 数据持久化完善 (Week 5)

#### 6.1 MessageWriter 升级
- 支持实时写入（移除批量）
- 分别保存消息和工具调用
- 保存 Agent 思考记录（可选）

**文件**：
- `src/services/database/MessageWriter.ts` (重构)

**验收**：消息立即写入，记录完整

#### 6.2 历史查询 API
- `GET /api/ai-chat/conversations/:id/history`
- `GET /api/ai-chat/conversations/:id/iterations`
- `GET /api/ai-chat/conversations/:id/tools`

**文件**：
- `src/routes/aiChat.ts`
- `src/controllers/aiChatController.ts`

**验收**：前端可查询历史，响应速度 < 200ms

---

### Phase 7: 性能优化 (Week 6)

#### 7.1 缓存实现
- 知识库查询缓存
- 图片识别缓存
- LRU 缓存策略

**文件**：
- `src/services/cache/KnowledgeBaseCache.ts`
- `src/services/cache/ImageCache.ts`

**验收**：缓存命中率 > 30%

#### 7.2 数据库优化
- 添加必要索引
- 查询优化
- 连接池配置

**验收**：查询时间 < 100ms，无慢查询

---

### Phase 8: 测试完善 (Week 6-7)

#### 8.1 单元测试
- 工具测试（10 个工具）
- ReAct 解析器测试
- 意图识别测试

**目标覆盖率**：80%

#### 8.2 集成测试
- ReAct 流程测试
- 多轮对话测试
- 数据库集成测试

**验收**：所有主流程测试通过

#### 8.3 E2E 测试
- SSE 完整流程测试
- 前后端联调测试

**验收**：用户场景全覆盖

---

### Phase 9: 前端适配 (Week 7)

#### 9.1 事件监听适配
- 监听新事件类型
- 展示思考过程（可折叠）
- 展示信息来源标识

**文件**：
- `frontend/src/services/sseClient.ts`
- `frontend/src/components/MessageBubble.tsx`
- `frontend/src/components/ThinkingProcess.tsx`

**验收**：可正常显示对话，思考过程可选展示

---

### Phase 10: 灰度发布与监控 (Week 8)

#### 10.1 灰度发布
- 10% 用户使用新架构
- 90% 用户使用旧架构
- 监控错误率和性能

**验收**：新架构错误率 < 5%，响应时间 < 15s (P95)

#### 10.2 全量发布
- 100% 切换到新架构
- 移除旧代码
- 数据迁移完成

**验收**：无重大 bug，用户反馈正面

---

## 关键决策记录

| 决策点 | 选择 | 理由 |
|--------|------|------|
| Agent 模式 | ReAct | 医疗问诊是"问→收集→思考→再问"的循环，ReAct 自然匹配 |
| 对话历史 | 数据库持久化 | 可靠、可追溯、支持多设备 |
| 循环控制 | 智能判断结束 + 安全上限 | 灵活处理不同复杂度的问诊 |
| 意图识别 | 保留但升级为多意图 | 提供上下文信息，不强制控制流程 |
| 澄清时机 | ReAct 循环中 | Agent 自主决定何时追问，更自然 |
| 思考过程展示 | 可选展示 | 平衡专业性和透明度 |
| 风险评估 | 工具 + Agent 判断 | 灵活且减少误判 |
| 信息优先级 | 知识库 > 网络 > 模型 | 在 Prompt 中强调，不做硬编码检查 |

---

## 预期效果

### 用户体验提升

1. **更自然的对话** - 支持多轮追问，理解上下文
2. **更准确的建议** - 优先使用专业知识库
3. **更透明的过程** - 可选查看 AI 思考过程
4. **更及时的风险提示** - 自动评估症状风险

### 技术指标

| 指标 | 目标 |
|------|------|
| 对话完整率 | > 95% |
| 平均迭代次数 | 3-5 轮 |
| 响应时间 (P95) | < 15s |
| 知识库使用率 | > 80% |
| 缓存命中率 | > 30% |
| 测试覆盖率 | > 80% |

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| LLM 输出格式不稳定 | 解析失败 | 提示 Agent 正确格式，允许重试 |
| 达到最大迭代次数 | 用户体验差 | 生成兜底回复，不显示"失败" |
| 工具调用失败 | 无法获取信息 | 将错误作为 Observation，Agent 可选择其他方案 |
| 数据库写入延迟 | 历史加载不完整 | 实时写入，不批量 |
| 前端事件过载 | 渲染卡顿 | 事件节流，按句子分块 |

---

## 后续迭代方向

1. **多模态增强** - 支持语音输入/输出
2. **个性化记忆** - 记录用户健康档案
3. **主动健康管理** - 定期提醒、健康计划
4. **医生协作** - 人工医生接入流程优化
5. **知识图谱** - 症状-疾病-药品关系图谱

---

**设计文档版本**: v1.0
**最后更新**: 2026-01-27
