import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRouter from '../../routes/auth';
import { jwtService } from '../../services/auth/jwt';

// 创建测试应用
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Auth Integration Tests', () => {
  describe('POST /api/auth/send-code', () => {
    it('should send verification code', async () => {
      const response = await request(app)
        .post('/api/auth/send-code')
        .send({ phone: '13800138000' });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data.message).toBe('Verification code sent');
    });

    it('should reject invalid phone number', async () => {
      const response = await request(app)
        .post('/api/auth/send-code')
        .send({ phone: '12345' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with correct verification code', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          phone: '13900139000',
          verifyCode: '123456',
        });

      expect(response.status).toBe(200);
      expect(response.body.code).toBe(0);
      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.accessToken).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
    });

    it('should reject wrong verification code', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          phone: '13900139001',
          verifyCode: '000000',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should get user profile with valid token', async () => {
      // 先登录获取 token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          phone: '13900139002',
          verifyCode: '123456',
        });

      const token = loginResponse.body.data.accessToken;

      // 获取用户信息
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.data).toBeDefined();
      expect(profileResponse.body.data.id).toBeDefined();
      expect(profileResponse.body.data.phone).toBeDefined();
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile');

      expect(response.status).toBe(401);
    });
  });
});
