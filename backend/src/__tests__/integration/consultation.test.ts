import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import consultationsRouter from '../../routes/consultations';
import authRouter from '../../routes/auth';
import { errorHandler } from '../../utils/errorHandler';

// 创建测试应用
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/consultations', consultationsRouter);
app.use(errorHandler);

describe('Consultation Integration Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    // 登录获取 token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        phone: '13900139999',
        verifyCode: '123456',
      });

    authToken = loginResponse.body.data.accessToken;
  });

  describe('GET /api/consultations/doctors', () => {
    it('should get doctors list with authentication', async () => {
      const response = await request(app)
        .get('/api/consultations/doctors')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should filter doctors by department', async () => {
      const response = await request(app)
        .get('/api/consultations/doctors?department=内科')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/consultations/doctors');

      expect(response.status).toBe(401);
      expect(response.body.code).toBeDefined();
      expect(response.body.message).toBeDefined();
    });
  });

  describe('GET /api/consultations/departments', () => {
    it('should get departments list with authentication', async () => {
      const response = await request(app)
        .get('/api/consultations/departments')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/consultations/departments');

      expect(response.status).toBe(401);
      expect(response.body.code).toBeDefined();
      expect(response.body.message).toBeDefined();
    });
  });

  describe('POST /api/consultations', () => {
    it('should create consultation with valid doctor ID', async () => {
      const response = await request(app)
        .post('/api/consultations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ doctorId: 'doctor_001' });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.status).toBe('pending');
    });

    it('should reject consultation creation without doctor ID', async () => {
      const response = await request(app)
        .post('/api/consultations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.code).toBeDefined();
      expect(response.body.message).toBeDefined();
    });

    it('should reject consultation creation without authentication', async () => {
      const response = await request(app)
        .post('/api/consultations')
        .send({ doctorId: 'doctor-001' });

      expect(response.status).toBe(401);
      expect(response.body.code).toBeDefined();
      expect(response.body.message).toBeDefined();
    });
  });

  describe('GET /api/consultations', () => {
    it('should get user consultations with authentication', async () => {
      const response = await request(app)
        .get('/api/consultations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/consultations');

      expect(response.status).toBe(401);
      expect(response.body.code).toBeDefined();
      expect(response.body.message).toBeDefined();
    });
  });

  describe('GET /api/consultations/doctors/:id', () => {
    it('should get doctor detail with authentication', async () => {
      const response = await request(app)
        .get('/api/consultations/doctors/doctor_001')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.name).toBeDefined();
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/consultations/doctors/doctor_001');

      expect(response.status).toBe(401);
      expect(response.body.code).toBeDefined();
      expect(response.body.message).toBeDefined();
    });
  });

  describe('GET /api/consultations/hospitals', () => {
    it('should get hospitals list with authentication', async () => {
      const response = await request(app)
        .get('/api/consultations/hospitals')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/consultations/hospitals');

      expect(response.status).toBe(401);
      expect(response.body.code).toBeDefined();
      expect(response.body.message).toBeDefined();
    });
  });

  describe('GET /api/consultations/:id/messages', () => {
    it('should return messages for a consultation', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ phone: '13800000001', verifyCode: '123456' });

      const token = loginRes.body.data.accessToken;

      // 创建问诊
      const createRes = await request(app)
        .post('/api/consultations')
        .set('Authorization', `Bearer ${token}`)
        .send({ doctorId: 'doctor_001' });

      const consultationId = createRes.body.data.id;

      // 添加测试消息 - 需要导入 messageStore
      const { messageStore } = await import('../../services/storage/messageStore');
      messageStore.addMessage({
        id: 'msg1',
        consultationId,
        senderId: 'patient1',
        senderType: 'patient',
        content: 'Hello doctor',
        createdAt: '2026-01-25T10:00:00Z',
      });

      const res = await request(app)
        .get(`/api/consultations/${consultationId}/messages`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].content).toBe('Hello doctor');
    });
  });

  describe('GET /api/consultations/doctor', () => {
    it('should return all non-closed consultations for doctor', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ phone: '13800138000', verifyCode: '123456', role: 'doctor' });

      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/consultations/doctor')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should filter consultations by status', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ phone: '13800138000', verifyCode: '123456', role: 'doctor' });

      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/consultations/doctor?status=pending')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every((c: any) => c.status === 'pending')).toBe(true);
    });

    it('should reject invalid status parameter', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ phone: '13800138000', verifyCode: '123456', role: 'doctor' });

      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/consultations/doctor?status=invalid')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBeDefined();
      expect(res.body.message).toContain('Invalid status');
    });

    it('should reject access from non-doctor users', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ phone: '13800139000', verifyCode: '123456', role: 'patient' });

      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/consultations/doctor')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBeDefined();
    });

    it('should mask patient phone numbers', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ phone: '13800138000', verifyCode: '123456', role: 'doctor' });

      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/consultations/doctor')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);

      if (res.body.data && res.body.data.length > 0) {
        res.body.data.forEach((c: any) => {
          expect(c.patientPhone).toMatch(/^\d{3}\*\*\*\*\d{4}$/);
        });
      }
    });
  });

  describe('PUT /api/consultations/:id/close - patient permission', () => {
    it('should allow patient to close consultation', async () => {
      const patientLoginRes = await request(app)
        .post('/api/auth/login')
        .send({ phone: '13800139000', verifyCode: '123456', role: 'patient' });

      const patientToken = patientLoginRes.body.data.accessToken;

      // 创建问诊
      const createRes = await request(app)
        .post('/api/consultations')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ doctorId: 'doctor_001' });

      const consultationId = createRes.body.data.id;

      // 患者关闭问诊
      const res = await request(app)
        .put(`/api/consultations/${consultationId}/close`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('closed');
    });
  });
});
