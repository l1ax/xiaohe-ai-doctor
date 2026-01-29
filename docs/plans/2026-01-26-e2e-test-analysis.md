# E2E 测试用例分析与修正计划

**日期**: 2026-01-26
**目标**: 分析现有 E2E 测试用例的合理性，制定修正计划

---

## 执行摘要

通过对比测试文件与实际代码实现，发现以下主要问题：

| 测试文件 | 问题数量 | 需要修改 | 需要实现功能 |
|---------|---------|---------|-------------|
| login.spec.ts | 1 | 角色跳转逻辑 | - |
| navigation.spec.ts | 3 | ✅ | - |
| profile.spec.ts | 2 | ✅ | - |
| chat.spec.ts | 4 | ✅ | - |
| appointment-patient.spec.ts | 0 | - | - |
| consultation-patient.spec.ts | 1 | ✅ | - |
| doctor-workflow.spec.ts | 2 | ✅ | - |
| error-scenarios.spec.ts | 3 | ✅ | 路由保护 |

---

## 详细分析

### 1. login.spec.ts ✅ 基本正确

**测试期望 vs 实际实现：**

| 测试内容 | 实际实现 | 状态 |
|---------|---------|------|
| `input[type="tel"]` | ✅ 存在 | 正确 |
| `button:has-text("登录 / 注册")` | ✅ 存在 | 正确 |
| 验证码倒计时 "60s" | ✅ `{countdown}s` 格式 | 正确 |
| 登录后跳转 | 根据角色跳转 | ⚠️ 需要注意 |

**需要修改的内容：**

1. **角色跳转逻辑** - 测试假设登录后总是跳转到 `/`，但实际：
   - 患者角色 → `/`
   - 医生角色 → `/doctor/console`

**建议修改：**
```typescript
// 当前测试
await expect(page).toHaveURL('/');

// 修改为
await expect(page).toHaveURL(selectedRole === 'doctor' ? '/doctor/console' : '/');
```

---

### 2. navigation.spec.ts ❌ 需要修改

**测试期望 vs 实际实现：**

| 测试内容 | 测试期望 | 实际实现 | 状态 |
|---------|---------|---------|------|
| "问诊"按钮导航 | `/chat` | `/consultations` | ❌ 不匹配 |
| "挂号"按钮导航 | `/booking` | `/appointments/doctors` | ❌ 不匹配 |
| 设置页面标题 | `h1:has-text("设置")` | `h1` | ✅ 正确 |
| 深色模式切换 | 添加 `dark` 类 | `toggle dark` | ✅ 正确 |

**需要修改的内容：**

1. **底部导航测试** - 修改路由期望
```typescript
// 当前测试
await page.locator('button:has-text("问诊")').click();
await expect(page).toHaveURL(/\/chat/);

await page.locator('button:has-text("挂号")').click();
await expect(page).toHaveURL(/\/booking/);

// 修改为
await page.locator('button:has-text("问诊")').click();
await expect(page).toHaveURL('/consultations');

await page.locator('button:has-text("挂号")').click();
await expect(page).toHaveURL('/appointments/doctors');
```

---

### 3. profile.spec.ts ❌ 需要修改

**测试期望 vs 实际实现：**

| 测试内容 | 测试期望 | 实际实现 | 状态 |
|---------|---------|---------|------|
| 页面标题 | `h2:has-text("个人中心")` | 无 h2 标签 | ❌ 不匹配 |
| "白银会员"文本 | ✅ 存在 | ✅ 存在 | 正确 |
| 二维码按钮 | ✅ 存在 | ✅ 存在 | 正确 |

**需要修改的内容：**

1. **页面标题选择器** - Profile 组件没有 h2 标签
```typescript
// 当前测试
await expect(page.locator('h2:has-text("个人中心")')).toBeVisible();

// 修改为（移除此测试或验证其他元素）
await expect(page.locator('text=白银会员').first()).toBeVisible();
```

---

### 4. chat.spec.ts ❌ 需要修改

**测试期望 vs 实际实现：**

| 测试内容 | 测试期望 | 实际实现 | 状态 |
|---------|---------|---------|------|
| 输入框类型 | `textarea` | `input` | ❌ 不匹配 |
| 欢迎消息 | "您好，我是小荷AI医生" | "请描述您的症状..." | ❌ 不匹配 |
| 快捷问题 | ✅ 存在 | ✅ 存在 | 正确 |
| 页面标题 | "小荷AI医生" | "AI 健康助手" | ❌ 不匹配 |
| 在线状态 | `.w-2.h-2.bg-gray-400` | 无此样式 | ❌ 不匹配 |

**需要修改的内容：**

1. **输入框选择器**
```typescript
// 当前测试
const input = page.locator('textarea');

// 修改为
const input = page.locator('input[placeholder="请描述您的症状..."]');
```

2. **欢迎消息**
```typescript
// 当前测试
await expect(page.locator('text=您好，我是小荷AI医生')).toBeVisible();
await expect(page.locator('text=有什么健康问题我可以帮您解答？')).toBeVisible();

// 修改为
await expect(page.locator('text=请描述您的症状，AI 助手将为您解答')).toBeVisible();
```

3. **快捷问题标签**
```typescript
// 当前测试
await expect(page.locator('text=最近总是头疼怎么办')).toBeVisible();
await expect(page.locator('text=感冒了吃什么药好')).toBeVisible();
await expect(page.locator('text=睡眠不好怎么调理')).toBeVisible();

// 修改为（实际快捷问题）
await expect(page.locator('text=感冒发烧')).toBeVisible();
await expect(page.locator('text=头痛眩晕')).toBeVisible();
await expect(page.locator('text=腹痛腹泻')).toBeVisible();
await expect(page.locator('text=儿童发热')).toBeVisible();
```

4. **页面标题**
```typescript
// 当前测试
await expect(page.locator('text=小荷AI医生')).toBeVisible();

// 修改为
await expect(page.locator('text=AI 健康助手')).toBeVisible();
```

5. **在线状态指示器** - 移除或调整测试
```typescript
// 当前测试
const statusIndicator = page.locator('.w-2.h-2.bg-gray-400');
await expect(statusIndicator).toBeVisible();

// 修改为（实际无此指示器）
// 移除此测试或验证其他连接状态
```

---

### 5. appointment-patient.spec.ts ✅ 无需修改

**测试期望 vs 实际实现：**

| 测试内容 | 实际实现 | 状态 |
|---------|---------|------|
| `/appointments` | ✅ 存在 | 正确 |
| `/appointments/doctors` | ✅ 存在 | 正确 |
| `/appointments/schedule` | ✅ 存在 | 正确 |
| `/appointments/confirm` | ✅ 存在 | 正确 |
| 预约状态筛选 | ✅ 存在 | 正确 |

**无需修改** - 测试与实现完全匹配。

---

### 6. consultation-patient.spec.ts ⚠️ 需要小修改

**测试期望 vs 实际实现：**

| 测试内容 | 实际实现 | 状态 |
|---------|---------|------|
| `/consultations` | ✅ 存在 | 正确 |
| `/doctor-list` | ✅ 存在 | 正确 |
| `/doctor-chat/:id` | ✅ 存在 | 正确 |
| "发问诊"按钮 | ✅ "发问诊" | 正确 |
| 空状态文本 | "暂无问诊记录" | ✅ | 正确 |

**需要修改的内容：**

1. **空状态按钮文本验证**
```typescript
// 当前测试
await expect(page.locator('button:has-text("发起问诊")')).toBeVisible();

// 实际渲染的按钮文本是"发起问诊"，测试正确
// 但需要确认空状态时是否显示此按钮
```

---

### 7. doctor-workflow.spec.ts ❌ 需要修改

**测试期望 vs 实际实现：**

| 测试内容 | 测试期望 | 实际实现 | 状态 |
|---------|---------|---------|------|
| `/doctor/console` | ✅ 存在 | 正确 |
| `/doctor/appointments` | ✅ 存在 | 正确 |
| `/doctor/consultations/:id` | ❌ 测试期望 | `/doctor/chat/:id` | ❌ 不匹配 |
| 工作台标题 | "工作台" | 需要确认 | ⚠️ 需要验证 |

**需要修改的内容：**

1. **医生端聊天路由**
```typescript
// 当前测试
await page.goto('/doctor/consultations/test-consultation-id');

// 修改为
await page.goto('/doctor/chat/test-consultation-id');
```

---

### 8. error-scenarios.spec.ts ❌ 需要修改

**测试期望 vs 实际实现：**

| 测试内容 | 测试期望 | 实际实现 | 状态 |
|---------|---------|---------|------|
| 未登录访问受保护页面 | 重定向到 `/login` | 需要验证 | ⚠️ 需要实现/验证 |
| `/chat` | ✅ 存在 | 正确 |
| `/doctor-chat/non-existent-id` | ✅ 存在 | 正确 |
| `/appointments/non-existent-id` | ✅ 存在 | 正确 |

**需要实现的功能：**

1. **路由保护** - 需要为受保护的路由添加身份验证检查
```typescript
// 需要在路由配置中添加保护
// 当前已有 ProtectedRoute 组件用于医生端
// 需要为患者端路由也添加保护
```

---

## 修正优先级

### P0 - 高优先级（阻塞测试运行）

1. **navigation.spec.ts** - 修改路由期望
2. **chat.spec.ts** - 修改输入框和欢迎消息选择器
3. **doctor-workflow.spec.ts** - 修改医生端聊天路由

### P1 - 中优先级（影响测试准确性）

4. **profile.spec.ts** - 移除或调整标题测试
5. **login.spec.ts** - 添加角色跳转逻辑处理

### P2 - 低优先级（增强功能）

6. **error-scenarios.spec.ts** - 实现路由保护功能
7. **consultation-patient.spec.ts** - 验证空状态按钮

---

## 实施计划

### 阶段一：测试修正（P0）

1. 修改 `navigation.spec.ts` 中的路由期望
2. 修改 `chat.spec.ts` 中的选择器
3. 修改 `doctor-workflow.spec.ts` 中的路由

### 阶段二：测试修正（P1）

4. 修改 `profile.spec.ts`
5. 修改 `login.spec.ts`

### 阶段三：功能实现（P2）

6. 实现路由保护
7. 验证和修正边缘情况

---

## 修正后的测试执行计划

按照严格 TDD 流程：

1. **RED** - 运行测试，观察失败
2. **GREEN** - 修改测试或实现代码使测试通过
3. **REFACTOR** - 重构代码，保持测试通过

**模块顺序：**
1. 登录模块 (`login.spec.ts`)
2. 导航功能 (`navigation.spec.ts`)
3. AI Chat (`chat.spec.ts`)
4. Profile (`profile.spec.ts`)
5. 患者端预约挂号 (`appointment-patient.spec.ts`)
6. 患者端专家问诊 (`consultation-patient.spec.ts`)
7. 医生端工作台 (`doctor-workflow.spec.ts`)
8. 异常场景 (`error-scenarios.spec.ts`)
