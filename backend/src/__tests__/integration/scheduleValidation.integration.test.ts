import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../index';
import { jwtService } from '../../services/auth/jwt';
import { scheduleStore } from '../../services/storage/scheduleStore';

describe('排班验证集成测试 - Schedule Validation Integration', () => {
  let doctorToken: string;
  let patientToken: string;
  const doctorId = 'doctor_001';
  const patientId = 'patient_001';

  beforeEach(() => {
    // 生成测试用的 JWT token
    doctorToken = jwtService.generateAccessToken({ userId: doctorId, phone: '13800138000', role: 'doctor' });
    patientToken = jwtService.generateAccessToken({ userId: patientId, phone: '13800138001', role: 'patient' });

    // 清空排班设置
    scheduleStore.clear();
  });

  describe('GET /api/appointments/schedule - 排班验证集成', () => {
    it('应该返回所有时间段，当医生没有设置排班时', async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const response = await request(app)
        .get('/api/appointments/schedule')
        .query({ doctorId, startDate: tomorrowStr, endDate: tomorrowStr })
        .set('Authorization', `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data.schedules).toHaveLength(1);
      expect(response.body.data.schedules[0].date).toBe(tomorrowStr);
      // 应该有一些可用的时间段
      expect(response.body.data.schedules[0].availableSlots.length).toBeGreaterThan(0);
    });

    it('应该只返回可用时段，当医生设置了排班', async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // 医生设置上午时段不可用
      await request(app)
        .post('/api/doctors/schedules')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          date: tomorrowStr,
          timeSlot: 'morning',
          isAvailable: false,
          maxPatients: 10,
        });

      // 患者查询排班
      const response = await request(app)
        .get('/api/appointments/schedule')
        .query({ doctorId, startDate: tomorrowStr, endDate: tomorrowStr })
        .set('Authorization', `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data.schedules).toHaveLength(1);
      expect(response.body.data.schedules[0].date).toBe(tomorrowStr);

      // 验证没有上午的时间段（6:00-12:00）
      const morningSlots = response.body.data.schedules[0].availableSlots.filter((time: string) => {
        const hour = parseInt(time.split(':')[0], 10);
        return hour >= 6 && hour < 12;
      });
      expect(morningSlots).toHaveLength(0);

      // 验证下午和晚上的时间段仍然存在
      const afternoonEveningSlots = response.body.data.schedules[0].availableSlots.filter((time: string) => {
        const hour = parseInt(time.split(':')[0], 10);
        return hour >= 12;
      });
      expect(afternoonEveningSlots.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/appointments - 预约验证集成', () => {
    it('应该拒绝创建预约，当时段不在医生的可用排班内', async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // 医生设置上午时段不可用
      await request(app)
        .post('/api/doctors/schedules')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          date: tomorrowStr,
          timeSlot: 'morning',
          isAvailable: false,
          maxPatients: 10,
        });

      // 患者尝试预约上午的时间段
      const appointmentTime = `${tomorrowStr}T09:00:00Z`;

      const response = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId,
          appointmentTime,
          patientName: '张三',
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('not available');
    });

    it('应该能够创建预约，当时段在医生的可用排班内', async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // 医生设置下午时段可用
      await request(app)
        .post('/api/doctors/schedules')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          date: tomorrowStr,
          timeSlot: 'afternoon',
          isAvailable: true,
          maxPatients: 10,
        });

      // 患者预约下午的时间段
      const appointmentTime = `${tomorrowStr}T14:00:00Z`;

      const response = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId,
          appointmentTime,
          patientName: '张三',
        });

      expect(response.status).toBe(201);
      expect(response.body.code).toBe(0);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.appointmentTime).toBe(appointmentTime);
    });

    it('应该能够使用 date + timeSlot 格式创建预约（前端友好格式）', async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      // 使用前端发送的 date + timeSlot 格式
      const response = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId,
          date: tomorrowStr,
          timeSlot: '14:00',
          patientName: '李四',
        });

      expect(response.status).toBe(201);
      expect(response.body.code).toBe(0);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.appointmentTime).toBe(`${tomorrowStr}T14:00:00Z`);
      expect(response.body.data.patientName).toBe('李四');
    });

    it('应该拒绝缺少 doctorId 的预约请求', async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const response = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          date: tomorrowStr,
          timeSlot: '14:00',
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('应该拒绝无效的 doctorId', async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const response = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          doctorId: 'invalid_doctor_id',
          date: tomorrowStr,
          timeSlot: '14:00',
        });

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/doctors/schedules - 排班日期验证', () => {
    it('应该拒绝设置过去的排班日期', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const response = await request(app)
        .post('/api/doctors/schedules')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          date: yesterdayStr,
          timeSlot: 'morning',
          isAvailable: true,
          maxPatients: 10,
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('past');
    });

    it('应该允许设置今天及未来的排班日期', async () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const response = await request(app)
        .post('/api/doctors/schedules')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          date: todayStr,
          timeSlot: 'morning',
          isAvailable: true,
          maxPatients: 10,
        });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
    });
  });
});
