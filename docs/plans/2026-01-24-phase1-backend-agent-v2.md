# Phase 1: Backend Agent 侧搭建 - Implementation Plan (Revised)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 搭建基于 LangGraph.js 的 AI Agent 后端服务，实现意图分类路由，根据用户意图分发到不同处理分支，最后综合生成回复。

**Architecture:** 使用 LangGraph.js 构建条件路由工作流。流程为：意图分类 → 条件路由 → 4个处理分支（患处分析、问诊、医生推荐、药品识别）→ 综合回答。MVP阶段所有分支均使用智谱AI大模型调用，后续迭代时再集成专业工具（知识库、搜索、OCR等）。后端通过 Express 提供 SSE 流式接口供前端调用。

**Tech Stack:** Node.js 20+, TypeScript, Express, LangGraph.js, Zhipu AI (glm-4.7)

**架构图:**
```
用户输入
  ↓
意图分类 (classifyIntent)
  ↓
条件路由 (routeByIntent)
  ↓
├─ 患处分析 (symptomAnalysis) [智谱AI]
├─ 问诊咨询 (consultation) [智谱AI]
├─ 医生推荐 (hospitalRecommend) [智谱AI]
└─ 药品识别 (medicineInfo) [智谱AI]
  ↓
综合回答 (synthesizeResponse) [智谱AI]
  ↓
END
```

---

## Task 1: 项目初始化

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.env.example`
- Create: `backend/src/index.ts`
- Create: `backend/.gitignore`

**Step 1: 创建后端目录和初始化项目**

```bash
mkdir -p backend/src
cd backend
pnpm init
```

Expected: 生成 `package.json` 文件

**Step 2: 安装依赖**

```bash
pnpm install express cors dotenv
pnpm install @langchain/core @langchain/openai @langchain/langgraph
pnpm install -D typescript @types/node @types/express @types/cors tsx
```

Expected: 依赖安装成功

**Step 3: 配置 TypeScript**

创建 `backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**Step 4: 创建环境变量模板**

创建 `backend/.env.example`:

```env
# Server
PORT=3000
NODE_ENV=development

# Zhipu AI
ZHIPU_API_KEY=your_zhipu_api_key_here
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4
```

**Step 5: 创建入口文件**

创建 `backend/src/index.ts`:

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

**Step 6: 配置 .gitignore**

创建 `backend/.gitignore`:

```
node_modules/
dist/
.env
*.log
.DS_Store
```

**Step 7: 添加启动脚本**

修改 `backend/package.json`，添加 scripts:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

**Step 8: 测试运行**

```bash
pnpm dev
```

Expected: 控制台输出 "🚀 Server running on port 3000"

访问 http://localhost:3000/health 应返回 JSON

**Step 9: Commit**

```bash
git add backend/
git commit -m "feat(backend): initialize Node.js project with Express and TypeScript"
```

---

## Task 2: Agent 基础类型和状态定义

**Files:**
- Create: `backend/src/agent/types.ts`
- Create: `backend/src/agent/state.ts`

**Step 1: 定义 Agent 类型**

创建 `backend/src/agent/types.ts`:

```typescript
export type UserIntent = 
  | 'symptom_consult'      // 症状咨询 → 患处分析分支
  | 'general_qa'           // 通用问答 → 问诊分支
  | 'hospital_recommend'   // 医院推荐 → 医生推荐分支
  | 'medicine_info';       // 药品咨询 → 药品识别分支

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
```

**Step 2: 定义 Agent 状态**

创建 `backend/src/agent/state.ts`:

```typescript
import { Annotation } from "@langchain/langgraph";
import { Message, UserIntent } from "./types";

export const AgentState = Annotation.Root({
  // 消息历史
  messages: Annotation<Message[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  
  // 用户意图
  userIntent: Annotation<UserIntent | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
  
  // 意图分类提取的信息
  extractedInfo: Annotation<any>({
    reducer: (_, update) => update,
    default: () => ({}),
  }),
  
  // 各分支的处理结果
  branchResult: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
  
  // 会话ID
  conversationId: Annotation<string>({
    reducer: (_, update) => update,
    default: () => '',
  }),
});
```

**Step 3: Commit**

```bash
git add backend/src/agent/
git commit -m "feat(agent): define Agent types and state for conditional routing"
```

---

## Task 3: 意图分类节点

**Files:**
- Create: `backend/src/agent/nodes/classifyIntent.ts`
- Create: `backend/src/utils/llm.ts`

**Step 1: 创建 LLM 工具函数**

创建 `backend/src/utils/llm.ts`:

```typescript
import { ChatOpenAI } from "@langchain/openai";

export function createZhipuLLM(temperature: number = 0.7) {
  return new ChatOpenAI({
    model: "glm-4-flash",
    apiKey: process.env.ZHIPU_API_KEY,
    temperature,
    configuration: {
      baseURL: process.env.ZHIPU_BASE_URL || "https://open.bigmodel.cn/api/paas/v4",
    },
  });
}
```

**Step 2: 实现意图分类节点**

创建 `backend/src/agent/nodes/classifyIntent.ts`:

```typescript
import { AgentState } from "../state";
import { UserIntent } from "../types";
import { createZhipuLLM } from "../../utils/llm";

const llm = createZhipuLLM(0);

const INTENT_PROMPT = `你是一个医疗健康助手的意图识别模块。分析用户输入，判断用户的意图类型。

意图类型：
- symptom_consult: 用户描述症状，寻求健康建议（如"我头疼怎么办"）
- general_qa: 通用医疗健康知识问答（如"什么是高血压"）
- hospital_recommend: 用户询问医院推荐（如"北京哪家医院心内科好"）
- medicine_info: 用户咨询药品信息（如"布洛芬怎么吃"）

用户输入: {input}

请返回 JSON 格式（仅返回JSON，不要其他内容）:
{
  "intent": "意图类型",
  "entities": {
    "symptoms": ["症状1", "症状2"],  // 如果是症状咨询
    "location": "地点",              // 如果是医院推荐
    "medicineName": "药品名"         // 如果是药品咨询
  }
}`;

export async function classifyIntent(state: typeof AgentState.State) {
  const lastMessage = state.messages[state.messages.length - 1];
  const userInput = lastMessage.content;

  const prompt = INTENT_PROMPT.replace('{input}', userInput);
  
  const response = await llm.invoke([
    { role: "system", content: prompt },
  ]);

  let result: { intent: UserIntent; entities: any };
  
  try {
    const content = (response.content as string).trim();
    // 提取JSON（可能包含```json```标记）
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      result = JSON.parse(jsonMatch[0]);
    } else {
      result = JSON.parse(content);
    }
  } catch (error) {
    console.error('Intent parse error:', error);
    // 解析失败，默认为通用问答
    result = { intent: 'general_qa', entities: {} };
  }

  console.log('✅ Intent classified:', result.intent);

  return {
    userIntent: result.intent,
    extractedInfo: result.entities,
  };
}
```

**Step 3: Commit**

```bash
git add backend/src/agent/nodes/ backend/src/utils/
git commit -m "feat(agent): implement intent classification node with Zhipu AI"
```

---

## Task 4: 条件路由函数

**Files:**
- Create: `backend/src/agent/router.ts`

**Step 1: 实现条件路由逻辑**

创建 `backend/src/agent/router.ts`:

```typescript
import { AgentState } from "./state";

/**
 * 根据用户意图路由到不同的处理分支
 */
export function routeByIntent(state: typeof AgentState.State): string {
  const { userIntent } = state;
  
  switch (userIntent) {
    case 'symptom_consult':
      return 'symptomAnalysis';
    case 'general_qa':
      return 'consultation';
    case 'hospital_recommend':
      return 'hospitalRecommend';
    case 'medicine_info':
      return 'medicineInfo';
    default:
      // 默认走通用问诊分支
      return 'consultation';
  }
}
```

**Step 2: Commit**

```bash
git add backend/src/agent/router.ts
git commit -m "feat(agent): implement conditional routing logic"
```

---

## Task 5: 实现 4 个处理分支节点

**Files:**
- Create: `backend/src/agent/nodes/symptomAnalysis.ts`
- Create: `backend/src/agent/nodes/consultation.ts`
- Create: `backend/src/agent/nodes/hospitalRecommend.ts`
- Create: `backend/src/agent/nodes/medicineInfo.ts`

**Step 1: 患处分析分支**

创建 `backend/src/agent/nodes/symptomAnalysis.ts`:

```typescript
import { AgentState } from "../state";
import { createZhipuLLM } from "../../utils/llm";

const llm = createZhipuLLM(0.7);

const SYMPTOM_PROMPT = `你是一位专业的医疗健康顾问。用户描述了一些症状，请进行专业分析。

用户症状: {query}

请提供：
1. 可能的原因分析
2. 初步建议
3. 是否需要就医的判断

注意：
- 提供专业建议，但要通俗易懂
- 强调这只是参考，严重情况需就医
- 语气温和、关切`;

export async function symptomAnalysis(state: typeof AgentState.State) {
  const lastMessage = state.messages[state.messages.length - 1];
  const userQuery = lastMessage.content;

  const prompt = SYMPTOM_PROMPT.replace('{query}', userQuery);
  
  const response = await llm.invoke([
    { role: "system", content: prompt },
  ]);

  const analysis = response.content as string;
  console.log('🩺 Symptom analysis completed');

  return {
    branchResult: analysis,
  };
}
```

**Step 2: 问诊咨询分支**

创建 `backend/src/agent/nodes/consultation.ts`:

```typescript
import { AgentState } from "../state";
import { createZhipuLLM } from "../../utils/llm";

const llm = createZhipuLLM(0.7);

const CONSULTATION_PROMPT = `你是一位专业的医疗健康顾问助手。请回答用户的医疗健康问题。

用户问题: {query}

要求：
- 提供专业、准确的医学知识
- 语言通俗易懂
- 必要时提醒用户就医
- 涉及用药时强调遵医嘱`;

export async function consultation(state: typeof AgentState.State) {
  const lastMessage = state.messages[state.messages.length - 1];
  const userQuery = lastMessage.content;

  const prompt = CONSULTATION_PROMPT.replace('{query}', userQuery);
  
  const response = await llm.invoke([
    { role: "system", content: prompt },
  ]);

  const answer = response.content as string;
  console.log('💬 Consultation completed');

  return {
    branchResult: answer,
  };
}
```

**Step 3: 医生推荐分支**

创建 `backend/src/agent/nodes/hospitalRecommend.ts`:

```typescript
import { AgentState } from "../state";
import { createZhipuLLM } from "../../utils/llm";

const llm = createZhipuLLM(0.7);

const HOSPITAL_PROMPT = `你是一位医疗咨询顾问。用户想要咨询医院推荐。

用户需求: {query}

请提供：
1. 根据用户需求推荐合适的医院科室
2. 就医建议

注意：
- MVP阶段只提供通用建议和科室推荐
- 告知用户可通过平台预约功能查看具体医院
- 语气专业、友好`;

export async function hospitalRecommend(state: typeof AgentState.State) {
  const lastMessage = state.messages[state.messages.length - 1];
  const userQuery = lastMessage.content;

  const prompt = HOSPITAL_PROMPT.replace('{query}', userQuery);
  
  const response = await llm.invoke([
    { role: "system", content: prompt },
  ]);

  const recommendation = response.content as string;
  console.log('🏥 Hospital recommendation completed');

  return {
    branchResult: recommendation,
  };
}
```

**Step 4: 药品识别分支**

创建 `backend/src/agent/nodes/medicineInfo.ts`:

```typescript
import { AgentState } from "../state";
import { createZhipuLLM } from "../../utils/llm";

const llm = createZhipuLLM(0.7);

const MEDICINE_PROMPT = `你是一位药品咨询顾问。用户询问药品相关问题。

用户问题: {query}

请提供：
1. 药品的基本信息
2. 用法用量建议
3. 注意事项

注意：
- 提供准确的药品信息
- 强调遵医嘱，不可自行用药
- 严重情况需咨询医生
- 语气专业、关切`;

export async function medicineInfo(state: typeof AgentState.State) {
  const lastMessage = state.messages[state.messages.length - 1];
  const userQuery = lastMessage.content;

  const prompt = MEDICINE_PROMPT.replace('{query}', userQuery);
  
  const response = await llm.invoke([
    { role: "system", content: prompt },
  ]);

  const info = response.content as string;
  console.log('💊 Medicine info completed');

  return {
    branchResult: info,
  };
}
```

**Step 5: Commit**

```bash
git add backend/src/agent/nodes/
git commit -m "feat(agent): implement 4 processing branches with Zhipu AI"
```

---

## Task 6: 综合回答节点

**Files:**
- Create: `backend/src/agent/nodes/synthesizeResponse.ts`

**Step 1: 实现综合回答节点**

创建 `backend/src/agent/nodes/synthesizeResponse.ts`:

```typescript
import { AgentState } from "../state";

/**
 * 综合各分支结果，生成最终回复
 * MVP阶段直接返回分支结果，后续可优化为多分支结果整合
 */
export async function synthesizeResponse(state: typeof AgentState.State) {
  const { branchResult, userIntent } = state;

  // MVP阶段直接使用分支结果
  const finalResponse = {
    role: 'assistant' as const,
    content: branchResult || '抱歉，我暂时无法回答这个问题。',
  };

  console.log(`✅ Final response synthesized for intent: ${userIntent}`);

  return {
    messages: [finalResponse],
  };
}
```

**Step 2: Commit**

```bash
git add backend/src/agent/nodes/synthesizeResponse.ts
git commit -m "feat(agent): implement response synthesis node"
```

---

## Task 7: 构建 LangGraph 工作流

**Files:**
- Create: `backend/src/agent/graph.ts`
- Create: `backend/src/agent/index.ts`

**Step 1: 构建工作流图**

创建 `backend/src/agent/graph.ts`:

```typescript
import { StateGraph, END } from "@langchain/langgraph";
import { AgentState } from "./state";
import { classifyIntent } from "./nodes/classifyIntent";
import { symptomAnalysis } from "./nodes/symptomAnalysis";
import { consultation } from "./nodes/consultation";
import { hospitalRecommend } from "./nodes/hospitalRecommend";
import { medicineInfo } from "./nodes/medicineInfo";
import { synthesizeResponse } from "./nodes/synthesizeResponse";
import { routeByIntent } from "./router";

export function createAgentGraph() {
  const workflow = new StateGraph(AgentState)
    // 添加节点
    .addNode("classifyIntent", classifyIntent)
    .addNode("symptomAnalysis", symptomAnalysis)
    .addNode("consultation", consultation)
    .addNode("hospitalRecommend", hospitalRecommend)
    .addNode("medicineInfo", medicineInfo)
    .addNode("synthesizeResponse", synthesizeResponse)
    
    // 入口：意图分类
    .addEdge("__start__", "classifyIntent")
    
    // 条件路由：根据意图分发到不同分支
    .addConditionalEdges(
      "classifyIntent",
      routeByIntent,
      {
        symptomAnalysis: "symptomAnalysis",
        consultation: "consultation",
        hospitalRecommend: "hospitalRecommend",
        medicineInfo: "medicineInfo",
      }
    )
    
    // 各分支都汇聚到综合回答
    .addEdge("symptomAnalysis", "synthesizeResponse")
    .addEdge("consultation", "synthesizeResponse")
    .addEdge("hospitalRecommend", "synthesizeResponse")
    .addEdge("medicineInfo", "synthesizeResponse")
    
    // 综合回答后结束
    .addEdge("synthesizeResponse", END);

  return workflow.compile();
}
```

**Step 2: 导出 Agent API**

创建 `backend/src/agent/index.ts`:

```typescript
import { createAgentGraph } from "./graph";
import { Message } from "./types";

const graph = createAgentGraph();

export async function runAgent(params: {
  messages: Message[];
  conversationId: string;
}) {
  const { messages, conversationId } = params;

  console.log(`\n🤖 Agent started for conversation: ${conversationId}`);
  
  const result = await graph.invoke({
    messages,
    conversationId,
  });

  console.log(`✅ Agent completed\n`);

  return result;
}

export { AgentState } from "./state";
export * from "./types";
```

**Step 3: Commit**

```bash
git add backend/src/agent/
git commit -m "feat(agent): build LangGraph conditional routing workflow"
```

---

## Task 8: SSE 流式接口

**Files:**
- Create: `backend/src/routes/aiChat.ts`
- Modify: `backend/src/index.ts`

**Step 1: 创建 AI 聊天路由**

创建 `backend/src/routes/aiChat.ts`:

```typescript
import express from 'express';
import { runAgent } from '../agent';

const router = express.Router();

router.get('/stream', async (req, res) => {
  const { message, conversationId = 'default' } = req.query;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  // 设置 SSE 头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // 发送思考状态
    res.write(`data: ${JSON.stringify({ 
      type: 'thinking', 
      data: '正在分析您的问题...' 
    })}\n\n`);

    // 调用 Agent
    const result = await runAgent({
      messages: [{ role: 'user', content: message as string }],
      conversationId: conversationId as string,
    });

    // 发送意图识别结果
    res.write(`data: ${JSON.stringify({ 
      type: 'intent', 
      data: { intent: result.userIntent } 
    })}\n\n`);

    // 发送最终响应
    const finalMessage = result.messages[result.messages.length - 1];
    res.write(`data: ${JSON.stringify({ 
      type: 'content', 
      data: { content: finalMessage.content } 
    })}\n\n`);

    // 完成
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

  } catch (error: any) {
    console.error('Agent error:', error);
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      data: error.message 
    })}\n\n`);
    res.end();
  }
});

export default router;
```

**Step 2: 注册路由**

修改 `backend/src/index.ts`:

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import aiChatRouter from './routes/aiChat';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// AI Chat routes
app.use('/api/ai-chat', aiChatRouter);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```

**Step 3: Commit**

```bash
git add backend/src/routes/ backend/src/index.ts
git commit -m "feat(api): add SSE streaming endpoint for AI chat"
```

---

## Task 9: 本地测试验证

**Step 1: 确认 .env 配置**

确保 `backend/.env` 包含：

```env
PORT=3000
NODE_ENV=development
ZHIPU_API_KEY=你的智谱API密钥
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4
```

**Step 2: 启动服务**

```bash
cd backend
pnpm dev
```

Expected: 控制台输出 "🚀 Server running on port 3000" 且无错误

**Step 3: 测试健康检查**

```bash
curl http://localhost:3000/health
```

Expected: 返回 `{"status":"ok","timestamp":"..."}`

**Step 4: 测试意图分类和路由**

```bash
# 测试症状咨询
curl -N "http://localhost:3000/api/ai-chat/stream?message=我最近头疼发烧怎么办"

# 测试通用问答
curl -N "http://localhost:3000/api/ai-chat/stream?message=什么是高血压"

# 测试医院推荐
curl -N "http://localhost:3000/api/ai-chat/stream?message=北京哪家医院心内科好"

# 测试药品咨询
curl -N "http://localhost:3000/api/ai-chat/stream?message=布洛芬怎么吃"
```

**Step 5: 验证响应**

确认收到以下类型的事件：
- ✅ `{ type: 'thinking' }` - 思考状态
- ✅ `{ type: 'intent', data: { intent: '...' } }` - 意图识别结果
- ✅ `{ type: 'content', data: { content: '...' } }` - 最终回复
- ✅ `{ type: 'done' }` - 完成

**Step 6: 检查控制台日志**

确认看到以下日志：
- `🤖 Agent started for conversation: ...`
- `✅ Intent classified: ...`
- `🩺 Symptom analysis completed` (或其他分支)
- `✅ Final response synthesized for intent: ...`
- `✅ Agent completed`

**Step 7: Commit**

```bash
git add .
git commit -m "test: verify Agent conditional routing works correctly"
```

---

## Verification Plan

### 功能验证清单

- [x] 项目成功启动，无错误
- [x] 健康检查接口正常
- [x] 意图分类准确（4种意图）
- [x] 条件路由正确（路由到对应分支）
- [x] 症状分析分支返回合理回复
- [x] 问诊咨询分支返回合理回复
- [x] 医院推荐分支返回合理回复
- [x] 药品识别分支返回合理回复
- [x] SSE 流式响应正常

### 手动测试用例

| 测试用例 | 期望意图 | 期望分支 |
|---------|----------|----------|
| "我头疼发烧" | symptom_consult | symptomAnalysis |
| "什么是糖尿病" | general_qa | consultation |
| "上海哪家医院皮肤科好" | hospital_recommend | hospitalRecommend |
| "阿莫西林的用法" | medicine_info | medicineInfo |

---

## 注意事项

1. **API Key**: 确保 `.env` 中配置了 `ZHIPU_API_KEY`
2. **模型选择**: 使用 `glm-4-flash` 作为快速响应模型
3. **错误处理**: MVP 阶段错误处理较简单，后续优化
4. **流式优化**: 当前是等待 Agent 完成后再流式发送，后续可优化为真正的流式生成
5. **工具集成**: 当前所有分支都用 LLM，后续迭代时再集成专业工具

---

## 下一阶段

完成后端 Agent 侧后，继续进行：
- **Phase 2**: 后端业务侧（数据库、认证、WebSocket、业务 API）
- **Phase 3**: 前端侧（React H5）
