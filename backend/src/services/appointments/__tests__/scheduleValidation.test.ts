import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDoctorSchedule,
  createAppointment,
  isValidDateFormat,
} from '../appointmentService';
import { scheduleStore } from '../../storage/scheduleStore';

// 在测试文件中清空全局 mockAppointments
// 注意：这需要访问 appointmentService 中的 mockAppointments
// 我们通过 vi.stub 来实现

describe('排班验证功能 - Schedule Validation', () => {
  const doctorId = 'doctor_001';
  const patientId = 'patient_001';
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  beforeEach(() => {
    // 清空排班设置，确保测试隔离
    scheduleStore.clear();
  });

  describe('getDoctorSchedule - 集成排班设置', () => {
    it('应该返回所有时间段，当医生没有设置排班时', () => {
      // 不设置任何排班，应该返回所有可用的时间段
      const schedules = getDoctorSchedule(doctorId, tomorrowStr, tomorrowStr);

      expect(schedules).toHaveLength(1);
      expect(schedules[0].date).toBe(tomorrowStr);
      // 会有一些时间段可用（基于 mock 数据）
      expect(schedules[0].availableSlots.length).toBeGreaterThan(0);
    });

    it('应该只返回可用时段，当医生设置了排班', () => {
      // 设置上午时段不可用
      scheduleStore.setSchedule({
        doctorId,
        date: tomorrowStr,
        timeSlot: 'morning',
        isAvailable: false,
        maxPatients: 10,
      });

      const schedules = getDoctorSchedule(doctorId, tomorrowStr, tomorrowStr);

      expect(schedules).toHaveLength(1);
      expect(schedules[0].date).toBe(tomorrowStr);

      // 验证没有上午的时间段（6:00-12:00）
      const morningSlots = schedules[0].availableSlots.filter(time => {
        const hour = parseInt(time.split(':')[0], 10);
        return hour >= 6 && hour < 12;
      });
      expect(morningSlots).toHaveLength(0);

      // 验证下午和晚上的时间段仍然存在
      const afternoonEveningSlots = schedules[0].availableSlots.filter(time => {
        const hour = parseInt(time.split(':')[0], 10);
        return hour >= 12;
      });
      expect(afternoonEveningSlots.length).toBeGreaterThan(0);
    });

    it('应该正确处理多个时段的可用性设置', () => {
      // 设置上午和下午都不可用
      scheduleStore.setSchedule({
        doctorId,
        date: tomorrowStr,
        timeSlot: 'morning',
        isAvailable: false,
        maxPatients: 10,
      });
      scheduleStore.setSchedule({
        doctorId,
        date: tomorrowStr,
        timeSlot: 'afternoon',
        isAvailable: false,
        maxPatients: 10,
      });

      const schedules = getDoctorSchedule(doctorId, tomorrowStr, tomorrowStr);

      // 验证没有上午和下午的时间段
      const morningSlots = schedules[0].availableSlots.filter(time => {
        const hour = parseInt(time.split(':')[0], 10);
        return hour >= 6 && hour < 12;
      });
      const afternoonSlots = schedules[0].availableSlots.filter(time => {
        const hour = parseInt(time.split(':')[0], 10);
        return hour >= 12 && hour < 18;
      });

      expect(morningSlots).toHaveLength(0);
      expect(afternoonSlots).toHaveLength(0);

      // 验证总的时间段数量减少
      const totalSlotsBeforeFilter = 11; // 基于 mock 数据的时间段总数
      expect(schedules[0].availableSlots.length).toBeLessThan(totalSlotsBeforeFilter);
    });

    it('应该支持多个日期的排班查询', () => {
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfterTomorrowStr = dayAfterTomorrow.toISOString().split('T')[0];

      // 设置明天上午不可用
      scheduleStore.setSchedule({
        doctorId,
        date: tomorrowStr,
        timeSlot: 'morning',
        isAvailable: false,
        maxPatients: 10,
      });

      // 设置后天下午不可用
      scheduleStore.setSchedule({
        doctorId,
        date: dayAfterTomorrowStr,
        timeSlot: 'afternoon',
        isAvailable: false,
        maxPatients: 10,
      });

      const schedules = getDoctorSchedule(doctorId, tomorrowStr, dayAfterTomorrowStr);

      expect(schedules).toHaveLength(2);

      // 验证明天没有上午时段
      const tomorrowMorningSlots = schedules[0].availableSlots.filter(time => {
        const hour = parseInt(time.split(':')[0], 10);
        return hour >= 6 && hour < 12;
      });
      expect(tomorrowMorningSlots).toHaveLength(0);

      // 验证后天没有下午时段
      const dayAfterTomorrowAfternoonSlots = schedules[1].availableSlots.filter(time => {
        const hour = parseInt(time.split(':')[0], 10);
        return hour >= 12 && hour < 18;
      });
      expect(dayAfterTomorrowAfternoonSlots).toHaveLength(0);
    });
  });

  describe('createAppointment - 验证排班设置', () => {
    it('应该能够创建预约，当时段在医生的可用排班内', () => {
      // 设置下午时段可用
      scheduleStore.setSchedule({
        doctorId,
        date: tomorrowStr,
        timeSlot: 'afternoon',
        isAvailable: true,
        maxPatients: 10,
      });

      const appointmentTime = `${tomorrowStr}T14:00:00Z`;

      const appointment = createAppointment(
        patientId,
        '张三',
        '13800138000',
        doctorId,
        '医生A',
        '北京协和医院',
        '内科',
        appointmentTime
      );

      expect(appointment).toBeDefined();
      expect(appointment.id).toBeDefined();
      expect(appointment.appointmentTime).toBe(appointmentTime);
    });

    it('应该拒绝创建预约，当时段不在医生的可用排班内', () => {
      // 设置上午时段不可用
      scheduleStore.setSchedule({
        doctorId,
        date: tomorrowStr,
        timeSlot: 'morning',
        isAvailable: false,
        maxPatients: 10,
      });

      const appointmentTime = `${tomorrowStr}T09:00:00Z`;

      expect(() => {
        createAppointment(
          patientId,
          '张三',
          '13800138000',
          doctorId,
          '医生A',
          '北京协和医院',
          '内科',
          appointmentTime
        );
      }).toThrow('Selected time slot is not available for this doctor.');
    });

    it('应该能够创建预约，当医生没有设置排班时（默认行为）', () => {
      // 不设置任何排班
      const appointmentTime = `${tomorrowStr}T09:00:00Z`;

      const appointment = createAppointment(
        patientId,
        '张三',
        '13800138000',
        doctorId,
        '医生A',
        '北京协和医院',
        '内科',
        appointmentTime
      );

      expect(appointment).toBeDefined();
      expect(appointment.id).toBeDefined();
    });

    it('应该允许时段被设置为可用后创建预约', () => {
      // 使用不同的时间段避免与其他测试冲突
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfterTomorrowStr = dayAfterTomorrow.toISOString().split('T')[0];

      const uniquePatientId = `patient_${Date.now()}`;

      // 先设置为不可用
      scheduleStore.setSchedule({
        doctorId,
        date: dayAfterTomorrowStr,
        timeSlot: 'afternoon',
        isAvailable: false,
        maxPatients: 10,
      });

      // 然后设置为可用
      scheduleStore.setSchedule({
        doctorId,
        date: dayAfterTomorrowStr,
        timeSlot: 'afternoon',
        isAvailable: true,
        maxPatients: 10,
      });

      const appointmentTime = `${dayAfterTomorrowStr}T14:00:00Z`;

      const appointment = createAppointment(
        uniquePatientId,
        '张三',
        '13800138000',
        doctorId,
        '医生A',
        '北京协和医院',
        '内科',
        appointmentTime
      );

      expect(appointment).toBeDefined();
      expect(appointment.id).toBeDefined();
    });
  });
});
