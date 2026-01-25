import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import consultationsRouter from '../../../routes/consultations';
import authRouter from '../../../routes/auth';
import { errorHandler } from '../../../utils/errorHandler';
import { TestApiClient, TestWebSocketClient, TEST_USERS } from '../helpers';
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
});
