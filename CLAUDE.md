# 小禾AI医生 - Claude AI 开发规范

## 项目概述

小禾AI医生是一个基于 AI 的医疗咨询平台，提供：
- **AI 问诊**：基于 LangGraph.js 的智能医疗咨询 Agent
- **专家问诊**：连接专业医生的在线咨询
- **预约挂号**：医院门诊预约服务
- **文件上传**：医疗影像/报告上传分析

**技术栈**：Node.js + TypeScript + Express + LangGraph.js + WebSocket + Vitest

---

## 强制要求：必须遵循 Superpowers 规范

**在此项目中工作的所有 AI 助手和开发者，必须严格遵循 superpowers 工作流程。**

### 核心原则

1. **任何新功能开发前，必须使用 `superpowers:brainstorming` 技能**
   - 即使需求看似明确，也必须先进行头脑风暴
   - 确保完全理解用户意图和设计目标
   - 在编写代码前完成探索和规划

2. **遇到 Bug 或测试失败时，必须使用 `superpowers:systematic-debugging` 技能**
   - 在提出任何修复方案前进行系统性调试
   - 找到根本原因，而非症状修复

3. **实施任何功能前，必须使用 `superpowers:test-driven-development` 技能**
   - 先写测试，再写实现代码
   - 确保代码质量和可维护性

4. **有多项独立任务时，必须使用 `superpowers:dispatching-parallel-agents` 技能**
   - 并行处理独立任务以提高效率

5. **完成开发后，必须使用 `superpowers:verification-before-completion` 技能**
   - 在声称完成前运行验证命令
   - 用证据说话，而非凭空断言

### 何时使用计划模式

对于以下情况，**必须**进入计划模式（使用 `superpowers:writing-plans`）：

- 需要新增完整的 API 端点
- 涉及多个文件的修改（3个及以上）
- 需要架构决策的技术方案
- 不确定实现路径的复杂任务

**简单任务可直接实施**：
- 单行或少量代码修复
- 明确的小功能添加
- 纯研究/探索任务

### Superpowers 工作流程图

```
用户请求
    ↓
检查是否有相关技能适用？
    ↓ 是
调用 Skill 工具加载技能
    ↓
遵循技能中的检查清单
    ↓
创建 TodoWrite 任务跟踪
    ↓
执行任务
```

---

## 项目结构

```
xiaohe-ai-doctor/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── index.ts        # 入口文件
│   │   ├── routes/         # API 路由
│   │   ├── services/       # 业务逻辑
│   │   ├── agents/         # LangGraph AI Agent
│   │   ├── middleware/     # 中间件
│   │   └── utils/          # 工具函数
│   ├── tests/              # 集成/单元测试
│   └── package.json
├── docs/
│   └── plans/              # 开发计划文档
└── CLAUDE.md               # 本文件

```

---

## 开发工作流

### 1. 收到任务时

```
1. 检查是否需要调用 superpowers 技能（99% 情况需要）
2. 使用 Skill 工具加载相应技能
3. 按照技能检查清单创建 TodoWrite 任务
4. 执行任务
```

### 2. 提交代码前

- 运行 `pnpm test:run` 确保所有测试通过
- 运行 `pnpm build` 确保无编译错误
- 检查是否有安全隐患（SQL 注入、XSS 等）

### 3. Git 提交规范

```
feat: 新功能
fix: 修复 Bug
refactor: 重构
test: 测试相关
docs: 文档更新
chore: 构建/工具链相关
```

---

## API 开发规范

### 路由组织

```
backend/src/routes/
├── auth.ts           # 身份认证
├── ai-chat.ts        # AI 问诊
├── consultations.ts  # 专家问诊
├── appointments.ts   # 预约挂号
└── upload.ts         # 文件上传
```

### 错误处理

```typescript
// 统一错误响应格式
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "用户友好的错误描述"
  }
}
```

### 身份验证

- 使用 JWT Bearer Token
- 受保护路由需验证 `Authorization: Bearer <token>`
- Token 通过 `/api/auth/login` 获取

---

## AI Agent 规范 (LangGraph.js)

### Agent 结构

```typescript
// backend/src/agents/medical-agent.ts
export const medicalAgent = new StateGraph<{
  messages: BaseMessage[];
  userId: string;
}>()
  .addNode("triage", triageNode)
  .addNode("diagnose", diagnoseNode)
  .addEdge(START, "triage")
  .compile();
```

### 状态管理

- 使用 `conversationId` 追踪会话上下文
- 消息历史存储在数据库（MVP 阶段可使用内存）

---

## 测试规范

### 测试文件组织

```
backend/tests/
├── integration/      # API 集成测试
│   ├── auth.test.ts
│   ├── ai-chat.test.ts
│   └── upload.test.ts
└── unit/             # 单元测试
```

### 测试命令

```bash
# 监听模式（开发时使用）
pnpm test

# 单次运行（CI/CD 使用）
pnpm test:run
```

---

## 环境配置

### 必需的环境变量

```bash
# .env
OPENAI_API_KEY=sk-xxx
JWT_SECRET=your-secret-key
SUPABASE_URL=xxx
SUPABASE_ANON_KEY=xxx
PORT=3000
```

---

## 代码风格

### TypeScript

- 使用 strict 模式
- 优先使用 `const` > `let`
- 函数参数类型明确标注
- 避免使用 `any`，使用 `unknown` 或具体类型

### 命名约定

- 文件名：kebab-case (`ai-chat.ts`)
- 类名：PascalCase (`MedicalAgent`)
- 函数/变量：camelCase (`getUserInfo`)
- 常量：UPPER_SNAKE_CASE (`MAX_UPLOAD_SIZE`)

---

## 联系与支持

如有疑问或需要技术支持，请参考项目计划文档：
- `docs/plans/2026-01-23-xiaohe-ai-doctor-design.md`
- `docs/plans/2026-01-24-phase1-backend-agent-v2.md`

---

**最后更新**：2026-01-25
