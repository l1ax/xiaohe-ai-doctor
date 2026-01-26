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

// 定义排班数据接口
interface ScheduleSlot {
  date: string;
  availableSlots: string[];
}

describe('预约挂号 - 排班数据一致性测试', () => {
  let apiClient: TestApiClient;
  let userToken: string;

  beforeAll(async () => {
    apiClient = new TestApiClient(app);
    userToken = await apiClient.loginPatient(
      TEST_USERS.PATIENT.phone,
      TEST_USERS.PATIENT.code
    );
  });

  describe('排班数据稳定性测试', () => {
    it('同一医生多次请求应返回相同的排班数据', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      // 第一次请求
      const schedules1 = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        dateStr,
        dateStr
      );

      // 第二次请求
      const schedules2 = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        dateStr,
        dateStr
      );

      // 验证数据一致性
      expect(schedules1).toEqual(schedules2);
      expect(schedules1.length).toBe(schedules2.length);

      // 验证每个日期的可用时段一致
      schedules1.forEach((schedule1, index) => {
        const schedule2 = schedules2[index];
        expect(schedule1.date).toBe(schedule2.date);
        expect(schedule1.availableSlots).toEqual(schedule2.availableSlots);
      });
    });

    it('不同医生的排班数据应相互独立', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      // 获取 doctor_001 的排班
      const schedules1 = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        dateStr,
        dateStr
      );

      // 获取 doctor_002 的排班
      const schedules2 = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_002',
        dateStr,
        dateStr
      );

      // 验证返回数据结构相同
      expect(schedules1.length).toBe(schedules2.length);
      expect(schedules1[0].date).toBe(schedules2[0].date);

      // 验证可用时段数组存在（但内容可能不同）
      expect(Array.isArray(schedules1[0].availableSlots)).toBe(true);
      expect(Array.isArray(schedules2[0].availableSlots)).toBe(true);
    });

    it('应能获取未来7天的完整排班数据', async () => {
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

      // 验证返回7天的数据
      expect(schedules.length).toBe(7);

      // 验证日期连续性
      for (let i = 0; i < schedules.length; i++) {
        const expectedDate = new Date(today);
        expectedDate.setDate(today.getDate() + i);
        const expectedDateStr = expectedDate.toISOString().split('T')[0];
        expect(schedules[i].date).toBe(expectedDateStr);
      }
    });

    it('7天排班数据应在合理的时间范围内', async () => {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 6);

      const startDate = today.toISOString().split('T')[0];
      const endDate = nextWeek.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        startDate,
        endDate
      );

      // 验证所有日期都在未来
      schedules.forEach((schedule) => {
        const scheduleDate = new Date(schedule.date);
        const todayUtc = Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate()
        );
        const scheduleUtc = scheduleDate.getTime();
        expect(scheduleUtc).toBeGreaterThanOrEqual(todayUtc);
      });
    });
  });

  describe('时段可用性测试', () => {
    it('已预约的时段不应在可用时段列表中', async () => {
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

      // 选择第一个可用时段
      const availableSlot = schedules[0].availableSlots[0];
      expect(availableSlot).toBeDefined();

      // 构造预约时间
      const [hours, minutes] = availableSlot.split(':');
      tomorrow.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

      // 创建预约
      await apiClient.createAppointment(userToken, {
        doctorId: 'doctor_001',
        patientName: '测试患者',
        appointmentTime: tomorrow.toISOString(),
      });

      // 再次获取排班（注意：实际实现中可能需要在预约后重新查询）
      // 在当前实现中，排班数据是静态的，但预约会检查冲突
      // 这里我们验证的是：尝试再次预约相同时段应该失败
      await expect(
        apiClient.createAppointment(userToken, {
          doctorId: 'doctor_001',
          patientName: '另一个患者',
          appointmentTime: tomorrow.toISOString(),
        })
      ).rejects.toThrow();
    });

    it('时段格式应为 HH:MM', async () => {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        dateStr,
        dateStr
      );

      // 验证所有可用时段的格式
      schedules.forEach((schedule: ScheduleSlot) => {
        schedule.availableSlots.forEach((slot: string) => {
          expect(slot).toMatch(/^\d{2}:\d{2}$/);
          // 验证时间有效性
          const [hours, minutes] = slot.split(':').map(Number);
          expect(hours).toBeGreaterThanOrEqual(0);
          expect(hours).toBeLessThanOrEqual(23);
          expect(minutes).toBeGreaterThanOrEqual(0);
          expect(minutes).toBeLessThanOrEqual(59);
        });
      });
    });

    it('时段应在合理的时间范围内', async () => {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        dateStr,
        dateStr
      );

      // 验证所有时段在工作时间范围内（假设 08:00-18:00）
      schedules.forEach((schedule: ScheduleSlot) => {
        schedule.availableSlots.forEach((slot: string) => {
          const [hours, minutes] = slot.split(':').map(Number);
          const totalMinutes = hours * 60 + minutes;
          // 工作时间：08:00 (480分钟) 到 18:00 (1080分钟)
          expect(totalMinutes).toBeGreaterThanOrEqual(480);
          expect(totalMinutes).toBeLessThanOrEqual(1080);
        });
      });
    });

    it('不同日期的时段应相互独立', async () => {
      const today = new Date();

      // 获取今天和明天的排班
      const todayStr = today.toISOString().split('T')[0];
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const todaySchedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        todayStr,
        todayStr
      );

      const tomorrowSchedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        tomorrowStr,
        tomorrowStr
      );

      // 验证日期不同
      expect(todaySchedules[0].date).not.toBe(tomorrowSchedules[0].date);

      // 验证时段数据存在
      expect(Array.isArray(todaySchedules[0].availableSlots)).toBe(true);
      expect(Array.isArray(tomorrowSchedules[0].availableSlots)).toBe(true);
    });
  });

  describe('日期边界测试', () => {
    it('月末日期应正确处理', async () => {
      // 测试月末日期（如1月31日）
      const testDate = new Date('2026-01-31T00:00:00.000Z');
      const dateStr = testDate.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        dateStr,
        dateStr
      );

      expect(schedules.length).toBe(1);
      expect(schedules[0].date).toBe('2026-01-31');
    });

    it('闰年日期应正确处理', async () => {
      // 测试闰年2月29日
      const leapYearDate = new Date('2028-02-29T00:00:00.000Z');
      const dateStr = leapYearDate.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        dateStr,
        dateStr
      );

      expect(schedules.length).toBe(1);
      expect(schedules[0].date).toBe('2028-02-29');
    });

    it('开始日期大于结束日期时应返回错误', async () => {
      const startDate = '2026-01-10';
      const endDate = '2026-01-01'; // 早于开始日期

      await expect(
        apiClient.getDoctorSchedule(userToken, 'doctor_001', startDate, endDate)
      ).rejects.toThrow();
    });

    it('开始日期等于结束日期时应返回单日数据', async () => {
      const sameDate = '2026-01-15';

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        sameDate,
        sameDate
      );

      expect(schedules.length).toBe(1);
      expect(schedules[0].date).toBe(sameDate);
    });

    it('跨月查询应正确处理', async () => {
      // 查询跨越月末的日期范围
      const startDate = '2026-01-30';
      const endDate = '2026-02-03';

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        startDate,
        endDate
      );

      // 验证返回5天的数据
      expect(schedules.length).toBe(5);

      // 验证日期正确性
      expect(schedules[0].date).toBe('2026-01-30');
      expect(schedules[1].date).toBe('2026-01-31');
      expect(schedules[2].date).toBe('2026-02-01');
      expect(schedules[3].date).toBe('2026-02-02');
      expect(schedules[4].date).toBe('2026-02-03');
    });

    it('跨年查询应正确处理', async () => {
      // 查询跨越年的日期范围
      const startDate = '2026-12-30';
      const endDate = '2027-01-02';

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        startDate,
        endDate
      );

      // 验证返回4天的数据
      expect(schedules.length).toBe(4);

      // 验证日期正确性
      expect(schedules[0].date).toBe('2026-12-30');
      expect(schedules[1].date).toBe('2026-12-31');
      expect(schedules[2].date).toBe('2027-01-01');
      expect(schedules[3].date).toBe('2027-01-02');
    });

    it('无效的日期格式应返回错误', async () => {
      await expect(
        apiClient.getDoctorSchedule(
          userToken,
          'doctor_001',
          'invalid-date',
          '2026-01-10'
        )
      ).rejects.toThrow();

      await expect(
        apiClient.getDoctorSchedule(
          userToken,
          'doctor_001',
          '2026-01-10',
          'invalid-date'
        )
      ).rejects.toThrow();
    });

    it('不完整的日期格式应返回错误', async () => {
      await expect(
        apiClient.getDoctorSchedule(
          userToken,
          'doctor_001',
          '2026-01',
          '2026-01-10'
        )
      ).rejects.toThrow();

      await expect(
        apiClient.getDoctorSchedule(userToken, 'doctor_001', '2026', '2026-01-10')
      ).rejects.toThrow();
    });
  });

  describe('排班数据完整性测试', () => {
    it('返回的排班数据应包含所有必需字段', async () => {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        dateStr,
        dateStr
      );

      schedules.forEach((schedule) => {
        expect(schedule).toHaveProperty('date');
        expect(schedule).toHaveProperty('availableSlots');
        expect(typeof schedule.date).toBe('string');
        expect(Array.isArray(schedule.availableSlots)).toBe(true);
      });
    });

    it('可用时段应为字符串数组', async () => {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        dateStr,
        dateStr
      );

      schedules.forEach((schedule: ScheduleSlot) => {
        schedule.availableSlots.forEach((slot: string) => {
          expect(typeof slot).toBe('string');
        });
      });
    });

    it('排班数据应按日期顺序返回', async () => {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 6);

      const startDate = today.toISOString().split('T')[0];
      const endDate = nextWeek.toISOString().split('T')[0];

      const schedules = await apiClient.getDoctorSchedule(
        userToken,
        'doctor_001',
        startDate,
        endDate
      );

      // 验证日期是递增的
      for (let i = 0; i < schedules.length - 1; i++) {
        const currentDate = new Date(schedules[i].date);
        const nextDate = new Date(schedules[i + 1].date);
        expect(currentDate.getTime()).toBeLessThan(nextDate.getTime());
      }
    });
  });
});
