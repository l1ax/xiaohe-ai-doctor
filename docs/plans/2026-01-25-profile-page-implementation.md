# Profile 页面与 E2E 测试实现计划

> **For Claude:** REQUIRED SUB-SKILL: 使用 superpowers:subagent-driven-development 执行此计划任务-by-任务。

**Goal:** 完整还原 Profile 页面，实现登录串联，引入 Playwright E2E 测试验证后端接口联调。

---

## 任务列表

### Task 1: 创建占位页面组件

**文件：**
- Create: `frontend/src/pages/Appointments/index.tsx`
- Create: `frontend/src/pages/Consultations/index.tsx`
- Create: `frontend/src/pages/Prescriptions/index.tsx`
- Create: `frontend/src/pages/HealthRecords/index.tsx`
- Create: `frontend/src/pages/FamilyMembers/index.tsx`
- Create: `frontend/src/pages/Address/index.tsx`
- Create: `frontend/src/pages/CustomerService/index.tsx`
- Create: `frontend/src/pages/VIP/index.tsx`

**Step 1: 创建统一的占位页面模板**

```tsx
// frontend/src/pages/Appointments/index.tsx
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';

const Appointments = observer(function Appointments() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background-light p-6">
      <h1 className="text-xl font-bold mb-4">我的预约</h1>
      <div className="text-center text-gray-500 py-20">
        <span className="material-symbols-outlined text-6xl mb-4">calendar_month</span>
        <p>预约功能开发中...</p>
      </div>
    </div>
  );
});

export default Appointments;
```

**Step 2: 为每个页面创建占位组件**

为 Consultations, Prescriptions, HealthRecords, FamilyMembers, Address, CustomerService, VIP 创建类似的占位页面，使用对应的 Material Symbols 图标。

**Step 3: 提交**

```bash
git add frontend/src/pages/{Appointments,Consultations,Prescriptions,HealthRecords,FamilyMembers,Address,CustomerService,VIP}/
git commit -m "feat: add placeholder pages for profile navigation"
```

---

### Task 2: 创建 Settings 页面

**文件：**
- Create: `frontend/src/pages/Settings/index.tsx`

**Step 1: 实现 Settings 页面**

```tsx
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { userStore } from '../../store';

const Settings = observer(function Settings() {
  const navigate = useNavigate();

  const handleLogout = () => {
    userStore.logout();
    navigate('/login', { replace: true });
  };

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      <div className="p-4">
        <h1 className="text-lg font-bold mb-4">设置</h1>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl mx-4 overflow-hidden">
        <button
          onClick={toggleTheme}
          className="flex items-center justify-between w-full p-4 active:bg-slate-50"
        >
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined">dark_mode</span>
            <span>深色模式</span>
          </div>
          <span className="material-symbols-outlined">
            {document.documentElement.classList.contains('dark') ? 'toggle_on' : 'toggle_off'}
          </span>
        </button>

        <button
          onClick={handleLogout}
          className="flex items-center justify-between w-full p-4 active:bg-slate-50 text-red-500"
        >
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined">logout</span>
            <span>退出登录</span>
          </div>
        </button>
      </div>
    </div>
  );
});

export default Settings;
```

**Step 2: 提交**

```bash
git add frontend/src/pages/Settings/
git commit -m "feat: add settings page with logout and theme toggle"
```

---

### Task 3: 创建 Profile 页面头部组件

**文件：**
- Create: `frontend/src/pages/Profile/components/UserInfo.tsx`
- Modify: `frontend/src/pages/Profile/index.tsx`

**Step 1: 实现 UserInfo 组件**

```tsx
import { observer } from 'mobx-react-lite';
import { userStore } from '../../store';
import { useNavigate } from 'react-router-dom';

const UserInfo = observer(function UserInfo() {
  const navigate = useNavigate();
  const { user } = userStore;

  if (!user) {
    return (
      <div className="relative bg-gradient-to-br from-primary via-[#0b8bc8] to-[#0870a3] pt-12 pb-24 px-6 rounded-b-[2.5rem]">
        <div className="text-white text-center py-10">
          <p>请先登录</p>
        </div>
      </div>
    );
  }

  const maskPhone = (phone: string) => {
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  };

  return (
    <div className="relative bg-gradient-to-br from-primary via-[#0b8bc8] to-[#0870a3] pt-12 pb-24 px-6 rounded-b-[2.5rem]">
      <div className="flex items-center justify-center mb-8">
        <h2 className="text-white text-lg font-bold tracking-wide">个人中心</h2>
      </div>
      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <div className="w-[88px] h-[88px] rounded-full border-[3px] border-white/40 bg-white/10">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="avatar" className="w-full h-full rounded-full object-cover" />
            ) : (
              <div className="w-full h-full rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-white">person</span>
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="absolute bottom-0 right-0 bg-white dark:bg-slate-700 text-primary p-1.5 rounded-full"
          >
            <span className="material-symbols-outlined text-[14px]">edit</span>
          </button>
        </div>
        <div className="flex flex-col text-white flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1.5">
            <h1 className="text-2xl font-bold truncate tracking-tight">{user.nickname || '用户'}</h1>
            <div className="px-2.5 py-0.5 bg-gradient-to-r from-yellow-100 to-yellow-300 dark:from-yellow-600 dark:to-yellow-800 text-yellow-900 dark:text-yellow-50 text-[10px] font-bold rounded-full flex items-center gap-1">
              <span className="material-symbols-outlined text-[12px] fill-1">diamond</span>
              <span>白银会员</span>
            </div>
          </div>
          <p className="text-blue-50/90 text-sm font-medium tracking-wide font-mono">{maskPhone(user.phone)}</p>
        </div>
        <button className="text-white/80 hover:text-white" onClick={() => navigate('/profile/qr')}>
          <span className="material-symbols-outlined text-2xl">qr_code_2</span>
        </button>
      </div>
    </div>
  );
});

export default UserInfo;
```

**Step 2: 提交**

```bash
git add frontend/src/pages/Profile/components/UserInfo.tsx frontend/src/pages/Profile/index.tsx
git commit -m "feat: add profile page header with user info"
```

---

### Task 4: 创建 Profile 页面功能网格组件

**文件：**
- Create: `frontend/src/pages/Profile/components/FeatureGrid.tsx`

**Step 1: 实现 FeatureGrid 组件**

```tsx
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';

interface FeatureItem {
  icon: string;
  label: string;
  path: string;
  hasBadge?: boolean;
}

const features: FeatureItem[] = [
  { icon: 'calendar_month', label: '我的预约', path: '/appointments' },
  { icon: 'clinical_notes', label: '问诊记录', path: '/consultations', hasBadge: true },
  { icon: 'receipt_long', label: '电子处方', path: '/prescriptions' },
  { icon: 'folder_shared', label: '健康档案', path: '/health-records' },
];

const FeatureGrid = observer(function FeatureGrid() {
  const navigate = useNavigate();

  return (
    <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-slate-100/50 dark:border-slate-700/50 p-5 mt-[-12px] relative z-10 mx-4">
      <div className="grid grid-cols-4 gap-2">
        {features.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex flex-col items-center gap-3 group w-full"
          >
            <div className="relative w-12 h-12 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-white group-active:scale-95 shadow-sm group-hover:shadow-md">
              <span className="material-symbols-outlined text-[26px]">{item.icon}</span>
              {item.hasBadge && (
                <span className="absolute top-0 right-0 -mt-1 -mr-1 w-3 h-3 bg-red-500 border-2 border-white dark:border-slate-800 rounded-full"></span>
              )}
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
});

export default FeatureGrid;
```

**Step 2: 提交**

```bash
git add frontend/src/pages/Profile/components/FeatureGrid.tsx
git commit -m "feat: add profile feature grid component"
```

---

### Task 5: 创建 Profile 页面 VIP 横幅组件

**文件：**
- Create: `frontend/src/pages/Profile/components/VIPBanner.tsx`

**Step 1: 实现 VIPBanner 组件**

```tsx
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';

const VIPBanner = observer(function VIPBanner() {
  const navigate = useNavigate();

  return (
    <div
      className="w-full h-20 rounded-xl overflow-hidden relative shadow-sm group cursor-pointer mx-4 mt-4"
      onClick={() => navigate('/vip')}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-teal-500 to-emerald-600"></div>
      <div className="relative z-10 flex items-center justify-between h-full px-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-white font-bold text-base">小禾健康VIP季卡</h3>
          <p className="text-white/90 text-xs">无限次AI咨询 · 专家号优先约</p>
        </div>
        <button className="bg-white text-teal-600 text-xs font-bold py-1.5 px-3 rounded-lg shadow-sm">
          立即查看
        </button>
      </div>
    </div>
  );
});

export default VIPBanner;
```

**Step 2: 提交**

```bash
git add frontend/src/pages/Profile/components/VIPBanner.tsx
git commit -m "feat: add VIP banner component"
```

---

### Task 6: 创建 Profile 页面列表菜单组件

**文件：**
- Create: `frontend/src/pages/Profile/components/MenuList.tsx`

**Step 1: 实现 MenuList 组件**

```tsx
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';

interface MenuItem {
  icon: string;
  label: string;
  path: string;
  description?: string;
}

const menuItems: MenuItem[] = [
  { icon: 'diversity_3', label: '家庭成员管理', path: '/family-members', description: '老人/儿童档案' },
  { icon: 'location_on', label: '地址管理', path: '/address' },
  { icon: 'headset_mic', label: '在线客服', path: '/customer-service' },
  { icon: 'settings', label: '设置', path: '/settings' },
];

const MenuList = observer(function MenuList() {
  const navigate = useNavigate();

  return (
    <>
      <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-slate-100/50 dark:border-slate-700/50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700 mx-4 mt-4">
        {menuItems.slice(0, 2).map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex items-center justify-between w-full p-4 active:bg-slate-50 dark:active:bg-slate-700 cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className={`flex items-center justify-center rounded-xl w-10 h-10 ${
                item.icon === 'diversity_3'
                  ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-500'
                  : 'bg-teal-50 dark:bg-teal-900/20 text-teal-600'
              }`}>
                <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              </div>
              <p className="text-slate-800 dark:text-slate-200 text-[15px] font-medium leading-normal">{item.label}</p>
            </div>
            <div className="flex items-center gap-2">
              {item.description && (
                <span className="text-slate-400 text-xs hidden sm:block">{item.description}</span>
              )}
              <span className="material-symbols-outlined text-slate-400 text-xl group-hover:translate-x-0.5 transition-transform">
                chevron_right
              </span>
            </div>
          </button>
        ))}
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-soft border border-slate-100/50 dark:border-slate-700/50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700 mx-4 mt-4">
        {menuItems.slice(2).map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className="flex items-center justify-between w-full p-4 active:bg-slate-50 dark:active:bg-slate-700 cursor-pointer transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className={`flex items-center justify-center rounded-xl w-10 h-10 ${
                item.icon === 'headset_mic'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-primary'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
              }`}>
                <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              </div>
              <p className="text-slate-800 dark:text-slate-200 text-[15px] font-medium leading-normal">{item.label}</p>
            </div>
            <span className="material-symbols-outlined text-slate-400 text-xl group-hover:translate-x-0.5 transition-transform">
              chevron_right
            </span>
          </button>
        ))}
      </section>
    </>
  );
});

export default MenuList;
```

**Step 2: 提交**

```bash
git add frontend/src/pages/Profile/components/MenuList.tsx
git commit -m "feat: add profile menu list component"
```

---

### Task 7: 组装 Profile 主页面

**文件：**
- Modify: `frontend/src/pages/Profile/index.tsx`

**Step 1: 实现完整的 Profile 页面**

```tsx
import { observer } from 'mobx-react-lite';
import UserInfo from './components/UserInfo';
import FeatureGrid from './components/FeatureGrid';
import VIPBanner from './components/VIPBanner';
import MenuList from './components/MenuList';

const Profile = observer(function Profile() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark pb-28">
      <UserInfo />
      <FeatureGrid />
      <VIPBanner />
      <MenuList />
      <div className="flex justify-center py-4">
        <p className="text-slate-300 text-xs font-medium">Xiaohe AI Doctor v2.3.0</p>
      </div>
    </div>
  );
});

export default Profile;
```

**Step 2: 提交**

```bash
git add frontend/src/pages/Profile/index.tsx
git commit -m "feat: assemble profile main page"
```

---

### Task 8: 更新路由配置

**文件：**
- Modify: `frontend/src/router.tsx`

**Step 1: 添加所有新页面路由**

```tsx
import { createBrowserRouter } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Appointments from './pages/Appointments';
import Consultations from './pages/Consultations';
import Prescriptions from './pages/Prescriptions';
import HealthRecords from './pages/HealthRecords';
import FamilyMembers from './pages/FamilyMembers';
import Address from './pages/Address';
import CustomerService from './pages/CustomerService';
import VIP from './pages/VIP';

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/', element: <Home /> },
  { path: '/profile', element: <Profile /> },
  { path: '/settings', element: <Settings /> },
  { path: '/appointments', element: <Appointments /> },
  { path: '/consultations', element: <Consultations /> },
  { path: '/prescriptions', element: <Prescriptions /> },
  { path: '/health-records', element: <HealthRecords /> },
  { path: '/family-members', element: <FamilyMembers /> },
  { path: '/address', element: <Address /> },
  { path: '/customer-service', element: <CustomerService /> },
  { path: '/vip', element: <VIP /> },
]);
```

**Step 2: 提交**

```bash
git add frontend/src/router.tsx
git commit -m "feat: add new routes for profile pages"
```

---

### Task 9: 更新底部导航选中状态

**文件：**
- Modify: `frontend/src/components/Layout.tsx`

**Step 1: 接收 activePath 参数并高亮对应 Tab**

```tsx
import { useLocation, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { path: '/', icon: 'home', label: '首页' },
  { path: '/chat', icon: 'medical_services', label: '问诊' },
  { path: '/booking', icon: 'edit_calendar', label: '挂号' },
  { path: '/profile', icon: 'person', label: '我的', activeIcon: 'person' },
];

const Layout = observer(function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 pb-24">{children}</main>
      <nav className="fixed bottom-0 left-0 w-full bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-6 pt-2 px-6 z-50 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)]">
        <div className="flex justify-between items-center h-14 max-w-lg mx-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center gap-1.5 w-16 ${
                  isActive ? 'text-primary' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <span className={`material-symbols-outlined text-[26px] ${isActive ? 'fill-1 drop-shadow-sm' : ''}`}>
                  {isActive && item.activeIcon ? item.activeIcon : item.icon}
                </span>
                <span className={`text-[10px] font-medium ${isActive ? 'font-bold' : ''}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
});

export default Layout;
```

**Step 2: 更新 Home 和 Profile 页面使用 Layout**

```tsx
// Home/index.tsx
import Layout from '../../components/Layout';

const Home = observer(function Home() {
  return (
    <Layout>
      {/* Home content */}
    </Layout>
  );
});

// Profile/index.tsx
import Layout from '../../components/Layout';

const Profile = observer(function Profile() {
  return (
    <Layout>
      {/* Profile content */}
    </Layout>
  );
});
```

**Step 3: 提交**

```bash
git add frontend/src/components/Layout.tsx frontend/src/pages/Home/index.tsx frontend/src/pages/Profile/index.tsx
git commit -m "feat: update bottom navigation active state"
```

---

### Task 10: 安装并配置 Playwright

**文件：**
- Modify: `frontend/package.json`
- Create: `frontend/tests/e2e/`

**Step 1: 安装 Playwright**

```bash
npm init playwright@latest -- --quiet
```

选择：
- TypeScript: Yes
- Install browsers: Yes
- Add GitHub Actions: No

**Step 2: 配置 Playwright**

```typescript
// frontend/tests/e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

**Step 3: 添加测试脚本到 package.json**

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

**Step 4: 提交**

```bash
git add frontend/package.json frontend/tests/
git commit -m "chore: add Playwright E2E testing"
```

---

### Task 11: 编写登录流程 E2E 测试

**文件：**
- Create: `frontend/tests/e2e/login.spec.ts`

**Step 1: 实现登录测试**

```typescript
import { test, expect } from '@playwright/test';

test.describe('登录流程', () => {
  test.beforeEach(async ({ page }) => {
    // 清除本地存储，确保每次测试从未登录状态开始
    await page.evaluate(() => localStorage.clear());
  });

  test('完整登录流程', async ({ page }) => {
    // 1. 访问首页，未登录应该跳转到登录页
    await page.goto('/');
    await expect(page).toHaveURL(/.*login/);

    // 2. 输入手机号
    await page.fill('input[type="tel"]', '13800138000');

    // 3. 点击获取验证码
    await page.click('button:has-text("获取验证码")');
    await expect(page.locator('button:has-text("60s")')).toBeVisible();

    // 4. 输入验证码 123456
    await page.fill('input[type="text"]', '123456');

    // 5. 点击登录按钮
    await page.click('button:has-text("登录 / 注册")');

    // 6. 登录成功后跳转到首页
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=小禾AI医生')).toBeVisible();
  });

  test('登录后访问 Profile 页面显示用户信息', async ({ page }) => {
    // 先登录
    await page.goto('/login');
    await page.fill('input[type="tel"]', '13800138000');
    await page.click('button:has-text("获取验证码")');
    await page.fill('input[type="text"]', '123456');
    await page.click('button:has-text("登录 / 注册")');
    await page.waitForURL('/');

    // 跳转到 Profile 页面
    await page.click('button:has-text("我的")');

    // 验证用户信息显示
    await expect(page.locator('text=白银会员')).toBeVisible();
    await expect(page.locator('text=138****0000')).toBeVisible();
  });

  test('验证码倒计时功能', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="tel"]', '13800138000');
    await page.click('button:has-text("获取验证码")');

    // 验证倒计时显示
    await expect(page.locator('button:has-text("60s")')).toBeVisible();

    // 60秒后恢复
    await expect(page.locator('button:has-text("获取验证码")')).toBeVisible({ timeout: 65000 });
  });
});
```

**Step 2: 提交**

```bash
git add frontend/tests/e2e/login.spec.ts
git commit -m "test: add login flow E2E tests"
```

---

### Task 12: 编写 Profile 页面 E2E 测试

**文件：**
- Create: `frontend/tests/e2e/profile.spec.ts`

**Step 1: 实现 Profile 测试**

```typescript
import { test, expect } from '@playwright/test';

test.describe('Profile 页面', () => {
  test.beforeEach(async ({ page }) => {
    // 先登录
    await page.goto('/login');
    await page.fill('input[type="tel"]', '13800138000');
    await page.click('button:has-text("获取验证码")');
    await page.fill('input[type="text"]', '123456');
    await page.click('button:has-text("登录 / 注册")');
    await page.waitForURL('/');

    // 跳转到 Profile 页面
    await page.click('button:has-text("我的")');
    await expect(page).toHaveURL('/profile');
  });

  test('Profile 页面头部显示', async ({ page }) => {
    // 验证标题
    await expect(page.locator('h2:has-text("个人中心")')).toBeVisible();

    // 验证用户信息
    await expect(page.locator('text=白银会员')).toBeVisible();
    await expect(page.locator('text=138****0000')).toBeVisible();

    // 验证二维码按钮
    await expect(page.locator('span:has-text("qr_code_2")')).toBeVisible();
  });

  test('功能入口网格显示', async ({ page }) => {
    // 验证 4 个功能入口
    await expect(page.locator('text=我的预约')).toBeVisible();
    await expect(page.locator('text=问诊记录')).toBeVisible();
    await expect(page.locator('text=电子处方')).toBeVisible();
    await expect(page.locator('text=健康档案')).toBeVisible();

    // 验证问诊记录红点
    await expect(page.locator('.rounded-full.bg-red-500')).toBeVisible();
  });

  test('VIP 横幅显示', async ({ page }) => {
    await expect(page.locator('text=小禾健康VIP季卡')).toBeVisible();
    await expect(page.locator('text=无限次AI咨询 · 专家号优先约')).toBeVisible();
    await expect(page.locator('button:has-text("立即查看")')).toBeVisible();
  });

  test('列表菜单显示', async ({ page }) => {
    await expect(page.locator('text=家庭成员管理')).toBeVisible();
    await expect(page.locator('text=地址管理')).toBeVisible();
    await expect(page.locator('text=在线客服')).toBeVisible();
    await expect(page.locator('text=设置')).toBeVisible();
  });

  test('页面跳转功能', async ({ page }) => {
    // 点击设置页面
    await page.click('text=设置');
    await expect(page).toHaveURL('/settings');
  });
});
```

**Step 2: 提交**

```bash
git add frontend/tests/e2e/profile.spec.ts
git commit -m "test: add profile page E2E tests"
```

---

### Task 13: 编写页面跳转 E2E 测试

**文件：**
- Create: `frontend/tests/e2e/navigation.spec.ts`

**Step 1: 实现导航测试**

```typescript
import { test, expect } from '@playwright/test';

test.describe('页面跳转', () => {
  test.beforeEach(async ({ page }) => {
    // 先登录
    await page.goto('/login');
    await page.fill('input[type="tel"]', '13800138000');
    await page.click('button:has-text("获取验证码")');
    await page.fill('input[type="text"]', '123456');
    await page.click('button:has-text("登录 / 注册")');
  });

  test('底部导航切换', async ({ page }) => {
    // 首页
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=首页')).toBeVisible();

    // 切换到问诊
    await page.click('button:has-text("问诊")');
    await expect(page).toHaveURL(/\/chat/);

    // 切换到挂号
    await page.click('button:has-text("挂号")');
    await expect(page).toHaveURL(/\/booking/);

    // 切换到我的
    await page.click('button:has-text("我的")');
    await expect(page).toHaveURL('/profile');
  });

  test('功能入口跳转', async ({ page }) => {
    await page.click('button:has-text("我的")');

    // 点击我的预约
    await page.click('text=我的预约');
    await expect(page).toHaveURL('/appointments');
    await expect(page.locator('text=我的预约')).toBeVisible();

    // 返回 Profile
    await page.goto('/profile');

    // 点击问诊记录
    await page.click('text=问诊记录');
    await expect(page).toHaveURL('/consultations');
  });

  test('设置页面功能', async ({ page }) => {
    await page.click('button:has-text("我的")');
    await page.click('text=设置');

    // 验证设置页面
    await expect(page.locator('text=设置')).toBeVisible();
    await expect(page.locator('text=深色模式')).toBeVisible();
    await expect(page.locator('text=退出登录')).toBeVisible();
  });
});
```

**Step 2: 提交**

```bash
git add frontend/tests/e2e/navigation.spec.ts
git commit -m "test: add navigation E2E tests"
```

---

### Task 14: 运行 E2E 测试并修复问题

**Step 1: 启动前端开发服务器**

```bash
npm run dev
```

**Step 2: 启动后端服务（另一个终端）**

```bash
cd ../../backend && npm run dev
```

**Step 3: 运行 E2E 测试**

```bash
npm run test:e2e
```

**Step 4: 修复发现的问题**

根据测试结果修复任何失败的问题。

**Step 5: 提交**

```bash
git add -A
git commit -m "fix: resolve E2E test issues"
```

---

### Task 15: 构建验证

**Step 1: 运行完整构建**

```bash
npm run build
```

**Step 2: 运行类型检查**

```bash
npx tsc --noEmit
```

**Step 3: 运行 E2E 测试**

```bash
npm run test:e2e
```

**Step 4: 提交**

```bash
git add -A
git commit -m "chore: verify build and tests"
```

---

### Task 16: 合并到 feature/frontend 分支

**Step 1: 切换到 feature/frontend**

```bash
git checkout feature/frontend
git pull
```

**Step 2: 合并 feature/profile-e2e**

```bash
git merge feature/profile-e2e --no-ff -m "feat: add profile page and E2E tests

- Profile page with user info, feature grid, VIP banner, menu list
- Settings page with logout and theme toggle
- Placeholder pages for appointments, consultations, etc.
- Playwright E2E tests for login, profile, navigation
- Updated routing and bottom navigation"
```

**Step 3: 删除远程分支**

```bash
git push origin --delete feature/profile-e2e
```

**Step 4: 删除 worktree**

```bash
git worktree remove .worktrees/profile-e2e
```

---

## 快速参考

| 任务 | 文件变更 |
|------|----------|
| Task 1 | 8 个占位页面 |
| Task 2 | Settings 页面 |
| Task 3-6 | Profile 子组件 |
| Task 7 | Profile 主页面 |
| Task 8 | 路由配置 |
| Task 9 | 底部导航 |
| Task 10 | Playwright 配置 |
| Task 11-13 | E2E 测试 |
| Task 14-15 | 测试运行与修复 |
| Task 16 | 合并与清理 |
