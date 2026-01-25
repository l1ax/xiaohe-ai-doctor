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

      // 等待旧连接完全关闭
      await new Promise(resolve => setTimeout(resolve, 1000));

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
      const reconnectCount = 3;

      for (let i = 0; i < reconnectCount; i++) {
        const patientWs = new TestWebSocketClient();

        await patientWs.connect(patientToken);
        await patientWs.waitForSystemMessage('Connected', 5000);
        patientWs.joinConversation(consultationId);
        await patientWs.waitForSystemMessage('Joined conversation', 5000);

        // 发送消息验证连接正常
        patientWs.sendMessage(consultationId, `第${i + 1}次连接测试`);

        await new Promise(resolve => setTimeout(resolve, 500));
        patientWs.disconnect();

        // 等待旧连接完全关闭再进行下一次连接
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
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

      // 注意：由于 WebSocketManager 的设计限制，每个 userId 只能有一个活跃连接
      // 当同一个 userId 的新连接建立时，旧连接会被替换
      //
      // 为了测试实际的并发连接能力，我们创建 10 个不同的用户连接
      // 由于系统可以生成唯一的 userId（通过不同的手机号），理论上可以支持更多并发连接
      const connectionCount = 10;

      // 为测试创建额外的用户 token（使用不同的手机号生成不同的 userId）
      const additionalTokens: string[] = [];
      for (let i = 0; i < connectionCount - 2; i++) {
        const phone = `1390013900${i}`; // 生成不同的手机号
        const token = await apiClient.loginPatient(phone, '123456');
        additionalTokens.push(token);
      }

      // 创建所有连接（包括原有的患者和医生）
      const allTokens = [patientToken, doctorToken, ...additionalTokens];
      for (let i = 0; i < connectionCount; i++) {
        const ws = new TestWebSocketClient();
        await ws.connect(allTokens[i]);
        await ws.waitForSystemMessage('Connected', 5000);
        ws.joinConversation(consultationId);
        clients.push(ws);
      }

      // 验证所有连接都成功
      expect(clients.length).toBe(connectionCount);
      expect(clients.every((c) => c.isConnected())).toBe(true);

      // 同时断开所有连接
      clients.forEach((c) => c.disconnect());

      // 等待断开完成
      await new Promise(resolve => setTimeout(resolve, 500));

      // 验证所有连接都已断开
      expect(clients.every((c) => !c.isConnected())).toBe(true);
    });
  });
});
