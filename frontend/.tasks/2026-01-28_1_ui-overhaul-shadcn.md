# 背景
文件名：2026-01-28_1_ui-overhaul-shadcn.md
创建于：2026-01-28_02:05:00
创建者：Antigravity
主分支：main
任务分支：task/ui-overhaul-shadcn_2026-01-28_1
Yolo模式：Ask

# 任务描述
使用现代 UI 库（shadcn-ui）优化整个项目的 UI，保持风格一致，提升设计感，符合 AI 医生 App 的体验，且不影响功能。

# 项目概览
当前项目是一个 React + Vite + Tailwind CSS 的前端项目。
- 依赖：React 18, MobX, XState, React Router, Tailwind CSS.
- 状态：shadcn-ui 尚未初始化。

# 分析
1.  **现有 UI**：使用 Tailwind CSS 自定义配置 (`tailwind.config.js`)，定义了一些颜色 (`primary`, `bubble-ai` 等) 和动画。
2.  **目标**：引入 shadcn-ui，替换手写的复杂样式，利用其设计系统（tokens, primitives）。
3.  **挑战**：
    - 需要合并现有的 tailwind 配置与 shadcn 的配置。
    - 需要保留原有的业务逻辑（App 逻辑），仅替换 UI 展示层。
    - 需要逐个组件进行迁移。

# 提议的解决方案
1.  **初始化**：运行 `npx shadcn@latest init`。
    - Style: Default (or New York?) -> Default usually simpler to start.
    - Base Color: Slate/Blue? -> User uses `#13a4ec` (Blue-ish), so maybe Blue is good.
    - CSS Variables: Yes.
2.  **配置**：合并 `tailwind.config.js`。保留原有的 `keyframes` 和 `animations` 如果 shadcn 没有覆盖，或者迁移到 shadcn 的方式。
3.  **组件替换**：
    - Button -> shadcn Button
    - Input/Textarea -> shadcn Input/Textarea
    - Modal/Dialog -> shadcn Dialog
    - Cards -> shadcn Card
4.  **主题定制**：调整 shadcn 的 CSS 变量以匹配“AI 医生”的品牌色（蓝色系）。

# 当前执行步骤
1.  初始化 shadcn-ui

# 任务进度
[2026-01-28 02:05:00] 任务开始，创建文件。
