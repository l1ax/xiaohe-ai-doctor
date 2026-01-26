import { Page } from '@playwright/test';
import { getTomorrowDate } from './utils';

/**
 * 等待 WebSocket 连接建立
 * @param page Playwright Page 对象
 * @param timeout 超时时间（毫秒）
 * @returns 是否连接成功
 */
export async function waitForWebSocketConnection(page: Page, timeout = 5000): Promise<boolean> {
  try {
    await page.waitForFunction(() => {
      return (window as any).wsConnected === true;
    }, { timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * 模拟 WebSocket 断开连接
 * @param page Playwright Page 对象
 */
export async function simulateDisconnect(page: Page) {
  await page.evaluate(() => {
    const ws = (window as any).websocketInstance;
    if (ws) {
      ws.close();
    }
  });
}

/**
 * 模拟 WebSocket 重新连接
 * @param page Playwright Page 对象
 */
export async function simulateReconnect(page: Page) {
  await page.evaluate(() => {
    const ws = (window as any).websocketInstance;
    if (ws && ws.reconnect) {
      ws.reconnect();
    }
  });
}

// 重新导出 getTomorrowDate 以保持向后兼容
export { getTomorrowDate };
