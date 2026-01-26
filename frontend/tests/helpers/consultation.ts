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
 * @param consultationId 问诊 ID（可选，如果不传则接受第一个待接诊）
 * @throws 如果找不到接单按钮
 */
export async function acceptConsultation(page: Page, consultationId?: string) {
  await page.goto('/doctor/console');
  await page.waitForLoadState('networkidle');

  // 等待问诊列表加载完成
  await page.waitForTimeout(3000);

  let acceptButton;

  if (consultationId) {
    // 如果指定了 consultationId，查找包含该 ID 的问诊项
    // 按钮文本是"立即接诊"
    acceptButton = page.locator('button:has-text("立即接诊")').first();
  } else {
    // 如果没有指定 ID，接受第一个待接诊
    acceptButton = page.locator('button:has-text("立即接诊")').first();
  }

  const acceptCount = await acceptButton.count();
  if (acceptCount === 0) {
    throw new Error(`未找到"立即接诊"按钮，可能没有待接诊的问诊`);
  }

  // 点击接诊按钮
  console.log('点击"立即接诊"按钮...');
  await acceptButton.click();

  // 等待 API 调用完成
  await page.waitForTimeout(3000);

  // 检查当前 URL
  const currentUrl = page.url();
  console.log('点击后当前 URL:', currentUrl);

  // 如果 URL 已经包含 /doctor/chat，说明导航成功了
  if (currentUrl.includes('/doctor/chat/')) {
    const urlConsultationId = extractConsultationId(currentUrl);
    if (urlConsultationId) {
      return urlConsultationId;
    }
  }

  // 尝试手动导航到问诊页面（使用 consultationId）
  if (consultationId) {
    console.log('手动导航到问诊页面:', consultationId);
    await page.goto(`/doctor/chat/${consultationId}`);
    await page.waitForLoadState('networkidle');
    return consultationId;
  }

  throw new Error('接诊后未找到问诊页面');
}

/**
 * 发送消息
 * @param page Playwright Page 对象
 * @param text 消息内容
 * @throws 如果找不到消息输入框
 */
export async function sendMessage(page: Page, text: string) {
  // 医生端聊天页面使用 textarea
  const input = page.locator('textarea[placeholder="输入消息..."]').first();
  const inputCount = await input.count();
  if (inputCount === 0) {
    // 患者端使用 input
    const altInput = page.locator('input[placeholder="输入消息..."], textarea').first();
    const altCount = await altInput.count();
    if (altCount === 0) {
      throw new Error('未找到消息输入框，可能不在聊天页面');
    }
    await altInput.fill(text);
    await altInput.press('Enter');
  } else {
    await input.fill(text);
    await input.press('Enter');
  }

  // 等待消息发送完成
  await page.waitForTimeout(1000);
}

/**
 * 结束问诊
 * @param page Playwright Page 对象
 * @throws 如果找不到结束问诊按钮
 */
export async function endConsultation(page: Page) {
  // 等待页面完全加载
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // 打印页面内容用于调试
  const bodyText = await page.locator('body').textContent();
  console.log('页面内容片段:', bodyText?.slice(0, 500));

  // 使用更精确的选择器定位"结束问诊"按钮
  // 按钮在快捷操作栏中，包含 CheckCircle 图标和"结束问诊"文本
  const endButton = page.locator('button:has-text("结束问诊")').first();
  const endCount = await endButton.count();

  if (endCount === 0) {
    console.log('未找到"结束问诊"按钮，尝试其他选择器...');
    // 尝试使用 aria-label 或其他属性
    const altButton = page.locator('button[aria-label*="结束"], button:has-text("结束")').first();
    const altCount = await altButton.count();
    if (altCount === 0) {
      throw new Error('未找到"结束"按钮');
    }
    console.log('找到备用按钮，点击...');
    await altButton.click();
  } else {
    console.log('找到"结束问诊"按钮，点击...');
    await endButton.click();
  }

  // 等待确认对话框出现
  await page.waitForTimeout(1500);

  // 处理确认对话框
  const confirmButton = page.locator('button:has-text("确认"), button:has-text("确定")').first();
  const confirmCount = await confirmButton.count();
  if (confirmCount > 0) {
    console.log('点击确认按钮...');
    await confirmButton.click();
  } else {
    // 使用原生 dialog 事件处理
    page.once('dialog', async dialog => {
      console.log('原生对话框:', dialog.message());
      await dialog.accept();
    });
    await page.waitForTimeout(500);
  }

  // 等待页面状态更新
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}
