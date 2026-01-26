import { vi } from 'vitest';

// 全局测试超时设置 - WebSocket 操作可能较慢
vi.setConfig({ testTimeout: 30000 });

// 测试常量配置
export const TEST_CONFIG = {
  WS_URL: process.env.WS_URL || 'ws://localhost:3000/ws',
  API_URL: process.env.API_URL || 'http://localhost:3000',
  TEST_TIMEOUT: 30000,
} as const;

// 测试用的认证信息
export const TEST_USERS = {
  PATIENT: {
    phone: '13900139999',
    code: '123456',
  },
  DOCTOR: {
    phone: '13800138000',
    code: '123456',
  },
} as const;
