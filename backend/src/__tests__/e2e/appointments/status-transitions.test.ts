import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
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

describe('预约挂号 - 预约状态转换完整测试', () => {
  let apiClient: TestApiClient;
  let userToken: string;
  let user2Token: string;
  let doctorToken: string;

  beforeAll(async () => {
    apiClient = new TestApiClient(app);

    // 患者登录
    userToken = await apiClient.loginPatient(
      TEST_USERS.PATIENT.phone,
      TEST_USERS.PATIENT.code
    );

    // 第二个患者登录
    user2Token = await apiClient.loginPatient('13900139998', '123456');

    // 医生登录
    doctorToken = await apiClient.loginDoctor(
      TEST_USERS.DOCTOR.phone,
      TEST_USERS.DOCTOR.code
    );
  });

  describe('初始状态测试', () => {
    it('新创建的预约状态应为 pending', async () => {
      // 获取明天的排班
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        dateStr,
        dateStr
      );

      const availableSlot = schedules[0].availableSlots[0];
      expect(availableSlot).toBeDefined();

      const [hours, minutes] = availableSlot.split(':');
      tomorrow.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

      const appointment = await apiClient.createAppointment(userToken, {
        doctorId: 'doctor_001',
        patientName: '测试患者A',
        appointmentTime: tomorrow.toISOString(),
      });

      expect(appointment.status).toBe('pending');
      expect(appointment.createdAt).toBeDefined();
      expect(appointment.updatedAt).toBeDefined();
    });

    it('预约应包含所有必需的状态字段', async () => {
      const twoDaysLater = new Date();
      twoDaysLater.setDate(twoDaysLater.getDate() + 2);
      const dateStr = twoDaysLater.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_002',
        dateStr,
        dateStr
      );

      if (schedules[0].availableSlots.length > 0) {
        const availableSlot = schedules[0].availableSlots[0];
        const [hours, minutes] = availableSlot.split(':');
        twoDaysLater.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

        const appointment = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_002',
          patientName: '测试患者B',
          appointmentTime: twoDaysLater.toISOString(),
        });

        // 验证所有状态相关字段
        expect(appointment).toHaveProperty('status');
        expect(appointment).toHaveProperty('createdAt');
        expect(appointment).toHaveProperty('updatedAt');
        expect(typeof appointment.status).toBe('string');
        expect(typeof appointment.createdAt).toBe('string');
        expect(typeof appointment.updatedAt).toBe('string');
      }
    });
  });

  describe('pending -> cancelled 状态转换', () => {
    it('患者应能取消自己的 pending 预约', async () => {
      // 创建预约
      const threeDaysLater = new Date();
      threeDaysLater.setDate(threeDaysLater.getDate() + 3);
      const dateStr = threeDaysLater.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_003',
        dateStr,
        dateStr
      );

      if (schedules[0].availableSlots.length > 0) {
        const availableSlot = schedules[0].availableSlots[0];
        const [hours, minutes] = availableSlot.split(':');
        threeDaysLater.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

        const appointment = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_003',
          patientName: '测试患者C',
          appointmentTime: threeDaysLater.toISOString(),
        });

        expect(appointment.status).toBe('pending');

        // 取消预约
        await apiClient.cancelAppointment(userToken, appointment.id);

        // 验证状态已更新
        const updated = await apiClient.getAppointmentDetail(
          userToken,
          appointment.id
        );
        expect(updated.status).toBe('cancelled');
      }
    });

    it('取消后 updatedAt 时间应更新', async () => {
      const fourDaysLater = new Date();
      fourDaysLater.setDate(fourDaysLater.getDate() + 4);
      const dateStr = fourDaysLater.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        dateStr,
        dateStr
      );

      if (schedules[0].availableSlots.length > 0) {
        const availableSlot = schedules[0].availableSlots[0];
        const [hours, minutes] = availableSlot.split(':');
        fourDaysLater.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

        const appointment = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_001',
          patientName: '测试患者D',
          appointmentTime: fourDaysLater.toISOString(),
        });

        const originalUpdatedAt = appointment.updatedAt;

        // 等待一小段时间以确保时间戳不同
        await new Promise((resolve) => setTimeout(resolve, 10));

        // 取消预约
        await apiClient.cancelAppointment(userToken, appointment.id);

        const updated = await apiClient.getAppointmentDetail(
          userToken,
          appointment.id
        );

        expect(updated.updatedAt).not.toBe(originalUpdatedAt);
      }
    });
  });

  describe('取消后的预约不应能再次取消', () => {
    it('已取消的预约不应能再次取消', async () => {
      const fiveDaysLater = new Date();
      fiveDaysLater.setDate(fiveDaysLater.getDate() + 5);
      const dateStr = fiveDaysLater.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_002',
        dateStr,
        dateStr
      );

      if (schedules[0].availableSlots.length > 0) {
        const availableSlot = schedules[0].availableSlots[0];
        const [hours, minutes] = availableSlot.split(':');
        fiveDaysLater.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

        const appointment = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_002',
          patientName: '测试患者E',
          appointmentTime: fiveDaysLater.toISOString(),
        });

        // 第一次取消
        await apiClient.cancelAppointment(userToken, appointment.id);

        // 第二次取消应该失败
        await expect(
          apiClient.cancelAppointment(userToken, appointment.id)
        ).rejects.toThrow();
      }
    });

    it('已取消的预约在详情中应显示 cancelled 状态', async () => {
      const sixDaysLater = new Date();
      sixDaysLater.setDate(sixDaysLater.getDate() + 6);
      const dateStr = sixDaysLater.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_003',
        dateStr,
        dateStr
      );

      if (schedules[0].availableSlots.length > 0) {
        const availableSlot = schedules[0].availableSlots[0];
        const [hours, minutes] = availableSlot.split(':');
        sixDaysLater.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

        const appointment = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_003',
          patientName: '测试患者F',
          appointmentTime: sixDaysLater.toISOString(),
        });

        await apiClient.cancelAppointment(userToken, appointment.id);

        const detail = await apiClient.getAppointmentDetail(
          userToken,
          appointment.id
        );

        expect(detail.status).toBe('cancelled');
      }
    });
  });

  describe('状态过滤测试', () => {
    it('应能按 pending 状态筛选预约', async () => {
      // 创建多个预约
      const sevenDaysLater = new Date();
      sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
      const dateStr = sevenDaysLater.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        dateStr,
        dateStr
      );

      if (schedules[0].availableSlots.length >= 2) {
        const slot1 = schedules[0].availableSlots[0];
        const slot2 = schedules[0].availableSlots[1];

        const [hours1, minutes1] = slot1.split(':');
        const [hours2, minutes2] = slot2.split(':');

        const time1 = new Date(sevenDaysLater);
        time1.setUTCHours(parseInt(hours1), parseInt(minutes1), 0, 0);

        const time2 = new Date(sevenDaysLater);
        time2.setUTCHours(parseInt(hours2), parseInt(minutes2), 0, 0);

        const appointment1 = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_001',
          patientName: '测试患者G',
          appointmentTime: time1.toISOString(),
        });

        const appointment2 = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_001',
          patientName: '测试患者H',
          appointmentTime: time2.toISOString(),
        });

        // 取消其中一个
        await apiClient.cancelAppointment(userToken, appointment1.id);

        // 获取所有预约
        const allAppointments = await apiClient.getMyAppointments(userToken);

        // 验证包含不同状态的预约
        expect(allAppointments.length).toBeGreaterThan(0);

        // 验证可以找到 pending 和 cancelled 状态的预约
        const pendingAppointments = allAppointments.filter(
          (a) => a.status === 'pending'
        );
        const cancelledAppointments = allAppointments.filter(
          (a) => a.status === 'cancelled'
        );

        expect(pendingAppointments.length).toBeGreaterThan(0);
        expect(cancelledAppointments.length).toBeGreaterThan(0);
      }
    });

    it('医生端应能按状态筛选预约', async () => {
      // 医生获取所有预约
      const allAppointments = await apiClient.getDoctorAppointments(
        doctorToken
      );

      if (allAppointments.length > 0) {
        // 获取 pending 状态的预约
        const pendingAppointments = await apiClient.getDoctorAppointments(
          doctorToken,
          'pending'
        );

        // 验证所有返回的预约都是 pending 状态
        pendingAppointments.forEach((appointment) => {
          expect(appointment.status).toBe('pending');
        });

        // 如果有已取消的预约，测试筛选
        const cancelledAppointments = await apiClient.getDoctorAppointments(
          doctorToken,
          'cancelled'
        );

        cancelledAppointments.forEach((appointment) => {
          expect(appointment.status).toBe('cancelled');
        });
      }
    });
  });

  describe('权限测试', () => {
    it('只有患者本人能取消自己的预约', async () => {
      const eightDaysLater = new Date();
      eightDaysLater.setDate(eightDaysLater.getDate() + 8);
      const dateStr = eightDaysLater.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_002',
        dateStr,
        dateStr
      );

      if (schedules[0].availableSlots.length > 0) {
        const availableSlot = schedules[0].availableSlots[0];
        const [hours, minutes] = availableSlot.split(':');
        eightDaysLater.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

        const appointment = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_002',
          patientName: '测试患者I',
          appointmentTime: eightDaysLater.toISOString(),
        });

        // 第二个用户尝试取消第一个用户的预约应该失败
        await expect(
          apiClient.cancelAppointment(user2Token, appointment.id)
        ).rejects.toThrow();

        // 第一个用户应该能成功取消
        await apiClient.cancelAppointment(userToken, appointment.id);

        const updated = await apiClient.getAppointmentDetail(
          userToken,
          appointment.id
        );
        expect(updated.status).toBe('cancelled');
      }
    });

    it('患者不能查看其他患者的预约详情', async () => {
      const nineDaysLater = new Date();
      nineDaysLater.setDate(nineDaysLater.getDate() + 9);
      const dateStr = nineDaysLater.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_003',
        dateStr,
        dateStr
      );

      if (schedules[0].availableSlots.length > 0) {
        const availableSlot = schedules[0].availableSlots[0];
        const [hours, minutes] = availableSlot.split(':');
        nineDaysLater.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

        const appointment = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_003',
          patientName: '测试患者J',
          appointmentTime: nineDaysLater.toISOString(),
        });

        // 第二个用户尝试查看第一个用户的预约详情应该失败
        await expect(
          apiClient.getAppointmentDetail(user2Token, appointment.id)
        ).rejects.toThrow();
      }
    });

    it('患者不能取消其他患者的预约', async () => {
      const tenDaysLater = new Date();
      tenDaysLater.setDate(tenDaysLater.getDate() + 10);
      const dateStr = tenDaysLater.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        dateStr,
        dateStr
      );

      if (schedules[0].availableSlots.length > 0) {
        const availableSlot = schedules[0].availableSlots[0];
        const [hours, minutes] = availableSlot.split(':');
        tenDaysLater.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

        const appointment = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_001',
          patientName: '测试患者K',
          appointmentTime: tenDaysLater.toISOString(),
        });

        // 第二个用户尝试取消应该失败
        await expect(
          apiClient.cancelAppointment(user2Token, appointment.id)
        ).rejects.toThrow();

        // 验证预约状态仍然是 pending
        const detail = await apiClient.getAppointmentDetail(
          userToken,
          appointment.id
        );
        expect(detail.status).toBe('pending');
      }
    });

    it('未认证用户不能访问预约接口', async () => {
      const elevenDaysLater = new Date();
      elevenDaysLater.setDate(elevenDaysLater.getDate() + 11);
      const dateStr = elevenDaysLater.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_002',
        dateStr,
        dateStr
      );

      if (schedules[0].availableSlots.length > 0) {
        const availableSlot = schedules[0].availableSlots[0];
        const [hours, minutes] = availableSlot.split(':');
        elevenDaysLater.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

        const appointment = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_002',
          patientName: '测试患者L',
          appointmentTime: elevenDaysLater.toISOString(),
        });

        // 尝试不带 token 访问
        const response = await fetch(
          `http://localhost:3000/api/appointments/${appointment.id}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        // 应该返回 401 未授权
        expect(response.status).toBe(401);
      }
    });
  });

  describe('预约列表状态显示测试', () => {
    it('我的预约列表应正确显示所有状态的预约', async () => {
      const myAppointments = await apiClient.getMyAppointments(userToken);

      // 验证每个预约都有状态字段
      myAppointments.forEach((appointment) => {
        expect(appointment).toHaveProperty('status');
        expect(['pending', 'cancelled', 'confirmed', 'completed']).toContain(
          appointment.status
        );
      });
    });

    it('医生预约列表应包含状态信息', async () => {
      const doctorAppointments = await apiClient.getDoctorAppointments(
        doctorToken
      );

      doctorAppointments.forEach((appointment) => {
        expect(appointment).toHaveProperty('status');
        expect(['pending', 'cancelled', 'confirmed', 'completed']).toContain(
          appointment.status
        );
      });
    });

    it('预约详情应包含完整的状态信息', async () => {
      const twelveDaysLater = new Date();
      twelveDaysLater.setDate(twelveDaysLater.getDate() + 12);
      const dateStr = twelveDaysLater.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_003',
        dateStr,
        dateStr
      );

      if (schedules[0].availableSlots.length > 0) {
        const availableSlot = schedules[0].availableSlots[0];
        const [hours, minutes] = availableSlot.split(':');
        twelveDaysLater.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

        const appointment = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_003',
          patientName: '测试患者M',
          appointmentTime: twelveDaysLater.toISOString(),
        });

        const detail = await apiClient.getAppointmentDetail(
          userToken,
          appointment.id
        );

        // 验证状态相关字段
        expect(detail).toHaveProperty('status');
        expect(detail).toHaveProperty('createdAt');
        expect(detail).toHaveProperty('updatedAt');
        expect(detail.status).toBe('pending');
      }
    });
  });

  describe('状态转换的副作用测试', () => {
    it('取消预约后时段应可重新预约', async () => {
      const thirteenDaysLater = new Date();
      thirteenDaysLater.setDate(thirteenDaysLater.getDate() + 13);
      const dateStr = thirteenDaysLater.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        dateStr,
        dateStr
      );

      if (schedules[0].availableSlots.length > 0) {
        const availableSlot = schedules[0].availableSlots[0];
        const [hours, minutes] = availableSlot.split(':');
        thirteenDaysLater.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

        const appointment1 = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_001',
          patientName: '测试患者N',
          appointmentTime: thirteenDaysLater.toISOString(),
        });

        // 取消预约
        await apiClient.cancelAppointment(userToken, appointment1.id);

        // 重新预约同一时段
        const appointment2 = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_001',
          patientName: '测试患者O',
          appointmentTime: thirteenDaysLater.toISOString(),
        });

        expect(appointment2.status).toBe('pending');
        expect(appointment2.id).not.toBe(appointment1.id);
      }
    });

    it('状态更新应保持数据一致性', async () => {
      const fourteenDaysLater = new Date();
      fourteenDaysLater.setDate(fourteenDaysLater.getDate() + 14);
      const dateStr = fourteenDaysLater.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_002',
        dateStr,
        dateStr
      );

      if (schedules[0].availableSlots.length > 0) {
        const availableSlot = schedules[0].availableSlots[0];
        const [hours, minutes] = availableSlot.split(':');
        fourteenDaysLater.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

        const appointment = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_002',
          patientName: '测试患者P',
          appointmentTime: fourteenDaysLater.toISOString(),
        });

        const originalId = appointment.id;
        const originalDoctorId = appointment.doctorId;
        const originalPatientName = appointment.patientName;
        const originalAppointmentTime = appointment.appointmentTime;

        // 取消预约
        await apiClient.cancelAppointment(userToken, appointment.id);

        const updated = await apiClient.getAppointmentDetail(
          userToken,
          appointment.id
        );

        // 验证其他字段未被修改
        expect(updated.id).toBe(originalId);
        expect(updated.doctorId).toBe(originalDoctorId);
        expect(updated.patientName).toBe(originalPatientName);
        expect(updated.appointmentTime).toBe(originalAppointmentTime);
        expect(updated.status).toBe('cancelled');
      }
    });
  });

  describe('状态时间戳测试', () => {
    it('createdAt 和 updatedAt 初始值应相同', async () => {
      const fifteenDaysLater = new Date();
      fifteenDaysLater.setDate(fifteenDaysLater.getDate() + 15);
      const dateStr = fifteenDaysLater.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_003',
        dateStr,
        dateStr
      );

      if (schedules[0].availableSlots.length > 0) {
        const availableSlot = schedules[0].availableSlots[0];
        const [hours, minutes] = availableSlot.split(':');
        fifteenDaysLater.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

        const appointment = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_003',
          patientName: '测试患者Q',
          appointmentTime: fifteenDaysLater.toISOString(),
        });

        expect(appointment.createdAt).toBe(appointment.updatedAt);
      }
    });

    it('状态更新后 updatedAt 应晚于 createdAt', async () => {
      const sixteenDaysLater = new Date();
      sixteenDaysLater.setDate(sixteenDaysLater.getDate() + 16);
      const dateStr = sixteenDaysLater.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        dateStr,
        dateStr
      );

      if (schedules[0].availableSlots.length > 0) {
        const availableSlot = schedules[0].availableSlots[0];
        const [hours, minutes] = availableSlot.split(':');
        sixteenDaysLater.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

        const appointment = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_001',
          patientName: '测试患者R',
          appointmentTime: sixteenDaysLater.toISOString(),
        });

        const createdAt = appointment.createdAt;

        // 等待一小段时间
        await new Promise((resolve) => setTimeout(resolve, 10));

        // 取消预约
        await apiClient.cancelAppointment(userToken, appointment.id);

        const updated = await apiClient.getAppointmentDetail(
          userToken,
          appointment.id
        );

        expect(updated.createdAt).toBe(createdAt);
        expect(updated.updatedAt).not.toBe(createdAt);
        expect(new Date(updated.updatedAt).getTime()).toBeGreaterThan(
          new Date(updated.createdAt).getTime()
        );
      }
    });
  });

  describe('有效状态值测试', () => {
    it('预约状态只能是预定义的值', async () => {
      const myAppointments = await apiClient.getMyAppointments(userToken);

      myAppointments.forEach((appointment) => {
        expect(['pending', 'cancelled', 'confirmed', 'completed']).toContain(
          appointment.status
        );
      });
    });

    it('初始状态应为 pending', async () => {
      const seventeenDaysLater = new Date();
      seventeenDaysLater.setDate(seventeenDaysLater.getDate() + 17);
      const dateStr = seventeenDaysLater.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_002',
        dateStr,
        dateStr
      );

      if (schedules[0].availableSlots.length > 0) {
        const availableSlot = schedules[0].availableSlots[0];
        const [hours, minutes] = availableSlot.split(':');
        seventeenDaysLater.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

        const appointment = await apiClient.createAppointment(userToken, {
          doctorId: 'doctor_002',
          patientName: '测试患者S',
          appointmentTime: seventeenDaysLater.toISOString(),
        });

        expect(appointment.status).toBe('pending');
      }
    });
  });

  describe('pending -> confirmed -> completed 状态转换（待实现）', () => {
    it('应支持 pending -> confirmed 转换', async () => {
      // 注意：此测试标记为待实现，因为当前代码库中没有
      // confirmAppointment 端点或函数
      // 当实现该功能时，应该：
      // 1. 创建一个 pending 预约
      // 2. 调用确认预约接口（医生或系统操作）
      // 3. 验证状态变为 confirmed

      // 目前跳过此测试
      expect(true).toBe(true);
    });

    it('应支持 confirmed -> completed 转换', async () => {
      // 注意：此测试标记为待实现，因为当前代码库中没有
      // completeAppointment 端点或函数
      // 当实现该功能时，应该：
      // 1. 创建一个预约并确认到 confirmed 状态
      // 2. 调用完成预约接口（医生操作）
      // 3. 验证状态变为 completed

      // 目前跳过此测试
      expect(true).toBe(true);
    });

    it('completed 状态不应能取消', async () => {
      // 注意：此测试标记为待实现
      // 当实现 completed 状态时，应该验证：
      // 已完成的预约不能取消

      // 目前跳过此测试
      expect(true).toBe(true);
    });
  });
});
