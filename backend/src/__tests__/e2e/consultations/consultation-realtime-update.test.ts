import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Server } from 'http';
import consultationsRouter from '../../../routes/consultations';
import authRouter from '../../../routes/auth';
import { errorHandler } from '../../../utils/errorHandler';
import { wsManager } from '../../../services/websocket/WebSocketManager';
import { TestApiClient, TestWebSocketClient, TEST_USERS } from '../helpers';
import { logger } from '../../../utils/logger';

// 禁用测试期间的日志输出
logger.silent = true;

// 测试超时配置常量
const TIMEOUT_WS_CONNECT = 5000;
const TIMEOUT_WS_MESSAGE = 3000;
const TIMEOUT_WS_CHAT = 5000;
const WAIT_MESSAGE_PROCESSING = 500;
const WAIT_DISCONNECT_STABILIZE = 500;

// 测试消息常量
const TEST_MESSAGES = {
  PATIENT_FIRST: '医生你好，我头疼',
  DOCTOR_REPLY: '你好，请问持续多久了？',
  CONCURRENT_1: '消息1',
  CONCURRENT_2: '消息2',
  CONCURRENT_3: '消息3',
  DISCONNECT_TEST: '测试断线消息',
} as const;

describe('专家会诊实时更新 - 完整流程', () => {
  let app: express.Express;
  let server: Server;
  let apiClient: TestApiClient;
  let patientToken: string;
  let doctorToken: string;
  let patientWs: TestWebSocketClient;
  let doctorWs: TestWebSocketClient;
  let consultationId: string;

  /**
   * 确保 WebSocket 连接并加入会话
   * 返回连接好的 WebSocket 客户端（如果已连接则返回原客户端，否则返回新连接的客户端）
   */
  async function ensureWebSocketConnection(
    wsClient: TestWebSocketClient,
    token: string,
    consultationIdToJoin?: string
  ): Promise<TestWebSocketClient> {
    if (!wsClient.isConnected()) {
      wsClient = new TestWebSocketClient();
      await wsClient.connect(token);
      await wsClient.waitForSystemMessage('Connected', TIMEOUT_WS_CONNECT);

      if (consultationIdToJoin) {
        wsClient.joinConversation(consultationIdToJoin);
        await wsClient.waitForSystemMessage('Joined conversation', TIMEOUT_WS_CONNECT);
      }
    }
    return wsClient;
  }

  beforeAll(async () => {
    // 创建测试应用
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
    app.use('/api/consultations', consultationsRouter);
    app.use(errorHandler);

    // 启动 HTTP 服务器（使用随机可用端口）
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (typeof address === 'object' && address) {
          const port = address.port;
          // 更新测试配置中的端口为实际分配的端口
          process.env.WS_URL = `ws://localhost:${port}/ws`;
          process.env.API_URL = `http://localhost:${port}`;
        }
        resolve();
      });
    });

    // 初始化 WebSocket 服务器
    wsManager.initialize(server);

    // 创建 API 客户端
    apiClient = new TestApiClient(app);

    // 登录患者和医生
    patientToken = await apiClient.loginPatient(
      TEST_USERS.PATIENT.phone,
      TEST_USERS.PATIENT.code
    );
    doctorToken = await apiClient.loginDoctor(
      TEST_USERS.DOCTOR.phone,
      TEST_USERS.DOCTOR.code
    );

    // 创建 WebSocket 客户端
    patientWs = new TestWebSocketClient();
    doctorWs = new TestWebSocketClient();

    // 连接 WebSocket
    await patientWs.connect(patientToken);
    await doctorWs.connect(doctorToken);

    // 等待连接成功消息
    await patientWs.waitForSystemMessage('Connected', TIMEOUT_WS_CONNECT);
    await doctorWs.waitForSystemMessage('Connected', TIMEOUT_WS_CONNECT);
  });

  afterAll(async () => {
    // 清理 WebSocket 连接
    if (patientWs) {
      patientWs.disconnect();
    }
    if (doctorWs) {
      doctorWs.disconnect();
    }

    // 清理 WebSocket 服务器
    wsManager.shutdown();

    // 关闭 HTTP 服务器
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  // Helper function to get doctor consultations
  async function getDoctorConsultations(token: string): Promise<any[]> {
    const response = await request(app)
      .get('/api/consultations/doctor')
      .set('Authorization', `Bearer ${token}`);

    if (response.status !== 200) {
      throw new Error(`Get doctor consultations failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as { code: number; data: any[] };
    if (body.code !== 0) {
      throw new Error(`Get doctor consultations response invalid: ${JSON.stringify(body)}`);
    }

    return body.data;
  }

  describe('E2E-01: 患者发起问诊 -> 医生看到新问诊通知', () => {
    it('患者应能成功创建问诊', async () => {
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');

      expect(consultation).toBeDefined();
      expect(consultation.id).toBeDefined();
      expect(consultation.status).toBe('pending');
      expect(consultation.doctorId).toBe('doctor_001');

      consultationId = consultation.id;
    });

    it('医生应能收到 consultation_update 通知（包含新问诊信息）', async () => {
      // 等待 consultation_update 消息
      const updateMessage = await doctorWs.waitForMessageOfType('consultation_update', TIMEOUT_WS_MESSAGE);

      expect(updateMessage).toBeDefined();
      expect(updateMessage.type).toBe('consultation_update');
      expect(updateMessage.consultation).toBeDefined();
      expect(updateMessage.consultation!.id).toBe(consultationId);
      expect(updateMessage.consultation!.status).toBe('pending');
    });
  });

  describe('E2E-02: 患者发送消息 -> 医生问诊列表实时更新 lastMessage', () => {
    beforeAll(async () => {
      // 双方加入会话
      if (patientWs.isConnected()) {
        patientWs.joinConversation(consultationId);
        await patientWs.waitForSystemMessage('Joined conversation', TIMEOUT_WS_CONNECT);
      }
      if (doctorWs.isConnected()) {
        doctorWs.joinConversation(consultationId);
        await doctorWs.waitForSystemMessage('Joined conversation', TIMEOUT_WS_CONNECT);
      }
    });

    it('患者应能发送消息', async () => {
      patientWs = await ensureWebSocketConnection(patientWs, patientToken, consultationId);

      patientWs.sendMessage(consultationId, TEST_MESSAGES.PATIENT_FIRST);

      // 等待一小段时间让消息被处理
      await new Promise(resolve => setTimeout(resolve, WAIT_MESSAGE_PROCESSING));
    });

    it('医生应能收到聊天消息', async () => {
      doctorWs = await ensureWebSocketConnection(doctorWs, doctorToken, consultationId);

      const received = await doctorWs.waitForChatMessage(TIMEOUT_WS_CHAT, { senderType: 'patient' });

      expect(received).toBeDefined();
      expect(received.type).toBe('message');
      expect(received.message?.content).toBe(TEST_MESSAGES.PATIENT_FIRST);
      expect(received.message?.senderType).toBe('patient');
    });

    it('医生应能收到 consultation_update 通知（lastMessage 更新）', async () => {
      const updateMessage = await doctorWs.waitForConsultationUpdateWithLastMessage(TEST_MESSAGES.PATIENT_FIRST, TIMEOUT_WS_MESSAGE);

      expect(updateMessage).toBeDefined();
      expect(updateMessage.type).toBe('consultation_update');
      expect(updateMessage.consultation).toBeDefined();
      expect(updateMessage.consultation!.lastMessage).toBe(TEST_MESSAGES.PATIENT_FIRST);
      expect(updateMessage.consultation!.id).toBe(consultationId);
    });

    it('医生的问诊列表应显示最新的 lastMessage', async () => {
      const doctorConsultations = await getDoctorConsultations(doctorToken);
      const consultation = doctorConsultations.find((c: any) => c.id === consultationId);

      expect(consultation).toBeDefined();
      expect(consultation.lastMessage).toBe(TEST_MESSAGES.PATIENT_FIRST);
    });
  });

  describe('E2E-03: 医生接诊 -> 双方看到状态更新为 active', () => {
    it('医生应能成功接诊', async () => {
      await apiClient.acceptConsultation(doctorToken, consultationId);

      // 验证 API 返回的状态
      const updated = await apiClient.getConsultationDetail(doctorToken, consultationId);
      expect(updated.status).toBe('active');
    });

    it('患者应能收到 consultation_update 通知（status: active）', async () => {
      patientWs = await ensureWebSocketConnection(patientWs, patientToken, consultationId);

      const updateMessage = await patientWs.waitForConsultationUpdateWithStatus('active', TIMEOUT_WS_MESSAGE);

      expect(updateMessage).toBeDefined();
      expect(updateMessage.type).toBe('consultation_update');
      expect(updateMessage.consultation).toBeDefined();
      expect(updateMessage.consultation!.status).toBe('active');
      expect(updateMessage.consultation!.id).toBe(consultationId);
    });

    it('患者应能看到问诊状态已更新', async () => {
      const consultation = await apiClient.getConsultationDetail(patientToken, consultationId);
      expect(consultation.status).toBe('active');
    });
  });

  describe('E2E-04: 医生回复消息 -> 患者收到消息且 lastMessage 更新', () => {
    it('医生应能发送消息', async () => {
      doctorWs = await ensureWebSocketConnection(doctorWs, doctorToken, consultationId);

      doctorWs.sendMessage(consultationId, TEST_MESSAGES.DOCTOR_REPLY);

      // 等待一小段时间让消息被处理
      await new Promise(resolve => setTimeout(resolve, WAIT_MESSAGE_PROCESSING));
    });

    it('患者应能收到医生的回复消息', async () => {
      patientWs = await ensureWebSocketConnection(patientWs, patientToken, consultationId);

      const received = await patientWs.waitForChatMessage(TIMEOUT_WS_CHAT, { senderType: 'doctor' });

      expect(received).toBeDefined();
      expect(received.type).toBe('message');
      expect(received.message?.content).toBe(TEST_MESSAGES.DOCTOR_REPLY);
      expect(received.message?.senderType).toBe('doctor');
    });

    it('患者应能收到 consultation_update 通知（lastMessage 更新）', async () => {
      const updateMessage = await patientWs.waitForConsultationUpdateWithLastMessage(TEST_MESSAGES.DOCTOR_REPLY, TIMEOUT_WS_MESSAGE);

      expect(updateMessage).toBeDefined();
      expect(updateMessage.type).toBe('consultation_update');
      expect(updateMessage.consultation).toBeDefined();
      expect(updateMessage.consultation!.lastMessage).toBe(TEST_MESSAGES.DOCTOR_REPLY);
      expect(updateMessage.consultation!.id).toBe(consultationId);
    });

    it('患者应能通过 API 看到问诊的 lastMessage 已更新', async () => {
      const consultation = await apiClient.getConsultationDetail(patientToken, consultationId);
      expect(consultation.lastMessage).toBe(TEST_MESSAGES.DOCTOR_REPLY);
    });
  });

  describe('E2E-05: 并发消息场景', () => {
    it('应能正确处理连续发送的多条消息', async () => {
      patientWs = await ensureWebSocketConnection(patientWs, patientToken, consultationId);
      doctorWs = await ensureWebSocketConnection(doctorWs, doctorToken, consultationId);

      const messages = [TEST_MESSAGES.CONCURRENT_1, TEST_MESSAGES.CONCURRENT_2, TEST_MESSAGES.CONCURRENT_3];

      // 患者连续发送多条消息
      for (const msg of messages) {
        patientWs.sendMessage(consultationId, msg);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // 医生应该收到所有消息
      for (const msg of messages) {
        const received = await doctorWs.waitForChatMessage(TIMEOUT_WS_CHAT, { senderType: 'patient' });
        expect(received.message?.content).toBe(msg);
      }
    });

    it('lastMessage 应该是最后一条消息', async () => {
      // 等待最后的 consultation_update 消息（带有最后一条消息内容）
      await doctorWs.waitForConsultationUpdateWithLastMessage(TEST_MESSAGES.CONCURRENT_3, TIMEOUT_WS_MESSAGE);

      const consultation = await apiClient.getConsultationDetail(doctorToken, consultationId);
      expect(consultation.lastMessage).toBe(TEST_MESSAGES.CONCURRENT_3);
    });
  });

  describe('E2E-06: 医生结束问诊 -> 双方看到状态更新为 closed', () => {
    it('医生应能结束问诊', async () => {
      await apiClient.closeConsultation(doctorToken, consultationId);

      // 验证 API 返回的状态
      const updated = await apiClient.getConsultationDetail(doctorToken, consultationId);
      expect(updated.status).toBe('closed');
    });

    it('医生应能收到 consultation_update 通知（status: closed）', async () => {
      doctorWs = await ensureWebSocketConnection(doctorWs, doctorToken, consultationId);

      const updateMessage = await doctorWs.waitForConsultationUpdateWithStatus('closed', TIMEOUT_WS_MESSAGE);

      expect(updateMessage).toBeDefined();
      expect(updateMessage.type).toBe('consultation_update');
      expect(updateMessage.consultation).toBeDefined();
      expect(updateMessage.consultation!.status).toBe('closed');
      expect(updateMessage.consultation!.id).toBe(consultationId);
    });

    it('患者应能收到 consultation_update 通知（status: closed）', async () => {
      patientWs = await ensureWebSocketConnection(patientWs, patientToken, consultationId);

      const updateMessage = await patientWs.waitForConsultationUpdateWithStatus('closed', TIMEOUT_WS_MESSAGE);

      expect(updateMessage).toBeDefined();
      expect(updateMessage.type).toBe('consultation_update');
      expect(updateMessage.consultation).toBeDefined();
      expect(updateMessage.consultation!.status).toBe('closed');
      expect(updateMessage.consultation!.id).toBe(consultationId);
    });

    it('问诊应不再出现在医生的问诊列表中', async () => {
      const doctorConsultations = await getDoctorConsultations(doctorToken);
      const consultation = doctorConsultations.find((c: any) => c.id === consultationId);

      expect(consultation).toBeUndefined();
    });
  });

  describe('E2E-07: 多医生并发场景 - 互不干扰', () => {
    let doctor2Token: string;
    let consultation1Id: string;
    let consultation2Id: string;

    it('应能创建第二个医生账号并登录', async () => {
      // 使用现有的 doctor_002（对应手机号 13800138001）
      doctor2Token = await apiClient.loginDoctor('13800138001', '123456');
      expect(doctor2Token).toBeDefined();
    });

    it('患者应能向两个医生分别发起问诊', async () => {
      const consultation1 = await apiClient.createConsultation(patientToken, 'doctor_001');
      const consultation2 = await apiClient.createConsultation(patientToken, 'doctor_002');

      expect(consultation1.id).toBeDefined();
      expect(consultation2.id).toBeDefined();

      consultation1Id = consultation1.id;
      consultation2Id = consultation2.id;
    });

    it('两个医生应能分别接诊', async () => {
      await Promise.all([
        apiClient.acceptConsultation(doctorToken, consultation1Id),
        apiClient.acceptConsultation(doctor2Token, consultation2Id),
      ]);

      const c1 = await apiClient.getConsultationDetail(doctorToken, consultation1Id);
      const c2 = await apiClient.getConsultationDetail(doctor2Token, consultation2Id);

      expect(c1.status).toBe('active');
      expect(c2.status).toBe('active');
    });

    it('医生1应只能看到自己的问诊', async () => {
      const doctor1Consultations = await getDoctorConsultations(doctorToken);

      expect(doctor1Consultations.some((c: any) => c.id === consultation1Id)).toBe(true);
      expect(doctor1Consultations.some((c: any) => c.id === consultation2Id)).toBe(false);
    });

    it('医生2应只能看到自己的问诊', async () => {
      const doctor2Consultations = await getDoctorConsultations(doctor2Token);

      expect(doctor2Consultations.some((c: any) => c.id === consultation2Id)).toBe(true);
      expect(doctor2Consultations.some((c: any) => c.id === consultation1Id)).toBe(false);
    });
  });

  describe('E2E-08: WebSocket 断线重连 - 消息不丢失', () => {
    let testConsultationId: string;

    beforeAll(async () => {
      // 创建新的问诊用于测试
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');
      testConsultationId = consultation.id;

      // 断开主测试套件的 WebSocket 连接，避免干扰
      if (patientWs && patientWs.isConnected()) {
        patientWs.disconnect();
      }
      if (doctorWs && doctorWs.isConnected()) {
        doctorWs.disconnect();
      }

      // 等待断开稳定
      await new Promise(resolve => setTimeout(resolve, WAIT_DISCONNECT_STABILIZE));
    });

    it('医生断线后患者发送消息，消息应被持久化', async () => {
      // 创建新的 WebSocket 连接
      const testPatientWs = new TestWebSocketClient();
      await testPatientWs.connect(patientToken);
      await testPatientWs.waitForSystemMessage('Connected', TIMEOUT_WS_CONNECT);
      testPatientWs.joinConversation(testConsultationId);
      await testPatientWs.waitForSystemMessage('Joined conversation', TIMEOUT_WS_CONNECT);

      const testDoctorWs = new TestWebSocketClient();
      await testDoctorWs.connect(doctorToken);
      await testDoctorWs.waitForSystemMessage('Connected', TIMEOUT_WS_CONNECT);
      testDoctorWs.joinConversation(testConsultationId);
      await testDoctorWs.waitForSystemMessage('Joined conversation', TIMEOUT_WS_CONNECT);

      // 医生断开连接
      testDoctorWs.disconnect();
      await new Promise(resolve => setTimeout(resolve, WAIT_DISCONNECT_STABILIZE));

      // 患者发送消息
      testPatientWs.sendMessage(testConsultationId, TEST_MESSAGES.DISCONNECT_TEST);
      await new Promise(resolve => setTimeout(resolve, WAIT_MESSAGE_PROCESSING));

      // 清理
      testPatientWs.disconnect();
    });

    it('医生重连后应能通过 API 获取离线期间的消息', async () => {
      // 创建新的 WebSocket 连接
      const newDoctorWs = new TestWebSocketClient();
      await newDoctorWs.connect(doctorToken);
      await newDoctorWs.waitForSystemMessage('Connected', TIMEOUT_WS_CONNECT);
      newDoctorWs.joinConversation(testConsultationId);
      await newDoctorWs.waitForSystemMessage('Joined conversation', TIMEOUT_WS_CONNECT);

      // 通过 API 获取问诊详情验证消息不丢失
      const consultation = await apiClient.getConsultationDetail(doctorToken, testConsultationId);
      expect(consultation.lastMessage).toBe(TEST_MESSAGES.DISCONNECT_TEST);

      // 通过 API 获取消息历史验证消息不丢失
      const messages = await apiClient.getConsultationMessages(doctorToken, testConsultationId);
      expect(messages.some((m: any) => m.content === TEST_MESSAGES.DISCONNECT_TEST)).toBe(true);

      // 清理
      newDoctorWs.disconnect();
    });
  });
});
