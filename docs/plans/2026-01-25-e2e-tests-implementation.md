# 预约模块与专家会诊模块 - 端到端测试实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 为预约挂号模块和专家问诊模块实现完整的端到端测试，验证患者和医生双角色交互流程。

**架构:** 混合模式测试方案 - 使用 Supertest 测试 REST API，使用 `ws` 客户端测试 WebSocket 实时通信。创建可复用的测试辅助工具层（ApiClient 和 WebSocketClient），然后实现端到端测试场景。

**技术栈:** Vitest (测试运行器), Supertest (HTTP 断言), ws (WebSocket 客户端), TypeScript

---

## 目录

1. [阶段一：辅助工具开发](#阶段一辅助工具开发)
2. [阶段二：专家会诊端到端测试](#阶段二专家会诊端到端测试)
3. [阶段三：预约挂号端到端测试](#阶段三预约挂号端到端测试)
4. [阶段四：集成与配置](#阶段四集成与配置)

---

## 阶段一：辅助工具开发

### Task 1: 创建测试环境配置文件

**文件:**
- 创建: `backend/src/__tests__/e2e/helpers/testSetup.ts`

**Step 1: 创建测试环境配置**

```typescript
import { vi } from 'vitest';

// 全局测试超时设置 - WebSocket 操作可能较慢
vi.setConfig({ testTimeout: 30000 });

// 测试常量配置
export const TEST_CONFIG = {
  WS_URL: process.env.WS_URL || 'ws://localhost:3000/ws',
  API_URL: process.env.API_URL || 'http://localhost:3000',
  TEST_TIMEOUT: 30000,
} as const;

// 测试用的认证信息
export const TEST_USERS = {
  PATIENT: {
    phone: '13900139999',
    code: '123456',
  },
  DOCTOR: {
    phone: '13800138000',
    code: '123456',
  },
} as const;
```

**Step 2: 提交更改**

```bash
cd /Users/cong/chenzhicong/project/xiaohe-ai-doctor/.worktrees/e2e-tests
git add backend/src/__tests__/e2e/helpers/testSetup.ts
git commit -m "test(e2e): add test environment configuration"
```

---

### Task 2: 创建 API 客户端抽象层 - 认证相关

**文件:**
- 创建: `backend/src/__tests__/e2e/helpers/testApiClient.ts`

**Step 1: 编写认证 API 的实现**

```typescript
import request from 'supertest';
import { Response } from 'supertest';

interface AuthResponse {
  code: number;
  data: {
    accessToken: string;
    refreshToken: string;
    user: {
      userId: string;
      phone: string;
    };
  };
}

export class TestApiClient {
  private app: Express;
  private patientToken: string | null = null;
  private doctorToken: string | null = null;

  constructor(expressApp: Express) {
    this.app = expressApp;
  }

  /**
   * 患者登录
   */
  async loginPatient(phone: string, code: string): Promise<string> {
    const response: Response = await request(this.app)
      .post('/api/auth/login')
      .send({ phone, verifyCode: code });

    if (response.status !== 200) {
      throw new Error(`Login failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as AuthResponse;
    if (body.code !== 0 || !body.data.accessToken) {
      throw new Error(`Login response invalid: ${JSON.stringify(body)}`);
    }

    this.patientToken = body.data.accessToken;
    return this.patientToken;
  }

  /**
   * 医生登录
   */
  async loginDoctor(phone: string, code: string): Promise<string> {
    const response: Response = await request(this.app)
      .post('/api/auth/login')
      .send({ phone, verifyCode: code, role: 'doctor' });

    if (response.status !== 200) {
      throw new Error(`Doctor login failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as AuthResponse;
    if (body.code !== 0 || !body.data.accessToken) {
      throw new Error(`Doctor login response invalid: ${JSON.stringify(body)}`);
    }

    this.doctorToken = body.data.accessToken;
    return this.doctorToken;
  }

  /**
   * 获取存储的 token
   */
  getPatientToken(): string {
    if (!this.patientToken) {
      throw new Error('Patient not logged in');
    }
    return this.patientToken;
  }

  getDoctorToken(): string {
    if (!this.doctorToken) {
      throw new Error('Doctor not logged in');
    }
    return this.doctorToken;
  }
}
```

**Step 2: 提交更改**

```bash
git add backend/src/__tests__/e2e/helpers/testApiClient.ts
git commit -m "test(e2e): add authentication methods to API client"
```

---

### Task 3: 扩展 API 客户端 - 专家问诊相关

**文件:**
- 修改: `backend/src/__tests__/e2e/helpers/testApiClient.ts`

**Step 1: 添加专家问诊 API 方法**

在 `TestApiClient` 类中添加以下方法：

```typescript
/**
 * 获取医生列表
 */
async getDoctors(
  token: string,
  filters?: {
    department?: string;
    hospital?: string;
    available?: boolean;
  }
): Promise<any[]> {
  const response: Response = await request(this.app)
    .get('/api/consultations/doctors')
    .query(filters || {})
    .set('Authorization', `Bearer ${token}`);

  if (response.status !== 200) {
    throw new Error(`Get doctors failed: ${JSON.stringify(response.body)}`);
  }

  const body = response.body as { code: number; data: any[] };
  if (body.code !== 0) {
    throw new Error(`Get doctors response invalid: ${JSON.stringify(body)}`);
  }

  return body.data;
}

/**
 * 获取医生详情
 */
async getDoctorDetail(token: string, doctorId: string): Promise<any> {
  const response: Response = await request(this.app)
    .get(`/api/consultations/doctors/${doctorId}`)
    .set('Authorization', `Bearer ${token}`);

  if (response.status !== 200) {
    throw new Error(`Get doctor detail failed: ${JSON.stringify(response.body)}`);
  }

  const body = response.body as { code: number; data: any };
  if (body.code !== 0) {
    throw new Error(`Get doctor detail response invalid: ${JSON.stringify(body)}`);
  }

  return body.data;
}

/**
 * 创建问诊
 */
async createConsultation(token: string, doctorId: string): Promise<any> {
  const response: Response = await request(this.app)
    .post('/api/consultations')
    .set('Authorization', `Bearer ${token}`)
    .send({ doctorId });

  if (response.status !== 200) {
    throw new Error(`Create consultation failed: ${JSON.stringify(response.body)}`);
  }

  const body = response.body as { code: number; data: any };
  if (body.code !== 0 || !body.data.id) {
    throw new Error(`Create consultation response invalid: ${JSON.stringify(body)}`);
  }

  return body.data;
}

/**
 * 获取待接诊列表（医生端）
 */
async getPendingConsultations(token: string): Promise<any[]> {
  const response: Response = await request(this.app)
    .get('/api/consultations/pending')
    .set('Authorization', `Bearer ${token}`);

  if (response.status !== 200) {
    throw new Error(`Get pending consultations failed: ${JSON.stringify(response.body)}`);
  }

  const body = response.body as { code: number; data: any[] };
  if (body.code !== 0) {
    throw new Error(`Get pending consultations response invalid: ${JSON.stringify(body)}`);
  }

  return body.data;
}

/**
 * 医生接诊
 */
async acceptConsultation(token: string, consultationId: string): Promise<void> {
  const response: Response = await request(this.app)
    .put(`/api/consultations/${consultationId}/accept`)
    .set('Authorization', `Bearer ${token}`);

  if (response.status !== 200) {
    throw new Error(`Accept consultation failed: ${JSON.stringify(response.body)}`);
  }

  const body = response.body as { code: number };
  if (body.code !== 0) {
    throw new Error(`Accept consultation response invalid: ${JSON.stringify(body)}`);
  }
}

/**
 * 结束问诊
 */
async closeConsultation(token: string, consultationId: string): Promise<void> {
  const response: Response = await request(this.app)
    .put(`/api/consultations/${consultationId}/close`)
    .set('Authorization', `Bearer ${token}`);

  if (response.status !== 200) {
    throw new Error(`Close consultation failed: ${JSON.stringify(response.body)}`);
  }

  const body = response.body as { code: number };
  if (body.code !== 0) {
    throw new Error(`Close consultation response invalid: ${JSON.stringify(body)}`);
  }
}

/**
 * 获取问诊详情
 */
async getConsultationDetail(token: string, consultationId: string): Promise<any> {
  const response: Response = await request(this.app)
    .get(`/api/consultations/${consultationId}`)
    .set('Authorization', `Bearer ${token}`);

  if (response.status !== 200) {
    throw new Error(`Get consultation detail failed: ${JSON.stringify(response.body)}`);
  }

  const body = response.body as { code: number; data: any };
  if (body.code !== 0) {
    throw new Error(`Get consultation detail response invalid: ${JSON.stringify(body)}`);
  }

  return body.data;
}

/**
 * 加入问诊会话
 */
async joinConsultation(token: string, consultationId: string): Promise<void> {
  const response: Response = await request(this.app)
    .post(`/api/consultations/${consultationId}/join`)
    .set('Authorization', `Bearer ${token}`);

  if (response.status !== 200) {
    throw new Error(`Join consultation failed: ${JSON.stringify(response.body)}`);
  }

  const body = response.body as { code: number };
  if (body.code !== 0) {
    throw new Error(`Join consultation response invalid: ${JSON.stringify(body)}`);
  }
}

/**
 * 离开问诊会话
 */
async leaveConsultation(token: string, consultationId: string): Promise<void> {
  const response: Response = await request(this.app)
    .post(`/api/consultations/${consultationId}/leave`)
    .set('Authorization', `Bearer ${token}`);

  if (response.status !== 200) {
    throw new Error(`Leave consultation failed: ${JSON.stringify(response.body)}`);
  }

  const body = response.body as { code: number };
  if (body.code !== 0) {
    throw new Error(`Leave consultation response invalid: ${JSON.stringify(body)}`);
  }
}
```

**Step 2: 提交更改**

```bash
git add backend/src/__tests__/e2e/helpers/testApiClient.ts
git commit -m "test(e2e): add consultation API methods to test client"
```

---

### Task 4: 扩展 API 客户端 - 预约挂号相关

**文件:**
- 修改: `backend/src/__tests__/e2e/helpers/testApiClient.ts`

**Step 1: 添加预约挂号 API 方法**

在 `TestApiClient` 类中添加以下方法：

```typescript
/**
 * 获取医生排班
 */
async getDoctorSchedule(
  doctorId: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  const response: Response = await request(this.app)
    .get('/api/appointments/schedule')
    .query({ doctorId, startDate, endDate });

  if (response.status !== 200) {
    throw new Error(`Get doctor schedule failed: ${JSON.stringify(response.body)}`);
  }

  const body = response.body as { code: number; data: { schedules: any[] } };
  if (body.code !== 0 || !body.data.schedules) {
    throw new Error(`Get doctor schedule response invalid: ${JSON.stringify(body)}`);
  }

  return body.data.schedules;
}

/**
 * 创建预约
 */
async createAppointment(
  token: string,
  data: {
    doctorId: string;
    patientName: string;
    appointmentTime: string;
  }
): Promise<any> {
  const response: Response = await request(this.app)
    .post('/api/appointments')
    .set('Authorization', `Bearer ${token}`)
    .send(data);

  if (response.status !== 201) {
    throw new Error(`Create appointment failed: ${JSON.stringify(response.body)}`);
  }

  const body = response.body as { code: number; data: any };
  if (body.code !== 0 || !body.data.id) {
    throw new Error(`Create appointment response invalid: ${JSON.stringify(body)}`);
  }

  return body.data;
}

/**
 * 获取我的预约列表
 */
async getMyAppointments(token: string): Promise<any[]> {
  const response: Response = await request(this.app)
    .get('/api/appointments')
    .set('Authorization', `Bearer ${token}`);

  if (response.status !== 200) {
    throw new Error(`Get my appointments failed: ${JSON.stringify(response.body)}`);
  }

  const body = response.body as { code: number; data: any[] };
  if (body.code !== 0) {
    throw new Error(`Get my appointments response invalid: ${JSON.stringify(body)}`);
  }

  return body.data;
}

/**
 * 获取预约详情
 */
async getAppointmentDetail(token: string, appointmentId: string): Promise<any> {
  const response: Response = await request(this.app)
    .get(`/api/appointments/${appointmentId}`)
    .set('Authorization', `Bearer ${token}`);

  if (response.status !== 200) {
    throw new Error(`Get appointment detail failed: ${JSON.stringify(response.body)}`);
  }

  const body = response.body as { code: number; data: any };
  if (body.code !== 0) {
    throw new Error(`Get appointment detail response invalid: ${JSON.stringify(body)}`);
  }

  return body.data;
}

/**
 * 取消预约
 */
async cancelAppointment(token: string, appointmentId: string): Promise<void> {
  const response: Response = await request(this.app)
    .put(`/api/appointments/${appointmentId}/cancel`)
    .set('Authorization', `Bearer ${token}`);

  if (response.status !== 200) {
    throw new Error(`Cancel appointment failed: ${JSON.stringify(response.body)}`);
  }

  const body = response.body as { code: number };
  if (body.code !== 0) {
    throw new Error(`Cancel appointment response invalid: ${JSON.stringify(body)}`);
  }
}

/**
 * 获取预约医生列表
 */
async getAppointmentDoctors(
  token: string,
  filters?: {
    department?: string;
    hospital?: string;
    available?: boolean;
  }
): Promise<any[]> {
  const response: Response = await request(this.app)
    .get('/api/appointments/doctors')
    .query(filters || {})
    .set('Authorization', `Bearer ${token}`);

  if (response.status !== 200) {
    throw new Error(`Get appointment doctors failed: ${JSON.stringify(response.body)}`);
  }

  const body = response.body as { code: number; data: any[] };
  if (body.code !== 0) {
    throw new Error(`Get appointment doctors response invalid: ${JSON.stringify(body)}`);
  }

  return body.data;
}
```

**Step 2: 添加导出和类型导入**

在文件顶部添加导入，在文件末尾添加导出：

```typescript
// 在文件顶部
import type { Express } from 'express';

// 在文件末尾
export { TestApiClient };
```

**Step 3: 提交更改**

```bash
git add backend/src/__tests__/e2e/helpers/testApiClient.ts
git commit -m "test(e2e): add appointment API methods to test client"
```

---

### Task 5: 创建 WebSocket 客户端封装

**文件:**
- 创建: `backend/src/__tests__/e2e/helpers/testWebSocketClient.ts`

**Step 1: 创建 WebSocket 客户端类**

```typescript
import WebSocket, { WebSocket as WebSocketType } from 'ws';

export type ServerMessage =
  | { type: 'message'; conversationId: string; message: any }
  | { type: 'typing'; conversationId: string; senderId: string; isTyping: boolean }
  | { type: 'system'; conversationId: string; text: string }
  | { type: 'joined'; conversationId: string }
  | { type: 'left'; conversationId: string };

export class TestWebSocketClient {
  private ws: WebSocketType | null = null;
  private messageQueue: ServerMessage[] = [];
  private url: string;
  private connected: boolean = false;

  constructor(wsUrl: string = 'ws://localhost:3000/ws') {
    this.url = wsUrl;
  }

  /**
   * 连接 WebSocket 服务器
   */
  async connect(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const urlWithToken = `${this.url}?token=${token}`;
      this.ws = new WebSocket(urlWithToken);

      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.connected = true;
        resolve();
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString()) as ServerMessage;
          this.messageQueue.push(message);
        } catch (e) {
          // 忽略无法解析的消息
        }
      });

      this.ws.on('close', () => {
        this.connected = false;
      });
    });
  }

  /**
   * 加入会话
   */
  joinConversation(conversationId: string): void {
    this.send({ type: 'join', conversationId });
  }

  /**
   * 离开会话
   */
  leaveConversation(conversationId: string): void {
    this.send({ type: 'leave', conversationId });
  }

  /**
   * 发送消息
   */
  sendMessage(conversationId: string, content: string): void {
    this.send({
      type: 'message',
      conversationId,
      content,
    });
  }

  /**
   * 发送正在输入状态
   */
  sendTyping(conversationId: string, isTyping: boolean): void {
    this.send({
      type: 'typing',
      conversationId,
      isTyping,
    });
  }

  /**
   * 发送心跳
   */
  sendHeartbeat(): void {
    this.send({ type: 'heartbeat' });
  }

  /**
   * 私有方法：发送数据
   */
  private send(data: any): void {
    if (!this.isConnected()) {
      throw new Error('WebSocket is not connected');
    }
    this.ws!.send(JSON.stringify(data));
  }

  /**
   * 等待下一条消息
   */
  async waitForMessage(timeout = 5000): Promise<ServerMessage> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (this.messageQueue.length > 0) {
        return this.messageQueue.shift()!;
      }
      await this.sleep(50);
    }

    throw new Error(`Timeout waiting for message after ${timeout}ms`);
  }

  /**
   * 等待特定类型的系统消息
   */
  async waitForSystemMessage(expectedText: string, timeout = 5000): Promise<ServerMessage> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const index = this.messageQueue.findIndex(
        (m) => m.type === 'system' && (m as any).text === expectedText
      );

      if (index !== -1) {
        return this.messageQueue.splice(index, 1)[0];
      }
      await this.sleep(50);
    }

    throw new Error(`Timeout waiting for system message: "${expectedText}"`);
  }

  /**
   * 等待特定类型的消息
   */
  async waitForMessageOfType(type: string, timeout = 5000): Promise<ServerMessage> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const index = this.messageQueue.findIndex((m) => (m as any).type === type);

      if (index !== -1) {
        return this.messageQueue.splice(index, 1)[0];
      }
      await this.sleep(50);
    }

    throw new Error(`Timeout waiting for ${type} message`);
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.messageQueue = [];
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connected && this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * 私有方法：延迟
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

**Step 2: 提交更改**

```bash
git add backend/src/__tests__/e2e/helpers/testWebSocketClient.ts
git commit -m "test(e2e): add WebSocket client wrapper for testing"
```

---

### Task 6: 创建测试工具导出文件

**文件:**
- 创建: `backend/src/__tests__/e2e/helpers/index.ts`

**Step 1: 创建导出文件**

```typescript
export { TEST_CONFIG, TEST_USERS } from './testSetup';
export { TestApiClient } from './testApiClient';
export { TestWebSocketClient } from './testWebSocketClient';
export type { ServerMessage } from './testWebSocketClient';
```

**Step 2: 提交更改**

```bash
git add backend/src/__tests__/e2e/helpers/index.ts
git commit -m "test(e2e): add helper utilities export file"
```

---

## 阶段二：专家会诊端到端测试

### Task 7: 创建专家会诊端到端测试 - 认证和创建问诊

**文件:**
- 创建: `backend/src/__tests__/e2e/consultations/consultation-flow.test.ts`

**Step 1: 编写测试 - 双方登录和创建问诊**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import consultationsRouter from '../../../routes/consultations';
import authRouter from '../../../routes/auth';
import { errorHandler } from '../../../utils/errorHandler';
import { TestApiClient, TEST_USERS } from '../helpers';
import { logger } from '../../../utils/logger';

// 创建测试应用
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/consultations', consultationsRouter);
app.use(errorHandler);

// 禁用测试期间的日志输出
logger.silent = true;

describe('专家问诊 - 双角色完整流程', () => {
  let apiClient: TestApiClient;
  let patientToken: string;
  let doctorToken: string;
  let consultationId: string;

  beforeAll(() => {
    apiClient = new TestApiClient(app);
  });

  describe('步骤 1-2: 双方登录', () => {
    it('患者应能成功登录', async () => {
      patientToken = await apiClient.loginPatient(
        TEST_USERS.PATIENT.phone,
        TEST_USERS.PATIENT.code
      );
      expect(patientToken).toBeDefined();
      expect(typeof patientToken).toBe('string');
      expect(patientToken.length).toBeGreaterThan(0);
    });

    it('医生应能成功登录', async () => {
      doctorToken = await apiClient.loginDoctor(
        TEST_USERS.DOCTOR.phone,
        TEST_USERS.DOCTOR.code
      );
      expect(doctorToken).toBeDefined();
      expect(typeof doctorToken).toBe('string');
      expect(doctorToken.length).toBeGreaterThan(0);
    });

    it('两个 token 应该不同', () => {
      expect(patientToken).not.toBe(doctorToken);
    });
  });

  describe('步骤 3-4: 患者创建问诊', () => {
    it('患者应能获取医生列表', async () => {
      const doctors = await apiClient.getDoctors(patientToken);
      expect(doctors).toBeDefined();
      expect(Array.isArray(doctors)).toBe(true);
      expect(doctors.length).toBeGreaterThan(0);
    });

    it('患者应能按科室筛选医生', async () => {
      const doctors = await apiClient.getDoctors(patientToken, {
        department: '内科',
      });
      expect(doctors.length).toBeGreaterThan(0);
      doctors.forEach((doctor) => {
        expect(doctor.department).toBe('内科');
      });
    });

    it('患者应能成功创建问诊', async () => {
      const consultation = await apiClient.createConsultation(
        patientToken,
        'doctor_001'
      );

      expect(consultation).toBeDefined();
      expect(consultation.id).toBeDefined();
      expect(consultation.status).toBe('pending');
      expect(consultation.doctorId).toBe('doctor_001');

      consultationId = consultation.id;
    });
  });

  describe('步骤 5-6: 医生接诊', () => {
    it('医生应能看到待接诊列表', async () => {
      const pending = await apiClient.getPendingConsultations(doctorToken);

      expect(pending).toBeDefined();
      expect(Array.isArray(pending)).toBe(true);

      // 找到我们刚创建的问诊
      const found = pending.find((c) => c.id === consultationId);
      expect(found).toBeDefined();
    });

    it('医生应能成功接诊', async () => {
      await apiClient.acceptConsultation(doctorToken, consultationId);

      // 验证状态已更新
      const updated = await apiClient.getConsultationDetail(
        doctorToken,
        consultationId
      );
      expect(updated.status).toBe('active');
    });

    it('患者应能看到问诊状态已更新', async () => {
      const consultation = await apiClient.getConsultationDetail(
        patientToken,
        consultationId
      );
      expect(consultation.status).toBe('active');
    });
  });
});
```

**Step 2: 运行测试验证通过**

运行:
```bash
cd /Users/cong/chenzhicong/project/xiaohe-ai-doctor/.worktrees/e2e-tests/backend
pnpm test src/__tests__/e2e/consultations/consultation-flow.test.ts
```

预期: 所有测试通过

**Step 3: 提交更改**

```bash
git add backend/src/__tests__/e2e/consultations/consultation-flow.test.ts
git commit -m "test(e2e): add consultation flow test - auth and creation"
```

---

### Task 8: 扩展专家会诊测试 - WebSocket 实时通信

**文件:**
- 修改: `backend/src/__tests__/e2e/consultations/consultation-flow.test.ts`

**Step 1: 添加 WebSocket 测试**

在文件中添加导入和新的测试组：

```typescript
// 在文件顶部添加导入
import { TestWebSocketClient } from '../helpers';

// 在现有测试之后添加新的测试组
  describe('步骤 7-9: WebSocket 实时通信', () => {
    let patientWs: TestWebSocketClient;
    let doctorWs: TestWebSocketClient;

    afterAll(() => {
      // 确保连接被清理
      if (patientWs) {
        patientWs.disconnect();
      }
      if (doctorWs) {
        doctorWs.disconnect();
      }
    });

    it('患者应能连接 WebSocket 并加入会话', async () => {
      patientWs = new TestWebSocketClient();

      await patientWs.connect(patientToken);
      expect(patientWs.isConnected()).toBe(true);

      patientWs.joinConversation(consultationId);

      // 等待加入确认（系统消息）
      const sysMsg = await patientWs.waitForMessageOfType('joined', 5000);
      expect(sysMsg).toBeDefined();
    });

    it('医生应能连接 WebSocket 并加入会话', async () => {
      doctorWs = new TestWebSocketClient();

      await doctorWs.connect(doctorToken);
      expect(doctorWs.isConnected()).toBe(true);

      doctorWs.joinConversation(consultationId);

      // 等待加入确认
      const sysMsg = await doctorWs.waitForMessageOfType('joined', 5000);
      expect(sysMsg).toBeDefined();
    });

    it('患者发送消息，医生应能收到', async () => {
      const testMessage = '医生您好，我最近头痛';
      patientWs.sendMessage(consultationId, testMessage);

      // 医生应该收到消息
      const received = await doctorWs.waitForMessage(5000);
      expect(received).toBeDefined();
      expect((received as any).type).toBe('message');
      expect((received as any).message.content).toBe(testMessage);
      expect((received as any).message.senderType).toBe('patient');
    });

    it('医生发送消息，患者应能收到', async () => {
      const testMessage = '请问持续多久了？';
      doctorWs.sendMessage(consultationId, testMessage);

      // 患者应该收到消息
      const received = await patientWs.waitForMessage(5000);
      expect(received).toBeDefined();
      expect((received as any).type).toBe('message');
      expect((received as any).message.content).toBe(testMessage);
      expect((received as any).message.senderType).toBe('doctor');
    });

    it('应能正确显示正在输入状态', async () => {
      patientWs.sendTyping(consultationId, true);

      // 医生应该收到正在输入通知
      const typingMsg = await doctorWs.waitForMessage(5000);
      expect(typingMsg).toBeDefined();
      expect((typingMsg as any).type).toBe('typing');
      expect((typingMsg as any).isTyping).toBe(true);
    });
  });
```

**注意:** 这个测试需要 WebSocket 服务器正在运行。如果后端 index.ts 没有在测试环境启动 WebSocket 服务器，可能需要先配置。

**Step 2: 运行测试验证通过**

运行:
```bash
cd /Users/cong/chenzhicong/project/xiaohe-ai-doctor/.worktrees/e2e-tests/backend
pnpm test src/__tests__/e2e/consultations/consultation-flow.test.ts
```

预期: 所有测试通过

**Step 3: 提交更改**

```bash
git add backend/src/__tests__/e2e/consultations/consultation-flow.test.ts
git commit -m "test(e2e): add WebSocket real-time communication tests"
```

---

### Task 9: 完成专家会诊测试 - 结束问诊流程

**文件:**
- 修改: `backend/src/__tests__/e2e/consultations/consultation-flow.test.ts`

**Step 1: 添加结束问诊和清理测试**

```typescript
  describe('步骤 10-11: 结束问诊并断开连接', () => {
    it('医生应能结束问诊', async () => {
      await apiClient.closeConsultation(doctorToken, consultationId);

      // 验证状态已更新
      const updated = await apiClient.getConsultationDetail(
        doctorToken,
        consultationId
      );
      expect(updated.status).toBe('closed');
    });

    it('患者应能看到问诊已结束', async () => {
      const consultation = await apiClient.getConsultationDetail(
        patientToken,
        consultationId
      );
      expect(consultation.status).toBe('closed');
    });

    it('患者应能离开会话', async () => {
      await apiClient.leaveConsultation(patientToken, consultationId);
      // 没有抛出异常即为成功
    });

    it('医生应能离开会话', async () => {
      await apiClient.leaveConsultation(doctorToken, consultationId);
      // 没有抛出异常即为成功
    });
  });
```

**Step 2: 运行测试验证通过**

运行:
```bash
cd /Users/cong/chenzhicong/project/xiaohe-ai-doctor/.worktrees/e2e-tests/backend
pnpm test src/__tests__/e2e/consultations/consultation-flow.test.ts
```

预期: 所有测试通过

**Step 3: 提交更改**

```bash
git add backend/src/__tests__/e2e/consultations/consultation-flow.test.ts
git commit -m "test(e2e): add consultation closing and cleanup tests"
```

---

## 阶段三：预约挂号端到端测试

### Task 10: 创建预约挂号端到端测试 - 浏览和创建

**文件:**
- 创建: `backend/src/__tests__/e2e/appointments/appointment-flow.test.ts`

**Step 1: 编写预约流程测试**

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import appointmentsRouter from '../../../routes/appointments';
import authRouter from '../../../routes/auth';
import { errorHandler } from '../../../utils/errorHandler';
import { TestApiClient, TEST_USERS } from '../helpers';
import { logger } from '../../../utils/logger';

// 创建测试应用
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/appointments', appointmentsRouter);
app.use(errorHandler);

// 禁用测试期间的日志输出
logger.silent = true;

describe('预约挂号 - 完整用户旅程', () => {
  let apiClient: TestApiClient;
  let userToken: string;
  let appointmentId: string;

  beforeAll(async () => {
    apiClient = new TestApiClient(app);
    userToken = await apiClient.loginPatient(
      TEST_USERS.PATIENT.phone,
      TEST_USERS.PATIENT.code
    );
  });

  describe('步骤 1: 浏览医生并选择', () => {
    it('应能获取医生列表（按科室筛选）', async () => {
      const doctors = await apiClient.getAppointmentDoctors(userToken, {
        department: '内科',
      });

      expect(doctors).toBeDefined();
      expect(Array.isArray(doctors)).toBe(true);
      expect(doctors.length).toBeGreaterThan(0);
      expect(doctors[0].department).toBe('内科');
    });

    it('应能获取医生详情', async () => {
      const doctor = await apiClient.getDoctorDetail(userToken, 'doctor_001');

      expect(doctor).toBeDefined();
      expect(doctor.id).toBe('doctor_001');
      expect(doctor.name).toBeDefined();
      expect(doctor.title).toBeDefined();
    });

    it('应能筛选可用的医生', async () => {
      const doctors = await apiClient.getAppointmentDoctors(userToken, {
        available: true,
      });

      expect(doctors.length).toBeGreaterThan(0);
      doctors.forEach((doctor) => {
        expect(doctor.available || doctor.isAvailable).toBe(true);
      });
    });
  });

  describe('步骤 2: 查看排班并选择时间', () => {
    it('应能获取医生未来7天排班', async () => {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);

      const startDate = today.toISOString().split('T')[0];
      const endDate = nextWeek.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        'doctor_001',
        startDate,
        endDate
      );

      expect(schedules).toBeDefined();
      expect(Array.isArray(schedules)).toBe(true);
      expect(schedules.length).toBe(7);

      // 验证每个日期都有可用时段数组
      schedules.forEach((schedule) => {
        expect(schedule.date).toBeDefined();
        expect(Array.isArray(schedule.availableSlots)).toBe(true);
      });
    });

    it('应能获取单日排班', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        'doctor_001',
        dateStr,
        dateStr
      );

      expect(schedules.length).toBe(1);
      expect(schedules[0].date).toBe(dateStr);
    });
  });
});
```

**Step 2: 运行测试验证通过**

运行:
```bash
cd /Users/cong/chenzhicong/project/xiaohe-ai-doctor/.worktrees/e2e-tests/backend
pnpm test src/__tests__/e2e/appointments/appointment-flow.test.ts
```

预期: 所有测试通过

**Step 3: 提交更改**

```bash
git add backend/src/__tests__/e2e/appointments/appointment-flow.test.ts
git commit -m "test(e2e): add appointment flow test - browsing and scheduling"
```

---

### Task 11: 扩展预约测试 - 创建和管理预约

**文件:**
- 修改: `backend/src/__tests__/e2e/appointments/appointment-flow.test.ts`

**Step 1: 添加创建和查看预约测试**

```typescript
  describe('步骤 3: 创建预约', () => {
    it('应能成功创建预约', async () => {
      // 选择明天上午 9:00
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);

      const appointment = await apiClient.createAppointment(userToken, {
        doctorId: 'doctor_001',
        patientName: '张三',
        appointmentTime: tomorrow.toISOString(),
      });

      expect(appointment).toBeDefined();
      expect(appointment.id).toBeDefined();
      expect(appointment.status).toBe('pending');
      expect(appointment.doctorId).toBe('doctor_001');
      expect(appointment.patientName).toBe('张三');

      appointmentId = appointment.id;
    });

    it('不应能创建过去的预约', async () => {
      // 选择昨天的时间
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await expect(
        apiClient.createAppointment(userToken, {
          doctorId: 'doctor_001',
          patientName: '李四',
          appointmentTime: yesterday.toISOString(),
        })
      ).rejects.toThrow();
    });

    it('不应能重复预约同一时段', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      // 第一次预约应该成功
      await apiClient.createAppointment(userToken, {
        doctorId: 'doctor_001',
        patientName: '王五',
        appointmentTime: tomorrow.toISOString(),
      });

      // 第二次预约相同时段应该失败
      await expect(
        apiClient.createAppointment(userToken, {
          doctorId: 'doctor_001',
          patientName: '赵六',
          appointmentTime: tomorrow.toISOString(),
        })
      ).rejects.toThrow();
    });
  });

  describe('步骤 4: 查看我的预约', () => {
    it('应能获取我的预约列表', async () => {
      const appointments = await apiClient.getMyAppointments(userToken);

      expect(appointments).toBeDefined();
      expect(Array.isArray(appointments)).toBe(true);
      expect(appointments.length).toBeGreaterThan(0);

      // 验证我们创建的预约在列表中
      const found = appointments.find((a) => a.id === appointmentId);
      expect(found).toBeDefined();
    });

    it('应能获取预约详情', async () => {
      const detail = await apiClient.getAppointmentDetail(userToken, appointmentId);

      expect(detail).toBeDefined();
      expect(detail.id).toBe(appointmentId);
      expect(detail.doctor).toBeDefined();
      expect(detail.doctor.name).toBeDefined();
      expect(detail.appointmentTime).toBeDefined();
    });

    it('不应能查看其他用户的预约', async () => {
      // 创建另一个用户
      const otherUserToken = await apiClient.loginPatient('13900139998', '123456');

      await expect(
        apiClient.getAppointmentDetail(otherUserToken, appointmentId)
      ).rejects.toThrow();
    });
  });
```

**Step 2: 运行测试验证通过**

运行:
```bash
cd /Users/cong/chenzhicong/project/xiaohe-ai-doctor/.worktrees/e2e-tests/backend
pnpm test src/__tests__/e2e/appointments/appointment-flow.test.ts
```

预期: 所有测试通过

**Step 3: 提交更改**

```bash
git add backend/src/__tests__/e2e/appointments/appointment-flow.test.ts
git commit -m "test(e2e): add appointment creation and management tests"
```

---

### Task 12: 完成预约测试 - 取消预约

**文件:**
- 修改: `backend/src/__tests__/e2e/appointments/appointment-flow.test.ts`

**Step 1: 添加取消预约测试**

```typescript
  describe('步骤 5: 取消预约', () => {
    it('应能成功取消预约', async () => {
      await apiClient.cancelAppointment(userToken, appointmentId);

      // 验证状态已更新
      const updated = await apiClient.getAppointmentDetail(
        userToken,
        appointmentId
      );
      expect(updated.status).toBe('cancelled');
    });

    it('已取消的预约不应能再次取消', async () => {
      await expect(
        apiClient.cancelAppointment(userToken, appointmentId)
      ).rejects.toThrow();
    });

    it('应能创建新的预约', async () => {
      const dayAfterTomorrow = new Date();
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      dayAfterTomorrow.setHours(14, 0, 0, 0);

      const newAppointment = await apiClient.createAppointment(userToken, {
        doctorId: 'doctor_002',
        patientName: '张三',
        appointmentTime: dayAfterTomorrow.toISOString(),
      });

      expect(newAppointment.status).toBe('pending');
      expect(newAppointment.doctorId).toBe('doctor_002');
    });
  });
```

**Step 2: 运行测试验证通过**

运行:
```bash
cd /Users/cong/chenzhicong/project/xiaohe-ai-doctor/.worktrees/e2e-tests/backend
pnpm test src/__tests__/e2e/appointments/appointment-flow.test.ts
```

预期: 所有测试通过

**Step 3: 提交更改**

```bash
git add backend/src/__tests__/e2e/appointments/appointment-flow.test.ts
git commit -m "test(e2e): add appointment cancellation tests"
```

---

## 阶段四：集成与配置

### Task 13: 更新 package.json 添加测试脚本

**文件:**
- 修改: `backend/package.json`

**Step 1: 添加端到端测试脚本**

在 `scripts` 部分添加：

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "vitest run src/__tests__/e2e",
    "test:e2e:watch": "vitest watch src/__tests__/e2e",
    "test:e2e:coverage": "vitest run src/__tests__/e2e --coverage"
  }
}
```

**Step 2: 提交更改**

```bash
git add backend/package.json
git commit -m "test(e2e): add e2e test scripts to package.json"
```

---

### Task 14: 验证所有端到端测试通过

**Step 1: 运行所有端到端测试**

```bash
cd /Users/cong/chenzhicong/project/xiaohe-ai-doctor/.worktrees/e2e-tests/backend
pnpm test:e2e
```

预期输出:
```
 ✓ src/__tests__/e2e/consultations/consultation-flow.test.ts (N tests)
 ✓ src/__tests__/e2e/appointments/appointment-flow.test.ts (N tests)

 Test Files  2 passed (2)
      Tests  N passed (N)
   Start at  HH:MM:SS
   Duration  Xms
```

**Step 2: 如果测试通过，提交最终验证**

```bash
git commit --allow-empty -m "test(e2e): verify all e2e tests passing"
```

---

### Task 15: 生成测试覆盖率报告

**Step 1: 运行覆盖率测试**

```bash
cd /Users/cong/chenzhicong/project/xiaohe-ai-doctor/.worktrees/e2e-tests/backend
pnpm test:e2e:coverage
```

**Step 2: 检查覆盖率是否达标**

预期覆盖率目标:
- 专家会诊 API: 90%+
- WebSocket 消息: 85%+
- 预约挂号 API: 90%+

**Step 3: 提交覆盖率配置（如需要）**

如果覆盖率配置需要更新：

```bash
git add backend/vitest.config.ts
git commit -m "test(e2e): update coverage configuration"
```

---

### Task 16: 推送分支到远程

**Step 1: 推送分支**

```bash
cd /Users/cong/chenzhicong/project/xiaohe-ai-doctor
git push -u origin feature/e2e-appointments-consultations
```

**Step 2: 验证推送成功**

检查分支已推送到远程。

---

## 测试文档

### 运行端到端测试

```bash
# 进入 worktree 目录
cd /Users/cong/chenzhicong/project/xiaohe-ai-doctor/.worktrees/e2e-tests/backend

# 安装依赖（首次）
pnpm install

# 运行所有端到端测试
pnpm test:e2e

# 监听模式（开发时）
pnpm test:e2e:watch

# 生成覆盖率报告
pnpm test:e2e:coverage
```

### 测试文件说明

| 文件 | 说明 |
|-----|------|
| `helpers/testSetup.ts` | 测试环境配置和常量 |
| `helpers/testApiClient.ts` | API 客户端抽象层 |
| `helpers/testWebSocketClient.ts` | WebSocket 客户端封装 |
| `consultations/consultation-flow.test.ts` | 专家问诊双角色完整流程测试 |
| `appointments/appointment-flow.test.ts` | 预约挂号完整用户旅程测试 |

### 测试覆盖场景

**专家问诊:**
- ✅ 患者和医生双角色登录
- ✅ 患者浏览医生并创建问诊
- ✅ 医生查看待接诊列表并接诊
- ✅ WebSocket 双向实时通信
- ✅ 正在输入状态通知
- ✅ 医生结束问诊
- ✅ 双方断开连接

**预约挂号:**
- ✅ 浏览医生列表（按科室筛选）
- ✅ 查看医生排班
- ✅ 创建预约
- ✅ 查看我的预约列表
- ✅ 查看预约详情
- ✅ 取消预约
- ✅ 边缘情况处理（过去时间、重复预约等）

---

**实施计划完成！**

所有任务已分解为可执行的步骤，每个步骤都包含：
- 具体的文件路径
- 完整的代码实现
- 确切的运行命令
- 预期结果
- Git 提交信息
