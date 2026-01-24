import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import consultationsRouter from '../../routes/consultations';
import authRouter from '../../routes/auth';

// 创建测试应用
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/consultations', consultationsRouter);

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
    });

    it('should reject consultation creation without authentication', async () => {
      const response = await request(app)
        .post('/api/consultations')
        .send({ doctorId: 'doctor-001' });

      expect(response.status).toBe(401);
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
    });
  });
});
