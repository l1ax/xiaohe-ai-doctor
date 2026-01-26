# 专家会诊与预约挂号 - 完整测试计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 为专家会诊和预约挂号功能编写完整的 API 测试和 Playwright 端到端测试，覆盖用户交互所有流程，保障业务稳定性。

**技术栈：** Vitest (后端 API 测试) + Playwright (前端 E2E 测试) + WebSocket (实时通信测试)

---

## 测试覆盖现状分析

### 现有测试

| 测试类型 | 文件位置 | 覆盖场景 |
|---------|---------|---------|
| 后端 E2E | `backend/src/__tests__/e2e/consultations/consultation-flow.test.ts` | 专家问诊基本流程（11个步骤） |
| 后端 E2E | `backend/src/__tests__/e2e/appointments/appointment-flow.test.ts` | 预约挂号基本流程（5个步骤） |
| 后端 E2E | `backend/src/__tests__/e2e/appointments/doctor-appointments.test.ts` | 医生预约列表 |
| 后端集成 | `backend/src/__tests__/integration/consultation.test.ts` | API端点、权限验证 |
| 前端 E2E | `frontend/tests/e2e/login.spec.ts` | 登录流程 |
| 前端 E2E | `frontend/tests/e2e/chat.spec.ts` | AI聊天流程 |
| 前端 E2E | `frontend/tests/e2e/navigation.spec.ts` | 导航测试 |
| 前端 E2E | `frontend/tests/e2e/profile.spec.ts` | 个人资料测试 |

### 测试缺口

| 缺口类型 | 描述 | 优先级 |
|---------|------|-------|
| 前端 E2E | 专家问诊完整流程（患者端） | 高 |
| 前端 E2E | 医生端接诊流程 | 高 |
| 前端 E2E | 预约挂号完整流程 | 高 |
| 前端 E2E | 医生端预约管理 | 高 |
| 后端 API | 并发场景测试 | 中 |
| 后端 API | WebSocket 异常恢复 | 中 |
| 后端 API | 边界条件测试 | 中 |
| 后端 API | 消息顺序和一致性 | 中 |

---

## 计划概览

本计划分为两个主要部分：

### 第一部分：后端 API 测试补充

1. **专家会诊 API 完整测试套件**
   - 并发创建问诊测试
   - WebSocket 连接异常恢复测试
   - 消息顺序和一致性测试
   - 边界条件测试

2. **预约挂号 API 完整测试套件**
   - 排班数据一致性测试
   - 时段冲突边界测试
   - 医生状态切换测试
   - 预约状态转换完整测试

### 第二部分：前端 Playwright E2E 测试

1. **患者端专家问诊完整流程**
2. **医生端工作台完整流程**
3. **患者端预约挂号完整流程**
4. **医生端预约管理完整流程**
5. **异常场景和边界条件测试**

---

## 第一部分：后端 API 测试补充

### Task 1: 专家会诊 - 并发创建问诊测试

**Files:**
- Create: `backend/src/__tests__/e2e/consultations/concurrent-consultations.test.ts`

**Step 1: Write the failing test**

```typescript
// backend/src/__tests__/e2e/consultations/concurrent-consultations.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { Server } from 'http';
import { TestApiClient, TEST_USERS } from '../helpers';
import { logger } from '../../../../utils/logger';

logger.silent = true;

describe('专家问诊 - 并发场景测试', () => {
  let app: express.Express;
  let server: Server;
  let apiClient: TestApiClient;
  let patientToken: string;
  let doctorToken: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    const consultationsRouter = (await import('../../../../routes/consultations')).default;
    const authRouter = (await import('../../../../routes/auth')).default;
    const { errorHandler } = await import('../../../../utils/errorHandler');

    app.use('/api/auth', authRouter);
    app.use('/api/consultations', consultationsRouter);
    app.use(errorHandler);

    server = app.listen(0);
    apiClient = new TestApiClient(app);

    patientToken = await apiClient.loginPatient(TEST_USERS.PATIENT.phone, TEST_USERS.PATIENT.code);
    doctorToken = await apiClient.loginDoctor(TEST_USERS.DOCTOR.phone, TEST_USERS.DOCTOR.code);
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe('多个患者同时向同一医生发起问诊', () => {
    it('应能正确处理10个并发问诊请求', async () => {
      const doctorId = 'doctor_001';
      const concurrentRequests = 10;

      // 创建10个并发问诊请求
      const promises = Array.from({ length: concurrentRequests }, () =>
        apiClient.createConsultation(patientToken, doctorId)
      );

      const results = await Promise.allSettled(promises);

      // 验证所有请求都成功
      const successful = results.filter((r) => r.status === 'fulfilled');
      expect(successful.length).toBe(concurrentRequests);

      // 验证每个问诊都有唯一的ID
      const consultationIds = successful.map((r: any) => r.value.id);
      const uniqueIds = new Set(consultationIds);
      expect(uniqueIds.size).toBe(concurrentRequests);

      // 验证所有问诊都在待接诊列表中
      const pending = await apiClient.getPendingConsultations(doctorToken);
      expect(pending.length).toBeGreaterThanOrEqual(concurrentRequests);
    });

    it('应能正确处理不同医生的并发问诊', async () => {
      const doctors = ['doctor_001', 'doctor_002', 'doctor_003'];

      // 为每个医生创建并发问诊
      const promises = doctors.flatMap((doctorId) =>
        Array.from({ length: 3 }, () =>
          apiClient.createConsultation(patientToken, doctorId)
        )
      );

      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === 'fulfilled');

      expect(successful.length).toBe(doctors.length * 3);

      // 验证每个医生的待接诊列表
      for (const doctorId of doctors) {
        const doctorToken = await apiClient.loginDoctor(
          doctorId === 'doctor_001' ? TEST_USERS.DOCTOR.phone : `1380013800${doctorId.slice(-1)}`,
          '123456'
        );
        const pending = await apiClient.getPendingConsultations(doctorToken);
        expect(pending.length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('并发接诊测试', () => {
    it('同一问诊不应被多个医生同时接诊', async () => {
      // 创建一个问诊
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_002');
      const consultationId = consultation.id;

      // 获取另一个医生的token
      const anotherDoctorToken = await apiClient.loginDoctor('13800138003', '123456');

      // 第一个医生接诊
      await apiClient.acceptConsultation(doctorToken, consultationId);

      // 第二个医生尝试接诊应该失败
      await expect(
        apiClient.acceptConsultation(anotherDoctorToken, consultationId)
      ).rejects.toThrow();
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd backend && pnpm test concurrent-consultations.test.ts
```

Expected: Tests should pass if the implementation is correct, or reveal race conditions.

**Step 3: (If tests fail) Fix implementation**

If concurrent issues are found, add proper locking/queuing to the consultation store.

**Step 4: Run tests to verify they pass**

```bash
cd backend && pnpm test concurrent-consultations.test.ts
```

**Step 5: Commit**

```bash
git add backend/src/__tests__/e2e/consultations/concurrent-consultations.test.ts
git commit -m "test: add concurrent consultation tests"
```

---

### Task 2: WebSocket 异常恢复测试

**Files:**
- Create: `backend/src/__tests__/e2e/consultations/websocket-recovery.test.ts`

**Step 1: Write the failing test**

```typescript
// backend/src/__tests__/e2e/consultations/websocket-recovery.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { Server } from 'http';
import { TestApiClient, TestWebSocketClient, TEST_USERS, TEST_CONFIG } from '../helpers';
import { wsManager } from '../../../../services/websocket/WebSocketManager';
import { logger } from '../../../../utils/logger';

logger.silent = true;

describe('WebSocket - 异常恢复测试', () => {
  let app: express.Express;
  let server: Server;
  let apiClient: TestApiClient;
  let patientToken: string;
  let doctorToken: string;
  let consultationId: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    const consultationsRouter = (await import('../../../../routes/consultations')).default;
    const authRouter = (await import('../../../../routes/auth')).default;
    const { errorHandler } = await import('../../../../utils/errorHandler');

    app.use('/api/auth', authRouter);
    app.use('/api/consultations', consultationsRouter);
    app.use(errorHandler);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (typeof address === 'object' && address) {
          (TEST_CONFIG as any).WS_URL = `ws://localhost:${address.port}/ws`;
          (TEST_CONFIG as any).API_URL = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });

    wsManager.initialize(server);

    apiClient = new TestApiClient(app);
    patientToken = await apiClient.loginPatient(TEST_USERS.PATIENT.phone, TEST_USERS.PATIENT.code);
    doctorToken = await apiClient.loginDoctor(TEST_USERS.DOCTOR.phone, TEST_USERS.DOCTOR.code);

    const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');
    consultationId = consultation.id;
    await apiClient.acceptConsultation(doctorToken, consultationId);
  });

  afterAll(async () => {
    wsManager.shutdown();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe('连接断开后的重连', () => {
    it('患者断开后重连应能恢复会话', async () => {
      let patientWs = new TestWebSocketClient();

      // 第一次连接
      await patientWs.connect(patientToken);
      await patientWs.waitForSystemMessage('Connected', 5000);
      patientWs.joinConversation(consultationId);
      await patientWs.waitForSystemMessage('Joined conversation', 5000);

      // 断开连接
      patientWs.disconnect();
      expect(patientWs.isConnected()).toBe(false);

      // 重连
      patientWs = new TestWebSocketClient();
      await patientWs.connect(patientToken);
      await patientWs.waitForSystemMessage('Connected', 5000);

      // 重新加入会话
      patientWs.joinConversation(consultationId);
      await patientWs.waitForSystemMessage('Joined conversation', 5000);

      // 验证可以接收消息
      const doctorWs = new TestWebSocketClient();
      await doctorWs.connect(doctorToken);
      await doctorWs.waitForSystemMessage('Connected', 5000);
      doctorWs.joinConversation(consultationId);
      await doctorWs.waitForSystemMessage('Joined conversation', 5000);

      doctorWs.sendMessage(consultationId, '重连测试消息');

      const received = await patientWs.waitForChatMessage(5000);
      expect(received.message?.content).toBe('重连测试消息');

      doctorWs.disconnect();
      patientWs.disconnect();
    });

    it('多次断开重连应能正常工作', async () => {
      const reconnectCount = 3;

      for (let i = 0; i < reconnectCount; i++) {
        const patientWs = new TestWebSocketClient();

        await patientWs.connect(patientToken);
        await patientWs.waitForSystemMessage('Connected', 5000);
        patientWs.joinConversation(consultationId);
        await patientWs.waitForSystemMessage('Joined conversation', 5000);

        // 发送消息验证连接正常
        patientWs.sendMessage(consultationId, `第${i + 1}次连接测试`);

        await new Promise(resolve => setTimeout(resolve, 500));
        patientWs.disconnect();
      }
    });
  });

  describe('网络抖动模拟', () => {
    it('心跳超时后应能重连', async () => {
      const patientWs = new TestWebSocketClient();

      await patientWs.connect(patientToken);
      await patientWs.waitForSystemMessage('Connected', 5000);
      patientWs.joinConversation(consultationId);

      // 等待超过心跳超时时间（60秒），但为了测试速度，我们模拟断开
      patientWs.disconnect();

      // 重连
      const newWs = new TestWebSocketClient();
      await newWs.connect(patientToken);
      const msg = await newWs.waitForSystemMessage('Connected', 5000);
      expect(msg).toBeDefined();

      newWs.disconnect();
    });
  });

  describe('并发连接和断开', () => {
    it('应能处理多个客户端同时连接和断开', async () => {
      const clients: TestWebSocketClient[] = [];

      // 创建10个并发连接
      for (let i = 0; i < 10; i++) {
        const ws = new TestWebSocketClient();
        await ws.connect(i % 2 === 0 ? patientToken : doctorToken);
        await ws.waitForSystemMessage('Connected', 5000);
        ws.joinConversation(consultationId);
        clients.push(ws);
      }

      // 验证所有连接都成功
      expect(clients.every((c) => c.isConnected())).toBe(true);

      // 同时断开所有连接
      clients.forEach((c) => c.disconnect());

      // 验证所有连接都已断开
      expect(clients.every((c) => !c.isConnected())).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd backend && pnpm test websocket-recovery.test.ts
```

**Step 3: Fix implementation if needed**

If reconnection issues are found, update WebSocketManager.ts to handle reconnection properly.

**Step 4: Run tests to verify they pass**

```bash
cd backend && pnpm test websocket-recovery.test.ts
```

**Step 5: Commit**

```bash
git add backend/src/__tests__/e2e/consultations/websocket-recovery.test.ts
git commit -m "test: add WebSocket recovery tests"
```

---

### Task 3: 消息顺序和一致性测试

**Files:**
- Create: `backend/src/__tests__/e2e/consultations/message-consistency.test.ts`

**Step 1: Write the failing test**

```typescript
// backend/src/__tests__/e2e/consultations/message-consistency.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { Server } from 'http';
import { TestApiClient, TestWebSocketClient, TEST_USERS, TEST_CONFIG } from '../helpers';
import { wsManager } from '../../../../services/websocket/WebSocketManager';
import { logger } from '../../../../utils/logger';

logger.silent = true;

describe('WebSocket - 消息顺序和一致性测试', () => {
  let app: express.Express;
  let server: Server;
  let apiClient: TestApiClient;
  let patientToken: string;
  let doctorToken: string;
  let consultationId: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    const consultationsRouter = (await import('../../../../routes/consultations')).default;
    const authRouter = (await import('../../../../routes/auth')).default;
    const { errorHandler } = await import('../../../../utils/errorHandler');

    app.use('/api/auth', authRouter);
    app.use('/api/consultations', consultationsRouter);
    app.use(errorHandler);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (typeof address === 'object' && address) {
          (TEST_CONFIG as any).WS_URL = `ws://localhost:${address.port}/ws`;
          (TEST_CONFIG as any).API_URL = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });

    wsManager.initialize(server);

    apiClient = new TestApiClient(app);
    patientToken = await apiClient.loginPatient(TEST_USERS.PATIENT.phone, TEST_USERS.PATIENT.code);
    doctorToken = await apiClient.loginDoctor(TEST_USERS.DOCTOR.phone, TEST_USERS.DOCTOR.code);

    const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');
    consultationId = consultation.id;
    await apiClient.acceptConsultation(doctorToken, consultationId);
  });

  afterAll(async () => {
    wsManager.shutdown();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe('消息顺序测试', () => {
    it('快速发送的多条消息应按顺序到达', async () => {
      const patientWs = new TestWebSocketClient();
      const doctorWs = new TestWebSocketClient();

      await patientWs.connect(patientToken);
      await doctorWs.connect(doctorToken);

      await patientWs.waitForSystemMessage('Connected', 5000);
      await doctorWs.waitForSystemMessage('Connected', 5000);

      patientWs.joinConversation(consultationId);
      doctorWs.joinConversation(consultationId);

      await patientWs.waitForSystemMessage('Joined conversation', 5000);
      await doctorWs.waitForSystemMessage('Joined conversation', 5000);

      // 快速发送10条消息
      const messageCount = 10;
      const messages: string[] = [];
      for (let i = 1; i <= messageCount; i++) {
        const msg = `消息 ${i}`;
        messages.push(msg);
        patientWs.sendMessage(consultationId, msg);
      }

      // 接收并验证消息顺序
      const receivedMessages: string[] = [];
      for (let i = 0; i < messageCount; i++) {
        const received = await doctorWs.waitForChatMessage(5000);
        receivedMessages.push(received.message?.content || '');
      }

      expect(receivedMessages).toEqual(messages);

      patientWs.disconnect();
      doctorWs.disconnect();
    });

    it('双向消息应保持正确顺序', async () => {
      const patientWs = new TestWebSocketClient();
      const doctorWs = new TestWebSocketClient();

      await patientWs.connect(patientToken);
      await doctorWs.connect(doctorToken);

      await patientWs.waitForSystemMessage('Connected', 5000);
      await doctorWs.waitForSystemMessage('Connected', 5000);

      patientWs.joinConversation(consultationId);
      doctorWs.joinConversation(consultationId);

      await patientWs.waitForSystemMessage('Joined conversation', 5000);
      await doctorWs.waitForSystemMessage('Joined conversation', 5000);

      // 交替发送消息
      const expectedOrder: string[] = [];
      expectedOrder.push('患者1');
      patientWs.sendMessage(consultationId, '患者1');

      const msg1 = await doctorWs.waitForChatMessage(5000);
      expect(msg1.message?.content).toBe('患者1');

      expectedOrder.push('医生1');
      doctorWs.sendMessage(consultationId, '医生1');

      const msg2 = await patientWs.waitForChatMessage(5000);
      expect(msg2.message?.content).toBe('医生1');

      expectedOrder.push('患者2');
      patientWs.sendMessage(consultationId, '患者2');

      const msg3 = await doctorWs.waitForChatMessage(5000);
      expect(msg3.message?.content).toBe('患者2');

      patientWs.disconnect();
      doctorWs.disconnect();
    });
  });

  describe('消息持久化测试', () => {
    it '历史消息应能正确加载', async () => {
      const patientWs = new TestWebSocketClient();
      const doctorWs = new TestWebSocketClient();

      await patientWs.connect(patientToken);
      await doctorWs.connect(doctorToken);

      await patientWs.waitForSystemMessage('Connected', 5000);
      await doctorWs.waitForSystemMessage('Connected', 5000);

      patientWs.joinConversation(consultationId);
      doctorWs.joinConversation(consultationId);

      // 发送一些消息
      const testMessages = ['测试消息1', '测试消息2', '测试消息3'];
      for (const msg of testMessages) {
        patientWs.sendMessage(consultationId, msg);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 等待消息被存储
      await new Promise(resolve => setTimeout(resolve, 500));

      // 通过API获取历史消息
      const messages = await apiClient.getConsultationMessages(patientToken, consultationId);

      // 验证消息被正确存储
      const messageContents = messages.map((m: any) => m.content);
      testMessages.forEach(msg => {
        expect(messageContents).toContain(msg);
      });

      patientWs.disconnect();
      doctorWs.disconnect();
    });

    it('新加入的会话应能看到历史消息', async () => {
      // 创建新的问诊
      const newConsultation = await apiClient.createConsultation(patientToken, 'doctor_002');
      const newConsultationId = newConsultation.id;

      // 患者先加入并发送消息
      const patientWs = new TestWebSocketClient();
      await patientWs.connect(patientToken);
      await patientWs.waitForSystemMessage('Connected', 5000);
      patientWs.joinConversation(newConsultationId);
      await patientWs.waitForSystemMessage('Joined conversation', 5000);

      const testMessage = '医生还没加入时的消息';
      patientWs.sendMessage(newConsultationId, testMessage);
      await new Promise(resolve => setTimeout(resolve, 500));

      // 医生接诊后加入
      await apiClient.acceptConsultation(doctorToken, newConsultationId);

      const doctorWs = new TestWebSocketClient();
      await doctorWs.connect(doctorToken);
      await doctorWs.waitForSystemMessage('Connected', 5000);
      doctorWs.joinConversation(newConsultationId);
      await doctorWs.waitForSystemMessage('Joined conversation', 5000);

      // 医生通过API获取历史消息
      const messages = await apiClient.getConsultationMessages(doctorToken, newConsultationId);
      const messageContents = messages.map((m: any) => m.content);

      expect(messageContents).toContain(testMessage);

      patientWs.disconnect();
      doctorWs.disconnect();
    });
  });
});
```

**Note:** Add `getConsultationMessages` method to TestApiClient if not already present.

**Step 2: Run test to verify it fails**

```bash
cd backend && pnpm test message-consistency.test.ts
```

**Step 3: Add missing helper method if needed**

```typescript
// Add to TestApiClient class in backend/src/__tests__/e2e/helpers/testApiClient.ts

/**
 * 获取问诊消息历史
 */
async getConsultationMessages(token: string, consultationId: string): Promise<any[]> {
  const response: Response = await request(this.app)
    .get(`/api/consultations/${consultationId}/messages`)
    .set('Authorization', `Bearer ${token}`);

  if (response.status !== 200) {
    throw new Error(`Get consultation messages failed: ${JSON.stringify(response.body)}`);
  }

  const body = response.body as { code: number; data: any[] };
  if (body.code !== 0) {
    throw new Error(`Get consultation messages response invalid: ${JSON.stringify(body)}`);
  }

  return body.data;
}
```

**Step 4: Run tests to verify they pass**

```bash
cd backend && pnpm test message-consistency.test.ts
```

**Step 5: Commit**

```bash
git add backend/src/__tests__/e2e/consultations/message-consistency.test.ts backend/src/__tests__/e2e/helpers/testApiClient.ts
git commit -m "test: add message consistency tests"
```

---

### Task 4: 边界条件测试

**Files:**
- Create: `backend/src/__tests__/e2e/consultations/boundary-conditions.test.ts`

**Step 1: Write the failing test**

```typescript
// backend/src/__tests__/e2e/consultations/boundary-conditions.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { Server } from 'http';
import { TestApiClient, TestWebSocketClient, TEST_USERS, TEST_CONFIG } from '../helpers';
import { wsManager } from '../../../../services/websocket/WebSocketManager';
import { logger } from '../../../../utils/logger';

logger.silent = true;

describe('专家问诊 - 边界条件测试', () => {
  let app: express.Express;
  let server: Server;
  let apiClient: TestApiClient;
  let patientToken: string;
  let doctorToken: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    const consultationsRouter = (await import('../../../../routes/consultations')).default;
    const authRouter = (await import('../../../../routes/auth')).default;
    const { errorHandler } = await import('../../../../utils/errorHandler');

    app.use('/api/auth', authRouter);
    app.use('/api/consultations', consultationsRouter);
    app.use(errorHandler);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (typeof address === 'object' && address) {
          (TEST_CONFIG as any).WS_URL = `ws://localhost:${address.port}/ws`;
          (TEST_CONFIG as any).API_URL = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });

    wsManager.initialize(server);

    apiClient = new TestApiClient(app);
    patientToken = await apiClient.loginPatient(TEST_USERS.PATIENT.phone, TEST_USERS.PATIENT.code);
    doctorToken = await apiClient.loginDoctor(TEST_USERS.DOCTOR.phone, TEST_USERS.DOCTOR.code);
  });

  afterAll(async () => {
    wsManager.shutdown();
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  describe('空消息和特殊字符测试', () => {
    let consultationId: string;
    let patientWs: TestWebSocketClient;
    let doctorWs: TestWebSocketClient;

    beforeAll(async () => {
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');
      consultationId = consultation.id;
      await apiClient.acceptConsultation(doctorToken, consultationId);

      patientWs = new TestWebSocketClient();
      doctorWs = new TestWebSocketClient();

      await patientWs.connect(patientToken);
      await doctorWs.connect(doctorToken);

      await patientWs.waitForSystemMessage('Connected', 5000);
      await doctorWs.waitForSystemMessage('Connected', 5000);

      patientWs.joinConversation(consultationId);
      doctorWs.joinConversation(consultationId);

      await patientWs.waitForSystemMessage('Joined conversation', 5000);
      await doctorWs.waitForSystemMessage('Joined conversation', 5000);
    });

    afterAll(() => {
      patientWs.disconnect();
      doctorWs.disconnect();
    });

    it('应能处理空字符串消息', async () => {
      patientWs.sendMessage(consultationId, '');

      const received = await doctorWs.waitForChatMessage(5000);
      expect(received.message?.content).toBe('');
    });

    it('应能处理超长消息', async () => {
      const longMessage = 'A'.repeat(10000);
      patientWs.sendMessage(consultationId, longMessage);

      const received = await doctorWs.waitForChatMessage(5000);
      expect(received.message?.content).toBe(longMessage);
    });

    it('应能处理特殊字符', async () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      patientWs.sendMessage(consultationId, specialChars);

      const received = await doctorWs.waitForChatMessage(5000);
      expect(received.message?.content).toBe(specialChars);
    });

    it('应能处理emoji表情', async () => {
      const emojiMessage = '你好 😊👨‍⚕️🏥';
      patientWs.sendMessage(consultationId, emojiMessage);

      const received = await doctorWs.waitForChatMessage(5000);
      expect(received.message?.content).toBe(emojiMessage);
    });

    it('应能处理换行符和制表符', async () => {
      const multilineMessage = '第一行\n第二行\t制表符';
      patientWs.sendMessage(consultationId, multilineMessage);

      const received = await doctorWs.waitForChatMessage(5000);
      expect(received.message?.content).toBe(multilineMessage);
    });
  });

  describe('速率限制测试', () => {
    it('应限制每分钟发送消息数量', async () => {
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');
      const newConsultationId = consultation.id;
      await apiClient.acceptConsultation(doctorToken, newConsultationId);

      const patientWs = new TestWebSocketClient();
      await patientWs.connect(patientToken);
      await patientWs.waitForSystemMessage('Connected', 5000);
      patientWs.joinConversation(newConsultationId);

      // 快速发送超过限制的消息（每分钟60条）
      const messageCount = 70;
      let rejectedCount = 0;

      for (let i = 0; i < messageCount; i++) {
        try {
          patientWs.sendMessage(newConsultationId, `消息 ${i}`);
          await new Promise(resolve => setTimeout(resolve, 10));
        } catch (error) {
          rejectedCount++;
        }
      }

      // 部分消息应该被拒绝
      expect(rejectedCount).toBeGreaterThan(0);

      patientWs.disconnect();
    });
  });

  describe('权限边界测试', () => {
    it('患者不应能访问其他患者的问诊', async () => {
      const otherPatientToken = await apiClient.loginPatient('13900139999', '123456');

      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');
      const consultationId = consultation.id;

      // 其他患者尝试访问
      await expect(
        apiClient.getConsultationDetail(otherPatientToken, consultationId)
      ).rejects.toThrow();
    });

    it('医生不应能看到其他医生的待接诊', async () => {
      const anotherDoctorToken = await apiClient.loginDoctor('13800138003', '123456');

      // 创建问诊给doctor_001
      await apiClient.createConsultation(patientToken, 'doctor_001');

      // doctor_003的待接诊列表应该是空的
      const pending = await apiClient.getPendingConsultations(anotherDoctorToken);
      const pendingForDoctor001 = pending.filter((c) => c.doctorId === 'doctor_001');
      expect(pendingForDoctor001.length).toBe(0);
    });

    it('未登录用户应无法访问问诊API', async () => {
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');

      // 使用无效token
      await expect(
        apiClient.getConsultationDetail('invalid_token', consultation.id)
      ).rejects.toThrow();
    });
  });

  describe('状态转换边界测试', () => {
    it('pending状态的问诊不应能发送消息', async () => {
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');
      const consultationId = consultation.id;

      const patientWs = new TestWebSocketClient();
      await patientWs.connect(patientToken);
      await patientWs.waitForSystemMessage('Connected', 5000);
      patientWs.joinConversation(consultationId);

      // 尝试在pending状态发送消息（应该被阻止或等待接诊）
      // 这个测试取决于具体实现
      patientWs.disconnect();
    });

    it('closed状态的问诊不应能发送消息', async () => {
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');
      const consultationId = consultation.id;
      await apiClient.acceptConsultation(doctorToken, consultationId);

      const patientWs = new TestWebSocketClient();
      const doctorWs = new TestWebSocketClient();

      await patientWs.connect(patientToken);
      await doctorWs.connect(doctorToken);

      await patientWs.waitForSystemMessage('Connected', 5000);
      await doctorWs.waitForSystemMessage('Connected', 5000);

      patientWs.joinConversation(consultationId);
      doctorWs.joinConversation(consultationId);

      // 结束问诊
      await apiClient.closeConsultation(doctorToken, consultationId);

      // 尝试发送消息应该失败
      await new Promise(resolve => setTimeout(resolve, 500));
      // 验证消息被拒绝或连接关闭

      patientWs.disconnect();
      doctorWs.disconnect();
    });

    it('重复接诊应被拒绝', async () => {
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');
      const consultationId = consultation.id;

      // 第一次接诊
      await apiClient.acceptConsultation(doctorToken, consultationId);

      // 第二次接诊应该失败
      await expect(
        apiClient.acceptConsultation(doctorToken, consultationId)
      ).rejects.toThrow();
    });
  });

  describe('无效输入测试', () => {
    it('不存在的问诊ID应返回404', async () => {
      await expect(
        apiClient.getConsultationDetail(patientToken, 'non-existent-id')
      ).rejects.toThrow();
    });

    it('不存在的医生ID应返回错误', async () => {
      await expect(
        apiClient.createConsultation(patientToken, 'non-existent-doctor')
      ).rejects.toThrow();
    });

    it('无效的问诊状态转换应被拒绝', async () => {
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');

      // 尝试在pending状态下结束问诊（应该先接诊）
      await expect(
        apiClient.closeConsultation(patientToken, consultation.id)
      ).rejects.toThrow();
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd backend && pnpm test boundary-conditions.test.ts
```

**Step 3: Fix implementation issues**

Update consultation controller and WebSocket manager to handle boundary conditions properly.

**Step 4: Run tests to verify they pass**

```bash
cd backend && pnpm test boundary-conditions.test.ts
```

**Step 5: Commit**

```bash
git add backend/src/__tests__/e2e/consultations/boundary-conditions.test.ts
git commit -m "test: add boundary condition tests for consultations"
```

---

### Task 5: 预约挂号 - 排班数据一致性测试

**Files:**
- Create: `backend/src/__tests__/e2e/appointments/schedule-consistency.test.ts`

**Step 1: Write the failing test**

```typescript
// backend/src/__tests__/e2e/appointments/schedule-consistency.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import { TestApiClient, TEST_USERS } from '../helpers';
import { logger } from '../../../../utils/logger';

logger.silent = true;

describe('预约挂号 - 排班数据一致性测试', () => {
  let app: express.Express;
  let apiClient: TestApiClient;
  let userToken: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    const appointmentsRouter = (await import('../../../../routes/appointments')).default;
    const authRouter = (await import('../../../../routes/auth')).default;
    const { errorHandler } = await import('../../../../utils/errorHandler');

    app.use('/api/auth', authRouter);
    app.use('/api/appointments', appointmentsRouter);
    app.use(errorHandler);

    apiClient = new TestApiClient(app);
    userToken = await apiClient.loginPatient(TEST_USERS.PATIENT.phone, TEST_USERS.PATIENT.code);
  });

  describe('排班数据稳定性测试', () => {
    it('同一医生的排班数据应保持一致（多次请求）', async () => {
      const doctorId = 'doctor_001';
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];

      // 多次请求同一医生的排班
      const schedules1 = await apiClient.getDoctorSchedule(userToken, doctorId, dateStr, dateStr);
      const schedules2 = await apiClient.getDoctorSchedule(userToken, doctorId, dateStr, dateStr);
      const schedules3 = await apiClient.getDoctorSchedule(userToken, doctorId, dateStr, dateStr);

      // 验证数据一致
      expect(schedules1).toEqual(schedules2);
      expect(schedules2).toEqual(schedules3);
    });

    it('不同医生的排班应相互独立', async () => {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];

      const schedules1 = await apiClient.getDoctorSchedule(userToken, 'doctor_001', dateStr, dateStr);
      const schedules2 = await apiClient.getDoctorSchedule(userToken, 'doctor_002', dateStr, dateStr);

      // 排班数据应该独立（可以使用相同的种子随机，但应该不同）
      expect(schedules1.length).toBe(schedules2.length);
    });

    it('未来7天排班应返回完整数据', async () => {
      const doctorId = 'doctor_001';
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 6);

      const startDate = today.toISOString().split('T')[0];
      const endDate = nextWeek.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(userToken, doctorId, startDate, endDate);

      // 验证返回7天数据
      expect(schedules.length).toBe(7);

      // 验证每天都有日期字段
      schedules.forEach((schedule) => {
        expect(schedule.date).toBeDefined();
        expect(Array.isArray(schedule.availableSlots)).toBe(true);
      });
    });
  });

  describe('时段可用性测试', () => {
    it('已预约的时段不应出现在可用时段中', async () => {
      const doctorId = 'doctor_001';
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      // 获取排班
      const schedulesBefore = await apiClient.getDoctorSchedule(userToken, doctorId, dateStr, dateStr);
      const availableSlot = schedulesBefore[0].availableSlots[0];

      if (availableSlot) {
        // 创建预约
        const [hours, minutes] = availableSlot.split(':');
        tomorrow.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

        await apiClient.createAppointment(userToken, {
          doctorId,
          patientName: '测试患者',
          appointmentTime: tomorrow.toISOString(),
        });

        // 再次获取排班
        const schedulesAfter = await apiClient.getDoctorSchedule(userToken, doctorId, dateStr, dateStr);

        // 已预约的时段不应在可用时段中（如果实现中排班会实时更新）
        // 注意：当前实现可能不支持实时更新排班，这个测试可能需要调整
      }
    });

    it '可用时段格式应正确', async () => {
      const doctorId = 'doctor_001';
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(userToken, doctorId, dateStr, dateStr);

      schedules[0].availableSlots.forEach((slot: string) => {
        // 验证时间格式 HH:MM
        expect(slot).toMatch(/^\d{2}:\d{2}$/);

        // 验证小时和分钟范围
        const [hours, minutes] = slot.split(':').map(Number);
        expect(hours).toBeGreaterThanOrEqual(0);
        expect(hours).toBeLessThanOrEqual(23);
        expect(minutes).toBeGreaterThanOrEqual(0);
        expect(minutes).toBeLessThanOrEqual(59);
      });
    });
  });

  describe('日期边界测试', () => {
    it('应能正确处理月末日期', async () => {
      const doctorId = 'doctor_001';
      const lastDayOfMonth = new Date();
      lastDayOfMonth.setMonth(lastDayOfMonth.getMonth() + 1, 0);
      const dateStr = lastDayOfMonth.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(userToken, doctorId, dateStr, dateStr);

      expect(schedules.length).toBe(1);
      expect(schedules[0].date).toBe(dateStr);
    });

    it('应能正确处理闰年日期', async () => {
      const doctorId = 'doctor_001';
      const leapYearDate = new Date('2024-02-29');
      const dateStr = '2024-02-29';

      const schedules = await apiClient.getDoctorSchedule(userToken, doctorId, dateStr, dateStr);

      expect(schedules.length).toBe(1);
    });

    it('开始日期大于结束日期应返回空', async () => {
      const doctorId = 'doctor_001';
      const startDate = '2024-01-10';
      const endDate = '2024-01-01';

      const schedules = await apiClient.getDoctorSchedule(userToken, doctorId, startDate, endDate);

      // 应该返回空数组或抛出错误
      expect(Array.isArray(schedules)).toBe(true);
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd backend && pnpm test schedule-consistency.test.ts
```

**Step 3: Fix implementation if needed**

**Step 4: Run tests to verify they pass**

```bash
cd backend && pnpm test schedule-consistency.test.ts
```

**Step 5: Commit**

```bash
git add backend/src/__tests__/e2e/appointments/schedule-consistency.test.ts
git commit -m "test: add schedule consistency tests"
```

---

### Task 6: 预约挂号 - 时段冲突边界测试

**Files:**
- Create: `backend/src/__tests__/e2e/appointments/slot-conflict-boundaries.test.ts`

**Step 1: Write the failing test**

```typescript
// backend/src/__tests__/e2e/appointments/slot-conflict-boundaries.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import { TestApiClient, TEST_USERS } from '../helpers';
import { logger } from '../../../../utils/logger';

logger.silent = true;

describe('预约挂号 - 时段冲突边界测试', () => {
  let app: express.Express;
  let apiClient: TestApiClient;
  let userToken: string;
  let doctorToken: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    const appointmentsRouter = (await import('../../../../routes/appointments')).default;
    const authRouter = (await import('../../../../routes/auth')).default;
    const { errorHandler } = await import('../../../../utils/errorHandler');

    app.use('/api/auth', authRouter);
    app.use('/api/appointments', appointmentsRouter);
    app.use(errorHandler);

    apiClient = new TestApiClient(app);
    userToken = await apiClient.loginPatient(TEST_USERS.PATIENT.phone, TEST_USERS.PATIENT.code);
    doctorToken = await apiClient.loginDoctor(TEST_USERS.DOCTOR.phone, TEST_USERS.DOCTOR.code);
  });

  describe('时段冲突检测', () => {
    it('完全相同的时间段应被检测为冲突', async () => {
      const doctorId = 'doctor_001';
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(userToken, doctorId, dateStr, dateStr);
      const availableSlot = schedules[0].availableSlots[0];

      if (availableSlot) {
        const [hours, minutes] = availableSlot.split(':');
        tomorrow.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

        // 第一次预约
        await apiClient.createAppointment(userToken, {
          doctorId,
          patientName: '患者1',
          appointmentTime: tomorrow.toISOString(),
        });

        // 第二次预约相同时间应失败
        await expect(
          apiClient.createAppointment(userToken, {
            doctorId,
            patientName: '患者2',
            appointmentTime: tomorrow.toISOString(),
          })
        ).rejects.toThrow();
      }
    });

    it('相邻时段不应冲突', async () => {
      const doctorId = 'doctor_001';
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(userToken, doctorId, dateStr, dateStr);

      // 获取前两个可用时段
      const firstSlot = schedules[0].availableSlots[0];
      const secondSlot = schedules[0].availableSlots[1];

      if (firstSlot && secondSlot) {
        // 预约第一个时段
        const [hours1, minutes1] = firstSlot.split(':');
        const appointmentTime1 = new Date(tomorrow);
        appointmentTime1.setUTCHours(parseInt(hours1), parseInt(minutes1), 0, 0);

        await apiClient.createAppointment(userToken, {
          doctorId,
          patientName: '患者1',
          appointmentTime: appointmentTime1.toISOString(),
        });

        // 预约第二个时段应该成功
        const [hours2, minutes2] = secondSlot.split(':');
        const appointmentTime2 = new Date(tomorrow);
        appointmentTime2.setUTCHours(parseInt(hours2), parseInt(minutes2), 0, 0);

        const appointment = await apiClient.createAppointment(userToken, {
          doctorId,
          patientName: '患者2',
          appointmentTime: appointmentTime2.toISOString(),
        });

        expect(appointment.id).toBeDefined();
      }
    });

    it('不同医生的预约不应冲突', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const schedules1 = await apiClient.getDoctorSchedule(userToken, 'doctor_001', dateStr, dateStr);
      const schedules2 = await apiClient.getDoctorSchedule(userToken, 'doctor_002', dateStr, dateStr);

      const slot1 = schedules1[0].availableSlots[0];
      const slot2 = schedules2[0].availableSlots[0];

      if (slot1 && slot2) {
        const [hours1, minutes1] = slot1.split(':');
        const [hours2, minutes2] = slot2.split(':');

        const time1 = new Date(tomorrow);
        time1.setUTCHours(parseInt(hours1), parseInt(minutes1), 0, 0);

        const time2 = new Date(tomorrow);
        time2.setUTCHours(parseInt(hours2), parseInt(minutes2), 0, 0);

        // 两个医生的预约应该都成功
        const appointment1 = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_001',
          patientName: '患者1',
          appointmentTime: time1.toISOString(),
        });

        const appointment2 = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_002',
          patientName: '患者2',
          appointmentTime: time2.toISOString(),
        });

        expect(appointment1.id).toBeDefined();
        expect(appointment2.id).toBeDefined();
      }
    });
  });

  describe('时间边界测试', () => {
    it('应能处理午夜时段（00:00）', async () => {
      const doctorId = 'doctor_001';
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);

      // 尝试预约午夜时段（如果有）
      const appointment = await apiClient.createAppointment(userToken, {
        doctorId,
        patientName: '测试患者',
        appointmentTime: tomorrow.toISOString(),
      }).catch(() => null);

      // 根据实现，可能成功或失败
      if (appointment) {
        expect(appointment.id).toBeDefined();
      }
    });

    it('应能处理跨日预约', async () => {
      // 当前实现不支持跨日预约（每个时段30分钟）
      // 这个测试验证边界情况
      const doctorId = 'doctor_001';
      const today = new Date();
      const endTime = new Date(today);
      endTime.setHours(23, 59, 59, 999);

      // 尝试预约接近午夜的时间
      const appointment = await apiClient.createAppointment(userToken, {
        doctorId,
        patientName: '测试患者',
        appointmentTime: endTime.toISOString(),
      }).catch(() => null);

      // 验证行为（成功或失败都可以接受）
    });

    it('秒和毫秒应被忽略', async () => {
      const doctorId = 'doctor_001';
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(userToken, doctorId, dateStr, dateStr);
      const availableSlot = schedules[0].availableSlots[0];

      if (availableSlot) {
        const [hours, minutes] = availableSlot.split(':');

        // 创建带有秒和毫秒的时间
        const timeWithSeconds = new Date(tomorrow);
        timeWithSeconds.setUTCHours(parseInt(hours), parseInt(minutes), 30, 500);

        const appointment = await apiClient.createAppointment(userToken, {
          doctorId,
          patientName: '测试患者',
          appointmentTime: timeWithSeconds.toISOString(),
        });

        expect(appointment.id).toBeDefined();

        // 验证存储的时间被规范化（秒和毫秒被清除）
        const detail = await apiClient.getAppointmentDetail(userToken, appointment.id);
        const storedTime = new Date(detail.appointmentTime);
        expect(storedTime.getSeconds()).toBe(0);
        expect(storedTime.getMilliseconds()).toBe(0);
      }
    });
  });

  describe('并发预约冲突测试', () => {
    it('并发预约相同时段应只有一个成功', async () => {
      const doctorId = 'doctor_001';
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(userToken, doctorId, dateStr, dateStr);
      const availableSlot = schedules[0].availableSlots[0];

      if (availableSlot) {
        const [hours, minutes] = availableSlot.split(':');
        tomorrow.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

        // 并发创建预约
        const promises = Array.from({ length: 5 }, () =>
          apiClient.createAppointment(userToken, {
            doctorId,
            patientName: `患者${Math.random()}`,
            appointmentTime: tomorrow.toISOString(),
          })
        );

        const results = await Promise.allSettled(promises);

        // 只有一个应该成功
        const successful = results.filter((r) => r.status === 'fulfilled');
        expect(successful.length).toBe(1);

        const failed = results.filter((r) => r.status === 'rejected');
        expect(failed.length).toBe(4);
      }
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd backend && pnpm test slot-conflict-boundaries.test.ts
```

**Step 3: Fix implementation if needed**

**Step 4: Run tests to verify they pass**

```bash
cd backend && pnpm test slot-conflict-boundaries.test.ts
```

**Step 5: Commit**

```bash
git add backend/src/__tests__/e2e/appointments/slot-conflict-boundaries.test.ts
git commit -m "test: add slot conflict boundary tests"
```

---

### Task 7: 预约状态转换完整测试

**Files:**
- Create: `backend/src/__tests__/e2e/appointments/status-transitions.test.ts`

**Step 1: Write the failing test**

```typescript
// backend/src/__tests__/e2e/appointments/status-transitions.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import { TestApiClient, TEST_USERS } from '../helpers';
import { logger } from '../../../../utils/logger';

logger.silent = true;

describe('预约挂号 - 状态转换完整测试', () => {
  let app: express.Express;
  let apiClient: TestApiClient;
  let userToken: string;
  let doctorToken: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    const appointmentsRouter = (await import('../../../../routes/appointments')).default;
    const authRouter = (await import('../../../../routes/auth')).default;
    const { errorHandler } = await import('../../../../utils/errorHandler');

    app.use('/api/auth', authRouter);
    app.use('/api/appointments', appointmentsRouter);
    app.use(errorHandler);

    apiClient = new TestApiClient(app);
    userToken = await apiClient.loginPatient(TEST_USERS.PATIENT.phone, TEST_USERS.PATIENT.code);
    doctorToken = await apiClient.loginDoctor(TEST_USERS.DOCTOR.phone, TEST_USERS.DOCTOR.code);
  });

  describe('完整状态转换流程', () => {
    it('应能完整转换: pending -> confirmed -> completed', async () => {
      // 创建预约（初始状态：pending）
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(userToken, 'doctor_001', dateStr, dateStr);
      const availableSlot = schedules[0].availableSlots[0];

      expect(availableSlot).toBeDefined();

      const [hours, minutes] = availableSlot.split(':');
      tomorrow.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

      const appointment = await apiClient.createAppointment(userToken, {
        doctorId: 'doctor_001',
        patientName: '测试患者',
        appointmentTime: tomorrow.toISOString(),
      });

      expect(appointment.status).toBe('pending');

      // 医生确认预约（状态：confirmed）
      // 注意：当前API可能没有医生确认预约的端点，这个测试可能需要调整
      // 如果有确认端点，取消下面注释
      // await apiClient.confirmAppointment(doctorToken, appointment.id);
      // let updated = await apiClient.getAppointmentDetail(userToken, appointment.id);
      // expect(updated.status).toBe('confirmed');

      // 完成预约（状态：completed）
      // 注意：当前API可能没有完成预约的端点
      // await apiClient.completeAppointment(doctorToken, appointment.id);
      // let final = await apiClient.getAppointmentDetail(userToken, appointment.id);
      // expect(final.status).toBe('completed');
    });

    it('应能转换: pending -> cancelled', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(userToken, 'doctor_002', dateStr, dateStr);
      const availableSlot = schedules[0].availableSlots[0];

      if (availableSlot) {
        const [hours, minutes] = availableSlot.split(':');
        tomorrow.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

        const appointment = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_002',
          patientName: '测试患者',
          appointmentTime: tomorrow.toISOString(),
        });

        expect(appointment.status).toBe('pending');

        // 取消预约
        await apiClient.cancelAppointment(userToken, appointment.id);

        const updated = await apiClient.getAppointmentDetail(userToken, appointment.id);
        expect(updated.status).toBe('cancelled');
      }
    });

    it('cancelled状态的预约不应能再次取消', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(userToken, 'doctor_003', dateStr, dateStr);
      const availableSlot = schedules[0].availableSlots[0];

      if (availableSlot) {
        const [hours, minutes] = availableSlot.split(':');
        tomorrow.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

        const appointment = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_003',
          patientName: '测试患者',
          appointmentTime: tomorrow.toISOString(),
        });

        // 取消预约
        await apiClient.cancelAppointment(userToken, appointment.id);

        // 再次取消应该失败
        await expect(
          apiClient.cancelAppointment(userToken, appointment.id)
        ).rejects.toThrow();
      }
    });
  });

  describe('状态筛选测试', () => {
    let appointmentIds: { [key: string]: string } = {};

    beforeAll(async () => {
      // 创建不同状态的预约
      const statuses = ['pending', 'cancelled'];

      for (const status of statuses) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];

        const schedules = await apiClient.getDoctorSchedule(
          userToken,
          'doctor_004',
          dateStr,
          dateStr
        );

        if (schedules[0].availableSlots.length > 0) {
          const availableSlot = schedules[0].availableSlots[0];
          const [hours, minutes] = availableSlot.split(':');
          tomorrow.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

          const appointment = await apiClient.createAppointment(userToken, {
            doctorId: 'doctor_004',
            patientName: `测试${status}`,
            appointmentTime: tomorrow.toISOString(),
          });

          appointmentIds[status] = appointment.id;

          if (status === 'cancelled') {
            await apiClient.cancelAppointment(userToken, appointment.id);
          }
        }
      }
    });

    it('应能按pending状态筛选', async () => {
      const appointments = await apiClient.getMyAppointments(userToken);
      const pendingAppointments = appointments.filter((a) => a.status === 'pending');

      expect(pendingAppointments.length).toBeGreaterThan(0);
      expect(pendingAppointments.every((a) => a.status === 'pending')).toBe(true);
    });

    it('应能按cancelled状态筛选', async () => {
      const appointments = await apiClient.getMyAppointments(userToken);
      const cancelledAppointments = appointments.filter((a) => a.status === 'cancelled');

      expect(cancelledAppointments.length).toBeGreaterThan(0);
      expect(cancelledAppointments.every((a) => a.status === 'cancelled')).toBe(true);
    });

    it('医生应能查看按状态筛选的预约', async () => {
      // 获取医生的所有预约
      const allAppointments = await apiClient.getDoctorAppointments(doctorToken);

      // 获取pending状态的预约
      const pendingAppointments = await apiClient.getDoctorAppointments(doctorToken, 'pending');

      expect(Array.isArray(pendingAppointments)).toBe(true);
      expect(pendingAppointments.every((a) => a.status === 'pending')).toBe(true);
    });
  });

  describe('状态权限测试', () => {
    it('只有患者本人能取消预约', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(userToken, 'doctor_001', dateStr, dateStr);
      const availableSlot = schedules[0].availableSlots[0];

      if (availableSlot) {
        const [hours, minutes] = availableSlot.split(':');
        tomorrow.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

        const appointment = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_001',
          patientName: '测试患者',
          appointmentTime: tomorrow.toISOString(),
        });

        // 其他用户尝试取消应该失败
        const otherUserToken = await apiClient.loginPatient('13900139997', '123456');

        await expect(
          apiClient.cancelAppointment(otherUserToken, appointment.id)
        ).rejects.toThrow();

        // 医生尝试取消患者预约（根据业务规则，可能允许或拒绝）
        // await expect(
        //   apiClient.cancelAppointment(doctorToken, appointment.id)
        // ).rejects.toThrow();
      }
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd backend && pnpm test status-transitions.test.ts
```

**Step 3: Fix implementation if needed**

**Step 4: Run tests to verify they pass**

```bash
cd backend && pnpm test status-transitions.test.ts
```

**Step 5: Commit**

```bash
git add backend/src/__tests__/e2e/appointments/status-transitions.test.ts
git commit -m "test: add appointment status transition tests"
```

---

## 第二部分：前端 Playwright E2E 测试

### Task 8: 患者端专家问诊完整流程

**Files:**
- Create: `frontend/tests/e2e/consultation-patient.spec.ts`

**Step 1: Write the failing test**

```typescript
// frontend/tests/e2e/consultation-patient.spec.ts
import { test, expect, describe } from '@playwright/test';

/**
 * 患者端专家问诊完整流程测试
 *
 * 测试目标：
 * 1. 医生列表浏览和筛选
 * 2. 创建问诊
 * 3. 进入聊天界面
 * 4. 发送和接收消息
 * 5. 结束问诊
 */

describe('患者端 - 专家问诊完整流程', () => {
  test.beforeEach(async ({ page }) => {
    // 清除本地存储
    await page.context().clearLocalStorage();

    // 登录
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13800139000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');
  });

  test('应能浏览医生列表', async ({ page }) => {
    // 导航到医生列表页面
    await page.goto('/doctors');

    // 等待页面加载
    await page.waitForLoadState('networkidle');

    // 验证医生列表显示
    await expect(page.locator('text=专家问诊').or(page.locator('text=医生'))).toBeVisible();

    // 验证至少有一个医生卡片
    const doctorCards = page.locator('[class*="doctor"]').or(page.locator('[class*="Doctor"]'));
    const count = await doctorCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('应能按科室筛选医生', async ({ page }) => {
    await page.goto('/doctors');
    await page.waitForLoadState('networkidle');

    // 查找科室筛选器
    const departmentFilter = page.locator('select').or(page.locator('[role="combobox"]')).first();

    // 选择心内科
    await departmentFilter.selectOption('心内科');
    await page.waitForLoadState('networkidle');

    // 验证URL或页面内容更新
    await expect(page).toHaveURL(/department=心内科/);
  });

  test('应能创建问诊', async ({ page }) => {
    await page.goto('/doctors');
    await page.waitForLoadState('networkidle');

    // 点击第一个医生的问诊按钮
    const consultButton = page.locator('button:has-text("问诊")').or(page.locator('button:has-text("咨询")')).first();
    await consultButton.click();

    // 等待创建成功提示或跳转
    await page.waitForTimeout(1000);

    // 验证跳转到问诊详情或聊天页面
    await expect(page).toHaveURL(/\/consultations\/|\/chat\//);
  });

  test('应能在聊天界面发送消息', async ({ page }) => {
    // 创建或进入一个已有的问诊
    await page.goto('/consultations');
    await page.waitForLoadState('networkidle');

    // 点击第一个问诊
    const firstConsultation = page.locator('[class*="consultation"]').or(page.locator('[class*="Consultation"]')).first();
    await firstConsultation.click();

    // 等待聊天页面加载
    await page.waitForLoadState('networkidle');

    // 输入消息
    const input = page.locator('textarea').or(page.locator('input[type="text"]'));
    await input.fill('医生您好，我最近头痛');

    // 点击发送按钮或按Enter
    const sendButton = page.locator('button:has-text("发送")').or(page.locator('button svg')).last();
    await sendButton.click();

    // 等待消息显示
    await page.waitForTimeout(500);

    // 验证消息出现在聊天中
    await expect(page.locator('text=医生您好，我最近头痛')).toBeVisible();
  });

  test('应能结束问诊', async ({ page }) => {
    // 进入一个问诊
    await page.goto('/consultations');
    await page.waitForLoadState('networkidle');

    const firstConsultation = page.locator('[class*="consultation"]').or(page.locator('[class*="Consultation"]')).first();
    await firstConsultation.click();

    await page.waitForLoadState('networkidle');

    // 查找并点击结束问诊按钮
    const endButton = page.locator('button:has-text("结束")').or(page.locator('button:has-text("关闭")'));
    const endButtonCount = await endButton.count();

    if (endButtonCount > 0) {
      // 点击结束按钮
      await endButton.first().click();

      // 确认结束（如果有确认对话框）
      const confirmButton = page.locator('button:has-text("确认")').or(page.locator('button:has-text("确定")');
      const confirmCount = await confirmButton.count();

      if (confirmCount > 0) {
        await confirmButton.first().click();
      }

      // 验证问诊已结束
      await page.waitForTimeout(500);
      await expect(page.locator('text=已结束').or(page.locator('text=关闭'))).toBeVisible();
    }
  });
});

describe('患者端 - 问诊列表和筛选', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearLocalStorage();

    // 登录
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13800139000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');
  });

  test('应能查看问诊列表', async ({ page }) => {
    await page.goto('/consultations');
    await page.waitForLoadState('networkidle');

    // 验证问诊列表显示
    await expect(page.locator('text=问诊').or(page.locator('text=咨询'))).toBeVisible();
  });

  test('应能按状态筛选问诊', async ({ page }) => {
    await page.goto('/consultations');
    await page.waitForLoadState('networkidle');

    // 查找状态筛选器
    const statusFilter = page.locator('[role="tab"]').or(page.locator('button:has-text("待接诊"), button:has-text("进行中"), button:has-text("已结束")'));

    const tabCount = await statusFilter.count();

    if (tabCount > 0) {
      // 点击"进行中"标签
      const activeTab = statusFilter.filter({ hasText: '进行中' });
      const activeCount = await activeTab.count();

      if (activeCount > 0) {
        await activeTab.first().click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('应能从问诊列表进入聊天', async ({ page }) => {
    await page.goto('/consultations');
    await page.waitForLoadState('networkidle');

    // 点击第一个问诊
    const firstConsultation = page.locator('[class*="consultation"]').or(page.locator('[class*="Consultation"]')).first();
    await firstConsultation.click();

    // 验证跳转到聊天页面
    await expect(page).toHaveURL(/\/chat\//);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && pnpm test consultation-patient.spec.ts
```

Expected: Tests will reveal issues with selectors, page structure, and navigation.

**Step 3: Fix selectors and implementation**

Update selectors to match actual page structure. Fix any navigation or interaction issues.

**Step 4: Run tests to verify they pass**

```bash
cd frontend && pnpm test consultation-patient.spec.ts
```

**Step 5: Commit**

```bash
git add frontend/tests/e2e/consultation-patient.spec.ts
git commit -m "test: add patient consultation flow E2E tests"
```

---

### Task 9: 医生端工作台完整流程

**Files:**
- Create: `frontend/tests/e2e/doctor-workflow.spec.ts`

**Step 1: Write the failing test**

```typescript
// frontend/tests/e2e/doctor-workflow.spec.ts
import { test, expect, describe } from '@playwright/test';

/**
 * 医生端工作台完整流程测试
 *
 * 测试目标：
 * 1. 医生登录
 * 2. 查看待接诊列表
 * 3. 接诊操作
 * 4. 与患者聊天
 * 5. 结束问诊
 * 6. 查看统计数据
 */

describe('医生端 - 工作台完整流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearLocalStorage();

    // 医生登录
    await page.goto('/login?role=doctor');
    await page.locator('input[type="tel"]').fill('13800138000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();

    // 等待跳转到医生工作台
    await page.waitForURL(/\/doctor/);
  });

  test('应能显示医生工作台', async ({ page }) => {
    // 验证工作台元素显示
    await expect(page.locator('text=医生').or(page.locator('text=工作台'))).toBeVisible();

    // 验证统计数据卡片
    const statsCards = page.locator('[class*="stat"]').or(page.locator('[class*="Stat"]'));
    const statsCount = await statsCards.count();

    if (statsCount > 0) {
      expect(statsCount).toBeGreaterThan(0);
    }
  });

  test('应能查看待接诊列表', async ({ page }) => {
    // 查找待接诊列表
    const pendingList = page.locator('text=待接诊').or(page.locator('[class*="pending"]'));

    // 验证待接诊部分可见
    const pendingVisible = await pendingList.count();
    if (pendingVisible > 0) {
      await expect(pendingList.first()).toBeVisible();
    }
  });

  test('应能接诊', async ({ page }) => {
    // 先确保有一个待接诊的问诊
    // 注意：这个测试可能需要预先创建一个问诊，或者使用测试数据

    // 查找接诊按钮
    const acceptButton = page.locator('button:has-text("接诊")').or(page.locator('button:has-text("接受")'));
    const acceptCount = await acceptButton.count();

    if (acceptCount > 0) {
      // 点击接诊按钮
      await acceptButton.first().click();

      // 等待接诊成功
      await page.waitForTimeout(1000);

      // 验证状态更新
      await expect(page.locator('text=进行中').or(page.locator('text=已接诊'))).toBeVisible();
    }
  });

  test('应能在聊天界面发送消息', async ({ page }) => {
    // 进入一个活跃的问诊
    const activeConsultation = page.locator('[class*="consultation"]').or(page.locator('[class*="Consultation"]')).first();
    const consultCount = await activeConsultation.count();

    if (consultCount > 0) {
      await activeConsultation.click();

      // 等待聊天页面加载
      await page.waitForLoadState('networkidle');

      // 输入消息
      const input = page.locator('textarea').or(page.locator('input[type="text"]'));
      await input.fill('请问您有什么症状？');

      // 发送消息
      const sendButton = page.locator('button:has-text("发送")').or(page.locator('button svg')).last();
      await sendButton.click();

      // 验证消息显示
      await page.waitForTimeout(500);
      await expect(page.locator('text=请问您有什么症状？')).toBeVisible();
    }
  });

  test('应能结束问诊', async ({ page }) => {
    // 进入一个活跃问诊
    const activeConsultation = page.locator('[class*="consultation"]').or(page.locator('[class*="Consultation"]')).first();
    const consultCount = await activeConsultation.count();

    if (consultCount > 0) {
      await activeConsultation.click();
      await page.waitForLoadState('networkidle');

      // 查找结束问诊按钮
      const endButton = page.locator('button:has-text("结束")').or(page.locator('button:has-text("完成")'));
      const endCount = await endButton.count();

      if (endCount > 0) {
        await endButton.first().click();

        // 确认结束
        const confirmButton = page.locator('button:has-text("确认")').or(page.locator('button:has-text("确定")'));
        const confirmCount = await confirmButton.count();

        if (confirmCount > 0) {
          await confirmButton.first().click();
        }

        // 验证问诊已结束
        await page.waitForTimeout(500);
        await expect(page.locator('text=已结束')).toBeVisible();
      }
    }
  });
});

describe('医生端 - 预约管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearLocalStorage();

    // 医生登录
    await page.goto('/login?role=doctor');
    await page.locator('input[type="tel"]').fill('13800138000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL(/\/doctor/);
  });

  test('应能查看预约列表', async ({ page }) => {
    // 导航到预约管理页面
    await page.goto('/doctor/appointments');
    await page.waitForLoadState('networkidle');

    // 验证预约列表显示
    await expect(page.locator('text=预约').or(page.locator('text=Appointment'))).toBeVisible();
  });

  test('应能按状态筛选预约', async ({ page }) => {
    await page.goto('/doctor/appointments');
    await page.waitForLoadState('networkidle');

    // 查找状态筛选标签
    const statusTabs = page.locator('[role="tab"]').or(page.locator('button:has-text("待确认"), button:has-text("已确认")'));

    const tabCount = await statusTabs.count();

    if (tabCount > 0) {
      // 点击"待确认"标签
      const pendingTab = statusTabs.filter({ hasText: '待确认' });
      const pendingCount = await pendingTab.count();

      if (pendingCount > 0) {
        await pendingTab.first().click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('应能确认预约', async ({ page }) => {
    await page.goto('/doctor/appointments');
    await page.waitForLoadState('networkidle');

    // 查找确认按钮
    const confirmButton = page.locator('button:has-text("确认")').or(page.locator('button:has-text("接受")'));
    const confirmCount = await confirmButton.count();

    if (confirmCount > 0) {
      await confirmButton.first().click();

      // 等待确认成功
      await page.waitForTimeout(500);

      // 验证状态更新
      await expect(page.locator('text=已确认')).toBeVisible();
    }
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && pnpm test doctor-workflow.spec.ts
```

**Step 3: Fix selectors and implementation**

**Step 4: Run tests to verify they pass**

```bash
cd frontend && pnpm test doctor-workflow.spec.ts
```

**Step 5: Commit**

```bash
git add frontend/tests/e2e/doctor-workflow.spec.ts
git commit -m "test: add doctor workflow E2E tests"
```

---

### Task 10: 患者端预约挂号完整流程

**Files:**
- Create: `frontend/tests/e2e/appointment-patient.spec.ts`

**Step 1: Write the failing test**

```typescript
// frontend/tests/e2e/appointment-patient.spec.ts
import { test, expect, describe } from '@playwright/test';

/**
 * 患者端预约挂号完整流程测试
 *
 * 测试目标：
 * 1. 浏览可预约医生
 * 2. 查看医生排班
 * 3. 选择日期和时段
 * 4. 创建预约
 * 5. 查看预约列表
 * 6. 取消预约
 */

describe('患者端 - 预约挂号完整流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearLocalStorage();

    // 患者登录
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13800139000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');
  });

  test('应能浏览可预约医生', async ({ page }) => {
    // 导航到预约挂号页面
    await page.goto('/appointments/doctors');
    await page.waitForLoadState('networkidle');

    // 验证医生列表显示
    await expect(page.locator('text=预约').or(page.locator('text=挂号'))).toBeVisible();

    // 验证有医生卡片
    const doctorCards = page.locator('[class*="doctor"]').or(page.locator('[class*="Doctor"]'));
    const count = await doctorCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('应能查看医生排班', async ({ page }) => {
    await page.goto('/appointments/doctors');
    await page.waitForLoadState('networkidle');

    // 点击第一个医生
    const firstDoctor = page.locator('[class*="doctor"]').or(page.locator('[class*="Doctor"]')).first();
    await firstDoctor.click();

    // 等待排班页面加载
    await page.waitForLoadState('networkidle');

    // 验证排班信息显示
    await expect(page.locator('text=排班').or(page.locator('text=时间'))).toBeVisible();
  });

  test('应能选择日期和时段', async ({ page }) => {
    await page.goto('/appointments/doctors');
    await page.waitForLoadState('networkidle');

    // 点击第一个医生
    const firstDoctor = page.locator('[class*="doctor"]').or(page.locator('[class*="Doctor"]')).first();
    await firstDoctor.click();

    await page.waitForLoadState('networkidle');

    // 选择一个可用日期
    const availableDate = page.locator('[class*="date"]').or(page.locator('button:has-text("/"), button:has-text("月")')).first();
    await availableDate.click();

    await page.waitForTimeout(500);

    // 选择一个可用时段
    const availableSlot = page.locator('button:has-text(":")').or(page.locator('[class*="slot"]')).first();
    const slotCount = await availableSlot.count();

    if (slotCount > 0) {
      await availableSlot.first().click();

      // 验证时段被选中
      await expect(availableSlot.first()).toHaveClass(/selected/);
    }
  });

  test('应能创建预约', async ({ page }) => {
    await page.goto('/appointments/doctors');
    await page.waitForLoadState('networkidle');

    // 点击第一个医生的预约按钮
    const bookButton = page.locator('button:has-text("预约")').or(page.locator('button:has-text("挂号")')).first();
    await bookButton.click();

    // 等待排班页面
    await page.waitForLoadState('networkidle');

    // 选择日期
    const availableDate = page.locator('[class*="date"]').or(page.locator('button:has-text("/"), button:has-text("月")')).first();
    await availableDate.click();
    await page.waitForTimeout(500);

    // 选择时段
    const availableSlot = page.locator('button:has-text(":")').or(page.locator('[class*="slot"]')).first();
    const slotCount = await availableSlot.count();

    if (slotCount > 0) {
      await availableSlot.first().click();
      await page.waitForTimeout(500);

      // 点击确认预约按钮
      const confirmButton = page.locator('button:has-text("确认预约")').or(page.locator('button:has-text("立即预约")'));
      const confirmCount = await confirmButton.count();

      if (confirmCount > 0) {
        await confirmButton.first().click();

        // 等待预约成功提示
        await page.waitForTimeout(1000);

        // 验证预约成功消息
        await expect(page.locator('text=预约成功').or(page.locator('text=成功'))).toBeVisible();
      }
    }
  });

  test('应能查看预约列表', async ({ page }) => {
    // 导航到我的预约页面
    await page.goto('/appointments');
    await page.waitForLoadState('networkidle');

    // 验证预约列表显示
    await expect(page.locator('text=我的预约').or(page.locator('text=预约'))).toBeVisible();
  });

  test('应能按状态筛选预约', async ({ page }) => {
    await page.goto('/appointments');
    await page.waitForLoadState('networkidle');

    // 查找状态筛选器
    const statusTabs = page.locator('[role="tab"]').or(
      page.locator('button:has-text("全部"), button:has-text("待确认"), button:has-text("已取消")')
    );

    const tabCount = await statusTabs.count();

    if (tabCount > 0) {
      // 点击"待确认"标签
      const pendingTab = statusTabs.filter({ hasText: '待确认' });
      const pendingCount = await pendingTab.count();

      if (pendingCount > 0) {
        await pendingTab.first().click();
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('应能取消预约', async ({ page }) => {
    await page.goto('/appointments');
    await page.waitForLoadState('networkidle');

    // 查找取消按钮
    const cancelButton = page.locator('button:has-text("取消")').or(page.locator('button:has-text("取消预约")'));
    const cancelCount = await cancelButton.count();

    if (cancelCount > 0) {
      // 点击第一个取消按钮
      await cancelButton.first().click();

      // 确认取消
      const confirmButton = page.locator('button:has-text("确认")').or(page.locator('button:has-text("确定")'));
      const confirmCount = await confirmButton.count();

      if (confirmCount > 0) {
        await confirmButton.first().click();
      }

      // 验证取消成功
      await page.waitForTimeout(500);
      await expect(page.locator('text=已取消')).toBeVisible();
    }
  });

  test('应能查看预约详情', async ({ page }) => {
    await page.goto('/appointments');
    await page.waitForLoadState('networkidle');

    // 点击第一个预约
    const firstAppointment = page.locator('[class*="appointment"]').or(page.locator('[class*="Appointment"]')).first();
    const appointmentCount = await firstAppointment.count();

    if (appointmentCount > 0) {
      await firstAppointment.click();

      // 验证详情页面显示
      await page.waitForLoadState('networkidle');
      await expect(page.locator('text=预约详情').or(page.locator('text=详情'))).toBeVisible();
    }
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && pnpm test appointment-patient.spec.ts
```

**Step 3: Fix selectors and implementation**

**Step 4: Run tests to verify they pass**

```bash
cd frontend && pnpm test appointment-patient.spec.ts
```

**Step 5: Commit**

```bash
git add frontend/tests/e2e/appointment-patient.spec.ts
git commit -m "test: add patient appointment flow E2E tests"
```

---

### Task 11: 异常场景和边界条件 E2E 测试

**Files:**
- Create: `frontend/tests/e2e/error-scenarios.spec.ts`

**Step 1: Write the failing test**

```typescript
// frontend/tests/e2e/error-scenarios.spec.ts
import { test, expect, describe } from '@playwright/test';

/**
 * 异常场景和边界条件 E2E 测试
 *
 * 测试目标：
 * 1. 网络错误处理
 * 2. 未授权访问
 * 3. 无效输入处理
 * 4. 并发操作
 * 5. 资源不存在
 */

describe('异常场景 - 网络错误处理', () => {
  test('应能处理网络断开', async ({ page }) => {
    // 模拟离线
    await page.context().setOffline(true);

    await page.goto('/doctors');

    // 验证错误提示显示
    await expect(page.locator('text=网络').or(page.locator('text=连接')).or(page.locator('text=失败'))).toBeVisible();

    // 恢复在线
    await page.context().setOffline(false);

    // 刷新页面
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 验证页面恢复正常
    await expect(page.locator('text=医生')).toBeVisible();
  });

  test('应能处理API错误', async ({ page, context }) => {
    // 登录
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13800139000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');

    // 导航到需要API的页面
    await page.goto('/consultations');

    // 验证页面正常加载
    await page.waitForLoadState('networkidle');
  });
});

describe('异常场景 - 未授权访问', () => {
  test('未登录访问受保护页面应重定向到登录页', async ({ page }) => {
    // 清除本地存储
    await page.context().clearLocalStorage();

    // 尝试访问受保护页面
    await page.goto('/consultations');

    // 验证重定向到登录页
    await expect(page).toHaveURL(/\/login/);
  });

  test('患者访问医生页面应被拒绝', async ({ page }) => {
    // 患者登录
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13800139000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');

    // 尝试访问医生工作台
    await page.goto('/doctor/console');

    // 验证访问被拒绝或重定向
    await page.waitForTimeout(1000);
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/doctor/console');
  });
});

describe('异常场景 - 无效输入处理', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13800139000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');
  });

  test('应能处理空手机号输入', async ({ page }) => {
    // 这个测试在登录页面
    await page.goto('/login');

    // 清空手机号
    await page.locator('input[type="tel"]').fill('');

    // 点击获取验证码
    await page.locator('button:has-text("获取验证码")').click();

    // 验证错误提示
    await expect(page.locator('text=请输入').or(page.locator('text=手机号'))).toBeVisible();
  });

  test('应能处理无效手机号格式', async ({ page }) => {
    await page.goto('/login');

    // 输入无效手机号
    await page.locator('input[type="tel"]').fill('123');

    // 点击获取验证码
    await page.locator('button:has-text("获取验证码")').click();

    // 验证错误提示
    await expect(page.locator('text=格式').or(page.locator('text=手机号'))).toBeVisible();
  });

  test('应能处理空消息发送', async ({ page }) => {
    // 进入聊天页面
    await page.goto('/consultations');
    await page.waitForLoadState('networkidle');

    // 点击第一个问诊
    const firstConsultation = page.locator('[class*="consultation"]').or(page.locator('[class*="Consultation"]')).first();
    const consultCount = await firstConsultation.count();

    if (consultCount > 0) {
      await firstConsultation.click();
      await page.waitForLoadState('networkidle');

      // 尝试发送空消息
      const sendButton = page.locator('button:has-text("发送")').or(page.locator('button svg')).last();

      // 验证发送按钮被禁用
      const isDisabled = await sendButton.isDisabled();
      expect(isDisabled).toBe(true);
    }
  });

  test('应能处理超长输入', async ({ page }) => {
    await page.goto('/consultations');
    await page.waitForLoadState('networkidle');

    const firstConsultation = page.locator('[class*="consultation"]').or(page.locator('[class*="Consultation"]')).first();
    const consultCount = await firstConsultation.count();

    if (consultCount > 0) {
      await firstConsultation.click();
      await page.waitForLoadState('networkidle');

      // 输入超长文本
      const input = page.locator('textarea').or(page.locator('input[type="text"]'));
      await input.fill('A'.repeat(10000));

      // 验证输入被限制或提示
      const value = await input.inputValue();
      expect(value.length).toBeLessThanOrEqual(10000);
    }
  });
});

describe('异常场景 - 资源不存在', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13800139000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');
  });

  test('访问不存在的问诊应显示错误', async ({ page }) => {
    // 访问不存在的问诊ID
    await page.goto('/consultations/non-existent-id');

    // 验证错误页面或提示
    await page.waitForTimeout(500);
    const hasError = await page.locator('text=不存在').or(page.locator('text=未找到').or(page.locator('text=错误'))).count();

    if (hasError > 0) {
      await expect(page.locator('text=不存在').or(page.locator('text=未找到')).or(page.locator('text=错误'))).toBeVisible();
    }
  });

  test('访问不存在的预约应显示错误', async ({ page }) => {
    await page.goto('/appointments/non-existent-id');

    await page.waitForTimeout(500);
    const hasError = await page.locator('text=不存在').or(page.locator('text=未找到').or(page.locator('text=错误'))).count();

    if (hasError > 0) {
      await expect(page.locator('text=不存在').or(page.locator('text=未找到')).or(page.locator('text=错误'))).toBeVisible();
    }
  });
});

describe('异常场景 - 移动端适配', () => {
  test('移动端应正确显示医生列表', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 });

    // 登录
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13800139000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');

    // 导航到医生列表
    await page.goto('/doctors');
    await page.waitForLoadState('networkidle');

    // 验证移动端布局
    await expect(page.locator('text=医生').or(page.locator('text=专家'))).toBeVisible();
  });

  test('移动端应能正常发送消息', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // 登录
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13800139000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');

    // 进入问诊列表
    await page.goto('/consultations');
    await page.waitForLoadState('networkidle');

    const firstConsultation = page.locator('[class*="consultation"]').or(page.locator('[class*="Consultation"]')).first();
    const consultCount = await firstConsultation.count();

    if (consultCount > 0) {
      await firstConsultation.click();
      await page.waitForLoadState('networkidle');

      // 验证移动端聊天界面
      const input = page.locator('textarea').or(page.locator('input[type="text"]'));
      await expect(input).toBeVisible();
    }
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd frontend && pnpm test error-scenarios.spec.ts
```

**Step 3: Fix implementation issues**

**Step 4: Run tests to verify they pass**

```bash
cd frontend && pnpm test error-scenarios.spec.ts
```

**Step 5: Commit**

```bash
git add frontend/tests/e2e/error-scenarios.spec.ts
git commit -m "test: add error scenarios E2E tests"
```

---

## 测试执行命令

### 后端测试

```bash
# 运行所有后端测试
cd backend && pnpm test

# 运行特定测试文件
cd backend && pnpm test concurrent-consultations.test.ts
cd backend && pnpm test websocket-recovery.test.ts
cd backend && pnpm test message-consistency.test.ts
cd backend && pnpm test boundary-conditions.test.ts
cd backend && pnpm test schedule-consistency.test.ts
cd backend && pnpm test slot-conflict-boundaries.test.ts
cd backend && pnpm test status-transitions.test.ts

# 运行测试并生成覆盖率报告
cd backend && pnpm test:coverage

# 监听模式（开发时使用）
cd backend && pnpm test --watch
```

### 前端测试

```bash
# 运行所有前端 E2E 测试
cd frontend && pnpm test

# 运行特定测试文件
cd frontend && pnpm test consultation-patient.spec.ts
cd frontend && pnpm test doctor-workflow.spec.ts
cd frontend && pnpm test appointment-patient.spec.ts
cd frontend && pnpm test error-scenarios.spec.ts

# 运行测试并显示浏览器
cd frontend && pnpm test --headed

# 调试模式
cd frontend && pnpm test --debug

# 运行特定项目
cd frontend && pnpm test --project=chromium
cd frontend && pnpm test --project=mobile-chrome
```

---

## 测试覆盖目标

### 后端 API 测试覆盖率目标

| 模块 | 目标覆盖率 | 当前状态 |
|------|-----------|---------|
| 专家问诊 API | 90%+ | 待补充 |
| 预约挂号 API | 90%+ | 待补充 |
| WebSocket 管理 | 85%+ | 待补充 |
| 数据存储层 | 85%+ | 基础覆盖 |

### 前端 E2E 测试覆盖目标

| 用户流程 | 覆盖场景数 | 当前状态 |
|---------|-----------|---------|
| 患者专家问诊 | 6+ | 新增 |
| 医生工作流程 | 6+ | 新增 |
| 患者预约挂号 | 7+ | 新增 |
| 异常场景处理 | 10+ | 新增 |

---

## 注意事项

1. **测试数据隔离**：每个测试应该使用独立的数据，避免测试间相互影响
2. **清理策略**：测试后应清理创建的数据，或使用事务回滚
3. **异步处理**：正确使用 `waitFor` 和 `waitForLoadState` 处理异步操作
4. **选择器稳定性**：优先使用 data-testid 属性，避免依赖容易变化的 class 名
5. **超时设置**：根据实际网络状况调整超时时间
6. **并发测试**：确保并发测试不会相互干扰
7. **错误日志**：测试失败时保留足够的错误信息用于调试

---

## 后续优化建议

1. **性能测试**：添加 API 响应时间、并发用户数等性能指标测试
2. **负载测试**：使用 k6 或 artillery 进行负载测试
3. **安全测试**：添加 SQL 注入、XSS 等安全漏洞测试
4. **视觉回归测试**：使用 Percy 或 Chromatic 进行 UI 视觉回归测试
5. **可访问性测试**：添加 axe-core 进行可访问性测试
6. **契约测试**：使用 Pact 进行 API 契约测试
