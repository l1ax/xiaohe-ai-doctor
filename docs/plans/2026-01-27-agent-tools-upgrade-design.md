# Agent 工具升级设计文档

**日期**: 2026-01-27  
**版本**: 1.0  
**状态**: 设计完成，待实施

---

## 📋 概述

### 升级目标

为小禾AI医生的 Agent 系统增加以下能力：

1. **多模态图片识别** - 使用智谱 glm-4.6v 模型识别用户上传的医疗图片
2. **知识库查询** - 集成 Coze 医疗知识库工作流
3. **网络搜索** - 使用 Tavily 进行医疗信息搜索
4. **渐进降级** - 知识库 → 网络搜索 → 纯 LLM 的多层降级机制

### 核心原则

- ✅ **最小侵入性** - 保持现有 graph 结构不变
- ✅ **可选增强** - 工具调用失败时降级到原有 LLM 回答
- ✅ **统一抽象** - 通过工具编排器统一管理工具调用
- ✅ **渐进降级** - 确保总能返回有效结果

---

## 🏗️ 架构设计

### 整体目录结构

```
backend/src/
├── agent/
│   ├── nodes/                    # 现有节点改造
│   │   ├── classifyIntent.ts    # 增加图片 URL 传递
│   │   ├── symptomAnalysis.ts   # 增加工具调用逻辑
│   │   ├── medicineInfo.ts      # 增加工具调用逻辑
│   │   ├── consultation.ts      # 增加工具调用逻辑
│   │   └── hospitalRecommend.ts # 增加知识库和搜索（不需要图片识别）
│   └── ...
├── services/
│   ├── tools/                    # 新增工具服务层
│   │   ├── imageRecognition.ts  # 智谱 glm-4.6v 多模态识别
│   │   ├── knowledgeBase.ts     # Coze 知识库查询
│   │   ├── webSearch.ts         # Tavily 网络搜索
│   │   ├── toolOrchestrator.ts  # 工具编排器（核心）
│   │   ├── prompts.ts           # 工具相关 prompt
│   │   └── types.ts             # 工具类型定义
│   ├── storage/
│   │   └── supabaseStorage.ts   # 新增 Supabase 存储服务
│   └── ...
└── controllers/
    └── uploadController.ts       # 改造：支持图片上传到 Supabase
```

---

## 🔄 完整数据流

```
前端上传图片 
  ↓
uploadController → Supabase Storage 
  ↓
返回图片 URL
  ↓
前端发送消息 { content: "肚子疼", imageUrls: ["https://..."] }
  ↓
aiChatController → createAgentGraph
  ↓
classifyIntent (意图分类，传递图片 URL)
  ↓
routeByIntent (路由到对应节点)
  ↓
symptomAnalysis/medicineInfo/consultation (处理节点)
  ├─ orchestrateTools (工具编排器)
  │   ├─ recognizeImage (如有图片且意图需要)
  │   ├─ queryKnowledgeBase (优先)
  │   └─ searchWeb (降级)
  ├─ 构建增强 Prompt
  └─ LLM 生成回答（流式输出）
  ↓
synthesizeResponse (综合回答)
  ↓
返回给前端（SSE 流式）
```

---

## 📦 核心模块设计

### 1. Supabase 存储服务

**文件**: `services/storage/supabaseStorage.ts`

#### Bucket 配置
- Bucket 名称: `medical-images`
- 访问策略: 私有（需要认证）
- 文件路径: `{userId}/{conversationId}/{timestamp}_{filename}`

#### 接口设计

```typescript
interface UploadResult {
  url: string;          // 认证访问 URL
  publicUrl: string;    // 公开访问 URL（用于多模态 API）
  path: string;         // 存储路径
}

async function uploadImage(
  file: Buffer, 
  filename: string, 
  userId: string,
  conversationId: string
): Promise<UploadResult>

async function deleteImage(path: string): Promise<void>

async function getPublicUrl(path: string): Promise<string>
```

#### 环境变量

```bash
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

### 2. 多模态图片识别服务

**文件**: `services/tools/imageRecognition.ts`

#### 智谱 glm-4.6v 集成

```typescript
interface ImageRecognitionConfig {
  intent: UserIntent;              // 用户意图
  customPrompt?: string;           // 自定义 prompt
}

interface ImageRecognitionResult {
  description: string;             // 图片描述
  confidence?: number;             // 识别置信度
}

async function recognizeImage(
  imageUrls: string[], 
  config: ImageRecognitionConfig
): Promise<string>
```

#### 不同意图的识别 Prompt

```typescript
const RECOGNITION_PROMPTS = {
  symptom_consult: `请详细描述图片中的症状表现，包括：
    - 症状的具体特征（颜色、形状、大小）
    - 症状的位置和范围
    - 可观察到的严重程度
    请用专业但易懂的语言描述。`,
  
  medicine_info: `请识别图片中的药品信息，包括：
    - 药品名称（通用名和商品名）
    - 规格和剂量
    - 生产厂家
    - 有效期（如可见）
    如果是药品说明书，请提取关键信息。`,
  
  general_qa: `请描述图片的医疗相关内容，包括：
    - 图片的主要内容
    - 医疗相关的关键信息
    - 任何需要注意的细节`
};
```

#### API 调用

```typescript
// 使用智谱 OpenAI 兼容接口
const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.ZHIPU_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'glm-4.6v',
    messages: [{
      role: 'user',
      content: [
        ...imageUrls.map(url => ({
          type: 'image_url',
          image_url: { url }
        })),
        {
          type: 'text',
          text: RECOGNITION_PROMPTS[intent]
        }
      ]
    }]
  })
});
```

---

### 3. 知识库查询服务

**文件**: `services/tools/knowledgeBase.ts`

#### Coze 工作流集成

```typescript
interface KnowledgeQueryResult {
  hasResults: boolean;           // 是否有结果
  documents: Array<{
    documentId: string;
    output: string;              // 知识库内容
  }>;
  source: 'knowledge_base';
}

async function queryKnowledgeBase(query: string): Promise<KnowledgeQueryResult> {
  const apiClient = new CozeAPI({
    token: process.env.COZE_API_KEY,
    baseURL: process.env.COZE_BASE_URL
  });

  const res = await apiClient.workflows.runs.create({
    workflow_id: process.env.COZE_WORKFLOW_ID,
    parameters: { query }
  });

  const data = JSON.parse(res.data);
  const output = data.output || [];
  
  return {
    hasResults: output.length > 0,  // 空数组 = 无返回
    documents: output,
    source: 'knowledge_base'
  };
}
```

#### 结果格式化

```typescript
function formatKnowledgeBase(documents: Array<{output: string}>): string {
  if (documents.length === 0) return '';
  
  return documents
    .map((doc, index) => `${index + 1}. ${doc.output}`)
    .join('\n\n');
}
```

#### 环境变量

```bash
COZE_API_KEY=your-coze-api-key
COZE_BASE_URL=https://api.coze.cn
COZE_WORKFLOW_ID=your-workflow-id
```

---

### 4. 网络搜索服务

**文件**: `services/tools/webSearch.ts`

#### Tavily 搜索集成

```typescript
interface WebSearchResult {
  hasResults: boolean;
  summary: string;               // 格式化的搜索结果摘要
  sources: Array<{
    title: string;
    url: string;
    content: string;
  }>;
  source: 'web_search';
}

async function searchWeb(query: string): Promise<WebSearchResult> {
  const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY });
  
  // 1. 执行搜索（最多 3 条结果）
  const result = await tavilyClient.search(query, {
    maxResults: 3,
    includeRawContent: true,
    topic: 'general'
  });
  
  // 2. 对每个结果的 raw_content 进行摘要
  const summarizedResults = await processSearchResults(result.results);
  
  // 3. 格式化返回
  return {
    hasResults: summarizedResults.length > 0,
    summary: formatSearchOutput(summarizedResults),
    sources: summarizedResults,
    source: 'web_search'
  };
}
```

#### 搜索结果摘要

使用智谱模型对搜索结果进行摘要：

```typescript
async function summarizeWebpageContent(content: string): Promise<string> {
  const llm = createZhipuLLM(0);  // temperature=0 保证稳定
  
  const prompt = `Today's date is ${new Date().toISOString().split('T')[0]}.

You are tasked with summarizing webpage content for research purposes.

**Instructions:**
1. Extract the main topic and key points from the content
2. Identify important facts, statistics, and findings
3. Capture relevant quotes or excerpts that contain valuable information
4. Filter out navigation, ads, and irrelevant boilerplate content
5. Focus on factual information that answers research questions

**Webpage Content:**
${content}

Provide:
1. A concise summary of the main content
2. Key excerpts with important quotes or data points

Return your response in JSON format with:
{
  "summary": "<concise summary of main content>",
  "key_excerpts": "<important quotes and data points>"
}`;

  const response = await llm.invoke([
    { role: "user", content: prompt }
  ], {
    response_format: { type: 'json_object' }
  });
  
  const result = JSON.parse(response.content as string);
  return `${result.summary}\n\n关键摘录：\n${result.key_excerpts}`;
}
```

#### 环境变量

```bash
TAVILY_API_KEY=your-tavily-api-key
```

---

### 5. 工具编排器（核心）

**文件**: `services/tools/toolOrchestrator.ts`

#### 接口设计

```typescript
interface ToolContext {
  query: string;                 // 用户原始问题
  intent: UserIntent;            // 用户意图
  imageUrls?: string[];          // 图片 URL（可选）
  conversationId: string;
  messageId: string;
  eventEmitter: AgentEventEmitter;
}

interface ToolResult {
  success: boolean;              // 是否成功获取工具结果
  data?: {
    imageDescription?: string;   // 图片识别结果
    knowledgeBase?: string;      // 知识库内容
    webSearch?: string;          // 搜索结果
  };
  enhancedQuery: string;         // 增强后的查询
  toolsUsed: string[];          // 使用了哪些工具
}
```

#### 编排流程

```typescript
async function orchestrateTools(context: ToolContext): Promise<ToolResult> {
  const result: ToolResult = {
    success: false,
    data: {},
    enhancedQuery: context.query,
    toolsUsed: []
  };

  try {
    // 步骤 1: 图片识别（如有图片且意图需要）
    if (context.imageUrls?.length && shouldRecognizeImage(context.intent)) {
      try {
        const imageDesc = await withTimeout(
          recognizeImage(context.imageUrls, { intent: context.intent }),
          10000  // 10s 超时
        );
        
        result.data.imageDescription = imageDesc;
        result.enhancedQuery = `${context.query}\n\n【图片信息】\n${imageDesc}`;
        result.toolsUsed.push('image_recognition');
        
        // 发送工具调用事件
        context.eventEmitter.emit('tool:call', createToolCallEvent(
          context.conversationId,
          `tool_img_${Date.now()}`,
          'image_recognition',
          context.messageId,
          'completed',
          { output: { description: imageDesc } }
        ));
      } catch (error) {
        console.warn('Image recognition failed, continue without it:', error);
        // 图片识别失败不影响后续流程
      }
    }

    // 步骤 2: 知识库查询
    try {
      const toolId = `tool_kb_${Date.now()}`;
      context.eventEmitter.emit('tool:call', createToolCallEvent(
        context.conversationId,
        toolId,
        'knowledge_base',
        context.messageId,
        'running',
        { input: { query: result.enhancedQuery } }
      ));
      
      const kbResult = await withTimeout(
        queryKnowledgeBase(result.enhancedQuery),
        5000  // 5s 超时
      );
      
      if (kbResult.hasResults) {
        result.data.knowledgeBase = formatKnowledgeBase(kbResult.documents);
        result.toolsUsed.push('knowledge_base');
        result.success = true;
        
        context.eventEmitter.emit('tool:call', createToolCallEvent(
          context.conversationId,
          toolId,
          'knowledge_base',
          context.messageId,
          'completed',
          { output: { documents: kbResult.documents } }
        ));
        
        return result;  // 有知识库结果，直接返回
      }
      
      context.eventEmitter.emit('tool:call', createToolCallEvent(
        context.conversationId,
        toolId,
        'knowledge_base',
        context.messageId,
        'completed',
        { output: { message: 'No results found' } }
      ));
    } catch (error) {
      console.warn('Knowledge base failed, fallback to web search:', error);
    }

    // 步骤 3: 降级到网络搜索
    try {
      const toolId = `tool_search_${Date.now()}`;
      context.eventEmitter.emit('tool:call', createToolCallEvent(
        context.conversationId,
        toolId,
        'web_search',
        context.messageId,
        'running',
        { input: { query: result.enhancedQuery } }
      ));
      
      const searchResult = await withTimeout(
        searchWeb(result.enhancedQuery),
        8000  // 8s 超时
      );
      
      if (searchResult.hasResults) {
        result.data.webSearch = searchResult.summary;
        result.toolsUsed.push('web_search');
        result.success = true;
        
        context.eventEmitter.emit('tool:call', createToolCallEvent(
          context.conversationId,
          toolId,
          'web_search',
          context.messageId,
          'completed',
          { output: { summary: searchResult.summary, sources: searchResult.sources } }
        ));
      }
    } catch (error) {
      console.warn('Web search failed, will use pure LLM:', error);
    }

    return result;
  } catch (error) {
    console.error('Tool orchestration error:', error);
    return result;  // 返回失败状态，节点降级到纯 LLM
  }
}

// 辅助函数：判断是否需要图片识别
function shouldRecognizeImage(intent: UserIntent): boolean {
  return intent !== 'hospital_recommend';  // 医院推荐不需要图片识别
}

// 辅助函数：超时控制
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), ms)
    )
  ]);
}
```

---

## 🔧 节点改造方案

### Message 类型扩展

**文件**: `agent/types.ts`

```typescript
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  imageUrls?: string[];  // 新增：支持多张图片
}
```

### 节点改造模式

以 `symptomAnalysis` 为例：

**文件**: `agent/nodes/symptomAnalysis.ts`

```typescript
import { orchestrateTools } from '../../services/tools/toolOrchestrator';

export async function symptomAnalysis(state: typeof AgentState.State) {
  const emitter = state.eventEmitter;
  const { conversationId, messages, userIntent } = state;
  const lastMessage = messages[messages.length - 1];
  const userQuery = lastMessage.content;
  const messageId = state.messageId || `msg_${Date.now()}`;

  // 步骤 1: 尝试使用工具增强
  const toolResult = await orchestrateTools({
    query: userQuery,
    intent: userIntent!,
    imageUrls: lastMessage.imageUrls,
    conversationId,
    messageId,
    eventEmitter: emitter
  });

  // 步骤 2: 构建增强的 Prompt
  let enhancedPrompt = SYMPTOM_PROMPT.replace('{query}', userQuery);
  
  if (toolResult.success && toolResult.data) {
    // 有工具结果，添加到 prompt
    if (toolResult.data.imageDescription) {
      enhancedPrompt += `\n\n【图片信息】\n${toolResult.data.imageDescription}`;
    }
    if (toolResult.data.knowledgeBase) {
      enhancedPrompt += `\n\n【知识库参考】\n${toolResult.data.knowledgeBase}\n\n请优先基于知识库内容回答。`;
    }
    if (toolResult.data.webSearch) {
      enhancedPrompt += `\n\n【网络搜索结果】\n${toolResult.data.webSearch}\n\n请参考搜索结果回答。`;
    }
    enhancedPrompt += `\n\n请基于以上信息，结合你的专业知识，给出专业建议。`;
  } else {
    // 工具失败或无结果，使用原有逻辑
    console.log('No tool results, using pure LLM');
  }

  // 步骤 3: LLM 生成回答（保持原有流式输出逻辑）
  const llm = createZhipuLLM(0.7);
  let fullContent = '';
  let chunkIndex = 0;
  let isFirst = true;

  const stream = await llm.stream([
    { role: "user", content: enhancedPrompt },
  ]);

  for await (const chunk of stream) {
    const delta = typeof chunk.content === 'string' ? chunk.content : '';
    if (delta) {
      fullContent += delta;
      emitter.emit('message:content', createMessageContentEvent(
        conversationId,
        messageId,
        delta,
        chunkIndex++,
        isFirst,
        false
      ));
      isFirst = false;
    }
  }

  // 发送结束标记
  emitter.emit('message:content', createMessageContentEvent(
    conversationId,
    messageId,
    '',
    chunkIndex,
    false,
    true
  ));

  const analysis = fullContent;
  console.log('🩺 Symptom analysis completed');

  // 发送元数据
  emitter.emit('message:metadata', createMessageMetadataEvent(
    conversationId,
    messageId,
    undefined,
    [
      { type: 'transfer_to_doctor', label: '咨询人工医生', data: { action: 'transfer' } },
      { type: 'book_appointment', label: '预约挂号', data: { action: 'booking' } },
    ],
    {
      symptoms: [],
      possibleConditions: [],
      suggestions: [],
      urgencyLevel: 'low',
      toolsUsed: toolResult.toolsUsed,  // 记录使用的工具
    }
  ));

  return {
    branchResult: analysis,
    messageId,
  };
}
```

### 改造范围

| 节点 | 是否需要图片识别 | 是否需要知识库/搜索 | 改造程度 |
|------|---------------|------------------|---------|
| `classifyIntent.ts` | ❌ | ❌ | 轻微（传递 imageUrls） |
| `symptomAnalysis.ts` | ✅ | ✅ | 中等（集成工具编排器） |
| `medicineInfo.ts` | ✅ | ✅ | 中等（集成工具编排器） |
| `consultation.ts` | ✅ | ✅ | 中等（集成工具编排器） |
| `hospitalRecommend.ts` | ❌ | ✅ | 轻度（仅知识库和搜索） |

---

## ⚠️ 错误处理与降级策略

### 多层降级机制

```
图片识别失败 
  → 忽略图片，继续后续流程（不影响主流程）

知识库查询失败/无结果/超时 
  → 降级到网络搜索

网络搜索失败/超时 
  → 降级到纯 LLM 回答

所有工具都失败 
  → 保底：纯 LLM 回答（原有逻辑，保证总能返回）
```

### 超时配置

```typescript
const TIMEOUT_CONFIG = {
  imageRecognition: 10000,   // 10s
  knowledgeBase: 5000,       // 5s
  webSearch: 8000,           // 8s
};
```

### 错误日志

所有工具调用错误都会记录到日志，但不会中断主流程：

```typescript
console.warn('[Tool] Image recognition failed:', error.message);
console.warn('[Tool] Knowledge base query failed:', error.message);
console.warn('[Tool] Web search failed:', error.message);
```

---

## 🧪 测试策略

### 测试层级

```
backend/src/
├── services/tools/__tests__/
│   ├── imageRecognition.test.ts      # 单元测试 - Mock 智谱 API
│   ├── knowledgeBase.test.ts         # 单元测试 - Mock Coze API
│   ├── webSearch.test.ts             # 单元测试 - Mock Tavily API
│   └── toolOrchestrator.test.ts      # 单元测试 - Mock 所有工具
├── agent/nodes/__tests__/
│   ├── symptomAnalysis.test.ts       # 集成测试 - 测试工具集成
│   ├── medicineInfo.test.ts
│   └── consultation.test.ts
└── __tests__/e2e/
    └── aiChatWithTools.test.ts       # E2E 测试 - 完整对话流程
```

### 关键测试用例

#### 1. 工具编排器测试

```typescript
describe('toolOrchestrator', () => {
  test('成功：图片识别 + 知识库', async () => {
    const result = await orchestrateTools({
      query: '肚子疼',
      intent: 'symptom_consult',
      imageUrls: ['https://...'],
      // ...
    });
    
    expect(result.success).toBe(true);
    expect(result.toolsUsed).toContain('image_recognition');
    expect(result.toolsUsed).toContain('knowledge_base');
    expect(result.data.imageDescription).toBeDefined();
    expect(result.data.knowledgeBase).toBeDefined();
  });

  test('降级：知识库失败 → 网络搜索', async () => {
    mockKnowledgeBase.mockRejectedValue(new Error('KB error'));
    
    const result = await orchestrateTools({...});
    
    expect(result.success).toBe(true);
    expect(result.toolsUsed).toContain('web_search');
    expect(result.toolsUsed).not.toContain('knowledge_base');
  });

  test('降级：所有工具失败 → 纯 LLM', async () => {
    mockAllToolsFail();
    
    const result = await orchestrateTools({...});
    
    expect(result.success).toBe(false);
    expect(result.toolsUsed).toHaveLength(0);
    // 节点应该仍能返回 LLM 回答
  });

  test('超时：工具调用超时后降级', async () => {
    mockKnowledgeBase.mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 10000))
    );
    
    const result = await orchestrateTools({...});
    
    // 应该降级到搜索
    expect(result.toolsUsed).toContain('web_search');
  });

  test('医院推荐不识别图片', async () => {
    const result = await orchestrateTools({
      query: '北京心内科医院',
      intent: 'hospital_recommend',
      imageUrls: ['https://...'],
      // ...
    });
    
    expect(result.toolsUsed).not.toContain('image_recognition');
  });
});
```

#### 2. 节点集成测试

```typescript
describe('symptomAnalysis with tools', () => {
  test('带图片和工具的完整流程', async () => {
    const state = createMockState({
      messages: [{ 
        role: 'user', 
        content: '肚子疼', 
        imageUrls: ['https://...'] 
      }],
      userIntent: 'symptom_consult'
    });
    
    const result = await symptomAnalysis(state);
    
    expect(result.branchResult).toBeDefined();
    expect(result.branchResult).toContain('建议');
  });

  test('工具失败仍能正常回答', async () => {
    mockAllToolsFail();
    
    const state = createMockState({...});
    const result = await symptomAnalysis(state);
    
    expect(result.branchResult).toBeDefined();
    // 应该有纯 LLM 的回答
  });
});
```

#### 3. E2E 测试

```typescript
describe('AI Chat with Tools E2E', () => {
  test('完整对话流程：上传图片 → 发送消息 → 获取增强回答', async () => {
    // 1. 上传图片
    const uploadRes = await testClient.uploadImage(testImage);
    expect(uploadRes.success).toBe(true);
    const imageUrl = uploadRes.data.url;
    
    // 2. 发送带图片的消息
    const messages: any[] = [];
    const response = await testClient.sendMessage({
      conversationId: 'test-conv',
      content: '这是什么药？',
      imageUrls: [imageUrl]
    });
    
    // 3. 收集 SSE 事件
    response.on('tool:call', (event) => {
      messages.push(event);
    });
    
    response.on('message:content', (event) => {
      messages.push(event);
    });
    
    await response.waitForComplete();
    
    // 4. 验证
    const toolEvents = messages.filter(m => m.type === 'tool:call');
    expect(toolEvents.length).toBeGreaterThan(0);
    
    const contentEvents = messages.filter(m => m.type === 'message:content');
    const fullContent = contentEvents
      .map(e => e.data.delta)
      .join('');
    
    expect(fullContent).toContain('药品');
  });
});
```

### 手动验证清单

实施完成后需手动验证：

- [ ] **Supabase 配置**
  - [ ] Bucket `medical-images` 创建成功
  - [ ] 上传图片成功并获取 URL
  - [ ] 公开访问 URL 可被多模态 API 访问

- [ ] **多模态识别**
  - [ ] 智谱 glm-4.6v API 调用成功
  - [ ] 症状图片识别准确
  - [ ] 药品图片识别准确
  - [ ] 医疗报告识别准确

- [ ] **知识库查询**
  - [ ] Coze 工作流调用成功
  - [ ] 返回格式正确解析
  - [ ] 无结果时正确降级

- [ ] **网络搜索**
  - [ ] Tavily 搜索正常工作
  - [ ] 搜索结果摘要准确
  - [ ] 格式化输出合理

- [ ] **完整流程**
  - [ ] 端到端流程流畅
  - [ ] SSE 事件正常推送
  - [ ] 工具调用事件正确展示
  - [ ] 降级机制工作正常
  - [ ] 错误不会导致整体失败

---

## 📋 实施检查清单

### 阶段 1: 基础设施（Supabase）

- [ ] 创建 Supabase bucket `medical-images`
- [ ] 实现 `supabaseStorage.ts` 服务
- [ ] 改造 `uploadController.ts` 支持图片上传
- [ ] 添加环境变量配置
- [ ] 测试图片上传和 URL 获取

### 阶段 2: 工具服务层

- [ ] 实现 `imageRecognition.ts`（智谱 glm-4.6v）
- [ ] 实现 `knowledgeBase.ts`（Coze）
- [ ] 实现 `webSearch.ts`（Tavily）
- [ ] 实现 `toolOrchestrator.ts`（编排器）
- [ ] 实现 `prompts.ts`（提示词配置）
- [ ] 实现 `types.ts`（类型定义）
- [ ] 添加所有环境变量

### 阶段 3: 节点改造

- [ ] 扩展 `Message` 类型支持 `imageUrls`
- [ ] 改造 `classifyIntent.ts`（传递图片 URL）
- [ ] 改造 `symptomAnalysis.ts`（集成工具）
- [ ] 改造 `medicineInfo.ts`（集成工具）
- [ ] 改造 `consultation.ts`（集成工具）
- [ ] 改造 `hospitalRecommend.ts`（仅知识库和搜索）

### 阶段 4: 测试

- [ ] 编写工具服务单元测试
- [ ] 编写工具编排器测试
- [ ] 编写节点集成测试
- [ ] 编写 E2E 测试
- [ ] 手动验证完整流程

### 阶段 5: 文档和部署

- [ ] 更新 README
- [ ] 更新环境变量文档
- [ ] 运行所有测试确保通过
- [ ] 代码审查
- [ ] 部署到测试环境
- [ ] 生产环境部署

---

## 📚 依赖包

需要安装的新依赖：

```json
{
  "dependencies": {
    "@coze/api": "^latest",
    "@tavily/core": "^latest"
  }
}
```

已有依赖：
- `@supabase/supabase-js` - Supabase 客户端
- `@langchain/openai` - OpenAI 兼容接口（用于智谱）

---

## 🔐 环境变量完整清单

```bash
# 现有变量
ZHIPU_API_KEY=sk-xxx
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4

# Supabase（现有）
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # 新增

# Coze 知识库（新增）
COZE_API_KEY=your-coze-api-key
COZE_BASE_URL=https://api.coze.cn
COZE_WORKFLOW_ID=your-workflow-id

# Tavily 搜索（新增）
TAVILY_API_KEY=your-tavily-api-key
```

---

## 📊 预期效果

### 功能增强

1. **多模态理解** - 支持用户上传症状图片、药品图片、医疗报告等
2. **知识准确性** - 基于医疗知识库提供更专业的回答
3. **信息实时性** - 通过网络搜索获取最新医疗信息
4. **用户体验** - 工具调用过程透明，实时展示进度

### 性能指标

- 图片识别响应时间: < 10s
- 知识库查询响应时间: < 5s
- 网络搜索响应时间: < 8s
- 整体响应时间: < 15s（含工具调用和 LLM 生成）

### 可靠性

- 工具失败不影响服务可用性
- 多层降级确保总能返回有效结果
- 超时控制防止长时间等待

---

## 🚀 后续优化方向

1. **缓存机制** - 对知识库和搜索结果进行缓存，减少 API 调用
2. **并行工具调用** - 图片识别和知识库查询可以并行执行
3. **智能路由** - 根据问题类型智能选择使用哪些工具
4. **用户反馈** - 收集用户对工具增强回答的反馈，持续优化
5. **多模态输出** - 支持返回图片、图表等多模态内容

---

**文档版本**: 1.0  
**最后更新**: 2026-01-27  
**状态**: ✅ 设计完成，待实施
