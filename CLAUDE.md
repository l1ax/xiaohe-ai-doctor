# 小禾AI医生 - Claude AI 开发规范

## 项目概述

小禾AI医生是一个基于 AI 的医疗咨询平台，提供：
- **AI 问诊**：基于 LangGraph.js 的智能医疗咨询 Agent
- **专家问诊**：连接专业医生的在线咨询
- **预约挂号**：医院门诊预约服务
- **文件上传**：医疗影像/报告上传分析

**技术栈**：Node.js + TypeScript + Express + LangGraph.js + WebSocket + Vitest + React (H5)

---

## 回答规范
对于产出的文档，还有过程中的回答，必须返回中文。

---

## Superpowers 规范

**对于复杂需求，必须遵循 superpowers 工作流程。** 简单任务可直接实施，无需遵循完整流程。

### 何时使用 Superpowers

对于**复杂需求**，必须使用相关技能：

| 场景 | 使用技能 |
|------|---------|
| 新功能开发前 | `superpowers:brainstorming` |
| Bug 或测试失败 | `superpowers:systematic-debugging` |
| 重要功能实施 | `superpowers:test-driven-development` |
| 多项独立任务 | `superpowers:dispatching-parallel-agents` |
| 开发完成前 | `superpowers:verification-before-completion` |

### 基本工作流程
brainstorming - Activates before writing code. Refines rough ideas through questions, explores alternatives, presents design in sections for validation. Saves design document.

using-git-worktrees - Activates after design approval. Creates isolated workspace on new branch, runs project setup, verifies clean test baseline.

writing-plans - Activates with approved design. Breaks work into bite-sized tasks (2-5 minutes each). Every task has exact file paths, complete code, verification steps.

subagent-driven-development or executing-plans - Activates with plan. Dispatches fresh subagent per task with two-stage review (spec compliance, then code quality), or executes in batches with human checkpoints.

test-driven-development - Activates during implementation. Enforces RED-GREEN-REFACTOR: write failing test, watch it fail, write minimal code, watch it pass, commit. Deletes code written before tests.

requesting-code-review - Activates between tasks. Reviews against plan, reports issues by severity. Critical issues block progress.

finishing-a-development-branch - Activates when tasks complete. Verifies tests, presents options (merge/PR/keep/discard), cleans up worktree.

The agent checks for relevant skills before any task. Mandatory workflows, not suggestions

### 计划模式使用场景

对于以下情况，必须进入计划模式（使用 `superpowers:writing-plans`）：

- 需要新增完整的 API 端点
- 涉及多个文件的修改（3个及以上）
- 需要架构决策的技术方案
- 不确定实现路径的复杂任务

### 简单任务可直接实施

以下任务无需使用 Superpowers 流程：

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
1. 评估任务复杂度
2. 简单任务直接实施，复杂任务使用 Skill 工具加载相应技能
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
