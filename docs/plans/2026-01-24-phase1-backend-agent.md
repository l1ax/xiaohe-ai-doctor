# Phase 1: Backend Agent 侧搭建 - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 搭建基于 LangGraph.js 的 AI Agent 后端服务，实现意图分类路由，根据用户意图分发到不同处理分支，最后综合生成回复。

**Architecture:** 使用 LangGraph.js 构建条件路由工作流。流程为：意图分类 → 条件路由 → 4个处理分支（患处分析、问诊、医生推荐、药品识别）→ 综合回答。MVP阶段所有分支均使用智谱AI大模型调用，后续迭代时再集成专业工具（知识库、搜索、OCR等）。后端通过 Express 提供 SSE 流式接口供前端调用。

**Tech Stack:** Node.js 20+, TypeScript, Express, LangGraph.js, Zhipu AI (glm-4.7)

---

## Task 1: 项目初始化

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.env.example`
- Create: `backend/src/index.ts`
- Create: `backend/.gitignore`

**Step 1: 创建后端目录和初始化 npm 项目**

```bash
mkdir backend
cd backend
npm init -y
```

Expected: 生成 `package.json` 文件

**Step 2: 安装依赖**

```bash
npm install express cors dotenv
npm install @langchain/core @langchain/openai @langchain/langgraph-sdk
npm install -D typescript @types/node @types/express @types/cors ts-node-dev
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

# LLM
OPENAI_API_KEY=your_openai_api_key_here
# or
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# LangGraph (如果使用 Cloud)
LANGGRAPH_API_URL=http://localhost:8123
LANGGRAPH_ASSISTANT_ID=your_assistant_id

# Coze
COZE_API_KEY=your_coze_api_key_here
COZE_BOT_ID=your_coze_bot_id_here
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
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**Step 6: 配置 .gitignore**

创建 `backend/.gitignore`:

```
node_modules/
dist/
.env
*.log
```

**Step 7: 添加启动脚本**

修改 `backend/package.json`，添加 scripts:

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

**Step 8: 测试运行**

```bash
npm run dev
```

Expected: 控制台输出 "Server running on port 3000"

访问 http://localhost:3000/health 应返回 `{"status":"ok"}`

**Step 9: Commit**

```bash
git add backend/
git commit -m "feat(backend): initialize Node.js project with Express and TypeScript"
```

---

## Task 2: LangGraph Agent 基础架构

**Files:**
- Create: `backend/src/agent/types.ts`
- Create: `backend/src/agent/state.ts`
- Create: `backend/src/agent/graph.ts`
- Create: `backend/src/agent/index.ts`

**Step 1: 定义 Agent 类型**

创建 `backend/src/agent/types.ts`:

```typescript
export type UserIntent = 
  | 'symptom_consult'      // 症状咨询
  | 'hospital_recommend'   // 医院推荐
  | 'medicine_info'        // 药品咨询
  | 'medicine_ocr'         // 药品识别
  | 'general_qa';          // 通用问答

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface ToolCall {
  tool: string;
  input: any;
  output: any;
}

export interface AgentStep {
  thought: string;
  action: string;
  observation: string;
}
```

**Step 2: 定义 Agent 状态**

创建 `backend/src/agent/state.ts`:

```typescript
import { Annotation } from "@langchain/langgraph";
import { Message, UserIntent } from "./types";

export const AgentState = Annotation.Root({
  messages: Annotation<Message[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),
  userIntent: Annotation<UserIntent | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
  extractedInfo: Annotation<any>({
    reducer: (_, update) => update,
    default: () => ({}),
  }),
  // 各分支的处理结果
  branchResult: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),
  conversationId: Annotation<string>({
    reducer: (_, update) => update,
    default: () => '',
  }),
});
```

**Step 3: Commit**

```bash
git add backend/src/agent/
git commit -m "feat(agent): define Agent state and types"
```

---

## Task 3: 意图识别节点

**Files:**
- Create: `backend/src/agent/nodes/classifyIntent.ts`

**Step 1: 实现意图识别节点**

创建 `backend/src/agent/nodes/classifyIntent.ts`:

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { AgentState } from "../state";
import { UserIntent } from "../types";

const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0,
});

const INTENT_PROMPT = `你是一个医疗健康助手的意图识别模块。分析用户输入，判断用户的意图类型。

意图类型：
- symptom_consult: 用户描述症状，寻求健康建议
- hospital_recommend: 用户询问医院推荐
- medicine_info: 用户咨询药品用法、用量
- medicine_ocr: 用户上传药品图片需要识别
- general_qa: 通用医疗健康知识问答

用户输入: {input}

请返回 JSON 格式:
{
  "intent": "意图类型",
  "entities": {
    "symptoms": ["症状1", "症状2"],  // 如果是症状咨询
    "location": "地点",              // 如果是医院推荐
    "medicineName": "药品名",        // 如果是药品咨询
    ...
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
    result = JSON.parse(response.content as string);
  } catch {
    // 解析失败，默认为通用问答
    result = { intent: 'general_qa', entities: {} };
  }

  return {
    userIntent: result.intent,
    extractedInfo: result.entities,
  };
}
```

**Step 2: Commit**

```bash
git add backend/src/agent/nodes/classifyIntent.ts
git commit -m "feat(agent): implement intent classification node"
```

---

## Task 4: Coze 知识库工具

**Files:**
- Create: `backend/src/agent/tools/cozeKnowledge.ts`
- Create: `backend/src/services/coze.ts`

**Step 1: 创建 Coze 服务封装**

创建 `backend/src/services/coze.ts`:

```typescript
import axios from 'axios';

const COZE_API_BASE = 'https://api.coze.com/v1';

export interface CozeWorkflowParams {
  workflow_id: string;
  parameters: Record<string, any>;
}

export class CozeService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async runWorkflow(params: CozeWorkflowParams): Promise<any> {
    try {
      const response = await axios.post(
        `${COZE_API_BASE}/workflows/run`,
        params,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('Coze API error:', error.response?.data || error.message);
      throw new Error('Failed to call Coze workflow');
    }
  }
}
```

**Step 2: 创建 Coze 知识库工具**

创建 `backend/src/agent/tools/cozeKnowledge.ts`:

```typescript
import { Tool } from "@langchain/core/tools";
import { CozeService } from "../../services/coze";

const cozeService = new CozeService(process.env.COZE_API_KEY || '');

export class CozeKnowledgeTool extends Tool {
  name = "medical_knowledge";
  description = "查询专业医学知识库，获取权威的医学信息";

  async _call(query: string): Promise<string> {
    try {
      const result = await cozeService.runWorkflow({
        workflow_id: process.env.COZE_WORKFLOW_ID || '',
        parameters: { query },
      });
      
      return JSON.stringify(result.data || result);
    } catch (error) {
      return '知识库查询失败，请稍后重试';
    }
  }
}
```

**Step 3: Commit**

```bash
git add backend/src/services/coze.ts backend/src/agent/tools/cozeKnowledge.ts
git commit -m "feat(agent): add Coze knowledge base tool"
```

---

## Task 5: 网络搜索工具

**Files:**
- Create: `backend/src/agent/tools/webSearch.ts`

**Step 1: 安装搜索工具依赖**

```bash
npm install @langchain/community
```

**Step 2: 创建网络搜索工具**

创建 `backend/src/agent/tools/webSearch.ts`:

```typescript
import { Tool } from "@langchain/core/tools";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";

// 使用 Tavily 搜索工具（需要 TAVILY_API_KEY）
// 或者可以使用其他搜索 API

export class WebSearchTool extends Tool {
  name = "web_search";
  description = "搜索最新的医疗健康资讯和信息";

  private tavilyTool: TavilySearchResults;

  constructor() {
    super();
    this.tavilyTool = new TavilySearchResults({
      maxResults: 3,
    });
  }

  async _call(query: string): Promise<string> {
    try {
      const results = await this.tavilyTool.invoke(query);
      return results;
    } catch (error) {
      console.error('Search error:', error);
      return '搜索功能暂时不可用';
    }
  }
}
```

**Step 3: 更新环境变量模板**

修改 `backend/.env.example`，添加:

```env
# Tavily Search
TAVILY_API_KEY=your_tavily_api_key_here
```

**Step 4: Commit**

```bash
git add backend/src/agent/tools/webSearch.ts backend/.env.example
git commit -m "feat(agent): add web search tool"
```

---

## Task 6: 医院查询和 OCR 工具（Mock）

**Files:**
- Create: `backend/src/agent/tools/hospitalQuery.ts`
- Create: `backend/src/agent/tools/medicineOcr.ts`

**Step 1: 创建医院查询工具（Mock）**

创建 `backend/src/agent/tools/hospitalQuery.ts`:

```typescript
import { Tool } from "@langchain/core/tools";

export class HospitalQueryTool extends Tool {
  name = "hospital_query";
  description = "查询医院信息，支持按城市和科室筛选";

  async _call(input: string): Promise<string> {
    // MVP 阶段返回 Mock 数据
    const mockHospitals = [
      { name: '北京协和医院', department: '心内科', level: '三甲' },
      { name: '北京大学第一医院', department: '消化内科', level: '三甲' },
      { name: '上海瑞金医院', department: '神经内科', level: '三甲' },
    ];

    return JSON.stringify(mockHospitals);
  }
}
```

**Step 2: 创建 OCR 工具（Mock）**

创建 `backend/src/agent/tools/medicineOcr.ts`:

```typescript
import { Tool } from "@langchain/core/tools";

export class MedicineOcrTool extends Tool {
  name = "medicine_ocr";
  description = "识别药品包装或说明书图片，提取药品信息";

  async _call(imageUrl: string): Promise<string> {
    // MVP 阶段返回模拟结果
    // 实际应该调用 OCR API（百度、腾讯云等）
    return JSON.stringify({
      medicineName: '布洛芬缓释胶囊',
      specification: '0.3g×20粒',
      manufacturer: '某某制药有限公司',
      usage: '口服，一次1粒，一日2次',
    });
  }
}
```

**Step 3: Commit**

```bash
git add backend/src/agent/tools/
git commit -m "feat(agent): add hospital query and OCR tools (mock)"
```

---

## Task 7: 工具调度节点

**Files:**
- Create: `backend/src/agent/nodes/dispatchTools.ts`

**Step 1: 实现工具调度节点**

创建 `backend/src/agent/nodes/dispatchTools.ts`:

```typescript
import { AgentState } from "../state";
import { CozeKnowledgeTool } from "../tools/cozeKnowledge";
import { WebSearchTool } from "../tools/webSearch";
import { HospitalQueryTool } from "../tools/hospitalQuery";
import { MedicineOcrTool } from "../tools/medicineOcr";

const tools = {
  coze: new CozeKnowledgeTool(),
  search: new WebSearchTool(),
  hospital: new HospitalQueryTool(),
  ocr: new MedicineOcrTool(),
};

export async function dispatchTools(state: typeof AgentState.State) {
  const { userIntent, extractedInfo } = state;
  const toolResults: any[] = [];
  let cozeKnowledge = null;
  let searchResults: any[] = [];

  const lastMessage = state.messages[state.messages.length - 1];
  const query = lastMessage.content;

  switch (userIntent) {
    case 'symptom_consult':
      // 症状咨询：调用 Coze 知识库 + 搜索
      cozeKnowledge = await tools.coze.invoke(query);
      const searchResult = await tools.search.invoke(`医疗 ${query}`);
      searchResults = JSON.parse(searchResult);
      toolResults.push(
        { tool: 'coze_knowledge', input: query, output: cozeKnowledge },
        { tool: 'web_search', input: query, output: searchResults }
      );
      break;

    case 'hospital_recommend':
      // 医院推荐：调用医院查询工具
      const hospitals = await tools.hospital.invoke(query);
      toolResults.push({ tool: 'hospital_query', input: query, output: hospitals });
      break;

    case 'medicine_info':
      // 药品咨询：调用 Coze + 搜索
      cozeKnowledge = await tools.coze.invoke(query);
      const medSearch = await tools.search.invoke(`药品 ${query}`);
      searchResults = JSON.parse(medSearch);
      toolResults.push(
        { tool: 'coze_knowledge', input: query, output: cozeKnowledge },
        { tool: 'web_search', input: query, output: searchResults }
      );
      break;

    case 'medicine_ocr':
      // 药品识别：调用 OCR
      const imageUrl = extractedInfo.imageUrl || '';
      const ocrResult = await tools.ocr.invoke(imageUrl);
      toolResults.push({ tool: 'medicine_ocr', input: imageUrl, output: ocrResult });
      break;

    case 'general_qa':
      // 通用问答：调用 Coze
      cozeKnowledge = await tools.coze.invoke(query);
      toolResults.push({ tool: 'coze_knowledge', input: query, output: cozeKnowledge });
      break;
  }

  return {
    toolResults,
    cozeKnowledge,
    searchResults,
  };
}
```

**Step 2: Commit**

```bash
git add backend/src/agent/nodes/dispatchTools.ts
git commit -m "feat(agent): implement tool dispatch node"
```

---

## Task 8: 响应生成节点

**Files:**
- Create: `backend/src/agent/nodes/generateResponse.ts`

**Step 1: 实现响应生成节点**

创建 `backend/src/agent/nodes/generateResponse.ts`:

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { AgentState } from "../state";

const llm = new ChatOpenAI({
  modelName: "gpt-4o",
  temperature: 0.7,
  streaming: true,
});

const RESPONSE_PROMPT = `你是一位专业的医疗健康助手。根据用户问题和工具调用结果，生成友好、专业的回复。

用户问题: {query}
意图类型: {intent}
工具调用结果: {toolResults}

要求：
1. 回复要专业但易懂
2. 如果是症状咨询，提醒用户这只是参考建议，严重情况需就医
3. 如果涉及用药，强调遵医嘱
4. 语气温和、关切

请生成回复：`;

export async function generateResponse(state: typeof AgentState.State) {
  const { messages, userIntent, toolResults } = state;
  const lastMessage = messages[messages.length - 1];

  const prompt = RESPONSE_PROMPT
    .replace('{query}', lastMessage.content)
    .replace('{intent}', userIntent || 'unknown')
    .replace('{toolResults}', JSON.stringify(toolResults, null, 2));

  const response = await llm.invoke([
    { role: "system", content: prompt },
  ]);

  const assistantMessage = {
    role: 'assistant' as const,
    content: response.content as string,
  };

  return {
    messages: [assistantMessage],
  };
}
```

**Step 2: Commit**

```bash
git add backend/src/agent/nodes/generateResponse.ts
git commit -m "feat(agent): implement response generation node"
```

---

## Task 9: 构建 Agent Graph

**Files:**
- Create: `backend/src/agent/graph.ts`
- Modify: `backend/src/agent/index.ts`

**Step 1: 构建工作流图**

创建 `backend/src/agent/graph.ts`:

```typescript
import { StateGraph, END } from "@langchain/langgraph";
import { AgentState } from "./state";
import { classifyIntent } from "./nodes/classifyIntent";
import { dispatchTools } from "./nodes/dispatchTools";
import { generateResponse } from "./nodes/generateResponse";

export function createAgentGraph() {
  const workflow = new StateGraph(AgentState)
    .addNode("classifyIntent", classifyIntent)
    .addNode("dispatchTools", dispatchTools)
    .addNode("generateResponse", generateResponse)
    .addEdge("__start__", "classifyIntent")
    .addEdge("classifyIntent", "dispatchTools")
    .addEdge("dispatchTools", "generateResponse")
    .addEdge("generateResponse", END);

  return workflow.compile();
}
```

**Step 2: 导出 Agent**

修改 `backend/src/agent/index.ts`:

```typescript
import { createAgentGraph } from "./graph";
import { Message } from "./types";

const graph = createAgentGraph();

export async function runAgent(params: {
  messages: Message[];
  conversationId: string;
}) {
  const { messages, conversationId } = params;

  const result = await graph.invoke({
    messages,
    conversationId,
  });

  return result;
}

export { AgentState } from "./state";
export * from "./types";
```

**Step 3: Commit**

```bash
git add backend/src/agent/
git commit -m "feat(agent): build LangGraph workflow"
```

---

## Task 10: SSE 流式接口

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
    res.write(`data: ${JSON.stringify({ type: 'thinking', data: '正在分析您的问题...' })}\n\n`);

    // 调用 Agent
    const result = await runAgent({
      messages: [{ role: 'user', content: message as string }],
      conversationId: conversationId as string,
    });

    // 发送工具调用信息
    if (result.toolResults && result.toolResults.length > 0) {
      for (const toolCall of result.toolResults) {
        res.write(`data: ${JSON.stringify({ 
          type: 'tool_call', 
          data: { tool: toolCall.tool, status: 'completed' } 
        })}\n\n`);
      }
    }

    // 发送最终响应
    const finalMessage = result.messages[result.messages.length - 1];
    res.write(`data: ${JSON.stringify({ 
      type: 'content', 
      data: { content: finalMessage.content } 
    })}\n\n`);

    // 发送元数据
    res.write(`data: ${JSON.stringify({ 
      type: 'metadata', 
      data: {
        toolCalls: result.toolResults,
        sources: result.searchResults,
      } 
    })}\n\n`);

    // 完成
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

  } catch (error: any) {
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
  res.json({ status: 'ok' });
});

// AI Chat routes
app.use('/api/ai-chat', aiChatRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

**Step 3: Commit**

```bash
git add backend/src/routes/ backend/src/index.ts
git commit -m "feat(api): add SSE streaming endpoint for AI chat"
```

---

## Task 11: 本地测试

**Files:**
- Create: `backend/test-agent.http` (可选，用于测试)

**Step 1: 创建 .env 文件**

```bash
cp .env.example .env
```

然后填入真实的 API Keys

**Step 2: 启动服务**

```bash
npm run dev
```

Expected: 服务启动成功

**Step 3: 测试 SSE 接口**

使用 curl 测试:

```bash
curl -N "http://localhost:3000/api/ai-chat/stream?message=我头疼怎么办&conversationId=test123"
```

Expected: 收到 SSE 流式响应

**Step 4: 验证响应格式**

确认收到以下类型的事件：
- `{ type: 'thinking' }`
- `{ type: 'tool_call' }`
- `{ type: 'content' }`
- `{ type: 'metadata' }`
- `{ type: 'done' }`

**Step 5: Commit**

```bash
git add .
git commit -m "test: verify Agent SSE streaming works"
```

---

## Verification Plan

### 自动化测试

暂时不实施单元测试（MVP 阶段），聚焦功能验证。

### 手动验证

**验证步骤：**

1. **启动后端服务**
   ```bash
   cd backend
   npm run dev
   ```

2. **测试意图识别**
   ```bash
   # 症状咨询
   curl -N "http://localhost:3000/api/ai-chat/stream?message=我最近头疼发烧"
   
   # 医院推荐
   curl -N "http://localhost:3000/api/ai-chat/stream?message=北京哪家医院心内科好"
   
   # 药品咨询
   curl -N "http://localhost:3000/api/ai-chat/stream?message=布洛芬怎么吃"
   ```

3. **检查响应**
   - ✅ 收到 `thinking` 事件
   - ✅ 收到 `tool_call` 事件（工具名称正确）
   - ✅ 收到 `content` 事件（回复内容合理）
   - ✅ 收到 `metadata` 事件（包含工具调用结果）
   - ✅ 收到 `done` 事件

4. **验证工具调用**
   - Coze 知识库工具被正确调用
   - 网络搜索工具返回结果（如果配置了 Tavily）
   - Mock 工具返回预期数据

---

## 注意事项

1. **API Keys**: 确保在 `.env` 中配置了所有必需的 API Keys
2. **Coze 配置**: 需要先在 Coze 平台创建 Workflow 并获取 ID
3. **LLM 选择**: 可以使用 OpenAI 或 Anthropic，根据 API Key 配置
4. **错误处理**: MVP 阶段错误处理较简单，后续优化
5. **流式优化**: 当前是等待 Agent 完成后再流式发送，后续可优化为真正的流式生成

---

## 下一阶段

完成后端 Agent 侧后，继续进行：
- **Phase 2**: 后端业务侧（数据库、认证、WebSocket、业务 API）
- **Phase 3**: 前端侧（Taro 小程序）
