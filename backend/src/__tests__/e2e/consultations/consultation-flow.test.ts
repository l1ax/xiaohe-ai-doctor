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
});
