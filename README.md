# 🏥 小荷 AI 医生 (Xiaohe AI Doctor)

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Frontend](https://img.shields.io/badge/Frontend-React%2018%20%7C%20MobX-61dafb)
![Backend](https://img.shields.io/badge/Backend-Express%20%7C%20LangGraph-green)
![AI](https://img.shields.io/badge/AI-DeepSeek%20%7C%20Agentic-purple)

**小荷 AI 医生** 是一个集成了 **Large Action Model (LAM)** 智能体、实时通信与专业医疗服务的综合问诊平台。项目旨在通过 AI Agent 解决初级分诊与常见病咨询，同时无缝连接真人专家，提供高效、精准的医疗服务体验。

---

## ✨ 核心特性

### 🤖 AI 智能问诊 (Smart Consultation)
- **Agentic Workflow**: 基于 `LangGraph` 构建的状态图，支持动态意图识别与路由。
- **ReAct 推理循环**: 能够进行"思考-行动-观察"循环，处理复杂医疗问题。
- **多工具调度**: 集成 `Tavily` 联网搜索、`Coze` 知识库查询等多种工具。
- **流式响应**: 支持 SSE (Server-Sent Events) 实时流式输出，提供打字机体验。

### 👨‍⚕️ 医生工作台 (Doctor Console)
- **实时接诊**: 基于 WebSocket 的实时消息推送，秒级响应患者咨询。
- **智能辅助**: 自动同步 AI 预问诊摘要，展示患者画像与历史记录。
- **任务管理**: 可视化看板管理待处理、进行中与已完成的问诊任务。

### 📱 全流程体验
- **预约挂号**: 完整的排班查询与预约流程。
- **多端适配**: 响应式设计，适配 PC 与移动端。

---

## 🛠️ 技术架构

### 系统架构图

```mermaid
graph TD
    subgraph Frontend [前端 (React + MobX)]
        UI[用户界面] <--> Store[MobX Store]
        Store <--> SSE[SSE Client (AI Stream)]
        Store <--> WS[WebSocket (Realtime Chat)]
    end

    subgraph Backend [后端 (Node.js + Express)]
        API[REST API]
        Event[SSE Controller]
        Socket[WebSocket Manager]
        
        subgraph Agent [AI Agent Service]
            Graph[LangGraph Core]
            Tools[Tool Registry]
        end
    end

    subgraph Database [Supabase]
        PG[(PostgreSQL)]
        Auth[Auth Service]
    end

    SSE --> Event
    WS <--> Socket
    UI --> API
    
    Event --> Graph
    Graph --> Tools
    Graph --> PG
    API --> PG
```

### 技术栈详细

| 模块 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **前端** | React 18, Vite | 现代化构建工具与 UI 库 |
| **状态管理** | MobX | 响应式状态管理，Entity View 模式 |
| **样式** | TailwindCSS | 原子化 CSS 框架 |
| **后端框架** | Express.js | 成熟稳定的 Node.js Web 框架 |
| **AI 编排** | LangGraph.js | 构建有状态、多角色的 Agent 应用 |
| **LLM** | DeepSeek V3/R1 | 高性能中文大语言模型 |
| **数据库** | Supabase | 基于 PostgreSQL 的开源 Firebase 替代品 |
| **通信** | SSE + WebSocket | 混合通信模式：AI 用 SSE，人际用 WS |

---

## 🚀 快速开始

### 前置要求
- Node.js >= 18.0.0
- PNPM >= 9.0.0
- Supabase CLI (可选，用于本地开发)

### 1. 克隆项目

```bash
git clone https://github.com/your-repo/xiaohe-ai-doctor.git
cd xiaohe-ai-doctor
```

### 2. 环境配置

在 `backend` 和 `frontend` 目录下分别创建 `.env` 文件。

**后端 (`backend/.env`):**

```env
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
DEEPSEEK_API_KEY=your_deepseek_key
TAVILY_API_KEY=your_tavily_key
COZE_API_KEY=your_coze_key
JWT_SECRET=your_jwt_secret
```

**前端 (`frontend/.env`):**

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

### 3. 安装依赖

```bash
# 安装根目录依赖（如果有）
pnpm install

# 安装后端依赖
cd backend
pnpm install

# 安装前端依赖
cd ../frontend
pnpm install
```

### 4. 启动项目

建议开启两个终端窗口分别启动前后端。

**启动后端:**

```bash
cd backend
pnpm dev
# 服务将在 http://localhost:3000 启动
```

**启动前端:**

```bash
cd frontend
pnpm dev
# 页面将在 http://localhost:5173 启动
```

---

## 📂 目录结构

```
xiaohe-ai-doctor/
├── backend/
│   ├── src/
│   │   ├── agent/          # LangGraph Agent 核心逻辑
│   │   ├── services/       # 业务服务 (WebSocket, Auth)
│   │   ├── routes/         # Express 路由
│   │   └── index.ts        # 入口文件
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── machines/       # 状态机 (如有)
│   │   ├── models/         # MobX 数据模型
│   │   ├── pages/          # 页面组件
│   │   ├── services/       # API 与 WS 服务
│   │   └── store/          # MobX Root Stores
│   └── package.json
└── README.md
```

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request
