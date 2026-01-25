# 预约模块与专家会诊模块 - 端到端测试设计文档

**创建日期**: 2026-01-25
**版本**: v1.0
**状态**: 设计阶段

---

## 1. 概述

本文档为预约挂号模块和专家问诊模块设计完整的端到端测试方案，验证两个模块的功能可用性。

### 1.1 测试目标

- 覆盖完整的用户旅程（从登录到业务完成）
- 验证患者和医生双角色交互流程（专家问诊）
- 测试 WebSocket 实时通信功能
- 确保错误处理和边界情况正确

### 1.2 测试范围

| 模块 | 测试场景 |
|-----|---------|
| 预约挂号 | 浏览医生 → 查看排班 → 创建预约 → 查看列表 → 取消预约 |
| 专家问诊 | 患者登录 → 创建问诊 → 医生登录 → 接诊 → WebSocket 实时对话 → 结束问诊 |

---

## 2. 整体架构

### 2.1 测试套件结构

```
backend/src/__tests__/e2e/
├── helpers/
│   ├── testApiClient.ts        # API 客户端抽象层
│   ├── testWebSocketClient.ts  # WS 客户端封装
│   └── testSetup.ts            # 测试环境初始化
│
├── appointments/
│   ├── appointment-flow.test.ts   # 完整预约流程
│   └── appointment-api.test.ts   # API 单元测试
│
└── consultations/
    ├── consultation-flow.test.ts  # 完整会诊流程（双角色）
    └── websocket-flow.test.ts     # WS 端到端测试
```

### 2.2 测试工具栈

| 工具 | 用途 | 版本 |
|-----|------|-----|
| Vitest | 测试运行器 | ^2.0.0 |
| Supertest | HTTP 断言 | ^7.0.0 |
| ws | WebSocket 客户端 | ^8.18.0 |

### 2.3 测试策略

- **混合模式**: 简单 API 用 Supertest，复杂 WebSocket 用封装客户端
- **真实环境**: 使用真实 HTTP 请求和 WebSocket 连接
- **数据隔离**: 内存存储，每个测试独立

---

## 3. 专家会诊双角色测试流程

### 3.1 完整测试场景

```
1. 患者登录    → POST /api/auth/login (role: patient)
2. 医生登录    → POST /api/auth/login (role: doctor)
3. 患者浏览医生 → GET /api/consultations/doctors
4. 患者创建问诊 → POST /api/consultations
5. 医生查看待办 → GET /api/consultations/pending
6. 医生接诊    → PUT /api/consultations/:id/accept
7. 患者 WS 连接 → WS Connect → join
8. 医生 WS 连接 → WS Connect → join
9. 实时对话    → 双向消息 + 正在输入状态
10. 医生结束问诊 → PUT /api/consultations/:id/close
11. 双方断开    → WS leave → disconnect
```

### 3.2 WebSocket 消息协议

**客户端 → 服务端**
```typescript
type ClientMessage =
  | { type: 'join'; conversationId: string }
  | { type: 'leave'; conversationId: string }
  | { type: 'message'; conversationId: string; content: string }
  | { type: 'typing'; conversationId: string; isTyping: boolean }
  | { type: 'heartbeat' };
```

**服务端 → 客户端**
```typescript
type ServerMessage =
  | { type: 'message'; conversationId: string; message: ChatMessage }
  | { type: 'typing'; conversationId: string; senderId: string }
  | { type: 'system'; conversationId: string; text: string }
  | { type: 'joined'; conversationId: string }
  | { type: 'left'; conversationId: string };
```

---

## 4. 辅助工具设计

### 4.1 TestApiClient

```typescript
class TestApiClient {
  // 认证
  loginPatient(phone: string, code: string): Promise<string>
  loginDoctor(phone: string, code: string): Promise<string>

  // 专家问诊
  getDoctors(token: string, filters?: object): Promise<Doctor[]>
  getDoctorDetail(token: string, doctorId: string): Promise<Doctor>
  createConsultation(token: string, doctorId: string): Promise<Consultation>
  getPendingConsultations(token: string): Promise<Consultation[]>
  acceptConsultation(token: string, id: string): Promise<void>
  closeConsultation(token: string, id: string): Promise<void>
  getConsultationDetail(token: string, id: string): Promise<Consultation>

  // 预约挂号
  getDoctorSchedule(doctorId: string, start: string, end: string): Promise<Schedule[]>
  createAppointment(token: string, data: object): Promise<Appointment>
  getMyAppointments(token: string): Promise<Appointment[]>
  getAppointmentDetail(token: string, id: string): Promise<Appointment>
  cancelAppointment(token: string, id: string): Promise<void>
}
```

### 4.2 TestWebSocketClient

```typescript
class TestWebSocketClient {
  connect(url: string, token: string): Promise<void>
  disconnect(): void

  // 会话操作
  joinConversation(conversationId: string): void
  leaveConversation(conversationId: string): void

  // 消息发送
  sendMessage(conversationId: string, content: string): void
  sendTyping(conversationId: string, isTyping: boolean): void
  sendHeartbeat(): void

  // 消息接收
  waitForMessage(timeout?: number): Promise<ServerMessage>
  waitForSystemMessage(text: string, timeout?: number): Promise<void>
  waitForMessageOfType(type: string, timeout?: number): Promise<ServerMessage>

  isConnected(): boolean
}
```

---

## 5. 测试文件实现示例

### 5.1 专家会诊双角色流程测试

```typescript
describe('专家问诊 - 双角色完整流程', () => {
  let patientToken: string;
  let doctorToken: string;
  let patientWs: TestWebSocketClient;
  let doctorWs: TestWebSocketClient;
  let consultationId: string;

  it('双方应能成功登录', async () => {
    patientToken = await apiClient.loginPatient('13900139999', '123456');
    doctorToken = await apiClient.loginDoctor('13800138000', '123456');
  });

  it('患者应能创建问诊', async () => {
    const consultation = await apiClient.createConsultation(
      patientToken, 'doctor_001'
    );
    expect(consultation.status).toBe('pending');
    consultationId = consultation.id;
  });

  it('医生应能接诊', async () => {
    await apiClient.acceptConsultation(doctorToken, consultationId);
    const updated = await apiClient.getConsultationDetail(doctorToken, consultationId);
    expect(updated.status).toBe('active');
  });

  it('双方应能通过 WebSocket 实时对话', async () => {
    patientWs = new TestWebSocketClient();
    doctorWs = new TestWebSocketClient();

    await patientWs.connect(WS_URL, patientToken);
    await doctorWs.connect(WS_URL, doctorToken);

    patientWs.joinConversation(consultationId);
    doctorWs.joinConversation(consultationId);

    // 患者发送消息
    patientWs.sendMessage(consultationId, '医生您好，我最近头痛');
    const received = await doctorWs.waitForMessage();
    expect(received.content).toBe('医生您好，我最近头痛');
    expect(received.senderType).toBe('patient');

    // 医生回复
    doctorWs.sendMessage(consultationId, '请问持续多久了？');
    const reply = await patientWs.waitForMessage();
    expect(reply.content).toBe('请问持续多久了？');
    expect(reply.senderType).toBe('doctor');
  });

  afterAll(() => {
    patientWs?.disconnect();
    doctorWs?.disconnect();
  });
});
```

### 5.2 预约挂号完整流程测试

```typescript
describe('预约挂号 - 完整用户旅程', () => {
  let userToken: string;
  let appointmentId: string;

  beforeAll(async () => {
    userToken = await apiClient.loginPatient('13900139999', '123456');
  });

  it('应能浏览医生并查看排班', async () => {
    const doctors = await apiClient.getDoctors(userToken, { department: '内科' });
    expect(doctors.length).toBeGreaterThan(0);

    const schedules = await apiClient.getDoctorSchedule(
      'doctor_001',
      '2026-01-26',
      '2026-02-01'
    );
    expect(schedules.length).toBe(7);
  });

  it('应能成功创建预约', async () => {
    const appointment = await apiClient.createAppointment(userToken, {
      doctorId: 'doctor_001',
      patientName: '张三',
      appointmentTime: new Date(Date.now() + 86400000).toISOString()
    });
    expect(appointment.status).toBe('pending');
    appointmentId = appointment.id;
  });

  it('应能查看我的预约列表', async () => {
    const appointments = await apiClient.getMyAppointments(userToken);
    expect(appointments.some(a => a.id === appointmentId)).toBe(true);
  });

  it('应能取消预约', async () => {
    await apiClient.cancelAppointment(userToken, appointmentId);
    const updated = await apiClient.getAppointmentDetail(userToken, appointmentId);
    expect(updated.status).toBe('cancelled');
  });
});
```

---

## 6. 实施步骤

### 阶段一：辅助工具开发

1. 创建 `testSetup.ts` - 测试环境配置
2. 创建 `testApiClient.ts` - API 客户端抽象层
3. 创建 `testWebSocketClient.ts` - WebSocket 客户端封装
4. 验证辅助工具单元测试

### 阶段二：专家会诊端到端测试

5. 创建 `consultation-flow.test.ts` - 双角色完整流程测试
6. 创建 `websocket-flow.test.ts` - WebSocket 独立测试
7. 运行测试并修复问题

### 阶段三：预约挂号端到端测试

8. 创建 `appointment-flow.test.ts` - 完整预约流程测试
9. 创建 `appointment-api.test.ts` - API 边缘场景测试
10. 运行测试并修复问题

### 阶段四：集成与文档

11. 更新 `package.json` 添加测试脚本
12. 编写测试运行文档

---

## 7. 测试运行命令

```bash
# 运行所有端到端测试
pnpm test:e2e

# 监听模式
pnpm test:e2e:watch

# 生成覆盖率报告
pnpm test:e2e:coverage
```

### package.json 配置

```json
{
  "scripts": {
    "test:e2e": "vitest run backend/src/__tests__/e2e",
    "test:e2e:watch": "vitest watch backend/src/__tests__/e2e",
    "test:e2e:coverage": "vitest run backend/src/__tests__/e2e --coverage"
  }
}
```

---

## 8. 关键注意事项

1. **WebSocket 服务器**: 确保 `backend/src/index.ts` 中 WebSocket 服务器在测试环境启动
2. **数据隔离**: 每个测试文件使用独立数据，避免污染
3. **异步超时**: WebSocket 操作超时设置为 30 秒
4. **资源清理**: 使用 `afterEach` 确保 WebSocket 连接正确关闭
5. **测试数据**: 使用标准化的 Mock 数据（医生 ID、手机号等）

---

## 9. 测试覆盖率目标

| 模块 | 目标覆盖率 |
|-----|----------|
| 专家会诊 API | 90%+ |
| WebSocket 消息 | 85%+ |
| 预约挂号 API | 90%+ |
| 错误处理 | 80%+ |

---

**设计文档完成** - 准备进入实施阶段
