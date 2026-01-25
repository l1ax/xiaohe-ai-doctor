import { describe, it, expect, beforeEach } from 'vitest';
import { scheduleStore, DoctorSchedule } from '../scheduleStore';

describe('ScheduleStore', () => {
  beforeEach(() => {
    scheduleStore.clear();
  });

  describe('setSchedule', () => {
    it('应该能够创建排班', () => {
      const schedule = scheduleStore.setSchedule({
        doctorId: 'doctor_1',
        date: '2026-01-26',
        timeSlot: 'morning',
        isAvailable: true,
        maxPatients: 10,
      });

      expect(schedule.id).toBeDefined();
      expect(schedule.doctorId).toBe('doctor_1');
      expect(schedule.date).toBe('2026-01-26');
      expect(schedule.timeSlot).toBe('morning');
      expect(schedule.isAvailable).toBe(true);
      expect(schedule.maxPatients).toBe(10);
    });

    it('应该能够更新已有排班', () => {
      const created = scheduleStore.setSchedule({
        doctorId: 'doctor_1',
        date: '2026-01-26',
        timeSlot: 'morning',
        isAvailable: true,
        maxPatients: 10,
      });

      const updated = scheduleStore.setSchedule({
        doctorId: 'doctor_1',
        date: '2026-01-26',
        timeSlot: 'morning',
        isAvailable: false,
        maxPatients: 15,
      });

      // ID 应该保持不变
      expect(updated.id).toBe(created.id);
      // 其他属性应该更新
      expect(updated.isAvailable).toBe(false);
      expect(updated.maxPatients).toBe(15);
    });

    it('应该能够为同一医生同一天的不同时段创建多个排班', () => {
      const morning = scheduleStore.setSchedule({
        doctorId: 'doctor_1',
        date: '2026-01-26',
        timeSlot: 'morning',
        isAvailable: true,
        maxPatients: 10,
      });

      const afternoon = scheduleStore.setSchedule({
        doctorId: 'doctor_1',
        date: '2026-01-26',
        timeSlot: 'afternoon',
        isAvailable: true,
        maxPatients: 10,
      });

      const evening = scheduleStore.setSchedule({
        doctorId: 'doctor_1',
        date: '2026-01-26',
        timeSlot: 'evening',
        isAvailable: false,
        maxPatients: 5,
      });

      // 三个排班应该有不同的 ID
      expect(morning.id).toBeDefined();
      expect(afternoon.id).toBeDefined();
      expect(evening.id).toBeDefined();
      expect(morning.id).not.toBe(afternoon.id);
      expect(afternoon.id).not.toBe(evening.id);
    });
  });

  describe('getByDoctorId', () => {
    it('应该能够获取医生的所有排班', () => {
      scheduleStore.setSchedule({
        doctorId: 'doctor_1',
        date: '2026-01-26',
        timeSlot: 'morning',
        isAvailable: true,
        maxPatients: 10,
      });

      scheduleStore.setSchedule({
        doctorId: 'doctor_1',
        date: '2026-01-27',
        timeSlot: 'afternoon',
        isAvailable: true,
        maxPatients: 10,
      });

      scheduleStore.setSchedule({
        doctorId: 'doctor_2',
        date: '2026-01-26',
        timeSlot: 'morning',
        isAvailable: true,
        maxPatients: 10,
      });

      const schedules = scheduleStore.getByDoctorId('doctor_1');

      expect(schedules).toHaveLength(2);
      expect(schedules.every(s => s.doctorId === 'doctor_1')).toBe(true);
      // 应该按日期排序
      expect(schedules[0].date).toBe('2026-01-26');
      expect(schedules[1].date).toBe('2026-01-27');
    });

    it('应该返回空数组如果医生没有排班', () => {
      const schedules = scheduleStore.getByDoctorId('doctor_1');
      expect(schedules).toEqual([]);
    });
  });

  describe('getByDate', () => {
    it('应该能够获取医生特定日期的排班', () => {
      scheduleStore.setSchedule({
        doctorId: 'doctor_1',
        date: '2026-01-26',
        timeSlot: 'morning',
        isAvailable: true,
        maxPatients: 10,
      });

      scheduleStore.setSchedule({
        doctorId: 'doctor_1',
        date: '2026-01-26',
        timeSlot: 'afternoon',
        isAvailable: true,
        maxPatients: 10,
      });

      scheduleStore.setSchedule({
        doctorId: 'doctor_1',
        date: '2026-01-27',
        timeSlot: 'morning',
        isAvailable: true,
        maxPatients: 10,
      });

      const schedules = scheduleStore.getByDate('doctor_1', '2026-01-26');

      expect(schedules).toHaveLength(2);
      expect(schedules.every(s => s.date === '2026-01-26')).toBe(true);
      // 应该按时段排序
      expect(schedules[0].timeSlot).toBe('afternoon');
      expect(schedules[1].timeSlot).toBe('morning');
    });

    it('应该返回空数组如果医生在该日期没有排班', () => {
      const schedules = scheduleStore.getByDate('doctor_1', '2026-01-26');
      expect(schedules).toEqual([]);
    });
  });

  describe('deleteSchedule', () => {
    it('应该能够删除排班', () => {
      const schedule = scheduleStore.setSchedule({
        doctorId: 'doctor_1',
        date: '2026-01-26',
        timeSlot: 'morning',
        isAvailable: true,
        maxPatients: 10,
      });

      const deleted = scheduleStore.deleteSchedule('doctor_1', '2026-01-26', 'morning');

      expect(deleted).toBe(true);

      // 验证排班已被删除
      const schedules = scheduleStore.getByDoctorId('doctor_1');
      expect(schedules).toHaveLength(0);
    });

    it('应该返回 false 如果排班不存在', () => {
      const deleted = scheduleStore.deleteSchedule('doctor_1', '2026-01-26', 'morning');
      expect(deleted).toBe(false);
    });

    it('应该只删除匹配的排班', () => {
      scheduleStore.setSchedule({
        doctorId: 'doctor_1',
        date: '2026-01-26',
        timeSlot: 'morning',
        isAvailable: true,
        maxPatients: 10,
      });

      scheduleStore.setSchedule({
        doctorId: 'doctor_1',
        date: '2026-01-26',
        timeSlot: 'afternoon',
        isAvailable: true,
        maxPatients: 10,
      });

      // 删除上午排班
      scheduleStore.deleteSchedule('doctor_1', '2026-01-26', 'morning');

      const schedules = scheduleStore.getByDoctorId('doctor_1');
      expect(schedules).toHaveLength(1);
      expect(schedules[0].timeSlot).toBe('afternoon');
    });
  });

  describe('getById', () => {
    it('应该能够根据 ID 获取排班', () => {
      const schedule = scheduleStore.setSchedule({
        doctorId: 'doctor_1',
        date: '2026-01-26',
        timeSlot: 'morning',
        isAvailable: true,
        maxPatients: 10,
      });

      const found = scheduleStore.getById(schedule.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(schedule.id);
      expect(found?.doctorId).toBe('doctor_1');
    });

    it('应该返回 undefined 如果 ID 不存在', () => {
      const found = scheduleStore.getById('non-existent-id');
      expect(found).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('应该能够清空所有排班', () => {
      scheduleStore.setSchedule({
        doctorId: 'doctor_1',
        date: '2026-01-26',
        timeSlot: 'morning',
        isAvailable: true,
        maxPatients: 10,
      });

      scheduleStore.setSchedule({
        doctorId: 'doctor_2',
        date: '2026-01-27',
        timeSlot: 'afternoon',
        isAvailable: true,
        maxPatients: 10,
      });

      scheduleStore.clear();

      const schedules1 = scheduleStore.getByDoctorId('doctor_1');
      const schedules2 = scheduleStore.getByDoctorId('doctor_2');

      expect(schedules1).toHaveLength(0);
      expect(schedules2).toHaveLength(0);
    });
  });

  describe('exportForMigration', () => {
    it('应该能够导出所有排班数据', () => {
      scheduleStore.setSchedule({
        doctorId: 'doctor_1',
        date: '2026-01-26',
        timeSlot: 'morning',
        isAvailable: true,
        maxPatients: 10,
      });

      scheduleStore.setSchedule({
        doctorId: 'doctor_2',
        date: '2026-01-27',
        timeSlot: 'afternoon',
        isAvailable: true,
        maxPatients: 10,
      });

      const exported = scheduleStore.exportForMigration();

      expect(exported).toHaveLength(2);
      expect(exported.every(s => s.id !== undefined)).toBe(true);
    });

    it('应该在清空后返回空数组', () => {
      scheduleStore.clear();
      const exported = scheduleStore.exportForMigration();
      expect(exported).toEqual([]);
    });
  });
});
