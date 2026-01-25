import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { TestApiClient, TEST_USERS } from '../helpers';
import { logger } from '../../../utils/logger';

// 创建测试应用
const app = express();
app.use(express.json());

// 动态导入路由
let appointmentsRouter: any;
let authRouter: any;
let errorHandler: any;

beforeAll(async () => {
  const appointmentsModule = await import('../../../routes/appointments');
  appointmentsRouter = appointmentsModule.default;

  const authModule = await import('../../../routes/auth');
  authRouter = authModule.default;

  const errorHandlerModule = await import('../../../utils/errorHandler');
  errorHandler = errorHandlerModule.errorHandler;

  app.use('/api/auth', authRouter);
  app.use('/api/appointments', appointmentsRouter);
  app.use(errorHandler);
});

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
        department: '心内科',
      });

      expect(doctors).toBeDefined();
      expect(Array.isArray(doctors)).toBe(true);
      expect(doctors.length).toBeGreaterThan(0);
      expect(doctors[0].department).toBe('心内科');
    });

    it('应能从列表中获取医生信息', async () => {
      const doctors = await apiClient.getAppointmentDoctors(userToken);

      expect(doctors).toBeDefined();
      expect(Array.isArray(doctors)).toBe(true);
      expect(doctors.length).toBeGreaterThan(0);

      // 验证第一个医生的字段
      const firstDoctor = doctors[0];
      expect(firstDoctor.id).toBeDefined();
      expect(firstDoctor.name).toBeDefined();
      expect(firstDoctor.title).toBeDefined();
      expect(firstDoctor.department).toBeDefined();
      expect(firstDoctor.hospital).toBeDefined();
      expect(typeof firstDoctor.available).toBe('boolean');
    });

    it('应能筛选可用的医生', async () => {
      const doctors = await apiClient.getAppointmentDoctors(userToken, {
        available: true,
      });

      expect(doctors.length).toBeGreaterThan(0);
      doctors.forEach((doctor) => {
        expect(doctor.available).toBe(true);
      });
    });

    it('应能获取所有科室的医生列表', async () => {
      const doctors = await apiClient.getAppointmentDoctors(userToken);

      // 验证返回的数据包含多个科室
      const departments = [...new Set(doctors.map((d) => d.department))];
      expect(departments.length).toBeGreaterThan(1);
    });
  });

  describe('步骤 2: 查看排班并选择时间', () => {
    it('应能获取医生未来7天排班', async () => {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 6); // 6 days from today = 7 days total (inclusive)

      const startDate = today.toISOString().split('T')[0];
      const endDate = nextWeek.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
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
        userToken,
        'doctor_001',
        dateStr,
        dateStr
      );

      expect(schedules.length).toBe(1);
      expect(schedules[0].date).toBe(dateStr);
    });

    it('应能验证排班时段格式', async () => {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        dateStr,
        dateStr
      );

      expect(schedules.length).toBe(1);
      expect(schedules[0].availableSlots).toBeDefined();

      // 验证可用时段格式（如果有时段的话）
      if (schedules[0].availableSlots.length > 0) {
        const slot = schedules[0].availableSlots[0];
        // availableSlots 是字符串数组，格式为 'HH:MM'
        expect(typeof slot).toBe('string');
        expect(slot).toMatch(/^\d{2}:\d{2}$/); // 验证时间格式
      }
    });
  });
});
