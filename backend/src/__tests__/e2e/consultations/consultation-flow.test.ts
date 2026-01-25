import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { Server } from 'http';
import consultationsRouter from '../../../routes/consultations';
import authRouter from '../../../routes/auth';
import { errorHandler } from '../../../utils/errorHandler';
import { wsManager } from '../../../services/websocket/WebSocketManager';
import { TestApiClient, TestWebSocketClient, TEST_USERS, TEST_CONFIG } from '../helpers';
import { logger } from '../../../utils/logger';

// 禁用测试期间的日志输出
logger.silent = true;

describe('专家问诊 - 双角色完整流程', () => {
  let app: express.Express;
  let server: Server;
  let apiClient: TestApiClient;
  let patientToken: string;
  let doctorToken: string;
  let consultationId: string;

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
          // 更新 TEST_CONFIG 中的端口为实际分配的端口
          (TEST_CONFIG as any).WS_URL = `ws://localhost:${port}/ws`;
          (TEST_CONFIG as any).API_URL = `http://localhost:${port}`;
        }
        resolve();
      });
    });

    // 初始化 WebSocket 服务器
    wsManager.initialize(server);

    // 创建 API 客户端
    apiClient = new TestApiClient(app);
  });

  afterAll(async () => {
    // 清理 WebSocket 连接
    wsManager.shutdown();

    // 关闭 HTTP 服务器
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
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
        department: '心内科',
      });
      expect(doctors.length).toBeGreaterThan(0);
      doctors.forEach((doctor) => {
        expect(doctor.department).toBe('心内科');
      });
    });

    it('患者应能成功创建问诊', async () => {
      // 测试医生的手机号 (13800138000) 会被映射到 doctor_001 (张医生)
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

      // 先等待连接成功消息
      const connMsg = await patientWs.waitForSystemMessage('Connected', 5000);
      expect(connMsg).toBeDefined();

      patientWs.joinConversation(consultationId);

      // 等待加入确认（系统消息）
      const sysMsg = await patientWs.waitForSystemMessage('Joined conversation', 5000);
      expect(sysMsg).toBeDefined();
    });

    it('医生应能连接 WebSocket 并加入会话', async () => {
      doctorWs = new TestWebSocketClient();

      await doctorWs.connect(doctorToken);
      expect(doctorWs.isConnected()).toBe(true);

      // 先等待连接成功消息
      const connMsg = await doctorWs.waitForSystemMessage('Connected', 5000);
      expect(connMsg).toBeDefined();

      doctorWs.joinConversation(consultationId);

      // 等待加入确认
      const sysMsg = await doctorWs.waitForSystemMessage('Joined conversation', 5000);
      expect(sysMsg).toBeDefined();
    });

    it('患者发送消息，医生应能收到', async () => {
      const testMessage = '医生您好，我最近头痛';
      patientWs.sendMessage(consultationId, testMessage);

      // 医生应该收到消息
      const received = await doctorWs.waitForChatMessage(5000);
      expect(received).toBeDefined();
      expect(received.type).toBe('message');
      expect(received.message?.content).toBe(testMessage);
      expect(received.message?.senderType).toBe('patient');
    });

    it('医生发送消息，患者应能收到', async () => {
      const testMessage = '请问持续多久了？';
      doctorWs.sendMessage(consultationId, testMessage);

      // 患者应该收到消息
      // 注意：患者可能会收到自己消息的回声，所以我们需要找到医生的消息
      let receivedDoctorMessage = false;
      const timeout = 5000;
      const startTime = Date.now();

      while (Date.now() - startTime < timeout && !receivedDoctorMessage) {
        try {
          const msg = await patientWs.waitForChatMessage(1000);
          if (msg.message?.content === testMessage && msg.message?.senderType === 'doctor') {
            expect(msg).toBeDefined();
            expect(msg.type).toBe('message');
            expect(msg.message?.content).toBe(testMessage);
            expect(msg.message?.senderType).toBe('doctor');
            receivedDoctorMessage = true;
            break;
          }
        } catch (e) {
          // 超时或没有更多消息
          break;
        }
      }

      expect(receivedDoctorMessage).toBe(true);
    });

    it('应能正确显示正在输入状态', async () => {
      patientWs.sendTyping(consultationId, true);

      // 医生应该收到正在输入通知
      const typingMsg = await doctorWs.waitForTypingMessage(5000);
      expect(typingMsg).toBeDefined();
      expect(typingMsg.type).toBe('typing');
      expect(typingMsg.data?.senderId).toBeDefined();
    });
  });

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
});
