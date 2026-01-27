# AI 聊天图片上传功能实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 AI 聊天添加图片上传和多模态交互能力，支持图片识别、工具反馈展示和混合消息渲染。

**Architecture:** 前端添加图片上传组件和预览管理，修改 SSE 客户端为 POST 请求传递图片 URL，后端调整路由接收 imageUrls 参数并传递给已有的 Agent 工具流程，前端渲染层支持图片+文字混合展示和工具调用卡片。

**Tech Stack:** React + TypeScript + XState + SSE (POST) + react-hot-toast + Vitest + Supabase Storage

---

## 阶段 1：后端路由和参数改造

### Task 1.1: 修改 AI 聊天路由为 POST

**Files:**
- Modify: `backend/src/routes/aiChat.ts:10`

**Step 1: 修改路由方法**

将路由从 GET 改为 POST：

```typescript
/**
 * POST /api/ai-chat/stream
 * Stream chat endpoint using SSE (changed from GET to POST)
 */
router.post('/stream', (req, res) => {
  aiChatController.streamChat(req, res);
});
```

**Step 2: 验证路由注册**

确认路由文件没有语法错误：

Run: `cd backend && pnpm run build`
Expected: 编译成功，无错误

**Step 3: Commit**

```bash
git add backend/src/routes/aiChat.ts
git commit -m "refactor(api): 修改 AI 聊天路由为 POST 方法"
```

---

### Task 1.2: 修改 Controller 接收 POST body 参数

**Files:**
- Modify: `backend/src/controllers/aiChatController.ts:37-88`

**Step 1: 修改参数读取逻辑**

替换 `streamChat` 方法中的参数读取部分：

```typescript
async streamChat(req: Request, res: Response): Promise<void> {
  // 从 body 读取参数（改造前从 query 读取）
  const { message, conversationId, imageUrls } = req.body;

  // 验证 message
  if (!message || typeof message !== 'string') {
    throw new ValidationError('Message is required and must be a string');
  }

  // 验证 message 长度
  if (message.length > 5000) {
    throw new ValidationError('Message must not exceed 5000 characters');
  }

  // 验证 imageUrls（可选参数）
  if (imageUrls !== undefined) {
    if (!Array.isArray(imageUrls)) {
      throw new ValidationError('imageUrls must be an array');
    }

    if (imageUrls.length > 1) {
      throw new ValidationError('Currently only 1 image is supported');
    }

    // 验证每个 URL 格式
    for (const url of imageUrls) {
      if (typeof url !== 'string' || !url.startsWith('http')) {
        throw new ValidationError('Invalid image URL format');
      }
    }
  }

  const conversationIdStr = conversationId || `conv_${Date.now()}`;

  logger.info('Stream chat request received', { 
    conversationId: conversationIdStr, 
    messageLength: message.length,
    imageCount: imageUrls?.length || 0,
  });

  // 创建 session-specific event emitter
  const sessionEmitter = new AgentEventEmitter();

  // Forward session events to global emitter
  const eventForwarder = (event: any) => {
    const eventWithConversationId = {
      ...event,
      data: {
        ...event.data,
        conversationId: conversationIdStr,
      },
    };
    this.globalEmitter.emit(event.type, eventWithConversationId);
  };
  sessionEmitter.on('*', eventForwarder);

  try {
    // Handle SSE connection
    this.sseHandler.handleConnection(req, res, conversationIdStr);

    // 构建消息（包含 imageUrls）
    const messages: Message[] = [
      { 
        role: 'user', 
        content: message,
        imageUrls,  // 传递给 Agent
      }
    ];

    logger.agent('Starting agent execution', { conversationId: conversationIdStr });

    // Run agent with session emitter
    await runAgent({
      messages,
      conversationId: conversationIdStr,
      eventEmitter: sessionEmitter,
    });

    logger.agent('Agent execution completed', { conversationId: conversationIdStr });

  } catch (error: any) {
    logger.error('Agent execution failed', error, { conversationId: conversationIdStr });

    const isLLMError = error instanceof LLMError ||
                       error.name === 'LLMError' ||
                       error.code === 'LLM_ERROR';

    if (isLLMError) {
      throw new LLMError(error.message || 'LLM service error', error);
    }

    const errorData = {
      type: 'agent:error',
      data: {
        error: error.message || 'Unknown error',
        code: 'AGENT_ERROR',
        timestamp: new Date().toISOString(),
        conversationId: conversationIdStr,
      },
    };

    this.sseHandler.sendToConversation(conversationIdStr, {
      type: 'error',
      data: errorData.data,
    });

    this.globalEmitter.emit('agent:error', errorData);
  } finally {
    // Cleanup session emitter
    sessionEmitter.removeListener('*', eventForwarder);
  }
}
```

**Step 2: 验证编译**

Run: `cd backend && pnpm run build`
Expected: 编译成功，无 TypeScript 错误

**Step 3: Commit**

```bash
git add backend/src/controllers/aiChatController.ts
git commit -m "feat(controller): 支持接收 imageUrls 参数并传递给 Agent"
```

---

### Task 1.3: 添加后端集成测试

**Files:**
- Create: `backend/src/routes/__tests__/aiChat.integration.test.ts`

**Step 1: 创建测试文件**

```typescript
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import aiChatRouter from '../aiChat';
import { errorHandler } from '../../middleware/errorHandler';

// Mock dependencies
vi.mock('../../agent', () => ({
  runAgent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/streaming/SSEHandler', () => ({
  SSEHandler: {
    getInstance: vi.fn(() => ({
      handleConnection: vi.fn(),
      sendToConversation: vi.fn(),
      closeAllConnections: vi.fn(),
      startEventListener: vi.fn(),
    })),
  },
}));

vi.mock('../../services/database/MessageWriter', () => ({
  MessageWriter: vi.fn(() => ({
    createConversation: vi.fn(),
    getMessages: vi.fn(),
    stop: vi.fn(),
  })),
}));

const app = express();
app.use(express.json());
app.use('/api/ai-chat', aiChatRouter);
app.use(errorHandler);

describe('POST /api/ai-chat/stream', () => {
  it('应该接受纯文字消息', async () => {
    const response = await request(app)
      .post('/api/ai-chat/stream')
      .send({
        conversationId: 'conv_test',
        message: '我头痛',
      })
      .set('Accept', 'text/event-stream');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
  });

  it('应该接受带图片的消息', async () => {
    const response = await request(app)
      .post('/api/ai-chat/stream')
      .send({
        conversationId: 'conv_test',
        message: '这是什么药？',
        imageUrls: ['https://example.com/medicine.jpg'],
      })
      .set('Accept', 'text/event-stream');

    expect(response.status).toBe(200);
  });

  it('应该接受纯图片消息（无文字）', async () => {
    const response = await request(app)
      .post('/api/ai-chat/stream')
      .send({
        conversationId: 'conv_test',
        message: '',
        imageUrls: ['https://example.com/symptom.jpg'],
      })
      .set('Accept', 'text/event-stream');

    expect(response.status).toBe(200);
  });

  it('应该拒绝缺少 message 的请求', async () => {
    const response = await request(app)
      .post('/api/ai-chat/stream')
      .send({
        conversationId: 'conv_test',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Message is required');
  });

  it('应该拒绝 message 不是字符串的请求', async () => {
    const response = await request(app)
      .post('/api/ai-chat/stream')
      .send({
        conversationId: 'conv_test',
        message: 123,
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('must be a string');
  });

  it('应该拒绝超过 5000 字符的消息', async () => {
    const response = await request(app)
      .post('/api/ai-chat/stream')
      .send({
        message: 'x'.repeat(5001),
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('must not exceed 5000');
  });

  it('应该拒绝超过 1 张的图片', async () => {
    const response = await request(app)
      .post('/api/ai-chat/stream')
      .send({
        message: 'test',
        imageUrls: [
          'https://example.com/img1.jpg',
          'https://example.com/img2.jpg',
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('only 1 image');
  });

  it('应该拒绝无效的图片 URL 格式', async () => {
    const response = await request(app)
      .post('/api/ai-chat/stream')
      .send({
        message: 'test',
        imageUrls: ['invalid-url'],
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Invalid image URL');
  });

  it('应该拒绝 imageUrls 不是数组的请求', async () => {
    const response = await request(app)
      .post('/api/ai-chat/stream')
      .send({
        message: 'test',
        imageUrls: 'https://example.com/image.jpg',
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('must be an array');
  });
});
```

**Step 2: 运行测试验证通过**

Run: `cd backend && pnpm test src/routes/__tests__/aiChat.integration.test.ts`
Expected: 所有测试通过

**Step 3: Commit**

```bash
git add backend/src/routes/__tests__/aiChat.integration.test.ts
git commit -m "test(api): 添加 POST /api/ai-chat/stream 集成测试"
```

---

## 阶段 2：前端消息协议扩展

### Task 2.1: 扩展前端 Message 接口

**Files:**
- Modify: `frontend/src/machines/chatMachine.ts:5-12`
- Modify: `frontend/src/machines/chatMachine.ts:82-93`

**Step 1: 添加 imageUrls 字段到 Message 接口**

```typescript
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  status: 'pending' | 'sending' | 'streaming' | 'complete' | 'failed';
  imageUrls?: string[];  // 新增：支持图片数组
  medicalAdvice?: MedicalAdvice;
}
```

**Step 2: 扩展 SEND_MESSAGE 事件类型**

在事件类型定义中添加 imageUrls：

```typescript
export type ChatEventType =
  | { type: 'SEND_MESSAGE'; content: string; imageUrls?: string[] }  // 修改：添加 imageUrls
  | { type: 'RETRY' }
  | { type: 'CANCEL' }
  | { type: 'TOOL_CALL'; toolId: string; toolName: string; status: string; input?: Record<string, unknown>; output?: Record<string, unknown>; duration?: number }
  | { type: 'MESSAGE_STATUS'; messageId: string; status: string; role: 'user' | 'assistant' }
  | { type: 'MESSAGE_CONTENT'; messageId: string; delta: string; index: number; isFirst: boolean; isLast: boolean }
  | { type: 'MESSAGE_METADATA'; messageId: string; actions?: MessageAction[]; medicalAdvice?: MedicalAdvice }
  | { type: 'CONVERSATION_STATUS'; status: string; message?: string }
  | { type: 'ERROR'; code: string; message: string }
  | { type: 'DONE' }
  | { type: 'RESET' };
```

**Step 3: 修改 addUserMessage action**

更新 action 以处理 imageUrls：

```typescript
addUserMessage: assign({
  messages: ({ context, event }): Message[] => {
    if (event.type !== 'SEND_MESSAGE') return context.messages;
    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: event.content,
      imageUrls: event.imageUrls,  // 新增：保存图片 URLs
      timestamp: new Date().toISOString(),
      status: 'complete',
    };
    return [...context.messages, newMessage];
  },
}),
```

**Step 4: 验证 TypeScript 编译**

Run: `cd frontend && pnpm run build`
Expected: 编译成功，无类型错误

**Step 5: Commit**

```bash
git add frontend/src/machines/chatMachine.ts
git commit -m "feat(chat): 扩展 Message 接口支持 imageUrls"
```

---

### Task 2.2: 修改 SSE 客户端支持 POST

**Files:**
- Modify: `frontend/src/services/sseClient.ts:6-14`
- Modify: `frontend/src/services/sseClient.ts:30-119`

**Step 1: 扩展 SSEConfig 接口**

```typescript
export interface SSEConfig {
  url: string;
  method?: 'GET' | 'POST';  // 新增，默认 POST
  conversationId: string;
  message?: string;
  imageUrls?: string[];  // 新增
  onEvent?: SSEEventHandler;
  onError?: (error: Error) => void;
  onClose?: () => void;
  onOpen?: () => void;
}
```

**Step 2: 修改 connect 方法支持 POST**

```typescript
async connect(): Promise<void> {
  if (this.isConnected) {
    console.warn('[SSE] Already connected');
    return;
  }

  const { method = 'POST', conversationId, message, imageUrls } = this.config;
  
  let fetchOptions: RequestInit;
  let fetchUrl: string = this.config.url;
  
  if (method === 'POST') {
    // POST 请求：通过 body 传递参数
    fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({
        conversationId,
        message,
        imageUrls,
      }),
      signal: this.abortController.signal,
    };
  } else {
    // GET 请求：兼容旧版（通过 query 参数）
    const url = new URL(this.config.url);
    if (conversationId) {
      url.searchParams.set('conversationId', conversationId);
    }
    if (message) {
      url.searchParams.set('message', message);
    }
    fetchUrl = url.toString();
    
    fetchOptions = {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      signal: this.abortController.signal,
    };
  }

  try {
    const response = await fetch(fetchUrl, fetchOptions);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    this.isConnected = true;
    console.log('[SSE] Connection established');
    this.config.onOpen?.();

    // Parse the SSE stream
    const eventStream = response.body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new EventSourceParserStream());

    const reader = eventStream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('[SSE] Stream ended');
          break;
        }

        if (value) {
          this.handleParsedEvent(value);
        }
      }
    } catch (error) {
      if (this.isManualClose) {
        console.log('[SSE] Connection closed by user');
      } else {
        throw error;
      }
    } finally {
      reader.releaseLock();
    }

  } catch (error) {
    if (this.isManualClose) {
      console.log('[SSE] Connection closed manually');
      return;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      console.log('[SSE] Request aborted');
      return;
    }

    console.error('[SSE] Connection error:', error);
    this.config.onError?.(error instanceof Error ? error : new Error(String(error)));
  } finally {
    this.isConnected = false;
    if (!this.isManualClose) {
      this.config.onClose?.();
    }
  }
}
```

**Step 3: 验证编译**

Run: `cd frontend && pnpm run build`
Expected: 编译成功

**Step 4: Commit**

```bash
git add frontend/src/services/sseClient.ts
git commit -m "feat(sse): 支持 POST 方法和 imageUrls 参数"
```

---

### Task 2.3: 添加 SSE 客户端单元测试

**Files:**
- Modify: `frontend/src/services/__tests__/sseClient.test.ts` (如果存在)
- Create: `frontend/src/services/__tests__/sseClient.test.ts` (如果不存在)

**Step 1: 创建/扩展测试文件**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SSEClient } from '../sseClient';
import { ChatEventType } from '../../machines/chatMachine';

describe('SSEClient POST support', () => {
  let mockFetch: any;
  
  beforeEach(() => {
    // Mock fetch API
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('应该使用 POST 方法发送消息和图片', async () => {
    // Mock successful stream response
    const mockStream = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });
    
    mockFetch.mockResolvedValue({
      ok: true,
      body: mockStream,
    });
    
    const client = new SSEClient({
      url: '/api/ai-chat/stream',
      method: 'POST',
      conversationId: 'conv_123',
      message: 'test message',
      imageUrls: ['https://example.com/image.jpg'],
    });
    
    await client.connect();
    
    expect(mockFetch).toHaveBeenCalledWith('/api/ai-chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({
        conversationId: 'conv_123',
        message: 'test message',
        imageUrls: ['https://example.com/image.jpg'],
      }),
      signal: expect.any(AbortSignal),
    });
  });

  it('应该支持纯文字消息（无 imageUrls）', async () => {
    const mockStream = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });
    
    mockFetch.mockResolvedValue({
      ok: true,
      body: mockStream,
    });
    
    const client = new SSEClient({
      url: '/api/ai-chat/stream',
      method: 'POST',
      conversationId: 'conv_123',
      message: 'test',
    });
    
    await client.connect();
    
    const bodyData = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(bodyData.imageUrls).toBeUndefined();
  });

  it('应该处理 HTTP 错误响应', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
    });
    
    const onError = vi.fn();
    const client = new SSEClient({
      url: '/api/ai-chat/stream',
      method: 'POST',
      conversationId: 'conv_123',
      message: 'test',
      onError,
    });
    
    await client.connect();
    
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('HTTP error'),
      })
    );
  });
});
```

**Step 2: 运行测试**

Run: `cd frontend && pnpm test src/services/__tests__/sseClient.test.ts`
Expected: 所有测试通过

**Step 3: Commit**

```bash
git add frontend/src/services/__tests__/sseClient.test.ts
git commit -m "test(sse): 添加 POST 方法和 imageUrls 测试"
```

---

## 阶段 3：前端图片上传组件

### Task 3.1: 安装前端依赖

**Files:**
- Modify: `frontend/package.json`

**Step 1: 安装 react-hot-toast**

Run: `cd frontend && pnpm add react-hot-toast`
Expected: 安装成功

**Step 2: 配置 Toast Provider**

修改 `frontend/src/main.tsx` 或 `frontend/src/App.tsx`：

```typescript
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <>
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
        }}
      />
      {/* 其他组件 */}
    </>
  );
}
```

**Step 3: 验证编译**

Run: `cd frontend && pnpm run build`
Expected: 编译成功

**Step 4: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/src/App.tsx
git commit -m "deps(frontend): 添加 react-hot-toast 依赖"
```

---

### Task 3.2: 创建 ImageUploader 组件测试（TDD）

**Files:**
- Create: `frontend/src/components/upload/__tests__/ImageUploader.test.tsx`

**Step 1: 编写失败测试**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageUploader } from '../ImageUploader';

describe('ImageUploader', () => {
  let mockOnImageUploaded: any;
  let mockOnImageRemoved: any;
  let mockFetch: any;

  beforeEach(() => {
    mockOnImageUploaded = vi.fn();
    mockOnImageRemoved = vi.fn();
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    
    // Mock localStorage for token
    Storage.prototype.getItem = vi.fn(() => 'mock-token');
  });

  it('应该在选择文件后立即上传', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        data: { url: 'https://example.com/uploaded.jpg', path: 'uploads/test.jpg' },
      }),
    });

    render(<ImageUploader onImageUploaded={mockOnImageUploaded} onImageRemoved={mockOnImageRemoved} />);
    
    const file = new File(['image-content'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText('上传图片') as HTMLInputElement;
    
    await userEvent.upload(input, file);
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/upload/image'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer mock-token',
          }),
          body: expect.any(FormData),
        })
      );
    });
    
    await waitFor(() => {
      expect(mockOnImageUploaded).toHaveBeenCalledWith('https://example.com/uploaded.jpg');
    });
  });

  it('应该显示上传成功后的预览', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { url: 'https://example.com/test.jpg' },
      }),
    });

    render(<ImageUploader onImageUploaded={mockOnImageUploaded} onImageRemoved={mockOnImageRemoved} />);
    
    const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText('上传图片') as HTMLInputElement;
    
    await userEvent.upload(input, file);
    
    await waitFor(() => {
      const preview = screen.getByAltText('预览图片');
      expect(preview).toHaveAttribute('src', 'https://example.com/test.jpg');
    });
  });

  it('应该支持删除已上传的图片', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { url: 'https://example.com/test.jpg' },
      }),
    });

    render(<ImageUploader onImageUploaded={mockOnImageUploaded} onImageRemoved={mockOnImageRemoved} />);
    
    // 上传图片
    const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText('上传图片') as HTMLInputElement;
    await userEvent.upload(input, file);
    
    // 等待预览显示
    await waitFor(() => {
      expect(screen.getByAltText('预览图片')).toBeInTheDocument();
    });
    
    // 点击删除按钮
    const deleteButton = screen.getByLabelText('删除图片');
    await userEvent.click(deleteButton);
    
    expect(mockOnImageRemoved).toHaveBeenCalled();
    expect(screen.queryByAltText('预览图片')).not.toBeInTheDocument();
  });

  it('应该拒绝超过 5MB 的文件', async () => {
    const { container } = render(
      <ImageUploader onImageUploaded={mockOnImageUploaded} onImageRemoved={mockOnImageRemoved} />
    );
    
    // 创建大文件（6MB）
    const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText('上传图片') as HTMLInputElement;
    
    await userEvent.upload(input, largeFile);
    
    // 验证没有调用上传 API
    expect(mockFetch).not.toHaveBeenCalled();
    
    // 验证显示错误提示（通过检查 toast 是否被调用，需要 mock toast）
  });

  it('应该拒绝非图片文件', async () => {
    render(<ImageUploader onImageUploaded={mockOnImageUploaded} onImageRemoved={mockOnImageRemoved} />);
    
    const pdfFile = new File(['pdf-content'], 'document.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText('上传图片') as HTMLInputElement;
    
    await userEvent.upload(input, pdfFile);
    
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('应该处理上传失败', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(<ImageUploader onImageUploaded={mockOnImageUploaded} onImageRemoved={mockOnImageRemoved} />);
    
    const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText('上传图片') as HTMLInputElement;
    
    await userEvent.upload(input, file);
    
    await waitFor(() => {
      expect(mockOnImageUploaded).not.toHaveBeenCalled();
      // 验证预览没有显示
      expect(screen.queryByAltText('预览图片')).not.toBeInTheDocument();
    });
  });

  it('应该在上传中禁用文件选择', async () => {
    // Mock slow upload
    mockFetch.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ data: { url: 'https://example.com/test.jpg' } }),
      }), 1000))
    );

    render(<ImageUploader onImageUploaded={mockOnImageUploaded} onImageRemoved={mockOnImageRemoved} />);
    
    const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText('上传图片') as HTMLInputElement;
    
    await userEvent.upload(input, file);
    
    // 验证按钮被禁用
    const uploadButton = screen.getByRole('button', { name: /上传/i });
    expect(uploadButton).toBeDisabled();
  });
});
```

**Step 2: 运行测试验证失败**

Run: `cd frontend && pnpm test src/components/upload/__tests__/ImageUploader.test.tsx`
Expected: 所有测试失败（组件尚未实现）

**Step 3: Commit**

```bash
git add frontend/src/components/upload/__tests__/ImageUploader.test.tsx
git commit -m "test(upload): 添加 ImageUploader 组件测试（TDD-RED）"
```

---

### Task 3.3: 实现 ImageUploader 组件

**Files:**
- Create: `frontend/src/components/upload/ImageUploader.tsx`

**Step 1: 创建组件实现**

```typescript
import React, { useState, useRef } from 'react';
import { X, Upload, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface ImageUploaderProps {
  onImageUploaded: (url: string) => void;
  onImageRemoved: () => void;
  disabled?: boolean;
}

interface UploadState {
  uploading: boolean;
  progress: number;
  imageUrl: string | null;
  error: string | null;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageUploaded,
  onImageRemoved,
  disabled = false,
}) => {
  const [state, setState] = useState<UploadState>({
    uploading: false,
    progress: 0,
    imageUrl: null,
    error: null,
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('仅支持 JPG、PNG、GIF、WebP 格式');
      return;
    }

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      toast.error('图片不能超过 5MB');
      return;
    }

    // 开始上传
    setState({ uploading: true, progress: 0, imageUrl: null, error: null });
    
    try {
      await uploadImage(file);
    } catch (error) {
      console.error('Upload error:', error);
      setState({ uploading: false, progress: 0, imageUrl: null, error: String(error) });
      toast.error('图片上传失败，请重试');
    }
    
    // 重置 input value，允许重新选择相同文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (file: File): Promise<void> => {
    const formData = new FormData();
    formData.append('file', file);

    // 获取 token
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('未登录，请先登录');
    }

    // 创建 AbortController 用于取消上传
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`${API_BASE_URL}/api/upload/image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (result.code !== 0) {
        throw new Error(result.message || 'Upload failed');
      }

      const imageUrl = result.data.url;
      
      setState({
        uploading: false,
        progress: 100,
        imageUrl,
        error: null,
      });
      
      onImageUploaded(imageUrl);
      toast.success('图片上传成功');
      
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Upload cancelled');
        return;
      }
      throw error;
    }
  };

  const handleRemove = () => {
    // 如果正在上传，取消请求
    if (state.uploading && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setState({
      uploading: false,
      progress: 0,
      imageUrl: null,
      error: null,
    });
    
    onImageRemoved();
  };

  const handleClick = () => {
    if (disabled || state.uploading) return;
    fileInputRef.current?.click();
  };

  // 如果已有图片，显示预览
  if (state.imageUrl) {
    return (
      <div className="mb-2 relative inline-block">
        <img
          src={state.imageUrl}
          alt="预览图片"
          className="w-[120px] h-[120px] object-cover rounded-lg border-2 border-slate-200 dark:border-slate-700"
        />
        <button
          onClick={handleRemove}
          aria-label="删除图片"
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // 上传中，显示进度
  if (state.uploading) {
    return (
      <div className="mb-2 w-[120px] h-[120px] bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <span className="text-xs text-slate-500">上传中...</span>
        </div>
      </div>
    );
  }

  // 未选择文件，显示上传按钮
  return (
    <div className="inline-block">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
        aria-label="上传图片"
      />
      <button
        onClick={handleClick}
        disabled={disabled}
        aria-label="选择图片"
        className="w-[120px] h-[120px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Upload className="w-8 h-8 text-slate-400" />
        <span className="text-xs text-slate-500">上传图片</span>
      </button>
    </div>
  );
};
```

**Step 2: 运行测试验证通过**

Run: `cd frontend && pnpm test src/components/upload/__tests__/ImageUploader.test.tsx`
Expected: 所有测试通过

**Step 3: Commit**

```bash
git add frontend/src/components/upload/ImageUploader.tsx
git commit -m "feat(upload): 实现 ImageUploader 组件（TDD-GREEN）"
```

---

### Task 3.4: 集成 ImageUploader 到 Chat 页面

**Files:**
- Modify: `frontend/src/pages/Chat.tsx:1-13` (imports)
- Modify: `frontend/src/pages/Chat.tsx:29-35` (state)
- Modify: `frontend/src/pages/Chat.tsx:46-97` (handleSendMessage)
- Modify: `frontend/src/pages/Chat.tsx:196-257` (footer UI)

**Step 1: 添加导入**

```typescript
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useMachine } from '@xstate/react';
import { 
  Send, 
  Mic, 
  PlusCircle, 
  ChevronLeft, 
  History, 
  Thermometer, 
  Brain, 
  Stethoscope, 
  Activity,
  Image as ImageIcon,  // 新增：图片图标
} from 'lucide-react';
import { chatMachine, ChatEventType } from '../machines/chatMachine';
import { MessagesList, SystemMessage } from '../components/message/MessageRenderer';
import { sseClientManager } from '../services/sseClient';
import { ImageUploader } from '../components/upload/ImageUploader';  // 新增
import toast from 'react-hot-toast';  // 新增
```

**Step 2: 添加图片上传状态**

```typescript
export const ChatPage: React.FC = () => {
  const [state, send] = useMachine(chatMachine);
  const [inputValue, setInputValue] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [_isSSEConnected, setIsSSEConnected] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);  // 新增
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isConnectingRef = useRef(false);
  
  // ... 其余代码
```

**Step 3: 修改发送消息逻辑**

```typescript
const handleSendMessage = useCallback(async (content?: string) => {
  const messageContent = (content || inputValue).trim();
  const imageUrls = uploadedImageUrl ? [uploadedImageUrl] : undefined;
  
  // 验证：至少有文字或图片
  if (!messageContent && !imageUrls) {
    toast.error('请输入消息或上传图片');
    return;
  }
  
  if (state.matches('streaming') || isConnectingRef.current) return;

  const newConversationId = conversationId || `conv_${Date.now()}`;
  setConversationId(newConversationId);
  isConnectingRef.current = true;

  // Send to XState（包含 imageUrls）
  send({ 
    type: 'SEND_MESSAGE', 
    content: messageContent,
    imageUrls,  // 新增
  });

  // Clean up previous connection
  const previousClient = sseClientManager.getClient(conversationId || '');
  if (previousClient) {
    previousClient.close();
  }

  // Create SSE client（改为 POST）
  const client = sseClientManager.createClient({
    url: `${API_BASE_URL}/api/ai-chat/stream`,
    method: 'POST',  // 新增
    conversationId: newConversationId,
    message: messageContent,
    imageUrls,  // 新增
    onEvent: (event: ChatEventType) => {
      send(event);
    },
    onError: (error) => {
      console.error('SSE Error:', error);
      isConnectingRef.current = false;
      send({ type: 'ERROR', code: 'SSE_ERROR', message: 'Connection error' });
    },
    onOpen: () => {
      setIsSSEConnected(true);
      isConnectingRef.current = false;
      console.log('SSE Connected');
    },
    onClose: () => {
      setIsSSEConnected(false);
      isConnectingRef.current = false;
      console.log('SSE Closed');
    },
  });

  // Connect to SSE
  client.connect().catch((error) => {
    console.error('Failed to connect SSE:', error);
    isConnectingRef.current = false;
    send({ type: 'ERROR', code: 'CONNECT_FAILED', message: 'Failed to connect' });
  });

  // 清空状态
  setInputValue('');
  setUploadedImageUrl(null);  // 新增：清空图片
}, [inputValue, uploadedImageUrl, conversationId, state.matches, send]);
```

**Step 4: 修改 footer 区域添加图片预览**

```typescript
{/* Footer / Input Area */}
<div className="bg-white dark:bg-[#1a2c35] border-t border-slate-100 dark:border-slate-800 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
  
  {/* 图片预览区域（新增） */}
  {uploadedImageUrl && (
    <div className="px-4 pt-3">
      <ImageUploader
        onImageUploaded={setUploadedImageUrl}
        onImageRemoved={() => setUploadedImageUrl(null)}
        disabled={state.matches('streaming') || isConnectingRef.current}
      />
    </div>
  )}
  
  {/* Quick Replies (Chips) */}
  {state.context.messages.length === 0 && !uploadedImageUrl && (
    <div className="pt-3 pb-1">
      <div className="flex gap-2 px-4 overflow-x-auto no-scrollbar mask-gradient-right">
        {QUICK_REPLIES.map((reply, index) => (
          <button
            key={index}
            onClick={() => setInputValue(reply.label)}
            className="flex h-9 shrink-0 items-center justify-center gap-x-1.5 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-blue-50 dark:hover:bg-slate-600 active:bg-blue-100 border border-transparent hover:border-primary/30 transition-all px-4 group whitespace-nowrap"
          >
            <reply.icon className={`w-[18px] h-[18px] ${reply.color}`} />
            <span className="text-slate-700 dark:text-slate-200 text-sm font-medium">{reply.label}</span>
          </button>
        ))}
      </div>
    </div>
  )}

  {/* Input Row */}
  <div className="flex items-end gap-2 p-3 pb-3">
    {/* Voice Input Button */}
    <button 
      aria-label="Voice Input" 
      className="flex items-center justify-center shrink-0 w-11 h-11 rounded-full text-slate-500 hover:text-primary hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-all active:scale-95"
      disabled={state.matches('streaming') || isConnectingRef.current}
    >
      <Mic className="w-6 h-6" />
    </button>

    {/* Text Input */}
    <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-[20px] min-h-[44px] flex items-center px-4 py-2 border border-transparent focus-within:border-primary/50 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
      <input
        className="w-full bg-transparent border-none p-0 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-0 text-[16px]"
        placeholder="请描述您的症状..."
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={state.matches('streaming') || isConnectingRef.current}
      />
    </div>

    {/* Action Button (Upload, Send) */}
    {!uploadedImageUrl ? (
      // 未上传图片：显示上传按钮
      <button 
        aria-label="上传图片"
        onClick={() => fileInputRef.current?.click()}
        disabled={state.matches('streaming') || isConnectingRef.current}
        className="flex items-center justify-center shrink-0 w-11 h-11 rounded-full text-slate-500 hover:text-primary hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
      >
        <ImageIcon className="w-6 h-6" />
      </button>
    ) : (
      // 已上传图片：显示发送按钮
      <button 
        aria-label="发送消息"
        onClick={() => handleSendMessage()}
        disabled={state.matches('streaming') || isConnectingRef.current}
        className="flex items-center justify-center shrink-0 w-11 h-11 rounded-full text-white bg-primary hover:bg-primary-dark shadow-md transition-all active:scale-95 disabled:opacity-50"
      >
        <Send className="w-5 h-5 ml-0.5" />
      </button>
    )}
    
    {/* 如果有输入文字，也显示发送按钮 */}
    {inputValue && !uploadedImageUrl && (
      <button 
        aria-label="发送消息"
        onClick={() => handleSendMessage()}
        disabled={state.matches('streaming') || isConnectingRef.current}
        className="flex items-center justify-center shrink-0 w-11 h-11 rounded-full text-white bg-primary hover:bg-primary-dark shadow-md transition-all active:scale-95 disabled:opacity-50"
      >
        <Send className="w-5 h-5 ml-0.5" />
      </button>
    )}
    
    {/* 隐藏的文件输入 */}
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      onChange={handleFileSelect}
      className="hidden"
      disabled={disabled}
      aria-label="上传图片"
    />
  </div>
</div>
```

等等，我发现这个设计有问题。上传按钮和预览应该分离。让我重新设计：

**更好的实现**：ImageUploader 作为独立组件，在 Chat.tsx 中调用：

```typescript
{/* Footer / Input Area */}
<div className="bg-white dark:bg-[#1a2c35] border-t border-slate-100 dark:border-slate-800 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
  
  {/* 图片预览区域 */}
  {uploadedImageUrl && (
    <div className="px-4 pt-3 pb-2">
      <div className="relative inline-block">
        <img
          src={uploadedImageUrl}
          alt="预览图片"
          className="w-[120px] h-[120px] object-cover rounded-lg border-2 border-slate-200 dark:border-slate-700"
        />
        <button
          onClick={() => {
            setUploadedImageUrl(null);
            toast.success('图片已移除');
          }}
          aria-label="删除图片"
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )}
  
  {/* Quick Replies */}
  {state.context.messages.length === 0 && !uploadedImageUrl && (
    <div className="pt-3 pb-1">
      {/* ... 现有快捷回复 ... */}
    </div>
  )}

  {/* Input Row */}
  <div className="flex items-end gap-2 p-3 pb-3">
    <button 
      aria-label="Voice Input" 
      className="flex items-center justify-center shrink-0 w-11 h-11 rounded-full text-slate-500 hover:text-primary hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-all active:scale-95"
      disabled={state.matches('streaming') || isConnectingRef.current}
    >
      <Mic className="w-6 h-6" />
    </button>

    <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-[20px] min-h-[44px] flex items-center px-4 py-2 border border-transparent focus-within:border-primary/50 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
      <input
        className="w-full bg-transparent border-none p-0 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:ring-0 text-[16px]"
        placeholder={uploadedImageUrl ? "描述图片或直接发送..." : "请描述您的症状..."}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={state.matches('streaming') || isConnectingRef.current}
      />
    </div>

    {/* 上传图片按钮（无图片时显示） */}
    {!uploadedImageUrl && !inputValue && (
      <ImageUploader
        onImageUploaded={setUploadedImageUrl}
        onImageRemoved={() => setUploadedImageUrl(null)}
        disabled={state.matches('streaming') || isConnectingRef.current}
      />
    )}
    
    {/* 发送按钮（有内容时显示） */}
    {(inputValue || uploadedImageUrl) && (
      <button 
        aria-label="发送消息"
        onClick={() => handleSendMessage()}
        disabled={state.matches('streaming') || isConnectingRef.current}
        className="flex items-center justify-center shrink-0 w-11 h-11 rounded-full text-white bg-primary hover:bg-primary-dark shadow-md transition-all active:scale-95 disabled:opacity-50"
      >
        <Send className="w-5 h-5 ml-0.5" />
      </button>
    )}
  </div>
</div>
```

重新思考：ImageUploader 应该只是一个触发上传的按钮，预览逻辑应该在 Chat.tsx 中。让我调整设计。

**最终方案**：ImageUploader 简化为上传按钮 + 上传逻辑，预览在 Chat.tsx 中独立管理。

修改后的 ImageUploader：

```typescript
interface ImageUploaderProps {
  onImageUploaded: (url: string) => void;
  disabled?: boolean;
  children?: React.ReactNode;  // 允许自定义按钮内容
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageUploaded,
  disabled = false,
  children,
}) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('仅支持 JPG、PNG、GIF、WebP 格式');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('图片不能超过 5MB');
      return;
    }

    setUploading(true);
    
    try {
      const imageUrl = await uploadImage(file);
      onImageUploaded(imageUrl);
      toast.success('图片上传成功');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('图片上传失败，请重试');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('未登录，请先登录');
    }

    abortControllerRef.current = new AbortController();

    const response = await fetch(`${API_BASE_URL}/api/upload/image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
      signal: abortControllerRef.current.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Upload failed' }));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    const result = await response.json();
    
    if (result.code !== 0) {
      throw new Error(result.message || 'Upload failed');
    }

    return result.data.url;
  };

  const handleClick = () => {
    if (disabled || uploading) return;
    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
        aria-label="上传图片"
      />
      
      {children ? (
        <div onClick={handleClick}>
          {children}
        </div>
      ) : (
        <button
          onClick={handleClick}
          disabled={disabled || uploading}
          aria-label="选择图片"
          className="flex items-center justify-center shrink-0 w-11 h-11 rounded-full text-slate-500 hover:text-primary hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-all active:scale-95 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <ImageIcon className="w-6 h-6" />
          )}
        </button>
      )}
    </>
  );
};
```

Chat.tsx 的完整集成：

```typescript
const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

// 在 footer 中：

{/* 图片预览 */}
{uploadedImageUrl && (
  <div className="px-4 pt-3 pb-2">
    <div className="relative inline-block">
      <img
        src={uploadedImageUrl}
        alt="预览图片"
        className="w-[120px] h-[120px] object-cover rounded-lg border-2 border-slate-200 dark:border-slate-700"
      />
      <button
        onClick={() => setUploadedImageUrl(null)}
        aria-label="删除图片"
        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  </div>
)}

{/* Input Row */}
<div className="flex items-end gap-2 p-3 pb-3">
  <button aria-label="Voice Input" className="...">
    <Mic className="w-6 h-6" />
  </button>

  <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-[20px] ...">
    <input
      placeholder={uploadedImageUrl ? "描述图片或直接发送..." : "请描述您的症状..."}
      value={inputValue}
      onChange={(e) => setInputValue(e.target.value)}
      onKeyDown={handleKeyDown}
      disabled={state.matches('streaming') || isConnectingRef.current}
    />
  </div>

  {/* 动态按钮 */}
  {!uploadedImageUrl && !inputValue ? (
    <ImageUploader
      onImageUploaded={setUploadedImageUrl}
      disabled={state.matches('streaming') || isConnectingRef.current}
    />
  ) : (
    <button 
      aria-label="发送消息"
      onClick={() => handleSendMessage()}
      disabled={state.matches('streaming') || isConnectingRef.current}
      className="flex items-center justify-center shrink-0 w-11 h-11 rounded-full text-white bg-primary hover:bg-primary-dark shadow-md transition-all active:scale-95 disabled:opacity-50"
    >
      <Send className="w-5 h-5 ml-0.5" />
    </button>
  )}
</div>
```

**Step 5: 验证编译**

Run: `cd frontend && pnpm run build`
Expected: 编译成功

**Step 6: Commit**

```bash
git add frontend/src/pages/Chat.tsx frontend/src/components/upload/ImageUploader.tsx
git commit -m "feat(chat): 集成图片上传功能到聊天页面"
```

---

## 阶段 4：前端消息渲染增强

### Task 4.1: 创建 ToolCallCard 组件测试（TDD）

**Files:**
- Create: `frontend/src/components/message/__tests__/ToolCallCard.test.tsx`

**Step 1: 编写失败测试**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolCallCard } from '../ToolCallCard';
import { ToolCall } from '../../../machines/chatMachine';

describe('ToolCallCard', () => {
  it('应该显示进行中的工具', () => {
    const tools: ToolCall[] = [
      {
        id: 'tool_1',
        name: 'image_recognition',
        status: 'running',
      },
    ];

    render(<ToolCallCard tools={tools} />);

    expect(screen.getByText(/识别图片/i)).toBeInTheDocument();
    expect(screen.getByText(/进行中|处理中/i)).toBeInTheDocument();
  });

  it('应该显示已完成的工具及耗时', () => {
    const tools: ToolCall[] = [
      {
        id: 'tool_1',
        name: 'image_recognition',
        status: 'completed',
        duration: 1234,
      },
    ];

    render(<ToolCallCard tools={tools} />);

    expect(screen.getByText(/识别图片/i)).toBeInTheDocument();
    expect(screen.getByText(/完成/i)).toBeInTheDocument();
    expect(screen.getByText(/1.2s|1234ms/)).toBeInTheDocument();
  });

  it('应该显示失败的工具', () => {
    const tools: ToolCall[] = [
      {
        id: 'tool_1',
        name: 'knowledge_base',
        status: 'failed',
      },
    ];

    render(<ToolCallCard tools={tools} />);

    expect(screen.getByText(/知识库/i)).toBeInTheDocument();
    expect(screen.getByText(/失败/i)).toBeInTheDocument();
  });

  it('应该同时显示多个工具', () => {
    const tools: ToolCall[] = [
      { id: 'tool_1', name: 'image_recognition', status: 'completed', duration: 1200 },
      { id: 'tool_2', name: 'knowledge_base', status: 'running' },
      { id: 'tool_3', name: 'web_search', status: 'pending' },
    ];

    render(<ToolCallCard tools={tools} />);

    expect(screen.getByText(/识别图片/i)).toBeInTheDocument();
    expect(screen.getByText(/知识库/i)).toBeInTheDocument();
    expect(screen.getByText(/网络搜索/i)).toBeInTheDocument();
  });

  it('工具列表为空时不应该渲染', () => {
    const { container } = render(<ToolCallCard tools={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
```

**Step 2: 运行测试验证失败**

Run: `cd frontend && pnpm test src/components/message/__tests__/ToolCallCard.test.tsx`
Expected: 所有测试失败（组件未实现）

**Step 3: Commit**

```bash
git add frontend/src/components/message/__tests__/ToolCallCard.test.tsx
git commit -m "test(message): 添加 ToolCallCard 组件测试（TDD-RED）"
```

---

### Task 4.2: 实现 ToolCallCard 组件

**Files:**
- Create: `frontend/src/components/message/ToolCallCard.tsx`

**Step 1: 创建组件**

```typescript
import React from 'react';
import { Loader2, CheckCircle, XCircle, ImageIcon, Database, Search } from 'lucide-react';
import { ToolCall } from '../../machines/chatMachine';

interface ToolCallCardProps {
  tools: ToolCall[];
}

const toolConfig: Record<string, { label: string; icon: React.ReactNode }> = {
  'image_recognition': {
    label: '识别图片',
    icon: <ImageIcon className="w-4 h-4" />,
  },
  'knowledge_base': {
    label: '查询知识库',
    icon: <Database className="w-4 h-4" />,
  },
  'web_search': {
    label: '网络搜索',
    icon: <Search className="w-4 h-4" />,
  },
};

const getToolInfo = (name: string) => {
  return toolConfig[name] || { label: name, icon: null };
};

const formatDuration = (ms?: number): string => {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

export const ToolCallCard: React.FC<ToolCallCardProps> = ({ tools }) => {
  if (!tools || tools.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 mb-3 px-1">
      {tools.map((tool) => {
        const toolInfo = getToolInfo(tool.name);
        
        return (
          <div
            key={tool.id}
            className="flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm px-3 py-2 rounded-lg text-sm border border-slate-200/50 dark:border-slate-700/50"
          >
            {/* 工具图标 */}
            <div className="text-slate-600 dark:text-slate-400">
              {toolInfo.icon}
            </div>
            
            {/* 工具名称 */}
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              {toolInfo.label}
            </span>
            
            {/* 状态 */}
            <div className="flex items-center gap-1.5 ml-auto">
              {tool.status === 'pending' && (
                <span className="text-xs text-slate-500">等待中</span>
              )}
              
              {tool.status === 'running' && (
                <>
                  <span className="text-xs text-blue-600 dark:text-blue-400">进行中</span>
                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                </>
              )}
              
              {tool.status === 'completed' && (
                <>
                  <span className="text-xs text-green-600 dark:text-green-400">完成</span>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  {tool.duration && (
                    <span className="text-xs text-slate-500 ml-1">
                      {formatDuration(tool.duration)}
                    </span>
                  )}
                </>
              )}
              
              {tool.status === 'failed' && (
                <>
                  <span className="text-xs text-red-600 dark:text-red-400">失败</span>
                  <XCircle className="w-4 h-4 text-red-500" />
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
```

**Step 2: 运行测试验证通过**

Run: `cd frontend && pnpm test src/components/message/__tests__/ToolCallCard.test.tsx`
Expected: 所有测试通过

**Step 3: Commit**

```bash
git add frontend/src/components/message/ToolCallCard.tsx
git commit -m "feat(message): 实现 ToolCallCard 组件（TDD-GREEN）"
```

---

### Task 4.3: 扩展 MessageRenderer 支持图片渲染

**Files:**
- Modify: `frontend/src/components/message/MessageRenderer.tsx:34-38`
- Modify: `frontend/src/components/message/MessageRenderer.tsx:40-118`
- Modify: `frontend/src/components/message/MessageRenderer.tsx:261-280`

**Step 1: 扩展 TextMessageProps 接口**

```typescript
interface TextMessageProps {
  content: string;
  role: 'user' | 'assistant' | 'system';
  isStreaming?: boolean;
  imageUrls?: string[];  // 新增
}
```

**Step 2: 修改 TextMessage 组件支持图片**

```typescript
export const TextMessage: React.FC<TextMessageProps> = ({ 
  content, 
  role, 
  isStreaming,
  imageUrls,  // 新增
}) => {
  if (role === 'system') {
    return (
      <div className={messageStyles.system.container}>
        <div className={messageStyles.system.bubble}>
          {content}
        </div>
      </div>
    );
  }

  const styles = messageStyles[role];

  return (
    <div className={`${styles.container} mb-6`}>
      {/* Assistant Avatar */}
      {role === 'assistant' && (
        <div className={styles.avatarContainer}>
           <img 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCF1kVXFyF37q3nrI02oGmsRVTY32V4_XBRDIbhjwotETvXN2SYYSvbHK1-QKsrjtU3IFzODgzEz4wCNcZ88VrNw4gmwGKNwCz7ULW1EeppZuX5FWqZrkxsDvxodVjnkMQKZAi8QaQP7iu1oG_T8cwbWYvfQ7tCJ8HAXLP_3fvgB_ZCpCkbJ8yIW0s1Q8bv2Poeg0A98RIJXErD3OLPQFuV3-hOijxEtf-DN9zpxVPf1vwMMmBEB26_cgxXZZrMFn-6hwZfpzNkHMc-" 
            alt="AI Doctor"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement?.classList.add('bg-primary/10');
            }}
           />
           <Bot className="w-6 h-6 text-primary absolute opacity-0" style={{ opacity: 0 }} />
        </div>
      )}

      <div className={styles.wrapper}>
        {role === 'assistant' && (
          <span className={styles.name}>小禾AI医生</span>
        )}
        
        <div className={styles.bubble}>
          {/* 图片（如果有） */}
          {imageUrls && imageUrls.length > 0 && (
            <div className="mb-2">
              <img 
                src={imageUrls[0]} 
                alt="用户上传的图片"
                className="max-w-full rounded-lg border border-slate-200 dark:border-slate-700"
                style={{ maxHeight: '200px', objectFit: 'contain' }}
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7lm77niYflia3ovb3lpLHotKU8L3RleHQ+PC9zdmc+';
                  e.currentTarget.alt = '图片加载失败';
                }}
              />
            </div>
          )}
          
          {/* 文字内容 */}
          {content && (
            role === 'user' ? (
              <p className="whitespace-pre-wrap">{content}</p>
            ) : (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    em: ({ children }) => <em>{children}</em>,
                    a: ({ href, children }) => (
                      <a href={href} className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-gray-300 pl-3 italic my-2">{children}</blockquote>
                    ),
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            )
          )}
          
          {isStreaming && (
            <span className="inline-block w-2 h-4 bg-primary/50 ml-1 animate-pulse" />
          )}
        </div>
      </div>

      {/* User Avatar */}
      {role === 'user' && (
        <div className={styles.avatarContainer}>
          <User className="w-6 h-6 text-primary" />
        </div>
      )}
    </div>
  );
};
```

**Step 3: 修改 MessageRenderer 主组件集成 ToolCallCard**

```typescript
import { ToolCallCard } from './ToolCallCard';  // 新增导入

interface MessageRendererProps {
  message: Message;
  toolCalls?: ToolCall[];  // 新增：关联的工具调用
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({ message, toolCalls }) => {
  const isStreaming = message.status === 'streaming';

  return (
    <div>
      {/* 工具调用卡片（仅 AI 回复时显示） */}
      {message.role === 'assistant' && toolCalls && toolCalls.length > 0 && (
        <ToolCallCard tools={toolCalls} />
      )}
      
      {/* 消息内容 */}
      <TextMessage
        content={message.content}
        role={message.role}
        isStreaming={isStreaming}
        imageUrls={message.imageUrls}  // 传递图片
      />
      
      {/* 医疗建议 */}
      {message.medicalAdvice && (
        <MedicalAdviceCard advice={message.medicalAdvice} />
      )}
    </div>
  );
};
```

**Step 4: 修改 MessagesList 传递 toolCalls**

由于 toolCalls 在 chatMachine context 中，需要在 Chat.tsx 中传递：

```typescript
// Chat.tsx
<MessagesList 
  messages={state.context.messages} 
  toolCalls={state.context.toolCalls}  // 传递工具调用
/>
```

修改 MessagesList 组件：

```typescript
interface MessagesListProps {
  messages: Message[];
  toolCalls?: ToolCall[];  // 新增
}

export const MessagesList: React.FC<MessagesListProps> = ({ messages, toolCalls }) => {
  return (
    <div className="flex flex-col pb-4">
      {messages.map((message) => {
        // 获取这条消息关联的工具调用
        // 暂时简单处理：最后一条 AI 消息显示所有工具
        const isLastAssistant = 
          message.role === 'assistant' && 
          message === messages.filter(m => m.role === 'assistant').slice(-1)[0];
        
        const relatedTools = isLastAssistant ? toolCalls : undefined;
        
        return (
          <MessageRenderer 
            key={message.id} 
            message={message} 
            toolCalls={relatedTools}
          />
        );
      })}
    </div>
  );
};
```

**Step 5: 验证编译**

Run: `cd frontend && pnpm run build`
Expected: 编译成功

**Step 6: 运行测试**

Run: `cd frontend && pnpm test src/components/message/`
Expected: 所有测试通过

**Step 7: Commit**

```bash
git add frontend/src/components/message/ToolCallCard.tsx frontend/src/components/message/MessageRenderer.tsx
git commit -m "feat(message): 支持图片渲染和工具调用卡片"
```

---

### Task 4.4: 添加 MessageRenderer 图片渲染测试

**Files:**
- Create: `frontend/src/components/message/__tests__/MessageRenderer.test.tsx` (如果不存在)
- Modify: `frontend/src/components/message/__tests__/MessageRenderer.test.tsx` (如果存在)

**Step 1: 添加图片渲染测试**

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageRenderer } from '../MessageRenderer';
import { Message } from '../../../machines/chatMachine';

describe('MessageRenderer with images', () => {
  it('应该渲染纯文字消息', () => {
    const message: Message = {
      id: 'msg_1',
      role: 'user',
      content: '我头痛',
      timestamp: '2026-01-27T10:00:00Z',
      status: 'complete',
    };

    render(<MessageRenderer message={message} />);

    expect(screen.getByText('我头痛')).toBeInTheDocument();
    expect(screen.queryByAltText('用户上传的图片')).not.toBeInTheDocument();
  });

  it('应该渲染图片+文字混合消息', () => {
    const message: Message = {
      id: 'msg_2',
      role: 'user',
      content: '这是什么药？',
      imageUrls: ['https://example.com/medicine.jpg'],
      timestamp: '2026-01-27T10:00:00Z',
      status: 'complete',
    };

    render(<MessageRenderer message={message} />);

    const img = screen.getByAltText('用户上传的图片') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toBe('https://example.com/medicine.jpg');
    expect(screen.getByText('这是什么药？')).toBeInTheDocument();
  });

  it('应该渲染纯图片消息（无文字）', () => {
    const message: Message = {
      id: 'msg_3',
      role: 'user',
      content: '',
      imageUrls: ['https://example.com/symptom.jpg'],
      timestamp: '2026-01-27T10:00:00Z',
      status: 'complete',
    };

    render(<MessageRenderer message={message} />);

    expect(screen.getByAltText('用户上传的图片')).toBeInTheDocument();
    expect(screen.queryByText(/.+/)).toBeNull(); // 无文字内容
  });

  it('应该处理空 imageUrls 数组', () => {
    const message: Message = {
      id: 'msg_4',
      role: 'user',
      content: 'test',
      imageUrls: [],
      timestamp: '2026-01-27T10:00:00Z',
      status: 'complete',
    };

    render(<MessageRenderer message={message} />);

    expect(screen.queryByAltText('用户上传的图片')).not.toBeInTheDocument();
    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('应该显示工具调用卡片（AI 消息）', () => {
    const message: Message = {
      id: 'msg_5',
      role: 'assistant',
      content: '这是阿莫西林',
      timestamp: '2026-01-27T10:00:00Z',
      status: 'complete',
    };

    const toolCalls = [
      { id: 'tool_1', name: 'image_recognition', status: 'completed' as const, duration: 1200 },
    ];

    render(<MessageRenderer message={message} toolCalls={toolCalls} />);

    expect(screen.getByText(/识别图片/i)).toBeInTheDocument();
    expect(screen.getByText(/完成/i)).toBeInTheDocument();
    expect(screen.getByText('这是阿莫西林')).toBeInTheDocument();
  });
});
```

**Step 2: 运行测试**

Run: `cd frontend && pnpm test src/components/message/__tests__/MessageRenderer.test.tsx`
Expected: 所有测试通过

**Step 3: Commit**

```bash
git add frontend/src/components/message/__tests__/MessageRenderer.test.tsx
git commit -m "test(message): 添加图片渲染测试用例"
```

---

## 阶段 5：Chat 页面最终集成

### Task 5.1: 完整集成所有功能到 Chat.tsx

**Files:**
- Modify: `frontend/src/pages/Chat.tsx`

**Step 1: 导入所有必需组件**

```typescript
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useMachine } from '@xstate/react';
import { 
  Send, 
  Mic, 
  ChevronLeft, 
  History, 
  Thermometer, 
  Brain, 
  Stethoscope, 
  Activity,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import { chatMachine, ChatEventType } from '../machines/chatMachine';
import { MessagesList, SystemMessage } from '../components/message/MessageRenderer';
import { sseClientManager } from '../services/sseClient';
import { ImageUploader } from '../components/upload/ImageUploader';
import toast, { Toaster } from 'react-hot-toast';
```

**Step 2: 完整的组件实现**

（由于篇幅，这里省略完整代码，主要包含：）
- 添加 `uploadedImageUrl` 状态
- 修改 `handleSendMessage` 支持 imageUrls
- 添加图片预览区域
- 集成 ImageUploader 组件
- 动态切换上传/发送按钮

**Step 3: 添加 Toaster 到页面**

```typescript
return (
  <div className="flex flex-col h-screen overflow-hidden bg-background-light dark:bg-background-dark font-sans text-slate-900 dark:text-slate-100">
    {/* Toast 容器 */}
    <Toaster position="top-center" />
    
    {/* Header */}
    <header className="...">
      {/* ... */}
    </header>
    
    {/* Main */}
    <main className="...">
      {/* ... */}
    </main>
    
    {/* Footer */}
    <div className="...">
      {/* ... */}
    </div>
  </div>
);
```

**Step 4: 修改 MessagesList 调用传递 toolCalls**

```typescript
<MessagesList 
  messages={state.context.messages}
  toolCalls={state.context.toolCalls}
/>
```

**Step 5: 验证编译**

Run: `cd frontend && pnpm run build`
Expected: 编译成功，无错误

**Step 6: Commit**

```bash
git add frontend/src/pages/Chat.tsx
git commit -m "feat(chat): 完整集成图片上传和工具反馈功能"
```

---

## 阶段 6：端到端验证

### Task 6.1: 手动测试完整流程

**Step 1: 启动后端服务**

Run: `cd backend && pnpm run dev`
Expected: 服务启动在 http://localhost:3000

**Step 2: 启动前端服务**

Run: `cd frontend && pnpm run dev`
Expected: 服务启动在 http://localhost:5173

**Step 3: 测试用例清单**

测试场景：
1. ✅ 上传图片（JPG，2MB）→ 显示预览 → 删除 → 重新上传
2. ✅ 上传图片 → 不输入文字 → 直接发送（纯图片消息）
3. ✅ 上传图片 → 输入"这是什么药？" → 发送（混合消息）
4. ✅ 不上传图片 → 输入"我头痛" → 发送（纯文字消息）
5. ✅ 观察工具调用卡片显示：识别图片 → 知识库查询 → 网络搜索
6. ✅ 上传超过 5MB 的图片 → 验证 Toast 错误提示
7. ✅ 上传 PDF 文件 → 验证格式错误提示
8. ✅ 网络断开时上传 → 验证错误处理
9. ✅ 快速发送多条消息 → 验证按钮禁用
10. ✅ 刷新页面 → 验证状态重置

**Step 4: 记录问题**

如有问题，记录到临时文件：`docs/testing-issues.md`

---

### Task 6.2: 修复发现的问题

**Step 1: 根据测试结果修复 bug**

（具体根据实际测试结果）

**Step 2: 回归测试**

Run: `cd frontend && pnpm test && cd ../backend && pnpm test`
Expected: 所有测试通过

**Step 3: Commit fixes**

```bash
git add .
git commit -m "fix: 修复手动测试发现的问题"
```

---

## 阶段 7：文档和收尾

### Task 7.1: 更新 README 文档

**Files:**
- Modify: `frontend/README.md`

**Step 1: 添加图片上传功能说明**

```markdown
## 功能特性

### AI 健康助手
- ✅ 智能症状分析
- ✅ 药品查询识别
- ✅ 医院科室推荐
- ✅ **图片上传** - 支持上传医疗图片（症状照片、药品图片、检查报告）
- ✅ **多模态识别** - 智谱 GLM-4V 图片理解
- ✅ **知识库增强** - Coze 知识库查询
- ✅ **网络搜索** - Tavily 实时信息检索
- ✅ **工具反馈** - 实时展示 AI 工具调用过程

### 图片上传功能

**使用方式**：
1. 点击聊天输入框右侧的图片图标
2. 选择图片（支持 JPG、PNG、GIF、WebP，最大 5MB）
3. 上传成功后显示预览，可删除重新上传
4. 输入描述文字（可选）并点击发送
5. AI 将结合图片和文字进行分析

**技术实现**：
- 图片存储：Supabase Storage
- 图片识别：智谱 GLM-4V 多模态模型
- 流式传输：POST + SSE
- 状态管理：XState
```

**Step 2: Commit**

```bash
git add frontend/README.md
git commit -m "docs(frontend): 添加图片上传功能说明"
```

---

### Task 7.2: 运行完整测试套件

**Step 1: 前端测试**

Run: `cd frontend && pnpm test:run`
Expected: 所有新增测试通过，无新增失败

**Step 2: 后端测试**

Run: `cd backend && pnpm test:run`
Expected: 所有新增测试通过，无新增失败

**Step 3: 验证无 Lint 错误**

Run: `cd frontend && pnpm run lint && cd ../backend && pnpm run lint`
Expected: 无错误

---

### Task 7.3: 最终代码审查和清理

**Step 1: 检查未使用的导入**

Run: `cd frontend && pnpm run build`
Expected: 无警告

**Step 2: 验证 TypeScript 严格模式**

检查是否有 `any` 类型滥用：

Run: `cd frontend && grep -r "any" src/components/upload/ src/components/message/ToolCallCard.tsx`
Expected: 仅必要的 `any`（如 error catch）

**Step 3: 清理临时文件**

删除测试过程中的临时文件（如 `docs/testing-issues.md`）

**Step 4: 最终提交**

```bash
git add .
git commit -m "chore: 代码清理和最终优化"
```

---

## 总结

### 文件变更清单

**前端新建**：
1. `frontend/src/components/upload/ImageUploader.tsx`
2. `frontend/src/components/upload/__tests__/ImageUploader.test.tsx`
3. `frontend/src/components/message/ToolCallCard.tsx`
4. `frontend/src/components/message/__tests__/ToolCallCard.test.tsx`
5. `frontend/src/components/message/__tests__/MessageRenderer.test.tsx`
6. `frontend/src/services/__tests__/sseClient.test.ts`

**前端修改**：
1. `frontend/src/machines/chatMachine.ts`
2. `frontend/src/services/sseClient.ts`
3. `frontend/src/pages/Chat.tsx`
4. `frontend/src/components/message/MessageRenderer.tsx`
5. `frontend/package.json`
6. `frontend/README.md`

**后端新建**：
1. `backend/src/routes/__tests__/aiChat.integration.test.ts`

**后端修改**：
1. `backend/src/routes/aiChat.ts`
2. `backend/src/controllers/aiChatController.ts`

**总计**：
- 新建：7 个文件
- 修改：9 个文件
- 预计代码行数：~1200 行（含测试）
- 预计时长：6-8 小时

### 验收标准

**功能**：
- ✅ 用户可以上传 1 张图片
- ✅ 上传后显示预览，可删除
- ✅ 支持纯图片、纯文字、图片+文字三种消息
- ✅ 消息气泡正确显示图片和文字
- ✅ 工具调用过程实时显示
- ✅ 错误时友好提示并降级

**技术**：
- ✅ 所有单元测试通过
- ✅ 所有集成测试通过
- ✅ 无 TypeScript 错误
- ✅ 无 ESLint 警告
- ✅ 前后端接口一致（imageUrls 数组）

**性能**：
- ✅ 图片上传 < 3秒
- ✅ SSE 首字节 < 1秒
- ✅ 页面交互流畅
