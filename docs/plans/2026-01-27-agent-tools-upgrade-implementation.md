# Agent 工具升级实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标**: 为小荷AI医生 Agent 增加多模态图片识别、知识库查询和网络搜索能力，并实现工具编排和降级机制。

**架构**: 创建统一的工具服务层（`services/tools/`），通过工具编排器统一管理图片识别、知识库查询和网络搜索。各节点保持原有逻辑，工具调用作为可选增强，失败时降级到纯 LLM 回答。

**技术栈**: 
- 智谱 glm-4.6v（多模态识别）
- Coze API（知识库工作流）
- Tavily API（网络搜索）
- Supabase Storage（图片存储）
- LangGraph.js（Agent 框架）

**测试策略**: TDD - 每个功能模块先写测试，验证失败，实现代码，验证通过，再提交。

---

## 阶段 1: 类型定义和基础工具

### Task 1.1: 扩展 Message 类型支持图片

**文件**:
- Modify: `backend/src/agent/types.ts`

**Step 1: 修改 Message 接口添加 imageUrls**

在 `backend/src/agent/types.ts` 中修改 Message 接口：

```typescript
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  imageUrls?: string[];  // 新增：支持多张图片
}
```

**Step 2: 验证类型无编译错误**

```bash
cd /Users/cong/chenzhicong/project/xiaohe-ai-doctor/.worktrees/agent-tools-upgrade/backend
pnpm build
```

预期: 编译成功，无类型错误

**Step 3: 提交**

```bash
git add src/agent/types.ts
git commit -m "feat(agent): 扩展 Message 类型支持 imageUrls"
```

---

### Task 1.2: 创建工具服务类型定义

**文件**:
- Create: `backend/src/services/tools/types.ts`

**Step 1: 创建工具类型定义文件**

```typescript
import { UserIntent } from '../../agent/types';
import { AgentEventEmitter } from '../../agent/events/AgentEventEmitter';

/**
 * 图片识别配置
 */
export interface ImageRecognitionConfig {
  intent: UserIntent;
  customPrompt?: string;
}

/**
 * 图片识别结果
 */
export interface ImageRecognitionResult {
  description: string;
  confidence?: number;
}

/**
 * 知识库查询结果
 */
export interface KnowledgeQueryResult {
  hasResults: boolean;
  documents: Array<{
    documentId: string;
    output: string;
  }>;
  source: 'knowledge_base';
}

/**
 * 网络搜索结果
 */
export interface WebSearchResult {
  hasResults: boolean;
  summary: string;
  sources: Array<{
    title: string;
    url: string;
    content: string;
  }>;
  source: 'web_search';
}

/**
 * 工具编排器上下文
 */
export interface ToolContext {
  query: string;
  intent: UserIntent;
  imageUrls?: string[];
  conversationId: string;
  messageId: string;
  eventEmitter: AgentEventEmitter;
}

/**
 * 工具编排器结果
 */
export interface ToolResult {
  success: boolean;
  data?: {
    imageDescription?: string;
    knowledgeBase?: string;
    webSearch?: string;
  };
  enhancedQuery: string;
  toolsUsed: string[];
}

/**
 * 超时配置
 */
export const TIMEOUT_CONFIG = {
  imageRecognition: 10000,   // 10s
  knowledgeBase: 5000,       // 5s
  webSearch: 8000,           // 8s
} as const;
```

**Step 2: 验证编译**

```bash
pnpm build
```

预期: 编译成功

**Step 3: 提交**

```bash
git add src/services/tools/types.ts
git commit -m "feat(tools): 添加工具服务类型定义"
```

---

### Task 1.3: 创建工具 Prompts 配置

**文件**:
- Create: `backend/src/services/tools/prompts.ts`

**Step 1: 创建 prompts 配置文件**

```typescript
import { UserIntent } from '../../agent/types';

/**
 * 图片识别 Prompts - 根据不同意图定制
 */
export const RECOGNITION_PROMPTS: Record<Exclude<UserIntent, 'hospital_recommend'>, string> = {
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
- 任何需要注意的细节`,
};

/**
 * 网页摘要 Prompt
 */
export const SUMMARIZE_WEBPAGE_PROMPT = (content: string, date: string): string => `Today's date is ${date}.

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

/**
 * 判断意图是否需要图片识别
 */
export function shouldRecognizeImage(intent: UserIntent): boolean {
  return intent !== 'hospital_recommend';
}
```

**Step 2: 验证编译**

```bash
pnpm build
```

**Step 3: 提交**

```bash
git add src/services/tools/prompts.ts
git commit -m "feat(tools): 添加工具 Prompts 配置"
```

---

## 阶段 2: Supabase 存储服务

### Task 2.1: 创建 Supabase Storage 服务（测试）

**文件**:
- Create: `backend/src/services/storage/__tests__/supabaseStorage.test.ts`

**Step 1: 写失败的测试**

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { uploadImage, deleteImage, getPublicUrl } from '../supabaseStorage';

// Mock @supabase/storage-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        remove: vi.fn(),
        getPublicUrl: vi.fn(),
      })),
    },
  })),
}));

describe('supabaseStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadImage', () => {
    it('应该成功上传图片并返回 URL', async () => {
      const file = Buffer.from('fake-image-data');
      const filename = 'test.jpg';
      const userId = 'user123';
      const conversationId = 'conv123';

      const result = await uploadImage(file, filename, userId, conversationId);

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('publicUrl');
      expect(result).toHaveProperty('path');
      expect(result.path).toContain(userId);
      expect(result.path).toContain(conversationId);
    });

    it('应该在上传失败时抛出错误', async () => {
      const file = Buffer.from('fake-image-data');
      
      await expect(
        uploadImage(file, 'test.jpg', 'user123', 'conv123')
      ).rejects.toThrow();
    });
  });

  describe('getPublicUrl', () => {
    it('应该返回公开访问 URL', async () => {
      const path = 'user123/conv123/test.jpg';
      
      const url = await getPublicUrl(path);
      
      expect(url).toContain('supabase');
      expect(url).toContain(path);
    });
  });

  describe('deleteImage', () => {
    it('应该成功删除图片', async () => {
      const path = 'user123/conv123/test.jpg';
      
      await expect(deleteImage(path)).resolves.not.toThrow();
    });
  });
});
```

**Step 2: 运行测试验证失败**

```bash
pnpm test src/services/storage/__tests__/supabaseStorage.test.ts
```

预期: FAIL - `Cannot find module '../supabaseStorage'`

**Step 3: 提交测试**

```bash
git add src/services/storage/__tests__/supabaseStorage.test.ts
git commit -m "test(storage): 添加 Supabase 存储服务测试"
```

---

### Task 2.2: 实现 Supabase Storage 服务

**文件**:
- Create: `backend/src/services/storage/supabaseStorage.ts`

**Step 1: 实现 Supabase Storage 服务**

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'medical-images';

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase credentials not configured');
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }

  return supabaseClient;
}

export interface UploadResult {
  url: string;
  publicUrl: string;
  path: string;
}

/**
 * 上传图片到 Supabase Storage
 */
export async function uploadImage(
  file: Buffer,
  filename: string,
  userId: string,
  conversationId: string
): Promise<UploadResult> {
  const client = getSupabaseClient();
  
  // 生成唯一文件路径
  const timestamp = Date.now();
  const path = `${userId}/${conversationId}/${timestamp}_${filename}`;

  // 上传文件
  const { data, error } = await client.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      contentType: getContentType(filename),
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // 获取公开 URL
  const publicUrl = await getPublicUrl(path);

  return {
    url: publicUrl,
    publicUrl,
    path: data.path,
  };
}

/**
 * 获取图片的公开访问 URL
 */
export async function getPublicUrl(path: string): Promise<string> {
  const client = getSupabaseClient();
  
  const { data } = client.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  return data.publicUrl;
}

/**
 * 删除图片
 */
export async function deleteImage(path: string): Promise<void> {
  const client = getSupabaseClient();
  
  const { error } = await client.storage
    .from(BUCKET_NAME)
    .remove([path]);

  if (error) {
    throw new Error(`Failed to delete image: ${error.message}`);
  }
}

/**
 * 根据文件名获取 Content-Type
 */
function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const contentTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  };

  return contentTypes[ext || ''] || 'application/octet-stream';
}
```

**Step 2: 运行测试验证通过**

```bash
pnpm test src/services/storage/__tests__/supabaseStorage.test.ts
```

预期: PASS（如果有 mock 问题需要调整测试）

**Step 3: 提交实现**

```bash
git add src/services/storage/supabaseStorage.ts
git commit -m "feat(storage): 实现 Supabase 存储服务"
```

---

## 阶段 3: 工具服务实现

### Task 3.1: 实现图片识别服务（测试）

**文件**:
- Create: `backend/src/services/tools/__tests__/imageRecognition.test.ts`

**Step 1: 写失败的测试**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { recognizeImage } from '../imageRecognition';

// Mock fetch
global.fetch = vi.fn();

describe('imageRecognition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该成功识别症状图片', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: '图片显示腹部右下方有明显红肿...'
        }
      }]
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await recognizeImage(
      ['https://example.com/image.jpg'],
      { intent: 'symptom_consult' }
    );

    expect(result).toContain('红肿');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('bigmodel.cn'),
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('应该使用不同的 prompt 识别药品图片', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: '药品名称：布洛芬缓释胶囊...'
        }
      }]
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await recognizeImage(
      ['https://example.com/medicine.jpg'],
      { intent: 'medicine_info' }
    );

    expect(result).toContain('布洛芬');
  });

  it('应该在 API 失败时抛出错误', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Request',
    });

    await expect(
      recognizeImage(['https://example.com/image.jpg'], { intent: 'symptom_consult' })
    ).rejects.toThrow();
  });
});
```

**Step 2: 运行测试验证失败**

```bash
pnpm test src/services/tools/__tests__/imageRecognition.test.ts
```

预期: FAIL - `Cannot find module '../imageRecognition'`

**Step 3: 提交测试**

```bash
git add src/services/tools/__tests__/imageRecognition.test.ts
git commit -m "test(tools): 添加图片识别服务测试"
```

---

### Task 3.2: 实现图片识别服务

**文件**:
- Create: `backend/src/services/tools/imageRecognition.ts`

**Step 1: 实现图片识别服务**

```typescript
import { ImageRecognitionConfig } from './types';
import { RECOGNITION_PROMPTS, shouldRecognizeImage } from './prompts';

/**
 * 使用智谱 glm-4.6v 识别图片
 */
export async function recognizeImage(
  imageUrls: string[],
  config: ImageRecognitionConfig
): Promise<string> {
  if (!process.env.ZHIPU_API_KEY) {
    throw new Error('ZHIPU_API_KEY not configured');
  }

  // 获取对应意图的 prompt
  const prompt = config.customPrompt || RECOGNITION_PROMPTS[config.intent as keyof typeof RECOGNITION_PROMPTS];
  
  if (!prompt) {
    throw new Error(`No recognition prompt for intent: ${config.intent}`);
  }

  // 构建多模态消息
  const content = [
    ...imageUrls.map(url => ({
      type: 'image_url' as const,
      image_url: { url },
    })),
    {
      type: 'text' as const,
      text: prompt,
    },
  ];

  // 调用智谱 API
  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.ZHIPU_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'glm-4v',
      messages: [{
        role: 'user',
        content,
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Image recognition failed: ${response.statusText}`);
  }

  const data = await response.json();
  const description = data.choices?.[0]?.message?.content || '';

  if (!description) {
    throw new Error('No description returned from image recognition');
  }

  return description;
}
```

**Step 2: 运行测试验证通过**

```bash
pnpm test src/services/tools/__tests__/imageRecognition.test.ts
```

预期: PASS

**Step 3: 提交实现**

```bash
git add src/services/tools/imageRecognition.ts
git commit -m "feat(tools): 实现图片识别服务"
```

---

### Task 3.3: 实现知识库查询服务（测试）

**文件**:
- Create: `backend/src/services/tools/__tests__/knowledgeBase.test.ts`

**Step 1: 写失败的测试**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { queryKnowledgeBase, formatKnowledgeBase } from '../knowledgeBase';

// Mock @coze/api
vi.mock('@coze/api', () => ({
  CozeAPI: vi.fn(() => ({
    workflows: {
      runs: {
        create: vi.fn(),
      },
    },
  })),
}));

describe('knowledgeBase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queryKnowledgeBase', () => {
    it('应该成功查询知识库并返回结果', async () => {
      const mockData = {
        output: [
          { documentId: '1', output: '症状分析内容1' },
          { documentId: '2', output: '症状分析内容2' },
        ],
      };

      const { CozeAPI } = await import('@coze/api');
      const mockCreate = vi.fn().mockResolvedValue({
        data: JSON.stringify(mockData),
      });
      
      (CozeAPI as any).mockImplementation(() => ({
        workflows: {
          runs: { create: mockCreate },
        },
      }));

      const result = await queryKnowledgeBase('肚子疼');

      expect(result.hasResults).toBe(true);
      expect(result.documents).toHaveLength(2);
      expect(result.source).toBe('knowledge_base');
    });

    it('应该在无结果时返回 hasResults: false', async () => {
      const mockData = { output: [] };

      const { CozeAPI } = await import('@coze/api');
      const mockCreate = vi.fn().mockResolvedValue({
        data: JSON.stringify(mockData),
      });
      
      (CozeAPI as any).mockImplementation(() => ({
        workflows: {
          runs: { create: mockCreate },
        },
      }));

      const result = await queryKnowledgeBase('未知问题');

      expect(result.hasResults).toBe(false);
      expect(result.documents).toHaveLength(0);
    });
  });

  describe('formatKnowledgeBase', () => {
    it('应该格式化知识库结果', () => {
      const documents = [
        { output: '内容1' },
        { output: '内容2' },
      ];

      const formatted = formatKnowledgeBase(documents);

      expect(formatted).toContain('1. 内容1');
      expect(formatted).toContain('2. 内容2');
    });

    it('应该处理空文档数组', () => {
      const formatted = formatKnowledgeBase([]);
      expect(formatted).toBe('');
    });
  });
});
```

**Step 2: 运行测试验证失败**

```bash
pnpm test src/services/tools/__tests__/knowledgeBase.test.ts
```

预期: FAIL

**Step 3: 提交测试**

```bash
git add src/services/tools/__tests__/knowledgeBase.test.ts
git commit -m "test(tools): 添加知识库查询服务测试"
```

---

### Task 3.4: 安装 Coze SDK

**Step 1: 安装依赖**

```bash
cd /Users/cong/chenzhicong/project/xiaohe-ai-doctor/.worktrees/agent-tools-upgrade/backend
pnpm add @coze/api
```

**Step 2: 验证安装**

```bash
pnpm list @coze/api
```

预期: 显示已安装的版本

**Step 3: 提交 package.json 变更**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): 添加 @coze/api 依赖"
```

---

### Task 3.5: 实现知识库查询服务

**文件**:
- Create: `backend/src/services/tools/knowledgeBase.ts`

**Step 1: 实现知识库查询服务**

```typescript
import { CozeAPI } from '@coze/api';
import { KnowledgeQueryResult } from './types';

let cozeClient: CozeAPI | null = null;

function getCozeClient(): CozeAPI {
  if (!cozeClient) {
    const apiKey = process.env.COZE_API_KEY;
    const baseURL = process.env.COZE_BASE_URL;

    if (!apiKey) {
      throw new Error('COZE_API_KEY not configured');
    }

    cozeClient = new CozeAPI({
      token: apiKey,
      baseURL: baseURL || 'https://api.coze.cn',
    });
  }

  return cozeClient;
}

/**
 * 查询 Coze 知识库
 */
export async function queryKnowledgeBase(query: string): Promise<KnowledgeQueryResult> {
  const workflowId = process.env.COZE_WORKFLOW_ID;

  if (!workflowId) {
    throw new Error('COZE_WORKFLOW_ID not configured');
  }

  const client = getCozeClient();

  try {
    const res = await client.workflows.runs.create({
      workflow_id: workflowId,
      parameters: { query },
    });

    // 解析返回数据
    const data = JSON.parse(res.data);
    const output = data.output || [];

    return {
      hasResults: output.length > 0,
      documents: output,
      source: 'knowledge_base',
    };
  } catch (error) {
    console.error('Knowledge base query failed:', error);
    throw error;
  }
}

/**
 * 格式化知识库结果
 */
export function formatKnowledgeBase(documents: Array<{ output: string }>): string {
  if (documents.length === 0) {
    return '';
  }

  return documents
    .map((doc, index) => `${index + 1}. ${doc.output}`)
    .join('\n\n');
}
```

**Step 2: 运行测试验证通过**

```bash
pnpm test src/services/tools/__tests__/knowledgeBase.test.ts
```

预期: PASS

**Step 3: 提交实现**

```bash
git add src/services/tools/knowledgeBase.ts
git commit -m "feat(tools): 实现知识库查询服务"
```

---

### Task 3.6: 实现网络搜索服务（测试）

**文件**:
- Create: `backend/src/services/tools/__tests__/webSearch.test.ts`

**Step 1: 写失败的测试**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchWeb, summarizeWebpageContent } from '../webSearch';

vi.mock('@tavily/core');
vi.mock('../../utils/llm');

describe('webSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('searchWeb', () => {
    it('应该成功搜索并返回摘要结果', async () => {
      const mockSearchResult = {
        results: [
          {
            title: '腹痛原因分析',
            url: 'https://example.com/1',
            content: '腹痛可能由多种原因引起...',
            raw_content: '详细的医疗内容...',
          },
        ],
      };

      const { tavily } = await import('@tavily/core');
      (tavily as any).mockReturnValue({
        search: vi.fn().mockResolvedValue(mockSearchResult),
      });

      const result = await searchWeb('肚子疼是什么原因');

      expect(result.hasResults).toBe(true);
      expect(result.sources).toHaveLength(1);
      expect(result.summary).toContain('腹痛');
      expect(result.source).toBe('web_search');
    });

    it('应该在无结果时返回 hasResults: false', async () => {
      const { tavily } = await import('@tavily/core');
      (tavily as any).mockReturnValue({
        search: vi.fn().mockResolvedValue({ results: [] }),
      });

      const result = await searchWeb('未知查询');

      expect(result.hasResults).toBe(false);
    });
  });

  describe('summarizeWebpageContent', () => {
    it('应该使用 LLM 摘要网页内容', async () => {
      const { createZhipuLLM } = await import('../../utils/llm');
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue({
          content: JSON.stringify({
            summary: '主要内容摘要',
            key_excerpts: '关键摘录',
          }),
        }),
      };
      (createZhipuLLM as any).mockReturnValue(mockLLM);

      const result = await summarizeWebpageContent('长篇网页内容...');

      expect(result).toContain('主要内容摘要');
      expect(result).toContain('关键摘录');
    });
  });
});
```

**Step 2: 运行测试验证失败**

```bash
pnpm test src/services/tools/__tests__/webSearch.test.ts
```

预期: FAIL

**Step 3: 提交测试**

```bash
git add src/services/tools/__tests__/webSearch.test.ts
git commit -m "test(tools): 添加网络搜索服务测试"
```

---

### Task 3.7: 安装 Tavily SDK

**Step 1: 安装依赖**

```bash
cd /Users/cong/chenzhicong/project/xiaohe-ai-doctor/.worktrees/agent-tools-upgrade/backend
pnpm add @tavily/core
```

**Step 2: 提交依赖变更**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore(deps): 添加 @tavily/core 依赖"
```

---

### Task 3.8: 实现网络搜索服务

**文件**:
- Create: `backend/src/services/tools/webSearch.ts`

**Step 1: 实现网络搜索服务**

```typescript
import { tavily } from '@tavily/core';
import { createZhipuLLM } from '../../utils/llm';
import { WebSearchResult } from './types';
import { SUMMARIZE_WEBPAGE_PROMPT } from './prompts';

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  raw_content?: string;
}

let tavilyClient: ReturnType<typeof tavily> | null = null;

function getTavilyClient() {
  if (!tavilyClient) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new Error('TAVILY_API_KEY not configured');
    }
    tavilyClient = tavily({ apiKey });
  }
  return tavilyClient;
}

/**
 * 摘要网页内容
 */
export async function summarizeWebpageContent(content: string): Promise<string> {
  try {
    const llm = createZhipuLLM(0);  // temperature=0 保证稳定
    const today = new Date().toISOString().split('T')[0];
    const prompt = SUMMARIZE_WEBPAGE_PROMPT(content, today);

    const response = await llm.invoke([
      { role: 'user', content: prompt },
    ], {
      response_format: { type: 'json_object' },
    } as any);

    const result = JSON.parse(response.content as string);
    return `${result.summary}\n\n关键摘录：\n${result.key_excerpts}`;
  } catch (error) {
    console.error('Failed to summarize webpage:', error);
    // 降级：返回截断的原始内容
    return content.length > 1000 ? content.slice(0, 1000) + '...' : content;
  }
}

/**
 * 处理搜索结果
 */
async function processSearchResults(
  results: TavilySearchResult[]
): Promise<Array<{ title: string; url: string; content: string }>> {
  const processed = [];

  for (const result of results) {
    const content = result.raw_content
      ? await summarizeWebpageContent(result.raw_content)
      : result.content;

    processed.push({
      title: result.title,
      url: result.url,
      content,
    });
  }

  return processed;
}

/**
 * 格式化搜索结果
 */
function formatSearchOutput(
  sources: Array<{ title: string; url: string; content: string }>
): string {
  if (sources.length === 0) {
    return 'No valid search results found.';
  }

  let output = '搜索结果：\n\n';

  sources.forEach((source, index) => {
    output += `\n\n--- 来源 ${index + 1}: ${source.title} ---\n`;
    output += `URL: ${source.url}\n\n`;
    output += `摘要：\n${source.content}\n\n`;
    output += '-'.repeat(80) + '\n';
  });

  return output;
}

/**
 * 网络搜索
 */
export async function searchWeb(query: string): Promise<WebSearchResult> {
  const client = getTavilyClient();

  try {
    const result = await client.search(query, {
      maxResults: 3,
      includeRawContent: true,
      topic: 'general',
    } as any);

    if (!result.results || result.results.length === 0) {
      return {
        hasResults: false,
        summary: '',
        sources: [],
        source: 'web_search',
      };
    }

    const processedResults = await processSearchResults(result.results);

    return {
      hasResults: true,
      summary: formatSearchOutput(processedResults),
      sources: processedResults,
      source: 'web_search',
    };
  } catch (error) {
    console.error('Web search failed:', error);
    throw error;
  }
}
```

**Step 2: 运行测试验证通过**

```bash
pnpm test src/services/tools/__tests__/webSearch.test.ts
```

预期: PASS

**Step 3: 提交实现**

```bash
git add src/services/tools/webSearch.ts
git commit -m "feat(tools): 实现网络搜索服务"
```

---

### Task 3.9: 实现工具编排器（测试）

**文件**:
- Create: `backend/src/services/tools/__tests__/toolOrchestrator.test.ts`

**Step 1: 写失败的测试**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orchestrateTools } from '../toolOrchestrator';
import { AgentEventEmitter } from '../../../agent/events/AgentEventEmitter';

vi.mock('../imageRecognition');
vi.mock('../knowledgeBase');
vi.mock('../webSearch');

describe('toolOrchestrator', () => {
  let mockEmitter: AgentEventEmitter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEmitter = new AgentEventEmitter();
  });

  it('应该成功执行图片识别 + 知识库查询', async () => {
    const { recognizeImage } = await import('../imageRecognition');
    const { queryKnowledgeBase } = await import('../knowledgeBase');

    (recognizeImage as any).mockResolvedValue('腹部右下方红肿');
    (queryKnowledgeBase as any).mockResolvedValue({
      hasResults: true,
      documents: [{ output: '可能是阑尾炎' }],
    });

    const result = await orchestrateTools({
      query: '肚子疼',
      intent: 'symptom_consult',
      imageUrls: ['https://example.com/image.jpg'],
      conversationId: 'conv123',
      messageId: 'msg123',
      eventEmitter: mockEmitter,
    });

    expect(result.success).toBe(true);
    expect(result.toolsUsed).toContain('image_recognition');
    expect(result.toolsUsed).toContain('knowledge_base');
    expect(result.data?.imageDescription).toContain('红肿');
    expect(result.data?.knowledgeBase).toContain('阑尾炎');
  });

  it('应该在知识库无结果时降级到网络搜索', async () => {
    const { queryKnowledgeBase } = await import('../knowledgeBase');
    const { searchWeb } = await import('../webSearch');

    (queryKnowledgeBase as any).mockResolvedValue({
      hasResults: false,
      documents: [],
    });
    (searchWeb as any).mockResolvedValue({
      hasResults: true,
      summary: '搜索到的医疗信息...',
      sources: [],
    });

    const result = await orchestrateTools({
      query: '罕见疾病',
      intent: 'general_qa',
      conversationId: 'conv123',
      messageId: 'msg123',
      eventEmitter: mockEmitter,
    });

    expect(result.success).toBe(true);
    expect(result.toolsUsed).toContain('web_search');
    expect(result.toolsUsed).not.toContain('knowledge_base');
  });

  it('应该在所有工具失败时返回失败状态', async () => {
    const { queryKnowledgeBase } = await import('../knowledgeBase');
    const { searchWeb } = await import('../webSearch');

    (queryKnowledgeBase as any).mockRejectedValue(new Error('KB error'));
    (searchWeb as any).mockRejectedValue(new Error('Search error'));

    const result = await orchestrateTools({
      query: '测试问题',
      intent: 'general_qa',
      conversationId: 'conv123',
      messageId: 'msg123',
      eventEmitter: mockEmitter,
    });

    expect(result.success).toBe(false);
    expect(result.toolsUsed).toHaveLength(0);
  });

  it('医院推荐不应该调用图片识别', async () => {
    const { recognizeImage } = await import('../imageRecognition');
    const { queryKnowledgeBase } = await import('../knowledgeBase');

    (queryKnowledgeBase as any).mockResolvedValue({
      hasResults: true,
      documents: [{ output: '北京协和医院心内科' }],
    });

    const result = await orchestrateTools({
      query: '北京心内科医院推荐',
      intent: 'hospital_recommend',
      imageUrls: ['https://example.com/image.jpg'],
      conversationId: 'conv123',
      messageId: 'msg123',
      eventEmitter: mockEmitter,
    });

    expect(recognizeImage).not.toHaveBeenCalled();
    expect(result.toolsUsed).not.toContain('image_recognition');
  });
});
```

**Step 2: 运行测试验证失败**

```bash
pnpm test src/services/tools/__tests__/toolOrchestrator.test.ts
```

预期: FAIL

**Step 3: 提交测试**

```bash
git add src/services/tools/__tests__/toolOrchestrator.test.ts
git commit -m "test(tools): 添加工具编排器测试"
```

---

### Task 3.10: 实现工具编排器

**文件**:
- Create: `backend/src/services/tools/toolOrchestrator.ts`

**Step 1: 实现工具编排器**

```typescript
import { ToolContext, ToolResult, TIMEOUT_CONFIG } from './types';
import { shouldRecognizeImage } from './prompts';
import { recognizeImage } from './imageRecognition';
import { queryKnowledgeBase, formatKnowledgeBase } from './knowledgeBase';
import { searchWeb } from './webSearch';
import { createToolCallEvent } from '../../agent/events/chat-event-types';

/**
 * 超时控制辅助函数
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    ),
  ]);
}

/**
 * 工具编排器 - 统一管理工具调用
 */
export async function orchestrateTools(context: ToolContext): Promise<ToolResult> {
  const result: ToolResult = {
    success: false,
    data: {},
    enhancedQuery: context.query,
    toolsUsed: [],
  };

  try {
    // 步骤 1: 图片识别（如有图片且意图需要）
    if (context.imageUrls?.length && shouldRecognizeImage(context.intent)) {
      try {
        const toolId = `tool_img_${Date.now()}`;
        
        context.eventEmitter.emit('tool:call', createToolCallEvent(
          context.conversationId,
          toolId,
          'image_recognition',
          context.messageId,
          'running',
          { input: { imageUrls: context.imageUrls, intent: context.intent } }
        ));

        const imageDesc = await withTimeout(
          recognizeImage(context.imageUrls, { intent: context.intent }),
          TIMEOUT_CONFIG.imageRecognition
        );

        result.data.imageDescription = imageDesc;
        result.enhancedQuery = `${context.query}\n\n【图片信息】\n${imageDesc}`;
        result.toolsUsed.push('image_recognition');

        context.eventEmitter.emit('tool:call', createToolCallEvent(
          context.conversationId,
          toolId,
          'image_recognition',
          context.messageId,
          'completed',
          { output: { description: imageDesc } }
        ));
      } catch (error) {
        console.warn('[Tool] Image recognition failed, continue without it:', error);
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
        TIMEOUT_CONFIG.knowledgeBase
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
      console.warn('[Tool] Knowledge base failed, fallback to web search:', error);
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
        TIMEOUT_CONFIG.webSearch
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
      console.warn('[Tool] Web search failed, will use pure LLM:', error);
    }

    return result;
  } catch (error) {
    console.error('[Tool] Orchestration error:', error);
    return result;  // 返回失败状态，节点降级到纯 LLM
  }
}
```

**Step 2: 运行测试验证通过**

```bash
pnpm test src/services/tools/__tests__/toolOrchestrator.test.ts
```

预期: PASS

**Step 3: 提交实现**

```bash
git add src/services/tools/toolOrchestrator.ts
git commit -m "feat(tools): 实现工具编排器"
```

---

## 阶段 4: 节点改造

### Task 4.1: 改造 symptomAnalysis 节点

**文件**:
- Modify: `backend/src/agent/nodes/symptomAnalysis.ts`

**Step 1: 集成工具编排器到 symptomAnalysis**

修改 `symptomAnalysis` 节点，在开头导入并调用工具编排器：

```typescript
import { AgentState } from "../state";
import { createZhipuLLM } from "../../utils/llm";
import {
  createToolCallEvent,
  createMessageContentEvent,
  createMessageMetadataEvent,
} from "../events/chat-event-types";
import { v4 as uuidv4 } from 'uuid';
import { orchestrateTools } from "../../services/tools/toolOrchestrator";  // 新增

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
    eventEmitter: emitter,
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
    console.log('[SymptomAnalysis] No tool results, using pure LLM');
  }

  // 步骤 3: LLM 生成回答（保持原有流式输出逻辑）
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
      toolsUsed: toolResult.toolsUsed,  // 新增：记录使用的工具
    }
  ));

  return {
    branchResult: analysis,
    messageId,
  };
}
```

**Step 2: 验证编译**

```bash
pnpm build
```

预期: 编译成功

**Step 3: 提交改造**

```bash
git add src/agent/nodes/symptomAnalysis.ts
git commit -m "feat(agent): 集成工具编排器到症状分析节点"
```

---

### Task 4.2: 改造 medicineInfo 节点

**文件**:
- Modify: `backend/src/agent/nodes/medicineInfo.ts`

**Step 1: 集成工具编排器到 medicineInfo**

类似 symptomAnalysis，修改 `medicineInfo.ts`：

```typescript
import { AgentState } from "../state";
import { createZhipuLLM } from "../../utils/llm";
import {
  createMessageContentEvent,
  createMessageMetadataEvent,
} from "../events/chat-event-types";
import { orchestrateTools } from "../../services/tools/toolOrchestrator";  // 新增

const llm = createZhipuLLM(0.7);

const MEDICINE_PROMPT = `你是一位专业的药剂师。用户咨询药品相关信息，请提供专业解答。

用户问题: {query}

请提供：
1. 药品基本信息（成分、作用）
2. 用法用量
3. 注意事项和禁忌
4. 常见副作用

注意：
- 信息准确、专业
- 强调遵医嘱用药
- 提醒查看说明书`;

export async function medicineInfo(state: typeof AgentState.State) {
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
    eventEmitter: emitter,
  });

  // 步骤 2: 构建增强的 Prompt
  let enhancedPrompt = MEDICINE_PROMPT.replace('{query}', userQuery);
  
  if (toolResult.success && toolResult.data) {
    if (toolResult.data.imageDescription) {
      enhancedPrompt += `\n\n【图片识别】\n${toolResult.data.imageDescription}`;
    }
    if (toolResult.data.knowledgeBase) {
      enhancedPrompt += `\n\n【知识库参考】\n${toolResult.data.knowledgeBase}\n\n请优先基于知识库内容回答。`;
    }
    if (toolResult.data.webSearch) {
      enhancedPrompt += `\n\n【网络搜索结果】\n${toolResult.data.webSearch}\n\n请参考搜索结果回答。`;
    }
    enhancedPrompt += `\n\n请基于以上信息，结合你的专业知识，给出专业建议。`;
  } else {
    console.log('[MedicineInfo] No tool results, using pure LLM');
  }

  // 步骤 3: LLM 生成回答
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

  emitter.emit('message:content', createMessageContentEvent(
    conversationId,
    messageId,
    '',
    chunkIndex,
    false,
    true
  ));

  console.log('💊 Medicine info completed');

  emitter.emit('message:metadata', createMessageMetadataEvent(
    conversationId,
    messageId,
    undefined,
    [
      { type: 'consult_pharmacist', label: '咨询药剂师', data: { action: 'consult' } },
    ],
    {
      toolsUsed: toolResult.toolsUsed,
    }
  ));

  return {
    branchResult: fullContent,
    messageId,
  };
}
```

**Step 2: 验证编译**

```bash
pnpm build
```

**Step 3: 提交改造**

```bash
git add src/agent/nodes/medicineInfo.ts
git commit -m "feat(agent): 集成工具编排器到药品查询节点"
```

---

### Task 4.3: 改造 consultation 节点

**文件**:
- Modify: `backend/src/agent/nodes/consultation.ts`

**Step 1: 集成工具编排器到 consultation**

类似的方式改造 `consultation.ts`：

```typescript
import { AgentState } from "../state";
import { createZhipuLLM } from "../../utils/llm";
import {
  createMessageContentEvent,
  createMessageMetadataEvent,
} from "../events/chat-event-types";
import { orchestrateTools } from "../../services/tools/toolOrchestrator";  // 新增

const llm = createZhipuLLM(0.7);

const CONSULTATION_PROMPT = `你是一位专业的医疗健康顾问。用户咨询医疗健康相关问题，请提供专业、准确的解答。

用户问题: {query}

请提供：
1. 清晰准确的回答
2. 相关的医学知识
3. 必要的健康建议

注意：
- 信息准确、专业
- 通俗易懂
- 必要时建议就医`;

export async function consultation(state: typeof AgentState.State) {
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
    eventEmitter: emitter,
  });

  // 步骤 2: 构建增强的 Prompt
  let enhancedPrompt = CONSULTATION_PROMPT.replace('{query}', userQuery);
  
  if (toolResult.success && toolResult.data) {
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
    console.log('[Consultation] No tool results, using pure LLM');
  }

  // 步骤 3: LLM 生成回答
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

  emitter.emit('message:content', createMessageContentEvent(
    conversationId,
    messageId,
    '',
    chunkIndex,
    false,
    true
  ));

  console.log('💬 Consultation completed');

  emitter.emit('message:metadata', createMessageMetadataEvent(
    conversationId,
    messageId,
    undefined,
    [
      { type: 'transfer_to_doctor', label: '咨询人工医生', data: { action: 'transfer' } },
    ],
    {
      toolsUsed: toolResult.toolsUsed,
    }
  ));

  return {
    branchResult: fullContent,
    messageId,
  };
}
```

**Step 2: 验证编译**

```bash
pnpm build
```

**Step 3: 提交改造**

```bash
git add src/agent/nodes/consultation.ts
git commit -m "feat(agent): 集成工具编排器到通用问答节点"
```

---

### Task 4.4: 改造 hospitalRecommend 节点（仅知识库和搜索）

**文件**:
- Modify: `backend/src/agent/nodes/hospitalRecommend.ts`

**Step 1: 集成工具编排器到 hospitalRecommend（不识别图片）**

```typescript
import { AgentState } from "../state";
import { createZhipuLLM } from "../../utils/llm";
import {
  createMessageContentEvent,
  createMessageMetadataEvent,
} from "../events/chat-event-types";
import { orchestrateTools } from "../../services/tools/toolOrchestrator";  // 新增

const llm = createZhipuLLM(0.7);

const HOSPITAL_PROMPT = `你是一位专业的医疗导诊助手。用户咨询医院推荐，请提供专业建议。

用户需求: {query}

请提供：
1. 推荐的医院及科室
2. 推荐理由
3. 就医建议

注意：
- 信息准确
- 考虑地理位置
- 提供实用建议`;

export async function hospitalRecommend(state: typeof AgentState.State) {
  const emitter = state.eventEmitter;
  const { conversationId, messages, userIntent } = state;
  const lastMessage = messages[messages.length - 1];
  const userQuery = lastMessage.content;
  const messageId = state.messageId || `msg_${Date.now()}`;

  // 步骤 1: 尝试使用工具增强（不识别图片）
  const toolResult = await orchestrateTools({
    query: userQuery,
    intent: userIntent!,
    // 注意：hospitalRecommend 不传递 imageUrls
    conversationId,
    messageId,
    eventEmitter: emitter,
  });

  // 步骤 2: 构建增强的 Prompt
  let enhancedPrompt = HOSPITAL_PROMPT.replace('{query}', userQuery);
  
  if (toolResult.success && toolResult.data) {
    if (toolResult.data.knowledgeBase) {
      enhancedPrompt += `\n\n【知识库参考】\n${toolResult.data.knowledgeBase}\n\n请优先基于知识库内容回答。`;
    }
    if (toolResult.data.webSearch) {
      enhancedPrompt += `\n\n【网络搜索结果】\n${toolResult.data.webSearch}\n\n请参考搜索结果回答。`;
    }
    enhancedPrompt += `\n\n请基于以上信息，结合你的专业知识，给出专业建议。`;
  } else {
    console.log('[HospitalRecommend] No tool results, using pure LLM');
  }

  // 步骤 3: LLM 生成回答
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

  emitter.emit('message:content', createMessageContentEvent(
    conversationId,
    messageId,
    '',
    chunkIndex,
    false,
    true
  ));

  console.log('🏥 Hospital recommend completed');

  emitter.emit('message:metadata', createMessageMetadataEvent(
    conversationId,
    messageId,
    undefined,
    [
      { type: 'book_appointment', label: '预约挂号', data: { action: 'booking' } },
    ],
    {
      toolsUsed: toolResult.toolsUsed,
    }
  ));

  return {
    branchResult: fullContent,
    messageId,
  };
}
```

**Step 2: 验证编译**

```bash
pnpm build
```

**Step 3: 提交改造**

```bash
git add src/agent/nodes/hospitalRecommend.ts
git commit -m "feat(agent): 集成工具编排器到医院推荐节点"
```

---

## 阶段 5: 环境变量和配置

### Task 5.1: 更新 .env.example

**文件**:
- Modify: `backend/.env.example`

**Step 1: 添加新的环境变量**

在 `.env.example` 中添加新配置：

```bash
# 现有配置...

# Supabase Storage
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Coze 知识库
COZE_API_KEY=your-coze-api-key
COZE_BASE_URL=https://api.coze.cn
COZE_WORKFLOW_ID=your-workflow-id

# Tavily 搜索
TAVILY_API_KEY=your-tavily-api-key
```

**Step 2: 提交配置**

```bash
git add .env.example
git commit -m "docs(env): 添加新工具服务的环境变量配置"
```

---

## 阶段 6: 集成测试

### Task 6.1: 创建 E2E 测试

**文件**:
- Create: `backend/src/__tests__/e2e/aiChatWithTools.test.ts`

**Step 1: 创建完整的 E2E 测试**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopTestServer, createTestApiClient } from './helpers/testSetup';
import type { TestApiClient } from './helpers/testApiClient';

describe('AI Chat with Tools E2E', () => {
  let apiClient: TestApiClient;

  beforeAll(async () => {
    await startTestServer();
    apiClient = createTestApiClient();
  });

  afterAll(async () => {
    await stopTestServer();
  });

  it('应该成功处理带图片的症状咨询', async () => {
    const conversationId = `test-conv-${Date.now()}`;
    
    // 模拟图片 URL（实际测试中可以上传真实图片）
    const imageUrl = 'https://example.com/test-symptom.jpg';

    const messages: any[] = [];
    
    const response = await apiClient.sendAIChatMessage({
      conversationId,
      message: {
        role: 'user',
        content: '我的手臂有这样的症状，是什么原因？',
        imageUrls: [imageUrl],
      },
    });

    // 收集事件
    response.on('tool:call', (event: any) => {
      messages.push(event);
    });

    response.on('message:content', (event: any) => {
      messages.push(event);
    });

    await response.waitForComplete();

    // 验证工具调用事件
    const toolEvents = messages.filter(m => m.type === 'tool:call');
    expect(toolEvents.length).toBeGreaterThan(0);

    // 验证内容事件
    const contentEvents = messages.filter(m => m.type === 'message:content');
    expect(contentEvents.length).toBeGreaterThan(0);

    const fullContent = contentEvents
      .filter((e: any) => !e.data.isEnd)
      .map((e: any) => e.data.delta)
      .join('');

    expect(fullContent.length).toBeGreaterThan(0);
  }, 60000);

  it('应该在工具失败时降级到纯 LLM', async () => {
    const conversationId = `test-conv-${Date.now()}`;
    
    // 发送一个可能触发工具但工具可能失败的问题
    const response = await apiClient.sendAIChatMessage({
      conversationId,
      message: {
        role: 'user',
        content: '什么是高血压？',
      },
    });

    const messages: any[] = [];
    response.on('message:content', (event: any) => {
      messages.push(event);
    });

    await response.waitForComplete();

    // 即使工具失败，也应该有回答
    const contentEvents = messages.filter(m => m.type === 'message:content');
    expect(contentEvents.length).toBeGreaterThan(0);
  }, 60000);
});
```

**Step 2: 运行 E2E 测试**

```bash
pnpm test src/__tests__/e2e/aiChatWithTools.test.ts
```

预期: 测试可能部分通过（取决于 API keys 配置）

**Step 3: 提交测试**

```bash
git add src/__tests__/e2e/aiChatWithTools.test.ts
git commit -m "test(e2e): 添加带工具的 AI 对话 E2E 测试"
```

---

## 阶段 7: 文档和收尾

### Task 7.1: 更新 README

**文件**:
- Modify: `backend/README.md`

**Step 1: 添加工具升级相关文档**

在 README 中添加新功能说明：

```markdown
## 新增功能：AI Agent 工具增强

### 多模态支持

Agent 现在支持处理用户上传的医疗图片：
- 症状图片识别
- 药品包装识别
- 医疗报告识别

### 知识库集成

集成 Coze 医疗知识库，提供更准确的医疗知识：
- 自动查询相关知识
- 优先使用知识库内容回答

### 网络搜索

支持实时搜索最新医疗信息：
- 知识库无结果时自动降级
- 搜索结果智能摘要

### 配置要求

需要以下环境变量：

```bash
# Supabase Storage
SUPABASE_URL=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Coze 知识库
COZE_API_KEY=xxx
COZE_WORKFLOW_ID=xxx

# Tavily 搜索
TAVILY_API_KEY=xxx
```

### 工具调用流程

1. 图片识别（如有图片）
2. 知识库查询
3. 网络搜索（降级）
4. 纯 LLM 回答（兜底）
```

**Step 2: 提交文档**

```bash
git add README.md
git commit -m "docs: 更新 README 添加工具升级说明"
```

---

### Task 7.2: 运行完整测试套件

**Step 1: 运行所有测试**

```bash
cd /Users/cong/chenzhicong/project/xiaohe-ai-doctor/.worktrees/agent-tools-upgrade/backend
pnpm test:run
```

**Step 2: 检查测试结果**

确认：
- 新增的工具服务测试全部通过
- 没有引入新的测试失败
- 现有测试保持稳定

**Step 3: 生成测试报告**

```bash
pnpm test:coverage
```

---

### Task 7.3: 最终代码审查

**Step 1: 检查代码质量**

```bash
# 编译检查
pnpm build

# 类型检查
pnpm tsc --noEmit
```

**Step 2: 检查 lint**

```bash
# 如果项目有 lint 配置
pnpm lint
```

**Step 3: 最终提交**

```bash
git add -A
git commit -m "chore: 代码质量检查和优化"
```

---

## 执行后检查清单

完成所有任务后，请验证：

### 功能验证
- [ ] 图片上传到 Supabase 成功
- [ ] 多模态识别正常工作
- [ ] 知识库查询返回正确结果
- [ ] 网络搜索正常工作
- [ ] 工具降级机制正常
- [ ] 所有节点正常响应

### 测试验证
- [ ] 所有新增测试通过
- [ ] 没有引入新的测试失败
- [ ] E2E 测试覆盖主要场景

### 代码质量
- [ ] 编译无错误
- [ ] 类型检查通过
- [ ] 代码风格一致

### 文档
- [ ] README 更新
- [ ] 环境变量文档完整
- [ ] 设计文档存档

---

## 执行选项

**计划已保存到**: `docs/plans/2026-01-27-agent-tools-upgrade-implementation.md`

**两种执行方式**:

1. **Subagent-Driven (当前会话)** - 由我逐任务调度子代理，任务间进行审查，快速迭代
2. **Parallel Session (独立会话)** - 在新会话中使用 executing-plans，批量执行并设置检查点

**您选择哪种方式？**
