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

describe('医生端预约查询', () => {
  let apiClient: TestApiClient;
  let patientToken: string;
  let doctorToken: string;
  let appointmentId: string;

  beforeAll(async () => {
    apiClient = new TestApiClient(app);

    // 患者登录
    patientToken = await apiClient.loginPatient(
      TEST_USERS.PATIENT.phone,
      TEST_USERS.PATIENT.code
    );

    // 医生登录
    doctorToken = await apiClient.loginDoctor(
      TEST_USERS.DOCTOR.phone,
      TEST_USERS.DOCTOR.code
    );
  });

  describe('准备测试数据', () => {
    it('医生应能成功创建多个预约', async () => {
      // 获取明天的排班
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        patientToken,
        'doctor_001',
        dateStr,
        dateStr
      );

      // 选择第一个可用时段
      const availableSlot = schedules[0].availableSlots[0];
      expect(availableSlot).toBeDefined();

      // 构造预约时间
      const [hours, minutes] = availableSlot.split(':');
      tomorrow.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

      // 创建第一个预约
      const appointment1 = await apiClient.createAppointment(patientToken, {
        doctorId: 'doctor_001',
        patientName: '张三',
        appointmentTime: tomorrow.toISOString(),
      });

      expect(appointment1).toBeDefined();
      expect(appointment1.status).toBe('pending');
      appointmentId = appointment1.id;

      // 获取后天的排班，创建第二个预约
      const dayAfterTomorrow = new Date();
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      const dateStr2 = dayAfterTomorrow.toISOString().split('T')[0];

      const schedules2 = await apiClient.getDoctorSchedule(
        patientToken,
        'doctor_001',
        dateStr2,
        dateStr2
      );

      if (schedules2[0].availableSlots.length > 0) {
        const availableSlot2 = schedules2[0].availableSlots[0];
        const [hours2, minutes2] = availableSlot2.split(':');
        dayAfterTomorrow.setUTCHours(parseInt(hours2), parseInt(minutes2), 0, 0);

        await apiClient.createAppointment(patientToken, {
          doctorId: 'doctor_001',
          patientName: '李四',
          appointmentTime: dayAfterTomorrow.toISOString(),
        });
      }
    });
  });

  describe('医生端预约查询功能', () => {
    it('医生应能获取自己的预约列表', async () => {
      const appointments = await apiClient.getDoctorAppointments(doctorToken);

      expect(appointments).toBeDefined();
      expect(Array.isArray(appointments)).toBe(true);
      expect(appointments.length).toBeGreaterThan(0);

      // 验证返回的字段
      const firstAppointment = appointments[0];
      expect(firstAppointment.id).toBeDefined();
      expect(firstAppointment.patientId).toBeDefined();
      expect(firstAppointment.patientName).toBeDefined();
      expect(firstAppointment.doctorId).toBeDefined();
      expect(firstAppointment.appointmentTime).toBeDefined();
      expect(firstAppointment.status).toBeDefined();
    });

    it('医生应能按状态筛选预约', async () => {
      // 筛选待处理状态的预约
      const pendingAppointments = await apiClient.getDoctorAppointments(
        doctorToken,
        'pending'
      );

      expect(pendingAppointments).toBeDefined();
      expect(Array.isArray(pendingAppointments)).toBe(true);

      // 验证所有返回的预约都是 pending 状态
      pendingAppointments.forEach((appointment) => {
        expect(appointment.status).toBe('pending');
      });
    });

    it('医生不应能获取其他医生的预约', async () => {
      // 登录另一个医生账号
      const otherDoctorToken = await apiClient.loginDoctor('13800138001', '123456');

      // 获取该医生的预约列表
      const otherDoctorAppointments = await apiClient.getDoctorAppointments(
        otherDoctorToken
      );

      // 验证返回的预约都是属于该医生的
      otherDoctorAppointments.forEach((appointment) => {
        expect(appointment.doctorId).toBe('doctor_002');
      });
    });

    it('患者不应能访问医生端预约查询接口', async () => {
      await expect(
        apiClient.getDoctorAppointments(patientToken)
      ).rejects.toThrow();
    });

    it('未认证用户不应能访问医生端预约查询接口', async () => {
      const response = await request(app)
        .get('/api/appointments/doctor')
        .expect(401);

      expect(response.body).toBeDefined();
    });
  });

  describe('预约状态变化测试', () => {
    it('取消预约后，医生应能在列表中看到状态更新', async () => {
      // 取消一个预约
      await apiClient.cancelAppointment(patientToken, appointmentId);

      // 医生获取所有预约
      const appointments = await apiClient.getDoctorAppointments(doctorToken);

      // 找到被取消的预约
      const cancelledAppointment = appointments.find(
        (a) => a.id === appointmentId
      );

      expect(cancelledAppointment).toBeDefined();
      expect(cancelledAppointment.status).toBe('cancelled');

      // 筛选已取消的预约
      const cancelledAppointments = await apiClient.getDoctorAppointments(
        doctorToken,
        'cancelled'
      );

      expect(cancelledAppointments.length).toBeGreaterThan(0);
      expect(
        cancelledAppointments.some((a) => a.id === appointmentId)
      ).toBe(true);
    });

    it('医生应能筛选不同状态的预约', async () => {
      // 获取所有预约
      const allAppointments = await apiClient.getDoctorAppointments(doctorToken);

      // 获取待处理预约
      const pendingAppointments = await apiClient.getDoctorAppointments(
        doctorToken,
        'pending'
      );

      // 获取已取消预约
      const cancelledAppointments = await apiClient.getDoctorAppointments(
        doctorToken,
        'cancelled'
      );

      // 验证筛选结果
      expect(pendingAppointments.length).toBeLessThanOrEqual(allAppointments.length);
      expect(cancelledAppointments.length).toBeGreaterThan(0);

      // 验证状态正确性
      pendingAppointments.forEach((a) => {
        expect(a.status).toBe('pending');
      });

      cancelledAppointments.forEach((a) => {
        expect(a.status).toBe('cancelled');
      });
    });
  });

  describe('数据排序和格式验证', () => {
    it('医生预约列表应按时间倒序排列', async () => {
      const appointments = await apiClient.getDoctorAppointments(doctorToken);

      if (appointments.length >= 2) {
        // 验证是按时间倒序排列（最新的在前）
        for (let i = 0; i < appointments.length - 1; i++) {
          const current = new Date(appointments[i].appointmentTime);
          const next = new Date(appointments[i + 1].appointmentTime);
          expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
        }
      }
    });

    it('预约数据应包含完整的患者信息', async () => {
      const appointments = await apiClient.getDoctorAppointments(doctorToken);

      if (appointments.length > 0) {
        const firstAppointment = appointments[0];

        // 验证患者信息字段
        expect(firstAppointment.patientId).toBeDefined();
        expect(firstAppointment.patientName).toBeDefined();
        expect(firstAppointment.patientPhone).toBeDefined();

        // 验证预约信息字段
        expect(firstAppointment.doctorId).toBeDefined();
        expect(firstAppointment.doctorName).toBeDefined();
        expect(firstAppointment.hospital).toBeDefined();
        expect(firstAppointment.department).toBeDefined();
        expect(firstAppointment.appointmentTime).toBeDefined();
        expect(firstAppointment.status).toBeDefined();
        expect(firstAppointment.createdAt).toBeDefined();
        expect(firstAppointment.updatedAt).toBeDefined();
      }
    });
  });
});
