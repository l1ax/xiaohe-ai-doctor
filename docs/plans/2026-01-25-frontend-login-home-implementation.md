# 前端登录与首页还原实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完成小禾AI医生前端项目初始化，实现登录页面和首页还原，严格遵循 frontendDesign/ 设计稿风格。

**Architecture:** React 18 + TypeScript + Vite + Tailwind CSS + MobX，前端独立目录 frontend/，对接后端已实现的 /api/auth/* API。

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, MobX, React Router v6

---

## 前置准备

### Task 0: 初始化前端项目

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/src/styles/index.css`

**Step 1: 创建 package.json**

```json
{
  "name": "xiaohe-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "mobx": "^6.10.0",
    "mobx-react-lighter": "^7.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.3.5",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  }
}
```

**Step 2: 创建 vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
```

**Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**Step 4: 创建 tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

**Step 5: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>小禾AI医生</title>
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**Step 6: 创建 tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
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
      },
      fontFamily: {
        display: ['Noto Sans SC', 'Manrope', 'PingFang SC', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        full: '9999px',
      },
      boxShadow: {
        soft: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
};
```

**Step 7: 创建 postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Step 8: 创建 src/styles/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
.material-symbols-outlined.filled {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
body {
  min-height: max(884px, 100dvh);
}
```

**Step 9: 安装依赖并验证**

```bash
cd frontend
pnpm install
npm run build
```

Expected: BUILD SUCCESS

**Step 10: Commit**

```bash
git add frontend/
git commit -m "feat: initialize frontend project with Vite + React + TypeScript + Tailwind"
```

---

## 工具函数层

### Task 1: 创建存储工具

**Files:**
- Create: `frontend/src/utils/storage.ts`

**Step 1: 创建 storage.ts**

```typescript
const TOKEN_KEY = 'xiaohe_token';
const USER_KEY = 'xiaohe_user';

export const storage = {
  get<T>(key: string): T | null {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  },
  set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove(key: string): void {
    localStorage.removeItem(key);
  },
  getToken() {
    return storage.get<{ accessToken: string; refreshToken: string }>(TOKEN_KEY);
  },
  setToken(tokens: { accessToken: string; refreshToken: string }) {
    storage.set(TOKEN_KEY, tokens);
  },
  removeToken() {
    storage.remove(TOKEN_KEY);
  },
  getUser() {
    return storage.get<{ id: string; phone: string; nickname?: string; avatarUrl?: string; role: string }>(USER_KEY);
  },
  setUser(user: { id: string; phone: string; nickname?: string; avatarUrl?: string; role: string }) {
    storage.set(USER_KEY, user);
  },
  removeUser() {
    storage.remove(USER_KEY);
  },
  clear() {
    this.removeToken();
    this.removeUser();
  },
};
```

**Step 2: Commit**

```bash
git add frontend/src/utils/storage.ts
git commit -m "feat: add storage utility for token and user persistence"
```

---

### Task 2: 创建 HTTP 请求封装

**Files:**
- Create: `frontend/src/utils/request.ts`

**Step 1: 创建 request.ts**

```typescript
import { storage } from './storage';

interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

class Request {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
  }

  private getHeaders(): HeadersInit {
    const tokenData = storage.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (tokenData?.accessToken) {
      headers['Authorization'] = `Bearer ${tokenData.accessToken}`;
    }
    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result: ApiResponse<T> = await response.json();
    if (result.code !== 0) {
      throw new Error(result.message || 'Request failed');
    }
    return result.data;
  }

  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(response);
  }

  async post<T>(endpoint: string, data?: object): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async put<T>(endpoint: string, data?: object): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });
    return this.handleResponse<T>(response);
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse<T>(response);
  }
}

export const request = new Request();
```

**Step 2: Commit**

```bash
git add frontend/src/utils/request.ts
git commit -m "feat: add HTTP request utility"
```

---

## API 服务层

### Task 3: 创建认证 API 服务

**Files:**
- Create: `frontend/src/services/auth.ts`

**Step 1: 创建 auth.ts**

```typescript
import { request } from '../utils/request';

export interface User {
  id: string;
  phone: string;
  nickname?: string;
  avatarUrl?: string;
  role: 'patient' | 'doctor';
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  sendCode(phone: string) {
    return request.post<{ message: string }>('/auth/send-code', { phone });
  },

  login(phone: string, verifyCode: string) {
    return request.post<LoginResponse>('/auth/login', { phone, verifyCode });
  },

  refreshToken(refreshToken: string) {
    return request.post<{ accessToken: string; refreshToken: string }>('/auth/refresh', { refreshToken });
  },

  getProfile() {
    return request.get<{ user: User }>('/auth/profile');
  },

  updateProfile(data: { nickname?: string; avatarUrl?: string }) {
    return request.put<{ user: User }>('/auth/profile', data);
  },
};
```

**Step 2: Commit**

```bash
git add frontend/src/services/auth.ts
git commit -m "feat: add auth API service"
```

---

## 状态管理

### Task 4: 创建 MobX UserStore

**Files:**
- Create: `frontend/src/store/userStore.ts`
- Create: `frontend/src/store/index.ts`

**Step 1: 创建 userStore.ts**

```typescript
import { makeAutoObservable, runInAction } from 'mobx';
import { authApi, User } from '../services/auth';
import { storage } from '../utils/storage';

class UserStore {
  user: User | null = null;
  accessToken: string | null = null;
  refreshToken: string | null = null;
  loading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
    this.loadFromStorage();
  }

  private loadFromStorage() {
    const tokenData = storage.getToken();
    const userData = storage.getUser();
    if (tokenData && userData) {
      this.accessToken = tokenData.accessToken;
      this.refreshToken = tokenData.refreshToken;
      this.user = userData;
    }
  }

  get isLoggedIn() {
    return !!this.accessToken && !!this.user;
  }

  async sendCode(phone: string) {
    try {
      this.loading = true;
      this.error = null;
      await authApi.sendCode(phone);
    } catch (e: any) {
      this.error = e.message;
      throw e;
    } finally {
      this.loading = false;
    }
  }

  async login(phone: string, verifyCode: string) {
    try {
      this.loading = true;
      this.error = null;
      const response = await authApi.login(phone, verifyCode);
      runInAction(() => {
        this.user = response.user;
        this.accessToken = response.accessToken;
        this.refreshToken = response.refreshToken;
        storage.setToken({ accessToken: response.accessToken, refreshToken: response.refreshToken });
        storage.setUser(response.user);
      });
    } catch (e: any) {
      this.error = e.message;
      throw e;
    } finally {
      this.loading = false;
    }
  }

  logout() {
    this.user = null;
    this.accessToken = null;
    this.refreshToken = null;
    storage.clear();
  }

  async refreshToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token');
    }
    try {
      const response = await authApi.refreshToken(this.refreshToken);
      runInAction(() => {
        this.accessToken = response.accessToken;
        this.refreshToken = response.refreshToken;
        storage.setToken({ accessToken: response.accessToken, refreshToken: response.refreshToken });
      });
    } catch (e) {
      this.logout();
      throw e;
    }
  }
}

export const userStore = new UserStore();
```

**Step 2: 创建 index.ts**

```typescript
export { userStore } from './userStore';
```

**Step 3: Commit**

```bash
git add frontend/src/store/
git commit -m "feat: add MobX userStore for authentication state"
```

---

## 路由配置

### Task 5: 创建路由配置

**Files:**
- Create: `frontend/src/router.tsx`

**Step 1: 创建 router.tsx**

```typescript
import { createBrowserRouter } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import Layout from './components/Layout';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'chat', element: <div>问诊页面（开发中）</div> },
      { path: 'appointment', element: <div>挂号页面（开发中）</div> },
      { path: 'profile', element: <div>个人中心（开发中）</div> },
    ],
  },
]);
```

**Step 2: Commit**

```bash
git add frontend/src/router.tsx
git commit -m "feat: add router configuration"
```

---

## 公共组件

### Task 6: 创建 Layout 组件（底部导航栏）

**Files:**
- Create: `frontend/src/components/Layout.tsx`

**Step 1: 创建 Layout.tsx**

```typescript
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', icon: 'home', label: '首页', filled: location.pathname === '/' },
    { path: '/chat', icon: 'chat_bubble_outline', label: '问诊', hasBadge: true },
    { path: '/appointment', icon: 'calendar_month', label: '挂号' },
    { path: '/profile', icon: 'person', label: '我的' },
  ];

  return (
    <div className="min-h-screen max-w-md mx-auto bg-background-light dark:bg-background-dark">
      <Outlet />
      <nav className="fixed bottom-0 left-0 w-full bg-white dark:bg-surface-dark border-t border-gray-200 dark:border-gray-800 h-20 pb-4 px-6 z-40 max-w-md mx-auto">
        <div className="flex justify-between items-center h-14">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center justify-center gap-1 w-14 ${
                item.filled ? 'text-primary' : 'text-text-sec-light dark:text-text-sec-dark'
              }`}
            >
              <div className="relative">
                <span className="material-symbols-outlined text-[26px]">
                  {item.filled && item.icon === 'home' ? 'home' : item.icon}
                </span>
                {item.hasBadge && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "feat: add Layout component with bottom navigation"
```

---

## 登录页面

### Task 7: 创建登录页面主组件

**Files:**
- Create: `frontend/src/pages/Login/index.tsx`

**Step 1: 创建 index.tsx**

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useObserver } from 'mobx-react-lighter';
import { userStore } from '../../store';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (userStore.isLoggedIn) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const handleSendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      alert('请输入正确的手机号');
      return;
    }
    await userStore.sendCode(phone);
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleLogin = async () => {
    if (!phone || !verifyCode) {
      alert('请填写完整信息');
      return;
    }
    try {
      await userStore.login(phone, verifyCode);
      navigate('/', { replace: true });
    } catch (e: any) {
      alert(e.message || '登录失败');
    }
  };

  return useObserver(() => (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background-light dark:bg-background-dark">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-4">
            <span className="material-symbols-outlined text-primary text-[48px] filled">medical_services</span>
          </div>
          <h1 className="text-2xl font-bold text-text-main-light dark:text-text-main-dark">小禾AI医生</h1>
          <p className="text-text-sec-light dark:text-text-sec-dark mt-2">智能健康助手</p>
        </div>

        {/* Form */}
        <div className="space-y-5">
          {/* Phone Input */}
          <div>
            <label className="block text-sm font-medium text-text-main-light dark:text-text-main-dark mb-2">
              手机号
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-sec-light dark:text-text-sec-dark">
                +86
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入手机号"
                className="w-full pl-16 pr-4 py-3 rounded-xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-text-main-light dark:text-text-main-dark"
              />
            </div>
          </div>

          {/* Verify Code */}
          <div>
            <label className="block text-sm font-medium text-text-main-light dark:text-text-main-dark mb-2">
              验证码
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                placeholder="请输入验证码"
                maxLength={6}
                className="flex-1 py-3 px-4 rounded-xl bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-text-main-light dark:text-text-main-dark"
              />
              <button
                onClick={handleSendCode}
                disabled={countdown > 0 || !/^1[3-9]\d{9}$/.test(phone)}
                className="px-4 py-3 rounded-xl bg-primary text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-dark transition-colors"
              >
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </button>
            </div>
            <p className="text-xs text-text-sec-light dark:text-text-sec-dark mt-2">
              演示验证码：123456
            </p>
          </div>

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={userStore.loading || !phone || !verifyCode}
            className="w-full py-4 rounded-xl bg-primary text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20"
          >
            {userStore.loading ? '登录中...' : '登录 / 注册'}
          </button>

          {/* Agreement */}
          <p className="text-xs text-center text-text-sec-light dark:text-text-sec-dark">
            登录即同意《用户协议》和《隐私政策》
          </p>
        </div>
      </div>
    </div>
  ));
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/Login/index.tsx
git commit -m "feat: add login page component"
```

---

## 首页还原

### Task 8: 创建首页主组件

**Files:**
- Create: `frontend/src/pages/Home/index.tsx`

**Step 1: 创建 index.tsx**

```typescript
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import FeatureCard from './components/FeatureCard';
import DepartmentGrid from './components/DepartmentGrid';
import NewsCard from './components/NewsCard';
import { mockDepartments, mockNews } from '../../mock/data';

export default function Home() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <Header />
      <SearchBar />

      <main className="px-4 pb-24">
        {/* Feature Cards */}
        <div className="grid grid-cols-2 gap-3 h-64 mt-2">
          {/* AI 问诊卡片 */}
          <FeatureCard
            title="AI 智能问诊"
            subtitle="全天候极速响应"
            icon="smart_toy"
            gradientFrom="primary"
            gradientTo="primary-dark"
            to="/chat"
            className="col-span-1"
          />

          <div className="flex flex-col gap-3 h-full">
            {/* 专家问诊卡片 */}
            <FeatureCard
              title="专家问诊"
              subtitle="三甲名医在线"
              icon="medical_services"
              color="teal"
              to="/consultation"
              className="flex-1"
            />
            {/* 预约挂号卡片 */}
            <FeatureCard
              title="预约挂号"
              subtitle="省时免排队"
              icon="calendar_month"
              color="indigo"
              to="/appointment"
              className="flex-1"
            />
          </div>
        </div>

        {/* Hot Departments */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-text-main-light dark:text-text-main-dark">热门科室</h2>
            <button className="text-primary text-sm font-semibold flex items-center">
              全部 <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
          <DepartmentGrid departments={mockDepartments} />
        </div>

        {/* Health News */}
        <div className="mt-6">
          <h2 className="text-lg font-bold text-text-main-light dark:text-text-main-dark mb-4">健康资讯</h2>
          <div className="flex flex-col gap-3">
            {mockNews.map((news) => (
              <NewsCard key={news.id} news={news} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/src/pages/Home/index.tsx
git commit -m "feat: add home page main component"
```

---

### Task 9: 创建首页子组件

**Files:**
- Create: `frontend/src/pages/Home/components/Header.tsx`
- Create: `frontend/src/pages/Home/components/SearchBar.tsx`
- Create: `frontend/src/pages/Home/components/FeatureCard.tsx`
- Create: `frontend/src/pages/Home/components/DepartmentGrid.tsx`
- Create: `frontend/src/pages/Home/components/DepartmentItem.tsx`
- Create: `frontend/src/pages/Home/components/NewsCard.tsx`
- Create: `frontend/src/mock/data.ts`

**Step 1: 创建 mock/data.ts**

```typescript
export const mockDepartments = [
  { id: '1', name: '儿科', icon: 'child_care', color: 'blue' },
  { id: '2', name: '内科', icon: 'cardiology', color: 'orange' },
  { id: '3', name: '口腔科', icon: 'dentistry', color: 'purple' },
  { id: '4', name: '皮肤科', icon: 'face', color: 'rose' },
  { id: '5', name: '中医科', icon: 'spa', color: 'emerald' },
  { id: '6', name: '外科', icon: 'orthopedics', color: 'cyan' },
  { id: '7', name: '妇产科', icon: 'pregnant_woman', color: 'pink' },
  { id: '8', name: '更多', icon: 'grid_view', color: 'slate' },
];

export const mockNews = [
  {
    id: '1',
    title: '冬季如何有效增强免疫力？这里有5个妙招',
    category: '健康预防',
    time: '2小时前',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBUIW8xxtiEjlKEuevFL4OKgXCBan_wD21tPP1wcQEq-LowmP6uE4y8FAwFRokOvXPsqGjWawSBry14pIeGSDamiM1n3uiB2_wppMiIdMNTxme2FnIzPKtDMWiuuArL78f7XddfakJWF0AS0rocxpIMQch9iyfFXvPwlZc8hI3LkZaXFomU3ANFAfwIgtWC3oSYCB2iOteZ6cHPEQOeGWMMMxEdHRW6pRjnGDGbVjnNlEzDYWMMkkcCSvKLOzZJU5EgNNmVelJdhk5E',
  },
  {
    id: '2',
    title: '65岁以上老年人年度体检发布新指南',
    category: '政策解读',
    time: '5小时前',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCK74cU8JwLNMwiwnYFVxhk3yjjsd35sZ958ukT8g6txu9mbdAntelwWL1Pqy4xH1_EOr4hjAb-OD3Waj4fHc_LYn2gIEkfLrYpC7JaDaKYfNz62cvmqK-vmKIms6h7FRc13zPOEZ1xVQ3Snc68VNCjXHloazEMJhZQaeb77T8OQYQDaXzD4PjmVQZcUcfau-Cjq1r8UZ15SUbeUmJIzho8BHhcifTTe6W7agC4lFPvS2Ib3-qhGcUgIs19RdE4PxSHOzabpOkY-1Ch',
  },
  {
    id: '3',
    title: '定期洗牙为何对心脏健康至关重要？',
    category: '口腔护理',
    time: '1天前',
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD2ZFtJ2IMiiz8FtcnCIcpfqh3f01xwovCjAMTS684JHDDdm2_XqvJSxUFWxQY1wleGpemPEb6XqgqAzGsfH3TWjqMcLBzp-8dN-kn7UekC-gQqA-ZxakOWjJIe7UHKYUuTZxrtU3T4S5S1zd6FkFX9K0oylWek3JR3VehlgZQzAk14mwSR36_zywptK83QbLUzQbUp_pK8HbDcuPZZDsmeJ47BuKPFhhqB9wCMd-TI_ZspCrrb0llQoo5W56984DcHvg7p3pqQv2ic',
  },
];

const colorMap: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-primary' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-500' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-500' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-500' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-500' },
  pink: { bg: 'bg-pink-50', text: 'text-pink-500' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-500' },
};

export const getDepartmentColor = (color: string) => colorMap[color] || colorMap.slate;
```

**Step 2: 创建 Header.tsx**

```typescript
import { useNavigate } from 'react-router-dom';

export default function Header() {
  const navigate = useNavigate();

  return (
    <div className="sticky top-0 z-50 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 pb-2">
      <div className="flex items-center justify-between p-4 pb-2">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-surface-dark shadow-sm border border-gray-100 dark:border-gray-700 active:scale-95 transition-transform">
          <span className="material-symbols-outlined text-primary text-[20px] filled">location_on</span>
          <span className="text-sm font-bold text-text-main-light dark:text-text-main-dark">北京</span>
          <span className="material-symbols-outlined text-text-sec-light dark:text-text-sec-dark text-[18px]">expand_more</span>
        </button>
        <button
          onClick={() => navigate('/notifications')}
          className="relative flex items-center justify-center p-2 rounded-full hover:bg-gray-100 dark:hover:bg-surface-dark transition-colors"
        >
          <span className="material-symbols-outlined text-text-main-light dark:text-text-main-dark text-[24px]">notifications</span>
          <span className="absolute top-2 right-2.5 h-2 w-2 rounded-full bg-red-500 border-2 border-background-light dark:border-background-dark"></span>
        </button>
      </div>
    </div>
  );
}
```

**Step 3: 创建 SearchBar.tsx**

```typescript
export default function SearchBar() {
  return (
    <div className="px-4 pb-2">
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <span className="material-symbols-outlined text-text-sec-light dark:text-text-sec-dark text-[22px]">search</span>
        </div>
        <input
          className="block w-full p-3 pl-10 text-sm text-text-main-light dark:text-text-main-dark bg-white dark:bg-surface-dark border-none rounded-full shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 focus:ring-2 focus:ring-primary focus:outline-none placeholder:text-text-sec-light/70 dark:placeholder:text-text-sec-dark/70 transition-all"
          placeholder="搜索症状、医生或医院"
          type="text"
        />
      </div>
    </div>
  );
}
```

**Step 4: 创建 FeatureCard.tsx**

```typescript
import { useNavigate } from 'react-router-dom';

interface FeatureCardProps {
  title: string;
  subtitle: string;
  icon: string;
  to: string;
  className?: string;
  gradientFrom?: string;
  gradientTo?: string;
  color?: string;
}

export default function FeatureCard({
  title,
  subtitle,
  icon,
  to,
  className = '',
  gradientFrom,
  gradientTo,
  color = 'gray',
}: FeatureCardProps) {
  const navigate = useNavigate();

  const colorClasses: Record<string, { bg: string; icon: string; iconBg: string }> = {
    teal: { bg: 'bg-white dark:bg-surface-dark', icon: 'text-teal-600 dark:text-teal-400', iconBg: 'bg-teal-50 dark:bg-teal-900/30' },
    indigo: { bg: 'bg-white dark:bg-surface-dark', icon: 'text-indigo-600 dark:text-indigo-400', iconBg: 'bg-indigo-50 dark:bg-indigo-900/30' },
  };

  const colors = colorClasses[color] || { bg: '', icon: '', iconBg: '' };

  if (gradientFrom) {
    return (
      <div
        onClick={() => navigate(to)}
        className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-${gradientFrom} to-${gradientTo} shadow-lg shadow-${gradientFrom}/20 group cursor-pointer active:scale-[0.98] transition-all ${className}`}
      >
        <div className="absolute top-0 right-0 p-8 bg-white/10 rounded-full blur-2xl -mr-6 -mt-6"></div>
        <div className="absolute bottom-0 left-0 p-10 bg-black/5 rounded-full blur-xl -ml-4 -mb-4"></div>
        <div className="relative z-10 h-full flex flex-col justify-between p-4">
          <div>
            <div className="bg-white/20 w-10 h-10 rounded-full flex items-center justify-center mb-3 backdrop-blur-sm">
              <span className="material-symbols-outlined text-white text-[24px] filled">{icon}</span>
            </div>
            <h3 className="text-white text-lg font-bold leading-tight">{title}</h3>
            <p className="text-blue-50 text-xs mt-1 font-medium opacity-90">{subtitle}</p>
          </div>
          <div className="flex justify-end">
            <span className="material-symbols-outlined text-white/40 text-[64px] group-hover:scale-110 transition-transform duration-500">medical_mask</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => navigate(to)}
      className={`relative overflow-hidden rounded-2xl ${colors.bg} p-4 shadow-sm border border-gray-100 dark:border-gray-800 cursor-pointer active:scale-[0.98] transition-all group ${className}`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-text-main-light dark:text-text-main-dark text-base font-bold">{title}</h3>
          <p className="text-text-sec-light dark:text-text-sec-dark text-xs mt-1">{subtitle}</p>
        </div>
        <div className={`${colors.iconBg} w-8 h-8 rounded-full flex items-center justify-center`}>
          <span className={`material-symbols-outlined ${colors.icon} text-[20px]`}>{icon}</span>
        </div>
      </div>
      <div className="absolute -bottom-2 -right-2 opacity-5 dark:opacity-10">
        <span className={`material-symbols-outlined ${color === 'teal' ? 'text-teal-900' : 'text-indigo-900'} text-[60px]`}>
          {icon === 'medical_services' ? 'stethoscope' : 'event_available'}
        </span>
      </div>
    </div>
  );
}
```

**Step 5: 创建 DepartmentGrid.tsx**

```typescript
import DepartmentItem from './DepartmentItem';
import { Department } from '../../mock/data';

interface DepartmentGridProps {
  departments: Department[];
}

export default function DepartmentGrid({ departments }: DepartmentGridProps) {
  return (
    <div className="grid grid-cols-4 gap-y-4">
      {departments.map((dept) => (
        <DepartmentItem key={dept.id} department={dept} />
      ))}
    </div>
  );
}
```

**Step 6: 创建 DepartmentItem.tsx**

```typescript
import { getDepartmentColor } from '../../mock/data';

interface DepartmentItemProps {
  department: {
    id: string;
    name: string;
    icon: string;
    color: string;
  };
}

export default function DepartmentItem({ department }: DepartmentItemProps) {
  const colors = getDepartmentColor(department.color);

  return (
    <div className="flex flex-col items-center gap-2 cursor-pointer group">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
          department.color === 'slate'
            ? 'bg-slate-100 dark:bg-surface-dark group-hover:bg-slate-200 dark:group-hover:bg-slate-800'
            : `${colors.bg} group-hover:bg-primary/10`
        }`}
      >
        <span className={`material-symbols-outlined ${department.color === 'slate' ? 'text-slate-500' : colors.text} text-[24px]`}>
          {department.icon}
        </span>
      </div>
      <span className="text-xs font-medium text-text-main-light dark:text-text-sec-dark">{department.name}</span>
    </div>
  );
}
```

**Step 7: 创建 NewsCard.tsx**

```typescript
interface NewsCardProps {
  news: {
    id: string;
    title: string;
    category: string;
    time: string;
    imageUrl: string;
  };
}

export default function NewsCard({ news }: NewsCardProps) {
  const categoryColors: Record<string, string> = {
    健康预防: 'bg-blue-50 dark:bg-blue-900/30 text-primary',
    政策解读: 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    口腔护理: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="flex bg-white dark:bg-surface-dark rounded-xl p-3 shadow-sm border border-gray-100 dark:border-gray-800 cursor-pointer hover:shadow-md transition-shadow">
      <div className="flex-1 pr-3 flex flex-col justify-between">
        <h4 className="text-sm font-bold text-text-main-light dark:text-text-main-dark line-clamp-2 leading-snug">
          {news.title}
        </h4>
        <div className="flex items-center gap-2 mt-2">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${categoryColors[news.category] || 'bg-gray-100'}`}>
            {news.category}
          </span>
          <span className="text-[10px] text-text-sec-light dark:text-text-sec-dark">{news.time}</span>
        </div>
      </div>
      <div className="w-24 h-24 shrink-0 rounded-lg bg-gray-200 overflow-hidden relative">
        <div
          className="w-full h-full bg-center bg-cover"
          style={{ backgroundImage: `url('${news.imageUrl}')` }}
        />
      </div>
    </div>
  );
}
```

**Step 8: Commit**

```bash
git add frontend/src/mock/data.ts frontend/src/pages/Home/components/
git commit -m "feat: add home page subcomponents and mock data"
```

---

## 应用入口

### Task 10: 创建应用入口文件

**Files:**
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`

**Step 1: 创建 main.tsx**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
```

**Step 2: 创建 App.tsx**

```typescript
export default function App() {
  return null;
}
```

**Step 3: Commit**

```bash
git add frontend/src/main.tsx frontend/src/App.tsx
git commit -m "feat: add app entry files"
```

---

## 验证与测试

### Task 11: 构建验证

**Step 1: 运行构建**

```bash
cd frontend
npm run build
```

Expected: BUILD SUCCESS

**Step 2: 启动开发服务器验证**

```bash
npm run dev
```

Expected: Dev server starts on http://localhost:5173

**Step 3: Commit 最终验证**

```bash
git add .
git commit -m "feat: complete frontend login and home page implementation"
```

---

## 任务总结

| Task | 文件数 | 预计时间 |
|------|--------|----------|
| 0. 初始化前端项目 | 8 | 10 min |
| 1. 存储工具 | 1 | 2 min |
| 2. HTTP 请求封装 | 1 | 3 min |
| 3. 认证 API 服务 | 1 | 2 min |
| 4. MobX UserStore | 2 | 5 min |
| 5. 路由配置 | 1 | 2 min |
| 6. Layout 组件 | 1 | 3 min |
| 7. 登录页面 | 1 | 8 min |
| 8. 首页主组件 | 1 | 5 min |
| 9. 首页子组件 | 6 | 10 min |
| 10. 应用入口 | 2 | 2 min |
| 11. 构建验证 | - | 5 min |

**总计**: ~57 分钟

---

**Plan complete and saved to `docs/plans/2026-01-25-frontend-login-home-implementation.md`**

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
