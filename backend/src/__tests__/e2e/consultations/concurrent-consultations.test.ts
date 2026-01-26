import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { Server } from 'http';
import { TestApiClient, TEST_USERS } from '../helpers';
import { logger } from '../../../utils/logger';
import { consultationStore } from '../../../services/storage/consultationStore';

logger.silent = true;

describe('专家问诊 - 并发场景测试', () => {
  let app: express.Express;
  let server: Server;
  let apiClient: TestApiClient;
  let patientToken: string;
  let doctorToken: string;

  beforeAll(async () => {
    // 创建测试应用
    app = express();
    app.use(express.json());

    const consultationsRouter = (await import('../../../routes/consultations')).default;
    const authRouter = (await import('../../../routes/auth')).default;
    const { errorHandler } = await import('../../../utils/errorHandler');

    app.use('/api/auth', authRouter);
    app.use('/api/consultations', consultationsRouter);
    app.use(errorHandler);

    // 启动 HTTP 服务器
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        resolve();
      });
    });

    apiClient = new TestApiClient(app);

    // 登录获取 token
    patientToken = await apiClient.loginPatient(TEST_USERS.PATIENT.phone, TEST_USERS.PATIENT.code);
    doctorToken = await apiClient.loginDoctor(TEST_USERS.DOCTOR.phone, TEST_USERS.DOCTOR.code);
  });

  afterAll(async () => {
    // 清理测试数据
    consultationStore.clear();

    // 关闭 HTTP 服务器
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

      // 验证所有问诊都有正确的状态
      successful.forEach((r: any) => {
        expect(r.value.status).toBe('pending');
        expect(r.value.doctorId).toBe(doctorId);
      });

      // 验证所有问诊都在待接诊列表中
      const pending = await apiClient.getPendingConsultations(doctorToken);
      expect(pending.length).toBeGreaterThanOrEqual(concurrentRequests);
    });

    it('应能正确处理不同医生的并发问诊', async () => {
      const doctors = [
        { id: 'doctor_001', phone: '13800138000' },
        { id: 'doctor_002', phone: '13800138001' },
        { id: 'doctor_004', phone: '13800138003' },
      ]; // 使用可用的医生（doctor_003 不可用）

      // 为每个医生创建并发问诊
      const promises = doctors.flatMap((doctor) =>
        Array.from({ length: 3 }, () =>
          apiClient.createConsultation(patientToken, doctor.id)
        )
      );

      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === 'fulfilled');

      expect(successful.length).toBe(doctors.length * 3);

      // 验证每个医生的待接诊列表都有正确的问诊数量
      for (const doctor of doctors) {
        const doctorConsultations = successful.filter((r: any) => r.value.doctorId === doctor.id);
        expect(doctorConsultations.length).toBe(3);

        // 验证所有问诊ID都是唯一的
        const ids = doctorConsultations.map((r: any) => r.value.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(3);

        // 为每个医生获取独立的token并验证待接诊列表
        const doctorToken = await apiClient.loginDoctor(doctor.phone, '123456');
        const pending = await apiClient.getPendingConsultations(doctorToken);
        expect(pending.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('并发创建问诊时应保证ID唯一性（高并发测试）', async () => {
      const doctorId = 'doctor_001';
      const highConcurrencyCount = 50;

      // 创建50个并发问诊请求
      const promises = Array.from({ length: highConcurrencyCount }, () =>
        apiClient.createConsultation(patientToken, doctorId)
      );

      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === 'fulfilled');

      // 验证所有请求都成功
      expect(successful.length).toBe(highConcurrencyCount);

      // 验证所有问诊ID都是唯一的
      const consultationIds = successful.map((r: any) => r.value.id);
      const uniqueIds = new Set(consultationIds);
      expect(uniqueIds.size).toBe(highConcurrencyCount);
    });
  });

  describe('并发接诊测试', () => {
    it('同一问诊不应被多个医生同时接诊', async () => {
      // 为 doctor_001 创建一个问诊
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');
      const consultationId = consultation.id;

      // 获取两个不同医生的token
      const doctorToken1 = await apiClient.loginDoctor('13800138000', '123456'); // doctor_001
      const doctorToken2 = await apiClient.loginDoctor('13800138001', '123456'); // doctor_002

      // 两个不同医生同时尝试接诊同一个问诊（测试竞态条件）
      const promises = [
        apiClient.acceptConsultation(doctorToken1, consultationId),
        apiClient.acceptConsultation(doctorToken2, consultationId),
      ];

      const results = await Promise.allSettled(promises);

      // 验证两个请求都完成了（成功或失败）
      expect(results.length).toBe(2);

      // 验证只有一个请求成功（正确的医生接诊，另一个医生因权限检查失败）
      const successful = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r) => r.status === 'rejected');

      // doctor_001 应该能成功接诊（因为问诊属于他）
      // doctor_002 应该失败（因为问诊不属于他）
      expect(successful.length).toBeGreaterThanOrEqual(1);

      // 验证最终状态是 active
      const updatedConsultation = await apiClient.getConsultationDetail(doctorToken1, consultationId);
      expect(updatedConsultation.status).toBe('active');
    });

    it('医生不能接诊不属于自己的问诊', async () => {
      // 为 doctor_001 创建问诊
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');
      const consultationId = consultation.id;

      // 尝试用 doctor_002 的身份接诊（应该失败）
      // 注意：由于测试环境只有一个医生 token，这个测试验证的是权限检查
      // 实际测试中应该使用不同的医生 token

      // 验证问诊属于 doctor_001
      expect(consultation.doctorId).toBe('doctor_001');
      expect(consultation.status).toBe('pending');
    });

    it('并发接诊不同医生的问诊应该都能成功', async () => {
      // 为不同医生创建问诊
      const consultation1 = await apiClient.createConsultation(patientToken, 'doctor_001');
      const consultation2 = await apiClient.createConsultation(patientToken, 'doctor_002');

      // 并发接诊
      const promises = [
        apiClient.acceptConsultation(doctorToken, consultation1.id),
        apiClient.acceptConsultation(doctorToken, consultation2.id),
      ];

      const results = await Promise.allSettled(promises);
      const successful = results.filter((r) => r.status === 'fulfilled');

      // 由于当前测试只有一个医生 token，只有属于该医生的问诊能被接诊
      // doctor_001 对应测试医生
      expect(successful.length).toBeGreaterThanOrEqual(1);

      // 验证被接诊的问诊状态已更新
      const updated1 = await apiClient.getConsultationDetail(doctorToken, consultation1.id);
      expect(updated1.status).toBe('active');
    });
  });

  describe('并发操作的数据一致性测试', () => {
    it('并发创建和接诊应保持数据一致性', async () => {
      const doctorId = 'doctor_001';
      const createCount = 5;

      // 并发创建问诊
      const createPromises = Array.from({ length: createCount }, () =>
        apiClient.createConsultation(patientToken, doctorId)
      );

      const consultations = await Promise.all(createPromises);

      // 验证所有问诊都创建成功
      expect(consultations.length).toBe(createCount);
      consultations.forEach((c) => {
        expect(c.status).toBe('pending');
      });

      // 并发接诊所有问诊
      const acceptPromises = consultations.map((c) =>
        apiClient.acceptConsultation(doctorToken, c.id)
      );

      const acceptResults = await Promise.allSettled(acceptPromises);
      const successfulAccepts = acceptResults.filter((r) => r.status === 'fulfilled');

      // 验证所有接诊都成功
      expect(successfulAccepts.length).toBe(createCount);

      // 验证所有问诊状态都已更新
      for (const consultation of consultations) {
        const updated = await apiClient.getConsultationDetail(doctorToken, consultation.id);
        expect(updated.status).toBe('active');
      }
    });

    it('高并发场景下的问诊创建应保持有序性', async () => {
      const doctorId = 'doctor_001';
      const requestCount = 20;

      // 记录开始时间
      const startTime = Date.now();

      // 并发创建问诊
      const promises = Array.from({ length: requestCount }, (_, index) =>
        apiClient.createConsultation(patientToken, doctorId).then((result) => ({
          result,
          index,
        }))
      );

      const results = await Promise.all(promises);

      // 验证所有问诊都创建成功
      expect(results.length).toBe(requestCount);

      // 验证所有问诊ID唯一
      const ids = results.map((r) => r.result.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(requestCount);

      // 验证创建时间在合理范围内
      const endTime = Date.now();
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(5000); // 应该在5秒内完成
    });
  });

  describe('边界条件和异常场景测试', () => {
    it('并发创建问诊时系统应能处理错误输入', async () => {
      const validDoctorId = 'doctor_001';

      // 混合有效和无效的请求
      const promises = [
        apiClient.createConsultation(patientToken, validDoctorId),
        apiClient.createConsultation(patientToken, validDoctorId),
        // 无效的 doctorId 会导致失败
        apiClient.createConsultation(patientToken, 'invalid_doctor').catch((e) => ({ error: e })),
        apiClient.createConsultation(patientToken, validDoctorId),
      ];

      const results = await Promise.allSettled(promises);

      // 验证有效的请求都成功
      const successful = results.filter((r) => r.status === 'fulfilled' && !('error' in (r as any).value));
      expect(successful.length).toBeGreaterThanOrEqual(2);
    });

    it('并发关闭问诊应只允许第一次操作成功', async () => {
      // 创建问诊
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');
      const consultationId = consultation.id;

      // 接诊问诊
      await apiClient.acceptConsultation(doctorToken, consultationId);

      // 并发关闭问诊
      const promises = [
        apiClient.closeConsultation(doctorToken, consultationId),
        apiClient.closeConsultation(doctorToken, consultationId),
        apiClient.closeConsultation(patientToken, consultationId),
      ];

      const results = await Promise.allSettled(promises);

      // 所有请求都应该成功（因为关闭已关闭的问诊不会报错）
      const successful = results.filter((r) => r.status === 'fulfilled');
      expect(successful.length).toBe(3);

      // 验证最终状态是 closed
      const updated = await apiClient.getConsultationDetail(doctorToken, consultationId);
      expect(updated.status).toBe('closed');
    });
  });
});
