import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { Server } from 'http';
import consultationsRouter from '../../../routes/consultations';
import authRouter from '../../../routes/auth';
import { errorHandler } from '../../../utils/errorHandler';
import { TestApiClient, TestWebSocketClient, TEST_USERS, TEST_CONFIG } from '../helpers';
import { wsManager } from '../../../services/websocket/WebSocketManager';
import { logger } from '../../../utils/logger';

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

      // 患者发送消息1
      patientWs.sendMessage(consultationId, '患者1');
      await new Promise(resolve => setTimeout(resolve, 100));

      // 医生发送消息1
      doctorWs.sendMessage(consultationId, '医生1');
      await new Promise(resolve => setTimeout(resolve, 100));

      // 患者发送消息2
      patientWs.sendMessage(consultationId, '患者2');
      await new Promise(resolve => setTimeout(resolve, 100));

      // 验证医生端收到的消息顺序
      const msg1 = await doctorWs.waitForChatMessage(5000);
      expect(msg1.message?.content).toBe('患者1');

      const msg2 = await doctorWs.waitForChatMessage(5000);
      expect(msg2.message?.content).toBe('医生1');

      const msg3 = await doctorWs.waitForChatMessage(5000);
      expect(msg3.message?.content).toBe('患者2');

      // 验证患者端收到的消息 - 患者应该收到医生的消息
      // 注意：患者发送的消息可能也会回传给自己，所以我们只验证收到的医生消息
      let receivedDoctorMessage = false;
      const timeout = 5000;
      const startTime = Date.now();

      while (Date.now() - startTime < timeout && !receivedDoctorMessage) {
        try {
          const msg = await patientWs.waitForChatMessage(1000);
          if (msg.message?.content === '医生1') {
            receivedDoctorMessage = true;
            break;
          }
        } catch (e) {
          // 超时或没有更多消息
          break;
        }
      }

      expect(receivedDoctorMessage).toBe(true);

      patientWs.disconnect();
      doctorWs.disconnect();
    });
  });

  describe('消息持久化测试', () => {
    it('历史消息应能正确加载', async () => {
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
      const newConsultation = await apiClient.createConsultation(patientToken, 'doctor_001');
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
