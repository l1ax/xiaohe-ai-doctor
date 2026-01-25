# 小禾AI医生 - 前端设计文档

**项目名称**: 小禾AI医生 (Xiaohe AI Doctor)
**平台**: H5（移动端 Web）
**版本**: v1.0
**创建日期**: 2026-01-25
**最后更新**: 2026-01-25

---

## 1. 项目概述

### 1.1 前端范围

本文档描述小禾AI医生 H5 前端的详细设计方案，涵盖：
- 项目初始化与工程配置
- 页面还原（基于 `frontendDesign/` 设计稿）
- 登录认证功能对接
- 状态管理与路由架构
- API 服务层封装

### 1.2 设计稿来源

设计稿位于 `frontendDesign/` 目录，包含以下页面：
| 文件名 | 页面名称 |
|--------|----------|
| homeScreen.html | 首页 |
| profile.html | 个人中心 |
| aichat.html | AI 问诊 |
| doctorChat.html | 医生问诊 |
| doctorConsole.html | 医生工作台 |
| expertDirectory.html | 专家目录 |
| hospitalBooking.html | 预约挂号 |
| messageCenter.html | 消息中心 |
| prescribe.html | 电子处方 |

**还原原则**：
- 风格和布局严格遵守设计稿
- 组件拆分和细粒度化由开发者自行决定

---

## 2. 技术架构

### 2.1 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| **前端框架** | React 18 + TypeScript | H5 移动端开发 |
| **构建工具** | Vite | 快速构建工具 |
| **UI 样式** | Tailwind CSS | 与设计稿一致的主题配置 |
| **状态管理** | MobX | 轻量级状态管理 |
| **路由** | React Router v6 | SPA 路由 |
| **HTTP 客户端** | Fetch + 封装 | API 请求 |
| **图标** | Material Symbols Outlined | Google 字体图标 |

### 2.2 项目结构

```
frontend/
├── src/
│   ├── main.tsx                   # 应用入口
│   ├── App.tsx                    # 根组件
│   ├── router.tsx                 # 路由配置
│   ├── pages/                     # 页面组件
│   │   ├── Login/                 # 登录页
│   │   │   ├── index.tsx          # 页面主组件
│   │   │   ├── PhoneInput.tsx     # 手机号输入
│   │   │   ├── VerifyCodeInput.tsx # 验证码输入
│   │   │   └── LoginButton.tsx    # 登录按钮
│   │   └── Home/                  # 首页
│   │       ├── index.tsx          # 页面主组件
│   │       ├── Header.tsx         # 顶部导航栏
│   │       ├── SearchBar.tsx      # 搜索框
│   │       ├── FeatureCard.tsx    # 功能入口卡片
│   │       ├── DepartmentGrid.tsx # 科室网格
│   │       ├── DepartmentItem.tsx # 科室单项
│   │       ├── NewsCard.tsx       # 资讯卡片
│   │       └── BottomNav.tsx      # 底部导航栏
│   ├── components/                # 公共组件
│   │   ├── Button/                # 按钮组件
│   │   ├── Input/                 # 输入框组件
│   │   ├── Modal/                 # 弹窗组件
│   │   ├── Toast/                 # 轻提示
│   │   └── Loading/               # 加载组件
│   ├── store/                     # MobX 状态管理
│   │   ├── userStore.ts           # 用户状态
│   │   └── index.ts               # Store 导出
│   ├── services/                  # API 服务层
│   │   ├── api.ts                 # HTTP 封装
│   │   ├── auth.ts                # 认证 API
│   │   └── index.ts               # 服务导出
│   ├── hooks/                     # 自定义 Hooks
│   │   ├── useCountdown.ts        # 倒计时 Hook
│   │   ├── useAuth.ts             # 认证状态 Hook
│   │   └── useToast.ts            # Toast Hook
│   ├── utils/                     # 工具函数
│   │   ├── request.ts             # 请求封装
│   │   ├── storage.ts             # 本地存储
│   │   └── helpers.ts             # 辅助函数
│   └── styles/                    # 全局样式
│       └── index.css              # Tailwind 指令
├── index.html                     # HTML 入口
├── vite.config.ts                 # Vite 配置
├── tailwind.config.js             # Tailwind 配置
└── tsconfig.json                  # TypeScript 配置
```

---

## 3. 设计规范（基于设计稿）

### 3.1 颜色系统

```javascript
// tailwind.config.js
colors: {
  primary: '#13a4ec',
  'primary-dark': '#0e8bc7',
  'background-light': '#f6f7f8',
  'background-dark': '#101c22',
  'surface-light': '#ffffff',
  'surface-dark': '#1c2a33',
  'text-main-light': '#0d171b',
  'text-main-dark': '#e0e6e9',
  'text-sec-light': '#4c809a',
  'text-sec-dark': '#8daab9',
}
```

### 3.2 字体

```javascript
fontFamily: {
  display: ['Noto Sans SC', 'Manrope', 'PingFang SC', 'sans-serif'],
}
```

### 3.3 圆角

```javascript
borderRadius: {
  DEFAULT: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  '2xl': '1rem',
  full: '9999px',
}
```

### 3.4 阴影

```javascript
boxShadow: {
  soft: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
}
```

### 3.5 深色模式

设计稿支持深色模式，使用 `dark:` 前缀：
- 背景色：`dark:bg-background-dark`
- 文字色：`dark:text-text-main-dark`
- 表面色：`dark:bg-surface-dark`

---

## 4. 登录页面详细设计

### 4.1 页面结构

```
┌─────────────────────────┐
│     小禾AI医生 Logo      │
│                         │
│    手机号输入框          │
│    (+86) 138 0000 0000  │
│                         │
│    获取验证码 按钮       │
│                         │
│    验证码输入框          │
│    ○ ○ ○ ○ ○ ○         │
│                         │
│    登录/注册 按钮        │
│                         │
│  登录即同意《用户协议》  │
│  和《隐私政策》          │
└─────────────────────────┘
```

### 4.2 组件拆分

```
pages/Login/
├── index.tsx              # 页面主组件（表单状态）
├── PhoneInput.tsx         # 手机号输入组件
├── VerifyCodeInput.tsx    # 验证码输入组件
└── LoginButton.tsx        # 登录按钮
```

### 4.3 交互流程

```
1. 用户输入手机号 → 点击"获取验证码"
   ↓
2. 调用 POST /api/auth/send-code
   ↓
3. 倒计时 60s（可重新发送）
   ↓
4. 输入验证码 → 点击"登录"
   ↓
5. 调用 POST /api/auth/login
   ↓
6. 存储 token（accessToken + refreshToken）
   ↓
7. 跳转首页 /Home
```

### 4.4 状态管理

```typescript
// store/userStore.ts
interface User {
  id: string;
  phone: string;
  nickname?: string;
  avatarUrl?: string;
  role: 'patient' | 'doctor';
}

class UserStore {
  user: User | null = null;
  accessToken: string | null = null;
  refreshToken: string | null = null;

  // 发送验证码
  async sendCode(phone: string): Promise<void> {
    await authApi.sendCode(phone);
  }

  // 登录
  async login(phone: string, verifyCode: string): Promise<void> {
    const res = await authApi.login(phone, verifyCode);
    this.user = res.data.user;
    this.accessToken = res.data.accessToken;
    this.refreshToken = res.data.refreshToken;
    storage.set('accessToken', this.accessToken);
    storage.set('refreshToken', this.refreshToken);
  }

  // 登出
  logout(): void {
    this.user = null;
    this.accessToken = null;
    this.refreshToken = null;
    storage.remove('accessToken');
    storage.remove('refreshToken');
    router.push('/login');
  }
}
```

### 4.5 API 服务封装

```typescript
// services/auth.ts
export const sendCode = (phone: string) =>
  api.post('/auth/send-code', { phone });

export const login = (phone: string, verifyCode: string) =>
  api.post('/auth/login', { phone, verifyCode });

export const refreshToken = (refreshToken: string) =>
  api.post('/auth/refresh', { refreshToken });

export const getProfile = () =>
  api.get('/auth/profile');

export const updateProfile = (data: { nickname?: string; avatarUrl?: string }) =>
  api.put('/auth/profile', data);
```

### 4.6 错误处理

| 场景 | 提示信息 |
|------|----------|
| 手机号格式错误 | 请输入正确的手机号 |
| 验证码发送失败 | 验证码发送失败，请重试 |
| 登录验证码错误 | 验证码错误，请重新输入 |
| 网络异常 | 网络异常，请检查网络连接 |
| Token 过期 | 登录已过期，请重新登录 |

---

## 5. 首页还原方案

### 5.1 页面整体结构

```
┌─────────────────────────────┐
│  顶部栏                      │
│  [北京▼]  [通知🔔]           │
│  [🔍 搜索症状、医生或医院]    │
├─────────────────────────────┤
│  功能入口区                  │
│  ┌─────────┬────────────┐  │
│  │ AI问诊  │ 专家问诊   │  │
│  │ 卡片    │ 卡片       │  │
│  ├─────────┴────────────┤  │
│  │     预约挂号卡片      │  │
│  └──────────────────────┘  │
├─────────────────────────────┤
│  热门科室（8个图标+名称）     │
│  儿科 内科 口腔科 皮肤科 ... │
├─────────────────────────────┤
│  健康资讯（3条新闻列表）      │
│  [标题] [标签] [时间] [图片] │
├─────────────────────────────┤
│  ━━━ 底部导航栏 ━━━          │
│  [首页] [问诊] [挂号] [我的] │
└─────────────────────────────┘
```

### 5.2 组件拆分

```
pages/Home/
├── index.tsx                    # 页面主组件
├── components/
│   ├── Header.tsx               # 顶部栏（城市选择+通知）
│   ├── SearchBar.tsx            # 搜索框
│   ├── FeatureCard.tsx          # 功能入口卡片
│   ├── DepartmentGrid.tsx       # 热门科室网格
│   ├── DepartmentItem.tsx       # 单个科室项
│   ├── NewsCard.tsx             # 健康资讯卡片
│   └── BottomNav.tsx            # 底部导航栏
```

### 5.3 页面状态

```typescript
interface HomePageState {
  selectedCity: string;          // 当前城市
  unreadNotifications: number;   // 未读通知数
  hotDepartments: Department[];  // 热门科室
  healthNews: NewsItem[];        // 健康资讯
}

interface Department {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface NewsItem {
  id: string;
  title: string;
  category: string;
  time: string;
  imageUrl: string;
}
```

### 5.4 数据来源（MVP 阶段 Mock）

| 区域 | 数据 | 来源 |
|------|------|------|
| 热门科室 | 科室列表 | Mock 数据 |
| 健康资讯 | 新闻列表 | Mock 数据 |
| 城市选择 | 城市列表 | Mock 数据 |

后端 API 尚未实现，详见附录 A。

### 5.5 导航配置

```typescript
// router.tsx
const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'chat', element: <AIChat /> },
      { path: 'appointment', element: <Appointment /> },
      { path: 'profile', element: <Profile /> },
    ],
  },
]);
```

---

## 6. API 服务层设计

### 6.1 HTTP 封装

```typescript
// services/api.ts
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    method: string,
    endpoint: string,
    data?: object
  ): Promise<T> {
    const token = storage.get('accessToken');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: ApiResponse<T> = await response.json();

    if (result.code !== 0) {
      throw new Error(result.message || 'Request failed');
    }

    return result.data;
  }

  get<T>(endpoint: string) {
    return this.request<T>('GET', endpoint);
  }

  post<T>(endpoint: string, data?: object) {
    return this.request<T>('POST', endpoint, data);
  }

  put<T>(endpoint: string, data?: object) {
    return this.request<T>('PUT', endpoint, data);
  }

  delete<T>(endpoint: string) {
    return this.request<T>('DELETE', endpoint);
  }
}

export const api = new ApiClient(BASE_URL);
```

### 6.2 认证拦截器

```typescript
// 请求拦截器：自动添加 Token
// 响应拦截器：处理 Token 过期

api.interceptors.request.use((config) => {
  const token = storage.get('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token 过期，尝试刷新
      const refreshToken = storage.get('refreshToken');
      if (refreshToken) {
        try {
          const newTokens = await authApi.refreshToken(refreshToken);
          storage.set('accessToken', newTokens.accessToken);
          storage.set('refreshToken', newTokens.refreshToken);
          // 重试原请求
          return api.request(error.config.method, error.config.url);
        } catch {
          // 刷新失败，跳转登录
          userStore.logout();
        }
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 7. 错误处理规范

### 7.1 错误分类

| 类型 | 处理方式 |
|------|----------|
| 网络错误 | Toast 提示"网络异常，请重试" |
| 401 未授权 | 自动刷新 Token 或跳转登录页 |
| 403 禁止访问 | Toast 提示"无权访问" |
| 404 未找到 | Toast 提示"资源不存在" |
| 业务错误 | 显示后端返回的错误信息 |
| 系统错误 | Toast 提示"系统异常，请稍后重试" |

### 7.2 全局错误边界

```typescript
// components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component<{ children: React.ReactNode }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>页面加载失败，请刷新重试</div>;
    }
    return this.props.children;
  }
}
```

---

## 8. 测试策略

### 8.1 测试范围

| 类型 | 工具 | 范围 |
|------|------|------|
| 单元测试 | Vitest | 工具函数、Store |
| 组件测试 | React Testing Library | 关键组件逻辑 |
| E2E 测试 | Playwright | 登录流程、核心功能 |

### 8.2 登录流程测试用例

```typescript
// tests/login.test.ts
describe('Login', () => {
  it('should show error for invalid phone', async () => {
    render(<Login />);
    fireEvent.change(screen.getByPlaceholderText('请输入手机号'), {
      target: { value: 'invalid' },
    });
    expect(screen.getByText('请输入正确的手机号')).toBeInTheDocument();
  });

  it('should login successfully with valid code', async () => {
    mockApi.post('/auth/send-code').reply(200, { code: 0 });
    mockApi.post('/auth/login').reply(200, {
      code: 0,
      data: { user: mockUser, accessToken: 'token', refreshToken: 'refresh' },
    });

    render(<Login />);
    // 输入手机号、验证码、点击登录
    // 验证跳转首页
  });
});
```

---

## 附录 A：后端未实现功能

以下功能在后端尚未实现，前端 MVP 阶段需使用 Mock 数据：

### A.1 首页相关 API

| 功能 | 端点 | 状态 | 备注 |
|------|------|------|------|
| 获取城市列表 | `GET /api/cities` | ❌ 未实现 | 需 Mock 数据 |
| 获取热门科室 | `GET /api/departments/hot` | ❌ 未实现 | 需 Mock 数据 |
| 获取健康资讯 | `GET /api/news` | ❌ 未实现 | 需 Mock 数据 |
| 搜索功能 | `GET /api/search` | ❌ 未实现 | 需 Mock 数据 |

### A.2 通知消息相关 API

| 功能 | 端点 | 状态 | 备注 |
|------|------|------|------|
| 获取通知列表 | `GET /api/notifications` | ❌ 未实现 | 需 Mock 数据 |
| 标记已读 | `PUT /api/notifications/:id/read` | ❌ 未实现 | 需 Mock 数据 |
| 获取未读数 | `GET /api/notifications/unread-count` | ❌ 未实现 | 需 Mock 数据 |

### A.3 消息中心相关 API

| 功能 | 端点 | 状态 | 备注 |
|------|------|------|------|
| 获取会话列表 | `GET /api/messages/conversations` | ❌ 未实现 | 需 Mock 数据 |
| 获取消息详情 | `GET /api/messages/:conversationId` | ❌ 未实现 | 需 Mock 数据 |
| 删除消息 | `DELETE /api/messages/:id` | ❌ 未实现 | 需 Mock 数据 |

### A.4 AI 问诊相关 API

| 功能 | 端点 | 状态 | 备注 |
|------|------|------|------|
| 图片上传（OCR） | `POST /api/ai-chat/upload-image` | ❌ 未实现 | 需 Mock 数据 |
| 获取会话列表 | `GET /api/ai-chat/conversations` | ❌ 未实现 | 需 Mock 数据 |

### A.5 个人中心相关 API

| 功能 | 端点 | 状态 | 备注 |
|------|------|------|------|
| 家庭成员管理 | `GET /api/family` | ❌ 未实现 | 需 Mock 数据 |
| 添加家庭成员 | `POST /api/family` | ❌ 未实现 | 需 Mock 数据 |
| 地址管理 | `GET /api/addresses` | ❌ 未实现 | 需 Mock 数据 |
| 修改密码 | `PUT /api/auth/password` | ❌ 未实现 | 需 Mock 数据 |

### A.6 医生端相关 API

| 功能 | 端点 | 状态 | 备注 |
|------|------|------|------|
| 获取待接诊列表 | `GET /api/doctor/pending` | ❌ 未实现 | 需 Mock 数据 |
| 获取处方列表 | `GET /api/doctor/prescriptions` | ❌ 未实现 | 需 Mock 数据 |
| 开具处方 | `POST /api/doctor/prescriptions` | ❌ 未实现 | 需 Mock 数据 |

### A.7 Mock 数据建议格式

```typescript
// mock/departments.ts
export const mockDepartments = [
  { id: '1', name: '儿科', icon: 'child_care', color: 'bg-blue-50 text-primary' },
  { id: '2', name: '内科', icon: 'cardiology', color: 'bg-orange-50 text-orange-500' },
  { id: '3', name: '口腔科', icon: 'dentistry', color: 'bg-purple-50 text-purple-500' },
  { id: '4', name: '皮肤科', icon: 'face', color: 'bg-rose-50 text-rose-500' },
  { id: '5', name: '中医科', icon: 'spa', color: 'bg-emerald-50 text-emerald-500' },
  { id: '6', name: '外科', icon: 'orthopedics', color: 'bg-cyan-50 text-cyan-500' },
  { id: '7', name: '妇产科', icon: 'pregnant_woman', color: 'bg-pink-50 text-pink-500' },
  { id: '8', name: '更多', icon: 'grid_view', color: 'bg-slate-100 text-slate-500' },
];

// mock/news.ts
export const mockHealthNews = [
  {
    id: '1',
    title: '冬季如何有效增强免疫力？这里有5个妙招',
    category: '健康预防',
    time: '2小时前',
    imageUrl: 'https://...',
  },
  {
    id: '2',
    title: '65岁以上老年人年度体检发布新指南',
    category: '政策解读',
    time: '5小时前',
    imageUrl: 'https://...',
  },
  {
    id: '3',
    title: '定期洗牙为何对心脏健康至关重要？',
    category: '口腔护理',
    time: '1天前',
    imageUrl: 'https://...',
  },
];
```

---

## 附录 B：后端已实现 API 列表

### B.1 认证模块 ✅ 已实现

| 端点 | 方法 | 请求 | 响应 |
|------|------|------|------|
| `/api/auth/send-code` | POST | `{ phone: string }` | `{ code: 0, data: { message } }` |
| `/api/auth/login` | POST | `{ phone, verifyCode }` | `{ code: 0, data: { user, accessToken, refreshToken } }` |
| `/api/auth/refresh` | POST | `{ refreshToken }` | `{ code: 0, data: { accessToken, refreshToken } }` |
| `/api/auth/profile` | GET | - | `{ code: 0, data: { user } }` |
| `/api/auth/profile` | PUT | `{ nickname?, avatarUrl? }` | `{ code: 0, data: { user } }` |

**Mock 验证码**: `123456`

### B.2 AI 问诊模块 ✅ 核心功能已实现

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/ai-chat/stream` | GET | SSE 流式问诊 |
| `/api/ai-chat/conversations` | POST | 创建会话 |
| `/api/ai-chat/conversations/:id/messages` | GET | 获取消息历史 |

### B.3 专家问诊模块 ✅ 核心功能已实现

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/consultations/doctors` | GET | 获取医生列表 |
| `/api/consultations/doctors/:id` | GET | 获取医生详情 |
| `/api/consultations/departments` | GET | 获取科室列表 |
| `/api/consultations/hospitals` | GET | 获取医院列表 |
| `/api/consultations` | POST | 创建问诊 |
| `/api/consultations` | GET | 获取问诊列表 |
| `/api/consultations/:id` | GET | 获取问诊详情 |
| `/api/consultations/:id/status` | PUT | 更新问诊状态 |
| `/api/consultations/:id/join` | POST | 加入问诊 |
| `/api/consultations/:id/leave` | POST | 离开问诊 |

### B.4 预约挂号模块 ✅ 核心功能已实现

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/appointments/schedule` | GET | 获取医生排班 |
| `/api/appointments` | POST | 创建预约 |
| `/api/appointments` | GET | 获取我的预约 |
| `/api/appointments/:id` | GET | 获取预约详情 |
| `/api/appointments/:id/cancel` | PUT | 取消预约 |

### B.5 文件上传模块 ✅ 已实现

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/upload/image` | POST | 上传图片（需认证） |

---

## 附录 C：开发环境配置

### C.1 环境变量

```bash
# .env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000
```

### C.2 启动命令

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 构建生产版本
pnpm build

# 运行测试
pnpm test
```

---

**文档版本**: 1.0
**最后更新**: 2026-01-25
