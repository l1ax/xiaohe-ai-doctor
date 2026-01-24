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
