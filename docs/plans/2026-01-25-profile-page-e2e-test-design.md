# Profile 页面与 E2E 测试设计方案

> **For Claude:** REQUIRED SUB-SKILL: 使用 superpowers:using-git-worktrees 创建隔离工作区，然后使用 superpowers:writing-plans 创建详细实现计划，最后使用 superpowers:subagent-driven-development 执行开发。

**Goal:** 完整还原 Profile 页面，实现登录串联，引入 Playwright E2E 测试验证后端接口联调。

**Architecture:**
- 页面采用组件化拆分，遵循设计稿布局
- 用户信息从 userStore 读取，与登录流程串联
- 未实现页面创建占位组件
- Playwright E2E 测试覆盖登录流程和页面跳转

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind CSS + MobX + Playwright

---

## 页面结构

```
frontend/src/pages/
├── Profile/           # 个人中心页（主页面）
│   ├── index.tsx      # 完整还原设计稿
│   └── components/    # 子组件
├── Appointments/      # 我的预约（占位）
├── Consultations/     # 问诊记录（占位）
├── Prescriptions/     # 电子处方（占位）
├── HealthRecords/     # 健康档案（占位）
├── FamilyMembers/     # 家庭成员管理（占位）
├── Address/           # 地址管理（占位）
├── CustomerService/   # 在线客服（占位）
├── Settings/          # 设置页
│   ├── index.tsx      # 退出登录 + 主题切换
└── VIP/               # VIP 推广页（占位）
```

## 页面还原要点

### Profile 页面（frontendDesign/profile.html）

1. **头部区域**（行 56-82）
   - 渐变背景：`bg-gradient-to-br from-primary via-[#0b8bc8] to-[#0870a3]`
   - 底部圆角：`rounded-b-[2.5rem]`
   - 头像：88x88px 圆形边框，带编辑按钮
   - 用户名 + 会员等级标签（白银会员）
   - 手机号（脱敏显示 138****1234）
   - 二维码按钮

2. **功能网格**（行 85-112）
   - 4个快捷入口：我的预约、问诊记录、电子处方、健康档案
   - 问诊记录带红点提示
   - 图标：calendar_month, clinical_notes, receipt_long, folder_shared

3. **VIP 推广横幅**（行 114-124）
   - 背景渐变：teal-500 to emerald-600
   - 标题：小荷健康VIP季卡
   - 副标题：无限次AI咨询 · 专家号优先约
   - 立即查看按钮

4. **列表区域**（行 125-167）
   - 家庭成员管理（diversity_3 图标）
   - 地址管理（location_on 图标）
   - 在线客服（headset_mic 图标）
   - 设置（settings 图标）
   - 点击跳转到对应页面

5. **底部导航**（行 172-195）
   - "我的"Tab 高亮（fill-1 + 字体加粗）

### Settings 页面

- 退出登录按钮
- 主题切换（深色/浅色模式）
- 与 userStore 串联

## 登录串联

- Profile 页面从 userStore.user 读取用户信息
- userStore.user 为 null 时显示未登录状态（头像+昵称占位）
- 登录成功后刷新 Profile 数据
- 退出登录清除数据并跳转首页/登录页

## E2E 测试方案

```
frontend/tests/e2e/
├── login.spec.ts       # 登录流程测试
├── profile.spec.ts     # Profile 页面测试
└── navigation.spec.ts  # 页面跳转测试
```

### 测试用例

**login.spec.ts:**
1. 未登录访问 Profile → 跳转登录页
2. 输入手机号获取验证码
3. 输入验证码 123456 → 登录成功
4. 登录成功后跳转到 Profile

**profile.spec.ts:**
1. 登录后访问 Profile → 显示用户信息
2. 验证头部：头像、用户名、手机号、会员标签
3. 验证功能入口数量（4个）
4. 验证 VIP 横幅显示
5. 验证列表入口（4个）

**navigation.spec.ts:**
1. 点击底部导航切换页面
2. 点击功能入口跳转到对应页面
3. 设置页面主题切换

### 测试命令

```bash
# 安装 Playwright
npm init playwright@latest

# 运行 E2E 测试
npx playwright test

# UI 模式
npx playwright test --ui
```

## 接口联调

后端 API 端点（需后端服务运行）：
- `POST /api/auth/send-code` - 发送验证码
- `POST /api/auth/login` - 登录
- `GET /api/auth/profile` - 获取用户信息
- `PUT /api/auth/profile` - 更新用户信息

前端 base URL：`http://localhost:3000/api`（可通过环境变量配置）

---

## 设计稿参考

- 完整设计稿：`frontendDesign/profile.html`
- 首页设计稿：`frontendDesign/homeScreen.html`（底部导航样式）
