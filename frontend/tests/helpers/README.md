# Playwright E2E 测试辅助函数使用示例

## 导入方式

### 方式一：从统一入口导入（推荐）

```typescript
import { test, expect } from '@playwright/test';
import { loginAsPatient, createAppointment, navigateToAppointmentList } from '../helpers';

test('患者预约挂号流程', async ({ page }) => {
  // 使用辅助函数简化测试代码
  await loginAsPatient(page);
  await navigateToAppointmentList(page);

  const appointmentId = await createAppointment(page);
  expect(appointmentId).toBeTruthy();
});
```

### 方式二：从具体模块导入

```typescript
import { test } from '@playwright/test';
import { loginAsDoctor } from '../helpers/auth';
import { acceptConsultation } from '../helpers/consultation';

test('医生接单流程', async ({ page }) => {
  await loginAsDoctor(page);
  await acceptConsultation(page, 'consultation-id');
});
```

## 可用的辅助函数

### 认证相关 (auth.ts)

- `loginAsPatient(page)` - 患者登录
- `loginAsDoctor(page)` - 医生登录
- `logout(page)` - 登出

### 问诊相关 (consultation.ts)

- `createConsultation(page)` - 创建问诊，返回问诊 ID
- `acceptConsultation(page, consultationId)` - 医生接单
- `sendMessage(page, text)` - 发送消息
- `endConsultation(page)` - 结束问诊

### 预约相关 (appointment.ts)

- `selectFirstDoctor(page)` - 选择第一个医生
- `selectFirstAvailableSlot(page)` - 选择第一个可用时间段
- `confirmAppointment(page)` - 确认预约
- `getFirstAppointmentId(page)` - 获取第一个预约 ID
- `createAppointment(page)` - 创建预约（完整流程）

### 导航相关 (navigation.ts)

- `navigateToAppointmentList(page)` - 导航到预约列表
- `navigateToDoctorList(page)` - 导航到医生列表
- `navigateToConsultationList(page)` - 导航到问诊列表
- `goBack(page)` - 返回上一页

### WebSocket 相关 (websocket.ts)

- `waitForWebSocketConnection(page, timeout)` - 等待 WebSocket 连接
- `simulateDisconnect(page)` - 模拟断开连接
- `simulateReconnect(page)` - 模拟重新连接
- `getTomorrowDate()` - 获取明天的日期（YYYY-MM-DD 格式）

## 完整示例

```typescript
import { test, expect } from '@playwright/test';
import { loginAsPatient, loginAsDoctor, createConsultation, acceptConsultation, sendMessage, endConsultation } from '../helpers';

test.describe('在线问诊流程', () => {
  test('患者发起问诊，医生接单并交流', async ({ page: patientPage }) => {
    // 患者登录并发起问诊
    await loginAsPatient(patientPage);
    const consultationId = await createConsultation(patientPage);

    // 医生登录并接单
    const doctorPage = await patientPage.context().newPage();
    await loginAsDoctor(doctorPage);
    await acceptConsultation(doctorPage, consultationId);

    // 患者发送消息
    await sendMessage(patientPage, '你好，我头疼');

    // 医生回复
    await sendMessage(doctorPage, '请问多久了？');

    // 结束问诊
    await endConsultation(patientPage);
  });
});
```

## 注意事项

1. 所有函数都是异步的，需要使用 `await`
2. 大部分函数接受 `Page` 对象作为参数
3. 部分函数返回值（如 ID 字符串），可用于后续操作
4. 已配置测试账号：患者 13800138000，医生 13900139000，验证码均为 123456
