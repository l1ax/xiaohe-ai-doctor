import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRouter from '../../routes/auth';
import { errorHandler } from '../../utils/errorHandler';

// 创建测试应用
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use(errorHandler);

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
      expect(response.body.code).toBeDefined();
      expect(response.body.message).toBeDefined();
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
      expect(response.body.code).toBeDefined();
      expect(response.body.message).toBeDefined();
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
      expect(profileResponse.body.code).toBe(0);
      expect(profileResponse.body.data.user).toBeDefined();
      expect(profileResponse.body.data.user.id).toBeDefined();
      expect(profileResponse.body.data.user.phone).toBeDefined();
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile');

      expect(response.status).toBe(401);
      expect(response.body.code).toBeDefined();
      expect(response.body.message).toBeDefined();
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      // 先登录获取 refresh token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          phone: '13900139003',
          verifyCode: '123456',
        });

      const refreshToken = loginResponse.body.data.refreshToken;

      // 刷新 token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.code).toBe(0);
      expect(refreshResponse.body.data.accessToken).toBeDefined();
      expect(refreshResponse.body.data.refreshToken).toBeDefined();
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid_token' });

      expect(response.status).toBe(401);
      expect(response.body.code).toBeDefined();
      expect(response.body.message).toBeDefined();
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('should update user profile with valid token', async () => {
      // 先登录获取 token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          phone: '13900139004',
          verifyCode: '123456',
        });

      const token = loginResponse.body.data.accessToken;

      // 更新用户信息
      const updateResponse = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ nickname: 'Updated Nickname' });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.code).toBe(0);
      expect(updateResponse.body.data.user).toBeDefined();
      expect(updateResponse.body.data.user.nickname).toBe('Updated Nickname');
    });

    it('should reject profile update without token', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .send({ nickname: 'Test' });

      expect(response.status).toBe(401);
      expect(response.body.code).toBeDefined();
      expect(response.body.message).toBeDefined();
    });
  });
});
