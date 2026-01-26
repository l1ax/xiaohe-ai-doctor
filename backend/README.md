# 小禾AI医生 - Backend API

## 技术栈

- Node.js + TypeScript
- Express.js
- LangGraph.js (AI Agent)
- WebSocket (实时通讯)
- Vitest (测试)

## 本地开发

### 环境变量

复制 `.env.example` 到 `.env` 并配置：

```bash
cp .env.example .env
```

### 安装依赖

```bash
pnpm install
```

### 启动开发服务器

```bash
pnpm dev
```

### 运行测试

```bash
# 单次运行
pnpm test:run

# 监听模式
pnpm test
```

### 构建

```bash
pnpm build
```

## 新增功能：AI Agent 工具增强

### 多模态支持

Agent 现在支持处理用户上传的医疗图片：
- 症状图片识别
- 药品包装识别
- 医疗报告识别

基于智谱 glm-4v 多模态模型，根据不同意图使用定制化识别 prompt。

### 知识库集成

集成 Coze 医疗知识库，提供更准确的医疗知识：
- 自动查询相关知识
- 优先使用知识库内容回答
- 最多返回 4 条相关文档，最小匹配度 0.7

### 网络搜索

支持实时搜索最新医疗信息：
- 知识库无结果时自动降级
- 搜索结果智能摘要（基于 Tavily API）
- 最多返回 3 条搜索结果

### 工具调用流程

```
用户消息（可包含图片）
  ↓
意图分类
  ↓
工具编排器
  ├─ 1. 图片识别（如有图片）
  ├─ 2. 知识库查询（优先）
  └─ 3. 网络搜索（降级）
  ↓
LLM 生成回答（基于工具增强的上下文）
  ↓
流式返回给用户
```

### 环境变量配置

需要以下新增环境变量：

```bash
# Supabase Storage（图片上传）
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Coze 知识库
COZE_API_KEY=your-coze-api-key
COZE_BASE_URL=https://api.coze.cn
COZE_WORKFLOW_ID=your-workflow-id

# Tavily 搜索
TAVILY_API_KEY=your-tavily-api-key
```

### 可靠性保证

多层降级机制确保服务可用性：
- 图片识别失败 → 忽略图片，继续后续流程
- 知识库查询失败/无结果 → 降级到网络搜索
- 网络搜索失败 → 降级到纯 LLM 回答
- 所有工具都失败 → 保底使用纯 LLM（原有逻辑）

### 性能指标

- 图片识别响应时间: < 10s
- 知识库查询响应时间: < 5s
- 网络搜索响应时间: < 8s
- 整体响应时间: < 15s（含工具调用和 LLM 生成）

---

## API 文档

### 身份认证

#### 发送验证码
```
POST /api/auth/send-code
Body: { phone: string }
```

#### 登录/注册
```
POST /api/auth/login
Body: { phone: string, verifyCode: string }
```

#### 获取用户信息
```
GET /api/auth/profile
Headers: Authorization: Bearer <token>
```

### AI 问诊

#### SSE 流式问诊
```
GET /api/ai-chat/stream?message=xxx&conversationId=xxx
```

#### 获取消息历史
```
GET /api/ai-chat/conversations/:id/messages
Headers: Authorization: Bearer <token>
```

### 专家问诊

#### 获取医生列表
```
GET /api/consultations/doctors?department=xxx&hospital=xxx
Headers: Authorization: Bearer <token>
```

#### 创建问诊
```
POST /api/consultations
Headers: Authorization: Bearer <token>
Body: { doctorId: string }
```

#### WebSocket 连接
```
ws://localhost:3000/ws?token=<jwt>
```

### 预约挂号

#### 获取医生排班
```
GET /api/appointments/schedule?doctorId=xxx&startDate=xxx&endDate=xxx
Headers: Authorization: Bearer <token>
```

#### 创建预约
```
POST /api/appointments
Headers: Authorization: Bearer <token>
Body: { doctorId: string, appointmentTime: string, patientName: string }
```

### 文件上传

#### 上传图片
```
POST /api/upload/image
Headers: Authorization: Bearer <token>
Content-Type: multipart/form-data
Body: file (binary)
```

## MVP 阶段说明

- 验证码：固定为 `123456`
- 医生数据：使用 Mock 数据
- 预约数据：内存存储
- 存储服务：需配置 Supabase

## 后续扩展

- 接入真实短信服务
- 数据库持久化
- 日志监控
- API 文档自动生成
