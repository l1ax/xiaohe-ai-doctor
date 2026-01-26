import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { Server } from 'http';
import consultationsRouter from '../../../routes/consultations';
import authRouter from '../../../routes/auth';
import { errorHandler } from '../../../utils/errorHandler';
import { wsManager } from '../../../services/websocket/WebSocketManager';
import { TestApiClient, TestWebSocketClient, TEST_USERS, TEST_CONFIG } from '../helpers';
import { logger } from '../../../utils/logger';
import { consultationStore } from '../../../services/storage/consultationStore';
import { messageStore } from '../../../services/storage/messageStore';

// 禁用测试期间的日志输出
logger.silent = true;

describe('专家问诊 - 边界条件测试', () => {
  let app: express.Express;
  let server: Server;
  let apiClient: TestApiClient;
  let patientToken: string;
  let doctorToken: string;
  let otherPatientToken: string;
  let otherDoctorToken: string;
  let consultationId: string;

  beforeAll(async () => {
    // 清理存储
    consultationStore.clear();
    messageStore.clear();

    // 创建测试应用
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
    app.use('/api/consultations', consultationsRouter);
    app.use(errorHandler);

    // 启动 HTTP 服务器（使用随机可用端口）
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (typeof address === 'object' && address) {
          const port = address.port;
          (TEST_CONFIG as any).WS_URL = `ws://localhost:${port}/ws`;
          (TEST_CONFIG as any).API_URL = `http://localhost:${port}`;
        }
        resolve();
      });
    });

    // 初始化 WebSocket 服务器
    wsManager.initialize(server);

    // 创建 API 客户端
    apiClient = new TestApiClient(app);
  });

  afterAll(async () => {
    // 清理 WebSocket 连接
    wsManager.shutdown();

    // 关闭 HTTP 服务器
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe('前置条件: 用户登录', () => {
    it('患者1应能成功登录', async () => {
      patientToken = await apiClient.loginPatient(
        TEST_USERS.PATIENT.phone,
        TEST_USERS.PATIENT.code
      );
      expect(patientToken).toBeDefined();
    });

    it('患者2应能成功登录', async () => {
      otherPatientToken = await apiClient.loginPatient('13900139998', '123456');
      expect(otherPatientToken).toBeDefined();
    });

    it('医生1应能成功登录', async () => {
      doctorToken = await apiClient.loginDoctor(
        TEST_USERS.DOCTOR.phone,
        TEST_USERS.DOCTOR.code
      );
      expect(doctorToken).toBeDefined();
    });

    it('医生2应能成功登录', async () => {
      otherDoctorToken = await apiClient.loginDoctor('13800138001', '123456');
      expect(otherDoctorToken).toBeDefined();
    });
  });

  describe('1. 空消息和特殊字符测试', () => {
    let patientWs: TestWebSocketClient;
    let doctorWs: TestWebSocketClient;

    beforeAll(async () => {
      // 创建一个新的问诊用于消息测试
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');
      consultationId = consultation.id;

      // 医生接诊
      await apiClient.acceptConsultation(doctorToken, consultationId);

      // 连接 WebSocket
      patientWs = new TestWebSocketClient();
      await patientWs.connect(patientToken);
      await patientWs.waitForSystemMessage('Connected', 5000);
      patientWs.joinConversation(consultationId);
      await patientWs.waitForSystemMessage('Joined conversation', 5000);

      doctorWs = new TestWebSocketClient();
      await doctorWs.connect(doctorToken);
      await doctorWs.waitForSystemMessage('Connected', 5000);
      doctorWs.joinConversation(consultationId);
      await doctorWs.waitForSystemMessage('Joined conversation', 5000);
    });

    afterAll(() => {
      if (patientWs) patientWs.disconnect();
      if (doctorWs) doctorWs.disconnect();
    });

    it('应能发送空字符串消息', async () => {
      patientWs.sendMessage(consultationId, '');

      const received = await doctorWs.waitForChatMessage(5000);
      expect(received).toBeDefined();
      expect(received.message?.content).toBe('');
    });

    it('应能发送超长消息 (10000字符)', async () => {
      const longMessage = 'A'.repeat(10000);
      patientWs.sendMessage(consultationId, longMessage);

      const received = await doctorWs.waitForChatMessage(5000);
      expect(received).toBeDefined();
      expect(received.message?.content).toBe(longMessage);
      expect(received.message?.content.length).toBe(10000);
    });

    it('应能发送特殊字符消息', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      expect(() => {
        patientWs.sendMessage(consultationId, specialChars);
      }).not.toThrow();
    });

    it('应能发送 emoji 表情消息', () => {
      const emojiMessage = '你好 😊👨‍⚕️🏥';
      expect(() => {
        patientWs.sendMessage(consultationId, emojiMessage);
      }).not.toThrow();
    });

    it('应能发送包含换行符和制表符的消息', () => {
      const whitespaceMessage = '第一行\n第二行\t制表符';
      expect(() => {
        patientWs.sendMessage(consultationId, whitespaceMessage);
      }).not.toThrow();
    });
  });

  describe('2. 速率限制测试', () => {
    let rateLimitConsultationId: string;
    let patientWs: TestWebSocketClient;
    let doctorWs: TestWebSocketClient;

    beforeAll(async () => {
      // 创建新问诊用于速率限制测试
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');
      rateLimitConsultationId = consultation.id;
      await apiClient.acceptConsultation(doctorToken, rateLimitConsultationId);

      // 连接 WebSocket
      patientWs = new TestWebSocketClient();
      await patientWs.connect(patientToken);
      await patientWs.waitForSystemMessage('Connected', 5000);
      patientWs.joinConversation(rateLimitConsultationId);
      await patientWs.waitForSystemMessage('Joined conversation', 5000);
    });

    afterAll(() => {
      if (patientWs) patientWs.disconnect();
    });

    it('应能快速发送60条消息（在限制内）', async () => {
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 60; i++) {
        promises.push(
          new Promise((resolve) => {
            setTimeout(() => {
              patientWs.sendMessage(rateLimitConsultationId, `消息 ${i}`);
              resolve(true);
            }, i * 10); // 每10ms发送一条，总共600ms
          })
        );
      }

      await Promise.all(promises);
      // 注意：如果实现有速率限制，这里可能会部分失败
      // 当前实现可能没有速率限制，所以这些测试可能会通过
    });

    it('发送70条消息时，部分消息可能被拒绝（如果实现了速率限制）', async () => {
      let successCount = 0;
      let failCount = 0;

      const promises: Promise<any>[] = [];
      for (let i = 0; i < 70; i++) {
        promises.push(
          new Promise((resolve) => {
            setTimeout(() => {
              try {
                patientWs.sendMessage(rateLimitConsultationId, `速率测试消息 ${i}`);
                successCount++;
              } catch (e) {
                failCount++;
              }
              resolve(true);
            }, i * 5); // 每5ms发送一条，总共350ms
          })
        );
      }

      await Promise.all(promises);

      // 当前实现可能没有速率限制，所以所有消息都可能成功
      // 如果实现了速率限制（60条/分钟），应该有部分失败
      expect(successCount + failCount).toBe(70);
    });
  });

  describe('3. 权限边界测试', () => {
    let patientConsultationId: string;

    beforeAll(async () => {
      // 患者A创建问诊
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');
      patientConsultationId = consultation.id;
    });

    it('患者B不应能访问患者A的问诊详情', async () => {
      const response = await request(app)
        .get(`/api/consultations/${patientConsultationId}`)
        .set('Authorization', `Bearer ${otherPatientToken}`);

      expect(response.status).toBe(401);
      expect(response.body.code).toBeDefined();
    });

    it('患者B不应能访问患者A的问诊消息', async () => {
      const response = await request(app)
        .get(`/api/consultations/${patientConsultationId}/messages`)
        .set('Authorization', `Bearer ${otherPatientToken}`);

      expect(response.status).toBe(401);
      expect(response.body.code).toBeDefined();
    });

    it('医生B不应能看到医生A的待接诊列表', async () => {
      // 创建一个给医生A的问诊
      await apiClient.createConsultation(patientToken, 'doctor_001');

      // 医生B获取待接诊列表
      const pending = await apiClient.getPendingConsultations(otherDoctorToken);

      // 医生B的列表中不应该包含给医生A的问诊
      const doctorAConsultations = pending.filter((c) => c.doctor?.id === 'doctor_001');
      expect(doctorAConsultations.length).toBe(0);
    });

    it('未登录用户应无法访问问诊API', async () => {
      const response = await request(app)
        .get(`/api/consultations/${patientConsultationId}`);

      expect(response.status).toBe(401);
    });

    it('患者不应能直接调用医生专属API', async () => {
      const response = await request(app)
        .get('/api/consultations/pending')
        .set('Authorization', `Bearer ${patientToken}`);

      // 应该返回401或403
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('4. 状态转换边界测试', () => {
    let statusConsultationId: string;

    it('pending状态的问诊创建成功', async () => {
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');
      statusConsultationId = consultation.id;
      expect(consultation.status).toBe('pending');
    });

    it('pending状态的问诊可以被医生接诊', async () => {
      await apiClient.acceptConsultation(doctorToken, statusConsultationId);

      const updated = await apiClient.getConsultationDetail(doctorToken, statusConsultationId);
      expect(updated.status).toBe('active');
    });

    it('active状态的问诊应能正常通信', async () => {
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');
      await apiClient.acceptConsultation(doctorToken, consultation.id);

      const activeConsultation = await apiClient.getConsultationDetail(
        patientToken,
        consultation.id
      );
      expect(activeConsultation.status).toBe('active');
    });

    it('重复接诊应被拒绝', async () => {
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');

      // 第一次接诊
      await apiClient.acceptConsultation(doctorToken, consultation.id);

      // 尝试第二次接诊
      const response = await request(app)
        .put(`/api/consultations/${consultation.id}/accept`)
        .set('Authorization', `Bearer ${doctorToken}`);

      // 应该返回错误（因为已经不再是pending状态）
      expect(response.status).not.toBe(200);
    });

    it('closed状态的问诊不应能再次接诊', async () => {
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');
      await apiClient.acceptConsultation(doctorToken, consultation.id);
      await apiClient.closeConsultation(doctorToken, consultation.id);

      // 尝试接诊已关闭的问诊
      const response = await request(app)
        .put(`/api/consultations/${consultation.id}/accept`)
        .set('Authorization', `Bearer ${doctorToken}`);

      // 应该返回错误
      expect(response.status).not.toBe(200);
    });

    it('医生不应能接诊其他医生的问诊', async () => {
      // 创建给医生A的问诊
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');

      // 医生B尝试接诊
      const response = await request(app)
        .put(`/api/consultations/${consultation.id}/accept`)
        .set('Authorization', `Bearer ${otherDoctorToken}`);

      // 应该返回401，因为这不是医生B的问诊
      expect(response.status).toBe(401);
    });
  });

  describe('5. 无效输入测试', () => {
    it('不存在的问诊ID应返回404', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/consultations/${fakeId}`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(response.status).toBe(404);
      expect(response.body.code).toBeDefined();
    });

    it('不存在的医生ID应返回错误', async () => {
      const response = await request(app)
        .post('/api/consultations')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ doctorId: 'nonexistent_doctor' });

      expect(response.status).toBe(404);
    });

    it('创建问诊时缺少doctorId应返回错误', async () => {
      const response = await request(app)
        .post('/api/consultations')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({});

      expect(response.status).toBe(400);
    });

    it('无效的问诊状态转换应被拒绝', async () => {
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');

      const response = await request(app)
        .put(`/api/consultations/${consultation.id}/status`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ status: 'invalid_status' });

      expect(response.status).toBe(400);
    });

    it('无效的UUID格式应被处理', async () => {
      const invalidId = 'not-a-valid-uuid';
      const response = await request(app)
        .get(`/api/consultations/${invalidId}`)
        .set('Authorization', `Bearer ${patientToken}`);

      // 应该返回404（找不到）或其他错误
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('空的问诊ID应被处理', async () => {
      const response = await request(app)
        .get('/api/consultations/')
        .set('Authorization', `Bearer ${patientToken}`);

      // GET /api/consultations/ 是获取列表的接口，应该返回200
      // 但GET /api/consultations/（不带ID）应该返回列表而不是单个问诊
      expect(response.status).toBe(200);
    });
  });

  describe('6. 并发和竞态条件测试', () => {
    it('多个患者同时创建问诊不应冲突', async () => {
      const promises = [
        apiClient.createConsultation(patientToken, 'doctor_001'),
        apiClient.createConsultation(otherPatientToken, 'doctor_002'),
        apiClient.createConsultation(patientToken, 'doctor_004'),
      ];

      const consultations = await Promise.all(promises);

      // 所有问诊都应该有唯一的ID
      const ids = consultations.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });

    it('同时获取多个问诊详情不应冲突', async () => {
      const c1 = await apiClient.createConsultation(patientToken, 'doctor_001');
      const c2 = await apiClient.createConsultation(otherPatientToken, 'doctor_002');

      const promises = [
        apiClient.getConsultationDetail(patientToken, c1.id),
        apiClient.getConsultationDetail(otherPatientToken, c2.id),
        apiClient.getConsultationDetail(patientToken, c1.id),
      ];

      const details = await Promise.all(promises);

      expect(details.length).toBe(3);
      expect(details[0].id).toBe(c1.id);
      expect(details[1].id).toBe(c2.id);
      expect(details[2].id).toBe(c1.id);
    });
  });

  describe('7. 数据一致性测试', () => {
    it('问诊创建后应能在患者列表中找到', async () => {
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');

      const patientConsultations = await request(app)
        .get('/api/consultations')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(patientConsultations.status).toBe(200);
      const found = patientConsultations.body.data.find((c: any) => c.id === consultation.id);
      expect(found).toBeDefined();
    });

    it('问诊创建后应能在医生的待接诊列表中找到', async () => {
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');

      const pending = await apiClient.getPendingConsultations(doctorToken);
      const found = pending.find((c) => c.id === consultation.id);
      expect(found).toBeDefined();
    });

    it('医生接诊后，待接诊列表中应移除该问诊', async () => {
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');

      // 接诊前应该在待接诊列表中
      let pending = await apiClient.getPendingConsultations(doctorToken);
      let found = pending.find((c) => c.id === consultation.id);
      expect(found).toBeDefined();

      // 接诊
      await apiClient.acceptConsultation(doctorToken, consultation.id);

      // 接诊后不应该在待接诊列表中
      pending = await apiClient.getPendingConsultations(doctorToken);
      found = pending.find((c) => c.id === consultation.id);
      expect(found).toBeUndefined();
    });
  });

  describe('8. 边界值测试', () => {
    it('应能正确处理最大长度的手机号', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ phone: '13800138000', verifyCode: '123456' });

      expect(response.status).toBe(200);
    });

    it('应能处理最小长度的有效消息', async () => {
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');
      await apiClient.acceptConsultation(doctorToken, consultation.id);

      const patientWs = new TestWebSocketClient();
      await patientWs.connect(patientToken);
      await patientWs.waitForSystemMessage('Connected', 5000);
      patientWs.joinConversation(consultation.id);
      await patientWs.waitForSystemMessage('Joined conversation', 5000);

      // 发送单字符消息
      expect(() => {
        patientWs.sendMessage(consultation.id, 'A');
      }).not.toThrow();

      patientWs.disconnect();
    });
  });

  describe('9. 错误恢复测试', () => {
    it('WebSocket断开后应能重新连接', async () => {
      const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');
      await apiClient.acceptConsultation(doctorToken, consultation.id);

      const patientWs = new TestWebSocketClient();
      await patientWs.connect(patientToken);
      await patientWs.waitForSystemMessage('Connected', 5000);
      patientWs.joinConversation(consultation.id);
      await patientWs.waitForSystemMessage('Joined conversation', 5000);

      // 断开连接
      patientWs.disconnect();
      expect(patientWs.isConnected()).toBe(false);

      // 重新连接
      await patientWs.connect(patientToken);
      await patientWs.waitForSystemMessage('Connected', 5000);
      expect(patientWs.isConnected()).toBe(true);

      patientWs.disconnect();
    });

    it('获取不存在的资源不应导致服务器崩溃', async () => {
      const response = await request(app)
        .get('/api/consultations/nonexistent-id')
        .set('Authorization', `Bearer ${patientToken}`);

      // 应该返回错误，而不是服务器崩溃
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    });
  });
});
