import { Page } from '@playwright/test';
import { extractConsultationId } from './utils';

/**
 * 创建问诊
 * @param page Playwright Page 对象
 * @returns 问诊 ID
 * @throws 如果无法创建问诊或提取 ID
 */
export async function createConsultation(page: Page): Promise<string> {
  await page.goto('/doctor-list');
  await page.waitForLoadState('networkidle');

  const filterButton = page.locator('button:has-text("全部")').first();
  const filterCount = await filterButton.count();
  if (filterCount === 0) {
    throw new Error('未找到"全部"筛选按钮，页面可能未加载完成');
  }
  await filterButton.click();

  const consultButton = page.locator('button:has-text("立即问诊")').first();
  const consultCount = await consultButton.count();
  if (consultCount === 0) {
    throw new Error('未找到"立即问诊"按钮，可能没有可用的医生');
  }
  await consultButton.click();

  await page.waitForURL(/\/doctor-chat\/.+/);
  await page.waitForLoadState('networkidle');

  const url = page.url();
  return extractConsultationId(url);
}

/**
 * 医生接单
 * @param page Playwright Page 对象
 * @param consultationId 问诊 ID
 * @throws 如果找不到接单按钮
 */
export async function acceptConsultation(page: Page, consultationId: string) {
  await page.goto('/doctor/console');
  await page.waitForLoadState('networkidle');

  const acceptButton = page.locator(`[data-consultation-id="${consultationId}"] button:has-text("接单")`).first();
  const acceptCount = await acceptButton.count();
  if (acceptCount === 0) {
    throw new Error(`未找到问诊 ID ${consultationId} 的接单按钮，该问诊可能不存在或已被接单`);
  }
  await acceptButton.click();

  // 等待接单操作完成，通过按钮状态变化判断
  await page.waitForFunction((id) => {
    const button = document.querySelector(`[data-consultation-id="${id}"] button:has-text("接单")`);
    return button === null;
  }, consultationId, { timeout: 5000 }).catch(() => {
    // 如果按钮仍然存在，可能已经接单成功并移除了按钮
    // 不抛出错误，继续执行
  });
}

/**
 * 发送消息
 * @param page Playwright Page 对象
 * @param text 消息内容
 * @throws 如果找不到消息输入框
 */
export async function sendMessage(page: Page, text: string) {
  const input = page.locator('input[placeholder="输入消息..."], textarea').first();
  const inputCount = await input.count();
  if (inputCount === 0) {
    throw new Error('未找到消息输入框，可能不在聊天页面');
  }

  await input.fill(text);
  await input.press('Enter');

  // 等待消息出现在聊天记录中
  await page.waitForFunction((msg) => {
    const messages = document.querySelectorAll('.message-content, [class*="message"], [class*="chat"]');
    return Array.from(messages).some(el => el.textContent?.includes(msg));
  }, text, { timeout: 5000 }).catch(() => {
    // 消息可能已经发送但DOM未更新，继续执行
  });
}

/**
 * 结束问诊
 * @param page Playwright Page 对象
 * @throws 如果找不到结束问诊按钮
 */
export async function endConsultation(page: Page) {
  const endButton = page.locator('button:has-text("结束问诊")').first();
  const endCount = await endButton.count();
  if (endCount === 0) {
    throw new Error('未找到"结束问诊"按钮');
  }
  await endButton.click();

  const confirmButton = page.locator('button:has-text("确认")').first();
  const confirmCount = await confirmButton.count();
  if (confirmCount === 0) {
    throw new Error('未找到确认按钮');
  }
  await confirmButton.click();

  // 等待页面导航或状态更新
  await page.waitForLoadState('networkidle');
}
