# 小禾AI医生 - 技术设计文档

**项目名称**: 小禾AI医生 (Xiaohe AI Doctor)  
**平台**: 微信小程序  
**版本**: MVP v1.0  
**创建日期**: 2026-01-23

---

## 1. 项目概述

### 1.1 产品定位

小禾AI医生是一款综合性医疗健康服务小程序，提供以下核心功能：

1. **AI 智能问诊** - 用户与 AI 健康助手对话，获取医疗健康咨询
2. **专家问诊** - 连接入驻的真实医生进行在线实时问诊
3. **预约挂号** - 在线预约医院挂号服务

### 1.2 用户角色

- **患者端**: 使用 AI 问诊、咨询医生、预约挂号
- **医生端**: 管理问诊请求、与患者实时沟通、查看预约

### 1.3 开发策略

采用**分阶段完整开发**模式：
- **阶段 1**: AI 智能问诊
- **阶段 2**: 专家问诊  
- **阶段 3**: 预约挂号（Mock 数据）

---

## 2. 技术架构

### 2.1 总体架构

```
┌─────────────────────────────────────────┐
│         Taro 小程序（患者端 + 医生端）      │
│   React 18 + TypeScript + Zustand       │
└───────────────┬─────────────────────────┘
                │ HTTPS / WSS / SSE
┌───────────────▼─────────────────────────┐
│        Node.js 单体应用服务              │
│  ┌─────────────────────────────────┐   │
│  │ RESTful API (Express/Koa)       │   │
│  ├─────────────────────────────────┤   │
│  │ WebSocket Server (医生问诊)     │   │
│  ├─────────────────────────────────┤   │
│  │ SSE Server (AI 问诊流式输出)    │   │
│  ├─────────────────────────────────┤   │
│  │ LangGraph.js Agent Engine       │   │
│  │   ├─ Coze 知识库工具             │   │
│  │   ├─ 网络搜索工具                │   │
│  │   ├─ 医院查询工具                │   │
│  │   └─ OCR 工具                   │   │
│  └─────────────────────────────────┘   │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│          Supabase 数据层                 │
│  ├─ PostgreSQL (结构化数据)             │
│  └─ Storage (图片文件存储)              │
└─────────────────────────────────────────┘
```

### 2.2 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| **前端框架** | Taro 3.x + React 18 + TypeScript | 小程序开发框架 |
| **UI 组件** | 自定义组件（按 Figma 设计实现） | 用户自行设计 UI |
| **状态管理** | Zustand | 轻量级状态管理 |
| **后端框架** | Express/Koa + TypeScript | Node.js Web 框架 |
| **AI Agent** | LangGraph.js | Agent 工作流编排 |
| **知识库** | Coze Workflow API | 医学知识查询 |
| **LLM** | OpenAI / Anthropic API | 大语言模型 |
| **实时通讯** | ws / Socket.io (医生问诊) | WebSocket 服务 |
| **流式输出** | Server-Sent Events (AI 问诊) | 单向流式推送 |
| **数据库** | Supabase (PostgreSQL) | 托管数据库 |
| **ORM** | Prisma / Kysely | 类型安全的 ORM |
| **文件存储** | Supabase Storage | 图片等文件存储 |
| **身份认证** | JWT + Supabase Auth | 用户认证 |

---

## 3. 数据库设计

### 3.1 核心数据表

#### users (用户表)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) UNIQUE NOT NULL,
  nickname VARCHAR(50),
  avatar_url TEXT,
  role VARCHAR(20) NOT NULL, -- 'patient' | 'doctor'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### doctors (医生信息表)
```sql
CREATE TABLE doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(50), -- 职称
  department VARCHAR(50), -- 科室
  hospital VARCHAR(100), -- 医院
  introduction TEXT, -- 个人简介
  consultation_fee INTEGER, -- 问诊费用（分）
  is_available BOOLEAN DEFAULT false, -- 是否在线
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### conversations (会话表)
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(20) NOT NULL, -- 'ai' | 'doctor'
  patient_id UUID REFERENCES users(id),
  doctor_id UUID REFERENCES doctors(id),
  status VARCHAR(20) DEFAULT 'active', -- 'active' | 'closed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### messages (消息表)
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id),
  content_type VARCHAR(20) NOT NULL, -- 'text' | 'image' | 'system'
  content TEXT NOT NULL,
  metadata JSONB, -- 扩展字段
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
```

#### appointments (预约表)
```sql
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES users(id),
  doctor_id UUID REFERENCES doctors(id),
  hospital VARCHAR(100),
  department VARCHAR(50),
  appointment_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'confirmed' | 'cancelled' | 'completed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appointments_patient ON appointments(patient_id, appointment_time DESC);
```

### 3.2 消息协议设计

#### AI Agent 消息的 `metadata` 字段结构

```typescript
{
  // Agent 工作流状态
  agentSteps?: {
    thought: string;        // 思考过程
    action: string;         // 执行的动作
    observation: string;    // 观察结果
  }[];
  
  // 工具调用记录
  toolCalls?: {
    tool: 'search' | 'coze_knowledge' | 'hospital_query' | 'ocr';
    input: any;
    output: any;
  }[];
  
  // 搜索结果引用
  sources?: {
    title: string;
    url: string;
    snippet: string;
  }[];
  
  // 结构化医疗建议
  medicalAdvice?: {
    symptoms: string[];              // 识别的症状
    possibleConditions: string[];    // 可能疾病
    suggestions: string[];           // 建议
    urgencyLevel: 'low' | 'medium' | 'high';
  };
  
  // UI 交互元素
  actions?: {
    type: 'transfer_to_doctor' | 'view_more' | 'book_appointment';
    label: string;
    data?: any;
  }[];
}
```

#### 普通消息的 `metadata` 字段

```typescript
{
  // 图片消息
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  
  // 系统消息
  systemType?: 'session_start' | 'session_end' | 'doctor_joined';
}
```

---

## 4. AI Agent 设计

### 4.1 LangGraph.js + Coze 混合架构

**整体流程**:
```
用户输入 → LangGraph.js Agent
            ├─ 意图识别节点 (classifyIntent)
            ├─ 工具调度节点 (dispatchTools)
            │   ├─ Coze 知识库工具 (医学知识查询)
            │   ├─ 网络搜索工具 (实时医疗资讯)
            │   ├─ 医院查询工具 (Mock 数据)
            │   └─ OCR 工具 (药品识别)
            ├─ 信息整合节点 (synthesizeInfo)
            └─ 响应生成节点 (generateResponse)
```

### 4.2 Agent 状态定义

```typescript
interface AgentState {
  messages: Message[];
  userIntent: 'symptom_consult' | 'hospital_recommend' | 
              'medicine_info' | 'medicine_ocr' | 'general_qa';
  extractedInfo: any;            // 提取的关键信息
  searchResults: SearchResult[]; // 搜索结果
  cozeKnowledge: any;            // Coze 返回的知识
  toolResults: any[];            // 工具调用结果
  conversationId: string;
}
```

### 4.3 工作流节点详解

**1. 意图识别节点 (classifyIntent)**
- 分析用户输入的真实意图
- 提取关键实体（地点、症状、药品名等）
- 支持的意图类型：
  - `symptom_consult`: 症状咨询
  - `hospital_recommend`: 医院推荐
  - `medicine_info`: 药品咨询
  - `medicine_ocr`: 药品图片识别
  - `general_qa`: 通用健康问答

**2. 工具调度节点 (dispatchTools)**

根据意图调用相应工具：

```typescript
// Coze 知识库工具
const cozeKnowledgeTool = {
  name: "medical_knowledge",
  description: "查询专业医学知识库",
  async execute(query: string) {
    const result = await cozeClient.workflows.run({
      workflow_id: COZE_KNOWLEDGE_WORKFLOW_ID,
      parameters: { query }
    });
    return result.data;
  }
};

// 网络搜索工具
const searchTool = {
  name: "web_search",
  description: "搜索最新医疗健康资讯",
  async execute(query: string) {
    // 调用 Tavily / SerpAPI
  }
};

// 医院查询工具
const hospitalTool = {
  name: "hospital_query",
  description: "查询医院信息",
  async execute(params: { city: string, department: string }) {
    // 返回 Mock 数据
  }
};

// OCR 工具
const ocrTool = {
  name: "medicine_ocr",
  description: "识别药品包装/说明书",
  async execute(imageUrl: string) {
    // 调用 OCR API
  }
};
```

**3. 信息整合节点 (synthesizeInfo)**
- 整合各工具返回的结果
- 生成结构化数据供 UI 渲染

**4. 响应生成节点 (generateResponse)**
- 调用 LLM 生成自然语言回复
- 附加 `metadata` 字段（工具调用记录、搜索结果、医疗建议等）
- 判断是否需要推荐转人工医生

### 4.4 LangGraph SDK 集成

后端通过 LangGraph SDK 调用 Agent：

```typescript
import { Client } from "@langchain/langgraph-sdk";

const client = new Client({ 
  apiUrl: process.env.LANGGRAPH_API_URL 
});

// 流式调用 Agent
const stream = client.runs.stream(
  threadId,
  assistantId,
  { input: { message: userMessage } }
);

for await (const event of stream) {
  // 通过 SSE 推送给前端
}
```

---

## 5. 实时通讯设计

### 5.1 双通道架构

**AI 问诊 - SSE (Server-Sent Events)**
- 用途：AI Agent 流式输出
- 协议：单向推送（服务端 → 客户端）
- 端点：`GET /api/ai-chat/stream`

**医生问诊 - WebSocket**
- 用途：医生与患者实时聊天
- 协议：双向通讯
- 端点：`ws://backend/doctor-chat?token=<jwt>`

### 5.2 SSE 事件类型

```typescript
// 1. Agent 思考中
{ type: 'thinking', data: '正在分析您的症状...' }

// 2. 工具调用
{ type: 'tool_call', data: { tool: 'coze_knowledge', status: 'running' } }

// 3. 内容流式输出
{ type: 'content', data: { delta: '建议您...' } }

// 4. 结构化数据
{ type: 'metadata', data: { sources: [...], medicalAdvice: {...} } }

// 5. 完成
{ type: 'done', data: { messageId: 'uuid' } }
```

### 5.3 WebSocket 消息协议

**客户端 → 服务端**
```typescript
{
  type: 'message' | 'typing' | 'read' | 'heartbeat',
  conversationId: string,
  data: {
    content?: string,
    contentType?: 'text' | 'image',
    imageUrl?: string, // 已上传到 Supabase Storage
  }
}
```

**服务端 → 客户端**
```typescript
{
  type: 'message' | 'typing' | 'system',
  conversationId: string,
  message: {
    id: string,
    senderId: string,
    senderType: 'patient' | 'doctor' | 'system',
    contentType: 'text' | 'image' | 'system',
    content: string,
    metadata?: {...},
    createdAt: string,
  }
}
```

### 5.4 连接管理

**WebSocket 连接**
- 连接时携带 JWT Token 进行身份验证
- 服务端维护 `Map<userId, WebSocketConnection>`
- 心跳机制：客户端每 30 秒发送心跳，服务端 60 秒无心跳则断开

**断线重连**
- 自动重连（指数退避策略）
- 重连后同步未读消息

---

## 6. API 设计

### 6.1 RESTful API 端点

#### 身份认证
```
POST   /api/auth/register          # 用户注册
POST   /api/auth/login             # 用户登录
POST   /api/auth/refresh           # 刷新 Token
GET    /api/auth/profile           # 获取用户信息
PUT    /api/auth/profile           # 更新用户信息
```

#### AI 问诊
```
POST   /api/ai-chat/conversations  # 创建 AI 会话
GET    /api/ai-chat/conversations  # 获取会话列表
GET    /api/ai-chat/conversations/:id/messages  # 获取消息历史
GET    /api/ai-chat/stream         # SSE 流式问诊
POST   /api/ai-chat/upload-image   # 上传图片（OCR 用）
```

#### 专家问诊
```
GET    /api/doctors                # 获取医生列表（支持筛选）
GET    /api/doctors/:id            # 获取医生详情
POST   /api/consultations          # 发起问诊请求
GET    /api/consultations          # 获取问诊列表
GET    /api/consultations/:id      # 获取问诊详情
PUT    /api/consultations/:id/status  # 医生接诊/结束
POST   /api/consultations/:id/messages  # 发送消息（备用）
POST   /api/consultations/upload-image  # 上传聊天图片
```

#### 预约挂号
```
GET    /api/hospitals              # 获取医院列表
GET    /api/departments            # 获取科室列表
GET    /api/appointments/schedule  # 获取医生排班
POST   /api/appointments           # 创建预约
GET    /api/appointments           # 获取我的预约
PUT    /api/appointments/:id/cancel  # 取消预约
```

### 6.2 通用响应格式

```typescript
// 成功
{
  code: 0,
  data: any,
  message: 'success'
}

// 失败
{
  code: 1001,  // 业务错误码
  message: '错误描述',
  data: null
}
```

---

## 7. 小程序前端设计

### 7.1 目录结构

```
miniprogram/
├── src/
│   ├── app.tsx                    # 应用入口
│   ├── app.config.ts              # 小程序配置
│   ├── pages/                     # 页面
│   │   ├── index/                 # 首页
│   │   ├── ai-chat/               # AI 问诊
│   │   ├── doctor-list/           # 医生列表
│   │   ├── doctor-chat/           # 医生问诊
│   │   ├── appointment/           # 预约挂号
│   │   └── profile/               # 个人中心
│   ├── components/                # 公共组件
│   │   ├── ChatMessage/           # 消息组件
│   │   ├── DoctorCard/            # 医生卡片
│   │   └── ...
│   ├── store/                     # 状态管理（Zustand）
│   │   ├── userStore.ts           # 用户状态
│   │   ├── chatStore.ts           # 聊天状态
│   │   └── ...
│   ├── services/                  # API 服务
│   │   ├── api.ts                 # API 封装
│   │   ├── websocket.ts           # WebSocket 封装
│   │   └── sse.ts                 # SSE 封装
│   └── utils/                     # 工具函数
```

### 7.2 核心页面

**AI 问诊页面**
- 聊天界面（支持流式渲染）
- 特殊消息类型渲染：
  - 搜索结果卡片
  - 医疗建议结构化展示
  - 工具调用过程展示
- "转人工医生" 快捷操作
- 历史会话管理

**医生问诊页面**
- 实时聊天（WebSocket）
- 文字 + 图片消息
- 图片上传/预览
- 医生信息头部
- 输入状态提示（对方正在输入...）

**预约挂号页面**
- 医院/科室选择
- 日历组件（选择日期）
- 医生排班展示
- 预约确认弹窗

**医生端页面**
- 问诊列表（待接诊/进行中）
- 实时聊天界面
- 接诊/结束问诊操作

### 7.3 状态管理（Zustand）

```typescript
// userStore.ts
interface UserState {
  user: User | null;
  token: string | null;
  login: (credentials) => Promise<void>;
  logout: () => void;
}

// chatStore.ts
interface ChatState {
  conversations: Conversation[];
  messages: Map<conversationId, Message[]>;
  addMessage: (conversationId, message) => void;
  streamMessage: (conversationId, delta) => void;
}
```

---

## 8. 错误处理

### 8.1 错误分类处理

**网络错误**
- 超时重试（最多 3 次）
- 降级提示用户

**业务错误**
- Token 过期 → 自动刷新
- 权限不足 → 跳转登录页
- 医生离线 → 提示并推荐其他医生

**AI Agent 错误**
- LLM API 故障 → 降级到基础问答
- 工具调用失败 → 跳过该工具继续执行
- 超时 → 返回部分结果

**WebSocket 断线**
- 自动重连（指数退避）
- 重连后同步未读消息

---

## 9. 本地开发与验证

### 9.1 环境准备

**后端环境变量**
```bash
# LangGraph
LANGGRAPH_API_URL=xxx
LANGGRAPH_ASSISTANT_ID=xxx

# Coze
COZE_API_KEY=xxx
COZE_WORKFLOW_ID=xxx

# Supabase
SUPABASE_URL=xxx
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx

# JWT
JWT_SECRET=xxx

# Server
PORT=3000
```

**小程序环境配置**
```typescript
// config.ts
export const API_BASE_URL = 'http://localhost:3000/api';
export const WS_URL = 'ws://localhost:3000/doctor-chat';
```

### 9.2 本地启动流程

1. **启动 Supabase**（本地或云端）
2. **启动后端服务**
   ```bash
   cd backend
   npm install
   npm run dev  # 监听 3000 端口
   ```
3. **启动小程序**
   ```bash
   cd miniprogram
   npm install
   npm run dev:weapp  # 微信开发者工具
   ```

### 9.3 测试验证重点

**AI 问诊流程**
- 发送消息 → 观察 SSE 流式输出
- 验证工具调用（Coze、搜索）
- 检查消息存储到数据库

**医生问诊流程**
- 双端 WebSocket 连接
- 实时消息收发
- 图片上传和展示
- 断线重连

**预约挂号流程**
- Mock 数据展示
- 预约创建和查询
- 预约取消

---

## 10. 技术风险与应对

| 风险 | 应对措施 |
|------|---------|
| LangGraph.js 部署复杂 | 使用 LangGraph Cloud 或本地运行 |
| Coze API 限流 | 缓存常见问题答案，降低调用频率 |
| WebSocket 连接不稳定 | 实现自动重连 + 消息持久化 |
| 小程序包体积过大 | 代码分包、图片懒加载 |
| AI 回复不准确 | 收集反馈持续优化 Prompt |

---

## 11. 后续扩展方向

**功能扩展**
- 健康档案管理
- 用药提醒
- 视频问诊
- 处方开具

**技术优化**
- 引入 Redis 缓存
- AI 回复质量监控
- 性能监控和日志系统
- 多端适配（H5、App）

---

## 附录：关键决策记录

1. **为什么选择 Taro？**  
   React 生态、跨端能力、技术栈统一

2. **为什么用 LangGraph.js 而不是全用 Coze？**  
   完全掌控 Agent 逻辑，灵活性更高；Coze 仅作为知识库工具

3. **为什么 AI 问诊用 SSE 而非 WebSocket？**  
   AI 流式输出是单向通讯，SSE 更轻量简单

4. **为什么 MVP 阶段用 Mock 数据？**  
   快速验证产品逻辑，降低第三方对接复杂度

5. **为什么不考虑部署？**  
   MVP 阶段仅需本地验证，先验证技术可行性
