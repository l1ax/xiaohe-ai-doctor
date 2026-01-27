# AI 聊天图片上传功能设计

## 文档信息
- **创建日期**: 2026-01-27
- **版本**: v1.0
- **目标**: 为 AI 聊天功能添加图片上传和多模态交互能力

---

## 一、需求概述

### 功能目标
为小禾 AI 医生的聊天功能添加图片上传能力，使用户可以：
1. 上传医疗相关图片（症状照片、药品图片、检查报告等）
2. 与文字一起发送给 AI 进行多模态分析
3. 实时查看工具调用过程（图片识别、知识库查询、网络搜索）
4. 获得基于图片和文字的综合医疗建议

### 核心约束
- 单次消息最多支持 1 张图片
- 图片大小限制：5MB
- 支持格式：JPG、PNG、GIF、WebP
- 必须保持现有 Agent 工具流程（已在后端实现）

---

## 二、整体架构设计

### 系统分层架构

```
┌─────────────────────────────────────────────┐
│            前端 UI 层                         │
│  - Chat.tsx (聊天页面)                        │
│  - ImageUploader 组件 (文件选择+上传)          │
│  - MessageRenderer (消息渲染)                 │
│  - ToolCallCard (工具反馈卡片)                │
└──────────────┬──────────────────────────────┘
               │
               ├─► POST /api/upload/image (上传图片)
               │   Response: { url, path }
               │
               └─► POST /api/ai-chat/stream (发送消息+图片)
                   Body: { conversationId, message, imageUrls }
                   Response: text/event-stream
                          ↓
         ┌─────────────────────────────┐
         │   后端 SSE 流式响应           │
         │  - aiChatController          │
         │  - SSEHandler                │
         └──────────┬──────────────────┘
                    ↓
         ┌─────────────────────────────┐
         │   Agent 工作流 (已完成)       │
         │  - 工具编排器                 │
         │  - 图片识别/知识库/搜索        │
         └─────────────────────────────┘
```

### 核心改动范围

**前端（4个文件 + 2个新组件）**：
1. `frontend/src/machines/chatMachine.ts` - 扩展 Message 接口
2. `frontend/src/pages/Chat.tsx` - 添加图片上传和预览
3. `frontend/src/services/sseClient.ts` - 改为 POST 请求
4. `frontend/src/components/message/MessageRenderer.tsx` - 支持图片渲染
5. `frontend/src/components/upload/ImageUploader.tsx` - 新建上传组件
6. `frontend/src/components/message/ToolCallCard.tsx` - 新建工具卡片组件

**后端（2个文件）**：
1. `backend/src/routes/aiChat.ts` - GET → POST 路由
2. `backend/src/controllers/aiChatController.ts` - 接收 body 参数

---

## 三、前端设计

### 3.1 Message 接口扩展

```typescript
// frontend/src/machines/chatMachine.ts
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

**设计决策**：使用数组而非单个字符串
- 与后端 Agent 接口保持一致
- 便于未来扩展到多图片
- 当前限制为 1 张，通过业务逻辑控制

### 3.2 ImageUploader 组件

**文件路径**: `frontend/src/components/upload/ImageUploader.tsx`

**接口定义**：
```typescript
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
```

**核心功能**：
1. **文件选择**：
   - 使用隐藏的 `<input type="file" accept="image/*">`
   - 点击按钮触发 `input.click()`
   
2. **即时上传**：
   ```typescript
   const handleFileSelect = async (file: File) => {
     // 前端验证
     if (file.size > 5 * 1024 * 1024) {
       toast.error('图片不能超过5MB');
       return;
     }
     
     // 立即上传
     setUploading(true);
     const formData = new FormData();
     formData.append('file', file);
     
     const response = await fetch('/api/upload/image', {
       method: 'POST',
       headers: { 'Authorization': `Bearer ${token}` },
       body: formData,
     });
     
     const { data } = await response.json();
     setImageUrl(data.url);
     onImageUploaded(data.url);
   };
   ```

3. **预览展示**：
   - 120x120px 缩略图
   - 右上角 X 删除按钮（带确认）
   - 上传中显示进度条 overlay

4. **错误处理**：
   - 使用 `react-hot-toast` 显示错误
   - 上传失败清空状态，允许重试

### 3.3 ToolCallCard 组件

**文件路径**: `frontend/src/components/message/ToolCallCard.tsx`

**接口定义**：
```typescript
interface ToolCallCardProps {
  tools: Array<{
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    duration?: number;
  }>;
}
```

**视觉设计**：
```tsx
<div className="flex flex-col gap-2 mb-3">
  {tools.map(tool => (
    <div className="flex items-center gap-2 bg-slate-100/50 dark:bg-slate-800/50 
                    px-3 py-2 rounded-lg text-sm">
      {/* 图标 */}
      {getToolIcon(tool.name)}
      
      {/* 工具名称 */}
      <span className="text-slate-700 dark:text-slate-300">
        {getToolLabel(tool.name)}
      </span>
      
      {/* 状态指示器 */}
      {tool.status === 'running' && <Loader className="animate-spin" />}
      {tool.status === 'completed' && <CheckCircle className="text-green-500" />}
      {tool.status === 'failed' && <XCircle className="text-red-500" />}
      
      {/* 耗时 */}
      {tool.duration && (
        <span className="text-xs text-slate-500">{tool.duration}ms</span>
      )}
    </div>
  ))}
</div>
```

**工具映射**：
```typescript
const toolLabels = {
  'image_recognition': '正在识别图片',
  'knowledge_base': '正在查询知识库',
  'web_search': '正在网络搜索',
};

const toolIcons = {
  'image_recognition': <ImageIcon className="w-4 h-4" />,
  'knowledge_base': <Database className="w-4 h-4" />,
  'web_search': <Search className="w-4 h-4" />,
};
```

### 3.4 Chat.tsx 改造

**状态扩展**：
```typescript
const [uploadedImage, setUploadedImage] = useState<{
  url: string;
  uploading: boolean;
  progress: number;
} | null>(null);
```

**发送消息逻辑**：
```typescript
const handleSendMessage = async () => {
  const messageContent = inputValue.trim();
  const imageUrls = uploadedImage?.url ? [uploadedImage.url] : undefined;
  
  // 验证
  if (!messageContent && !imageUrls) {
    toast.error('请输入消息或上传图片');
    return;
  }
  
  // 发送到状态机
  send({ 
    type: 'SEND_MESSAGE', 
    content: messageContent,
    imageUrls,
  });
  
  // SSE 连接（改为 POST）
  const client = sseClientManager.createClient({
    url: `${API_BASE_URL}/api/ai-chat/stream`,
    method: 'POST',  // 新增
    conversationId: newConversationId,
    message: messageContent,
    imageUrls,  // 新增
    onEvent: (event) => send(event),
  });
  
  // 清空状态
  setInputValue('');
  setUploadedImage(null);
};
```

### 3.5 SSE 客户端改造

**关键改动**：
```typescript
// frontend/src/services/sseClient.ts

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

async connect(): Promise<void> {
  const { method = 'POST', conversationId, message, imageUrls } = this.config;
  
  let fetchOptions: RequestInit;
  
  if (method === 'POST') {
    // POST 请求：body 传参
    fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({ conversationId, message, imageUrls }),
      signal: this.abortController.signal,
    };
  } else {
    // GET 请求：兼容旧版（未来可删除）
    const url = new URL(this.config.url);
    url.searchParams.set('conversationId', conversationId);
    if (message) url.searchParams.set('message', message);
    
    fetchOptions = {
      method: 'GET',
      headers: { 'Accept': 'text/event-stream' },
      signal: this.abortController.signal,
    };
  }
  
  const response = await fetch(this.config.url, fetchOptions);
  // ... 其余流式处理逻辑不变
}
```

### 3.6 MessageRenderer 增强

**混合消息渲染**：
```typescript
export const MessageRenderer: React.FC<MessageRendererProps> = ({ message }) => {
  const isStreaming = message.status === 'streaming';
  
  return (
    <div>
      <TextMessage
        content={message.content}
        role={message.role}
        isStreaming={isStreaming}
        imageUrls={message.imageUrls}  // 传递图片 URLs
      />
      {message.medicalAdvice && (
        <MedicalAdviceCard advice={message.medicalAdvice} />
      )}
    </div>
  );
};

// 修改 TextMessage 组件
const TextMessage: React.FC<TextMessageProps> = ({ 
  content, 
  role, 
  isStreaming,
  imageUrls  // 新增
}) => {
  // ...
  
  return (
    <div className={styles.bubble}>
      {/* 图片（如果有） */}
      {imageUrls && imageUrls.length > 0 && (
        <div className="mb-2">
          <img 
            src={imageUrls[0]} 
            alt="用户上传的图片"
            className="max-w-full rounded-lg"
            style={{ maxHeight: '200px', objectFit: 'contain' }}
            onError={(e) => {
              e.currentTarget.src = '/placeholder-image.png';
            }}
          />
        </div>
      )}
      
      {/* 文字内容 */}
      {content && (
        role === 'user' ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <ReactMarkdown>{content}</ReactMarkdown>
        )
      )}
    </div>
  );
};
```

---

## 四、后端设计

### 4.1 路由改造

```typescript
// backend/src/routes/aiChat.ts

// 改造前：
router.get('/stream', (req, res) => {
  aiChatController.streamChat(req, res);
});

// 改造后：
router.post('/stream', (req, res) => {
  aiChatController.streamChat(req, res);
});
```

### 4.2 Controller 改造

```typescript
// backend/src/controllers/aiChatController.ts

async streamChat(req: Request, res: Response): Promise<void> {
  // 从 body 读取参数（改造前从 query 读取）
  const { message, conversationId, imageUrls } = req.body;
  
  // 验证 message
  if (!message || typeof message !== 'string') {
    throw new ValidationError('Message is required and must be a string');
  }
  
  if (message.length > 5000) {
    throw new ValidationError('Message must not exceed 5000 characters');
  }
  
  // 验证 imageUrls（可选）
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
        throw new ValidationError('Invalid image URL');
      }
    }
  }
  
  const conversationIdStr = conversationId || `conv_${Date.now()}`;
  
  logger.info('Stream chat request received', { 
    conversationId: conversationIdStr, 
    messageLength: message.length,
    imageCount: imageUrls?.length || 0,
  });
  
  // 构建消息（直接传递 imageUrls）
  const messages: Message[] = [
    { 
      role: 'user', 
      content: message,
      imageUrls,  // 新增：传递给 Agent
    }
  ];
  
  // ... 其余逻辑不变（SSE 处理、Agent 执行）
}
```

---

## 五、数据流设计

### 完整用户交互流程

```
用户操作                 前端状态                    API 调用
────────────────────────────────────────────────────────
1. 点击上传按钮 (📎)
   └─► 打开文件选择器 (<input type="file">)
   
2. 选择图片文件
   └─► uploading: true  ─────────► POST /api/upload/image
       progress: 0 → 100          Authorization: Bearer {token}
                                   FormData: { file }
   
3. 上传成功
   └─► imageUrl: "https://..."  ◄──── Response: { 
       显示预览缩略图 (120x120px)        url: "https://...",
       显示 X 删除按钮                    path: "uploads/..." 
                                        }
   
4. 输入文字（可选）
   └─► inputValue: "这是什么药？"
   
5. 点击发送按钮 (✈️)
   └─► chatMachine.send({      ─────► POST /api/ai-chat/stream
         type: 'SEND_MESSAGE',         Body: {
         content: "这是什么药？",         "conversationId": "conv_123",
         imageUrls: ["https://..."]      "message": "这是什么药？",
       })                                "imageUrls": ["https://..."]
                                       }
   
6. 接收 SSE 事件流
   ├─► tool:call               ◄──── event: tool:call
   │   显示 ToolCallCard              data: {
   │   "🖼️ 正在识别图片..."              toolName: "image_recognition",
   │                                    status: "running"
   │                                  }
   │
   ├─► tool:call               ◄──── event: tool:call
   │   "✅ 图片识别完成"                data: {
   │                                    toolName: "image_recognition",
   │                                    status: "completed",
   │                                    duration: 1234
   │                                  }
   │
   ├─► message:content         ◄──── event: message:content
   │   流式显示 AI 回复               data: {
   │                                    delta: "这是...",
   │                                    isFirst: true
   │                                  }
   │
   └─► conversation:end        ◄──── event: conversation:end
       完成，允许新消息
```

### SSE 事件类型扩展

**已有事件**（无需修改）：
- `conversation:status`
- `message:status`
- `message:content`
- `message:metadata`
- `tool:call` ✅ 已支持，用于显示工具卡片
- `conversation:end`

**前端状态机处理**：
```typescript
// chatMachine.ts - 已有 TOOL_CALL 事件处理
case 'tool_call':
case 'tool:call':
  return {
    type: 'TOOL_CALL',
    toolId: event.data.toolId,
    toolName: event.data.toolName,
    status: event.data.status,
    input: event.data.input,
    output: event.data.output,
    duration: event.data.duration,
  };
```

**工具调用状态存储**：
```typescript
// chatMachine context 已有 toolCalls 数组
toolCalls: ToolCall[];

// actions 已有 addToolCall 和 updateToolCall
addToolCall: assign({
  toolCalls: ({ context, event }) => {
    const newTool = {
      id: event.toolId,
      name: event.toolName,
      status: event.status,
    };
    return [...context.toolCalls, newTool];
  },
}),
```

---

## 六、UI/UX 设计

### 6.1 Chat 页面输入区域布局

```
┌────────────────────────────────────────────┐
│  [图片预览区域] (上传成功后显示)             │
│  ┌──────────┐                              │
│  │          │  ❌                           │
│  │ 缩略图   │  删除                         │
│  │ 120x120  │                              │
│  └──────────┘                              │
├────────────────────────────────────────────┤
│  [🎤] [         输入框...         ] [📎/✈️] │
│   语音     描述您的症状            上传/发送 │
└────────────────────────────────────────────┘
```

**交互逻辑**：
- 无图片时：右侧按钮显示 📎（PlusCircle），点击触发上传
- 有图片时：右侧按钮显示 ✈️（Send），点击发送消息
- 上传中时：按钮显示 ⏳ 加载图标，禁用状态

### 6.2 消息气泡显示

**用户消息（带图片）**：
```
┌─────────────────────────┐  👤
│ ┌───────────────────┐   │
│ │                   │   │
│ │   [图片 200px]    │   │
│ │                   │   │
│ └───────────────────┘   │
│                         │
│ 这是我的药品，请帮我    │
│ 看看是什么？            │
└─────────────────────────┘
```

**AI 回复（带工具卡片）**：
```
🤖  小禾AI医生
┌─────────────────────────────┐
│ 🖼️  图片识别完成  ✅  1.2s  │
│ 📚  知识库查询完成 ✅  0.8s │
└─────────────────────────────┘
┌─────────────────────────────┐
│ 根据图片识别，这是阿莫西林  │
│ 胶囊，属于青霉素类抗生素... │
│                             │
│ **适应症**：                │
│ - 呼吸道感染               │
│ - 泌尿系统感染             │
└─────────────────────────────┘
```

### 6.3 错误提示设计

**Toast 位置**：页面顶部居中  
**显示时长**：3 秒自动消失  
**样式**：

```typescript
// 成功
toast.success('图片上传成功');

// 错误
toast.error('图片上传失败：文件过大');
toast.error('消息发送失败，请重试');

// 警告
toast.warning('图片识别失败，将仅基于文字回答');
```

---

## 七、错误处理和降级策略

### 7.1 前端错误处理

| 错误场景 | Toast 提示 | 降级处理 |
|---------|-----------|---------|
| 文件过大（>5MB） | "图片不能超过5MB" | 清空选择，允许重新上传 |
| 格式不支持 | "仅支持 JPG/PNG/GIF 格式" | 清空选择，允许重新上传 |
| 网络失败 | "上传失败，请重试" | 保留文件，提供重试按钮 |
| 认证失败 | "登录已过期，请重新登录" | 跳转到登录页 |
| 发送失败 | "消息发送失败，请重试" | 保留输入，允许重试 |

### 7.2 后端错误处理

**参数验证错误**（400）：
```typescript
if (!message) {
  throw new ValidationError('Message is required');
}

if (imageUrls && imageUrls.length > 1) {
  throw new ValidationError('Currently only 1 image is supported');
}
```

**工具调用失败**（已实现渐进降级）：
- 图片识别失败 → 跳过图片，仅用文字
- 知识库无结果 → 自动降级到网络搜索
- 网络搜索失败 → 纯 LLM 回答

前端通过 `tool:call` 事件的 `status: 'failed'` 感知失败，但不阻断流程。

### 7.3 边界情况处理

1. **纯图片消息**（无文字）：
   - 允许发送
   - `content` 为空字符串
   - Agent 会基于图片识别结果回答

2. **快速连续发送**：
   - 前一条未完成时禁用发送按钮
   - 通过 `state.matches('streaming')` 判断

3. **上传中切换页面**：
   - `useEffect` cleanup 中取消上传请求
   - 保存草稿到 localStorage（可选）

4. **图片加载失败**：
   - `onError` 显示占位图
   - 提供"重新加载"按钮

---

## 八、测试策略

### 8.1 前端测试

**ImageUploader 组件测试** (`frontend/src/components/upload/__tests__/ImageUploader.test.tsx`)：
```typescript
describe('ImageUploader', () => {
  it('应该在选择文件后立即上传', async () => {
    const onImageUploaded = vi.fn();
    render(<ImageUploader onImageUploaded={onImageUploaded} />);
    
    const file = new File(['image'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen.getByLabelText('上传图片');
    
    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { url: 'https://example.com/image.jpg' } }),
    });
    
    await userEvent.upload(input, file);
    
    expect(global.fetch).toHaveBeenCalledWith('/api/upload/image', {
      method: 'POST',
      body: expect.any(FormData),
    });
    
    await waitFor(() => {
      expect(onImageUploaded).toHaveBeenCalledWith('https://example.com/image.jpg');
    });
  });
  
  it('应该拒绝超过5MB的文件', async () => {
    const largeFile = new File(['x'.repeat(6 * 1024 * 1024)], 'large.jpg');
    // ... 验证 toast.error 被调用
  });
  
  it('应该支持删除已上传的图片', async () => {
    const onImageRemoved = vi.fn();
    // ... 点击删除按钮，验证回调
  });
});
```

**SSE 客户端测试** (`frontend/src/services/__tests__/sseClient.test.ts`)：
```typescript
describe('SSEClient POST support', () => {
  it('应该使用 POST 方法发送消息和图片', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream(),
    });
    
    const client = new SSEClient({
      url: '/api/ai-chat/stream',
      method: 'POST',
      conversationId: 'conv_123',
      message: 'test',
      imageUrls: ['https://example.com/image.jpg'],
    });
    
    await client.connect();
    
    expect(global.fetch).toHaveBeenCalledWith('/api/ai-chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        conversationId: 'conv_123',
        message: 'test',
        imageUrls: ['https://example.com/image.jpg'],
      }),
    });
  });
});
```

**MessageRenderer 测试**：
```typescript
describe('MessageRenderer with images', () => {
  it('应该渲染图片+文字混合消息', () => {
    const message: Message = {
      id: 'msg_1',
      role: 'user',
      content: '这是什么药？',
      imageUrls: ['https://example.com/medicine.jpg'],
      timestamp: '2026-01-27T10:00:00Z',
      status: 'complete',
    };
    
    render(<MessageRenderer message={message} />);
    
    expect(screen.getByAltText('用户上传的图片')).toBeInTheDocument();
    expect(screen.getByText('这是什么药？')).toBeInTheDocument();
  });
  
  it('应该渲染纯图片消息', () => {
    const message: Message = {
      id: 'msg_2',
      role: 'user',
      content: '',
      imageUrls: ['https://example.com/symptom.jpg'],
      timestamp: '2026-01-27T10:00:00Z',
      status: 'complete',
    };
    
    render(<MessageRenderer message={message} />);
    
    expect(screen.getByAltText('用户上传的图片')).toBeInTheDocument();
    expect(screen.queryByText(/.+/)).not.toBeInTheDocument(); // 无文字
  });
});
```

**ToolCallCard 测试**：
```typescript
describe('ToolCallCard', () => {
  it('应该显示工具调用进度', () => {
    const tools = [
      { id: '1', name: 'image_recognition', status: 'completed', duration: 1200 },
      { id: '2', name: 'knowledge_base', status: 'running' },
    ];
    
    render(<ToolCallCard tools={tools} />);
    
    expect(screen.getByText('图片识别完成')).toBeInTheDocument();
    expect(screen.getByText('1.2s')).toBeInTheDocument();
    expect(screen.getByText('正在查询知识库')).toBeInTheDocument();
  });
});
```

### 8.2 后端测试

**aiChatController 路由测试** (`backend/src/routes/__tests__/aiChat.test.ts`)：
```typescript
describe('POST /api/ai-chat/stream', () => {
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
    expect(response.headers['content-type']).toContain('text/event-stream');
  });
  
  it('应该拒绝超过1张的图片', async () => {
    const response = await request(app)
      .post('/api/ai-chat/stream')
      .send({
        message: 'test',
        imageUrls: ['url1', 'url2'],
      });
    
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('only 1 image');
  });
  
  it('应该验证图片 URL 格式', async () => {
    const response = await request(app)
      .post('/api/ai-chat/stream')
      .send({
        message: 'test',
        imageUrls: ['invalid-url'],
      });
    
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Invalid image URL');
  });
});
```

---

## 九、技术栈和依赖

### 新增前端依赖

```json
{
  "dependencies": {
    "react-hot-toast": "^2.4.1"
  }
}
```

### 已有依赖（无需新增）
- `eventsource-parser`: SSE 流解析 ✅
- `lucide-react`: 图标库 ✅
- `@xstate/react`: 状态管理 ✅

### 后端依赖（无需新增）
- `multer`: 文件上传处理 ✅
- `@supabase/supabase-js`: 存储服务 ✅

---

## 十、实施计划

### 阶段 1：后端改造（优先）
**文件**：
1. `backend/src/routes/aiChat.ts`
2. `backend/src/controllers/aiChatController.ts`

**步骤**：
1. 修改路由方法：GET → POST
2. 修改参数读取：`req.query` → `req.body`
3. 添加 imageUrls 验证逻辑
4. 编写单元测试
5. 运行测试确保通过

### 阶段 2：前端消息协议（基础）
**文件**：
1. `frontend/src/machines/chatMachine.ts`
2. `frontend/src/services/sseClient.ts`

**步骤**：
1. 扩展 Message 接口添加 `imageUrls`
2. 修改 SSE 客户端支持 POST
3. 修改 `SEND_MESSAGE` 事件类型支持 imageUrls
4. 编写单元测试

### 阶段 3：前端上传功能
**文件**：
1. `frontend/src/components/upload/ImageUploader.tsx` (新建)
2. `frontend/src/pages/Chat.tsx`

**步骤**：
1. 创建 ImageUploader 组件（TDD）
2. 集成到 Chat.tsx
3. 添加图片预览区域
4. 实现上传状态管理
5. 添加 Toast 通知

### 阶段 4：前端渲染增强
**文件**：
1. `frontend/src/components/message/MessageRenderer.tsx`
2. `frontend/src/components/message/ToolCallCard.tsx` (新建)

**步骤**：
1. 修改 MessageRenderer 支持图片渲染
2. 创建 ToolCallCard 组件
3. 集成工具状态显示
4. 样式优化

### 阶段 5：集成测试和优化
1. 端到端手动测试
2. 修复发现的问题
3. 性能优化
4. 文档更新

---

## 十一、成功标准

### 功能验收
- ✅ 用户可以上传 1 张图片（JPG/PNG/GIF，≤5MB）
- ✅ 上传后显示预览，可删除重新上传
- ✅ 可发送纯图片、纯文字或图片+文字消息
- ✅ 消息气泡中正确显示图片和文字
- ✅ 工具调用过程实时显示在卡片中
- ✅ 错误时显示友好提示并降级处理

### 技术验收
- ✅ 前端所有单元测试通过
- ✅ 后端所有集成测试通过
- ✅ 无 TypeScript 编译错误
- ✅ 无 ESLint 警告
- ✅ SSE 流式响应正常工作
- ✅ 图片识别、知识库、搜索工具正常调用

### 性能指标
- 图片上传响应时间 < 3秒（5MB 文件）
- SSE 首字节响应时间 < 1秒
- 工具调用总耗时 < 10秒
- 页面交互流畅，无卡顿

---

## 十二、风险和缓解措施

### 已识别风险

1. **SSE POST 兼容性**
   - 风险：某些浏览器或代理可能不支持 POST SSE
   - 缓解：主流浏览器（Chrome/Safari/Firefox）均支持，已验证可行性

2. **图片识别 API 限流**
   - 风险：智谱 API 可能有速率限制
   - 缓解：后端已有渐进降级，识别失败不影响回答

3. **大图片上传体验**
   - 风险：5MB 图片上传可能较慢
   - 缓解：显示实时进度条，允许取消

4. **移动端触摸体验**
   - 风险：小屏幕上预览和删除按钮可能难以点击
   - 缓解：确保按钮点击区域 ≥44x44px（iOS 人机界面指南）

---

## 附录：文件清单

### 前端新建文件
1. `frontend/src/components/upload/ImageUploader.tsx`
2. `frontend/src/components/upload/__tests__/ImageUploader.test.tsx`
3. `frontend/src/components/message/ToolCallCard.tsx`
4. `frontend/src/components/message/__tests__/ToolCallCard.test.tsx`

### 前端修改文件
1. `frontend/src/machines/chatMachine.ts`
2. `frontend/src/services/sseClient.ts`
3. `frontend/src/pages/Chat.tsx`
4. `frontend/src/components/message/MessageRenderer.tsx`
5. `frontend/package.json` (添加 react-hot-toast)

### 后端修改文件
1. `backend/src/routes/aiChat.ts`
2. `backend/src/controllers/aiChatController.ts`

### 后端新增测试
1. `backend/src/routes/__tests__/aiChat.test.ts` (扩展现有测试)

**总计**：
- 新建文件：4 个
- 修改文件：7 个
- 预计代码行数：~800 行（含测试）
