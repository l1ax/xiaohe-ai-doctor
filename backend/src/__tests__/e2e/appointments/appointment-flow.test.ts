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

  describe('步骤 3: 创建预约', () => {
    it('应能成功创建预约', async () => {
      // 获取明天的排班，找到可用时段
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        dateStr,
        dateStr
      );

      // 选择第一个可用时段
      const availableSlot = schedules[0].availableSlots[0];
      expect(availableSlot).toBeDefined();

      // 构造预约时间（使用 UTC 时间以匹配后端逻辑）
      const [hours, minutes] = availableSlot.split(':');
      tomorrow.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

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
      // 获取后天的排班
      const dayAfterTomorrow = new Date();
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      const dateStr = dayAfterTomorrow.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        dateStr,
        dateStr
      );

      // 选择第一个可用时段（确保至少有2个可用时段用于测试）
      expect(schedules[0].availableSlots.length).toBeGreaterThan(0);
      const availableSlot = schedules[0].availableSlots[0];

      // 构造预约时间
      const [hours, minutes] = availableSlot.split(':');
      dayAfterTomorrow.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

      // 第一次预约应该成功
      await apiClient.createAppointment(userToken, {
        doctorId: 'doctor_001',
        patientName: '王五',
        appointmentTime: dayAfterTomorrow.toISOString(),
      });

      // 第二次预约相同时段应该失败
      await expect(
        apiClient.createAppointment(userToken, {
          doctorId: 'doctor_001',
          patientName: '赵六',
          appointmentTime: dayAfterTomorrow.toISOString(),
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
      // 获取3天后的排班
      const threeDaysLater = new Date();
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);
      const dateStr = threeDaysLater.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_002',
        dateStr,
        dateStr
      );

      // 选择第一个可用时段
      expect(schedules[0].availableSlots.length).toBeGreaterThan(0);
      const availableSlot = schedules[0].availableSlots[0];

      // 构造预约时间
      const [hours, minutes] = availableSlot.split(':');
      threeDaysLater.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

      const newAppointment = await apiClient.createAppointment(userToken, {
        doctorId: 'doctor_002',
        patientName: '张三',
        appointmentTime: threeDaysLater.toISOString(),
      });

      expect(newAppointment.status).toBe('pending');
      expect(newAppointment.doctorId).toBe('doctor_002');
    });
  });
});
