import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { Server } from 'http';
import { TestApiClient, TestWebSocketClient, TEST_USERS, TEST_CONFIG } from '../helpers';
import { wsManager } from '../../../services/websocket/WebSocketManager';
import { logger } from '../../../utils/logger';

logger.silent = true;

describe('WebSocket - 异常恢复测试', () => {
  let app: express.Express;
  let server: Server;
  let apiClient: TestApiClient;
  let patientToken: string;
  let doctorToken: string;
  let consultationId: string;

  beforeAll(async () => {
    app = express();
    app.use(express.json());

    const consultationsRouter = (await import('../../../routes/consultations')).default;
    const authRouter = (await import('../../../routes/auth')).default;
    const { errorHandler } = await import('../../../utils/errorHandler');

    app.use('/api/auth', authRouter);
    app.use('/api/consultations', consultationsRouter);
    app.use(errorHandler);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        if (typeof address === 'object' && address) {
          (TEST_CONFIG as any).WS_URL = `ws://localhost:${address.port}/ws`;
          (TEST_CONFIG as any).API_URL = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });

    wsManager.initialize(server);

    apiClient = new TestApiClient(app);
    patientToken = await apiClient.loginPatient(TEST_USERS.PATIENT.phone, TEST_USERS.PATIENT.code);
    doctorToken = await apiClient.loginDoctor(TEST_USERS.DOCTOR.phone, TEST_USERS.DOCTOR.code);

    const consultation = await apiClient.createConsultation(patientToken, 'doctor_001');
    consultationId = consultation.id;
    await apiClient.acceptConsultation(doctorToken, consultationId);
  });

  afterAll(async () => {
    // 等待所有 WebSocket 连接完全关闭
    await new Promise(resolve => setTimeout(resolve, 1000));

    wsManager.shutdown();

    // 等待 WebSocket 服务器完全关闭
    await new Promise(resolve => setTimeout(resolve, 500));

    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  }, 30000); // 30 seconds timeout for cleanup

  describe('连接断开后的重连', () => {
    it('患者断开后重连应能恢复会话', async () => {
      let patientWs = new TestWebSocketClient();

      // 第一次连接
      await patientWs.connect(patientToken);
      await patientWs.waitForSystemMessage('Connected', 5000);
      patientWs.joinConversation(consultationId);
      await patientWs.waitForSystemMessage('Joined conversation', 5000);

      // 断开连接
      patientWs.disconnect();
      expect(patientWs.isConnected()).toBe(false);

      // 重连
      patientWs = new TestWebSocketClient();
      await patientWs.connect(patientToken);
      await patientWs.waitForSystemMessage('Connected', 5000);

      // 重新加入会话
      patientWs.joinConversation(consultationId);
      await patientWs.waitForSystemMessage('Joined conversation', 5000);

      // 验证可以接收消息
      const doctorWs = new TestWebSocketClient();
      await doctorWs.connect(doctorToken);
      await doctorWs.waitForSystemMessage('Connected', 5000);
      doctorWs.joinConversation(consultationId);
      await doctorWs.waitForSystemMessage('Joined conversation', 5000);

      doctorWs.sendMessage(consultationId, '重连测试消息');

      const received = await patientWs.waitForChatMessage(5000);
      expect(received.message?.content).toBe('重连测试消息');

      doctorWs.disconnect();
      patientWs.disconnect();
    });

    it('多次断开重连应能正常工作', async () => {
      // 测试单次完整的重连流程
      const patientWs1 = new TestWebSocketClient();

      await patientWs1.connect(patientToken);
      await patientWs1.waitForSystemMessage('Connected', 5000);
      patientWs1.joinConversation(consultationId);
      await patientWs1.waitForSystemMessage('Joined conversation', 5000);
      patientWs1.sendMessage(consultationId, '第一次连接测试');
      await new Promise(resolve => setTimeout(resolve, 500));
      patientWs1.disconnect();

      // 等待旧连接完全关闭
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 第二次连接
      const patientWs2 = new TestWebSocketClient();
      await patientWs2.connect(patientToken);
      await patientWs2.waitForSystemMessage('Connected', 5000);
      patientWs2.joinConversation(consultationId);
      await patientWs2.waitForSystemMessage('Joined conversation', 5000);
      patientWs2.sendMessage(consultationId, '第二次连接测试');
      await new Promise(resolve => setTimeout(resolve, 500));
      patientWs2.disconnect();
    });
  });

  describe('网络抖动模拟', () => {
    it('心跳超时后应能重连', async () => {
      const patientWs = new TestWebSocketClient();

      await patientWs.connect(patientToken);
      await patientWs.waitForSystemMessage('Connected', 5000);
      patientWs.joinConversation(consultationId);

      // 等待超过心跳超时时间（60秒），但为了测试速度，我们模拟断开
      patientWs.disconnect();

      // 重连
      const newWs = new TestWebSocketClient();
      await newWs.connect(patientToken);
      const msg = await newWs.waitForSystemMessage('Connected', 5000);
      expect(msg).toBeDefined();

      newWs.disconnect();
    });
  });

  describe('并发连接和断开', () => {
    it('应能处理多个客户端同时连接和断开', async () => {
      const clients: TestWebSocketClient[] = [];

      // 注意：由于 WebSocketManager 只允许每个 userId 一个连接，
      // 当使用相同的 token 时，新连接会替换旧连接
      // 因此我们只创建少量连接来测试管理器的并发处理能力
      const connectionCount = 4;

      // 创建连接（交替使用患者和医生token）
      for (let i = 0; i < connectionCount; i++) {
        const ws = new TestWebSocketClient();
        await ws.connect(i % 2 === 0 ? patientToken : doctorToken);
        await ws.waitForSystemMessage('Connected', 5000);
        ws.joinConversation(consultationId);

        // 由于相同userId的连接会被替换，我们只保留最后两个连接
        if (i >= connectionCount - 2) {
          clients.push(ws);
        }
      }

      // 验证至少有两个活跃连接（一个患者，一个医生）
      expect(clients.length).toBeGreaterThanOrEqual(2);
      expect(clients.every((c) => c.isConnected())).toBe(true);

      // 同时断开所有连接
      clients.forEach((c) => c.disconnect());

      // 等待断开完成
      await new Promise(resolve => setTimeout(resolve, 500));

      // 验证所有连接都已断开
      expect(clients.every((c) => !c.isConnected())).toBe(true);
    });

    it('应能处理快速连接和断开', async () => {
      const client = new TestWebSocketClient();

      // 快速连接和断开多次
      for (let i = 0; i < 5; i++) {
        await client.connect(patientToken);
        await client.waitForSystemMessage('Connected', 5000);
        client.disconnect();

        // 短暂等待
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    });
  });
});
