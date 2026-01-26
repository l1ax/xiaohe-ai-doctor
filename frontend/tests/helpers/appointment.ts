import { Page } from '@playwright/test';

/**
 * 选择第一个医生
 * @param page Playwright Page 对象
 * @throws 如果找不到医生选项
 */
export async function selectFirstDoctor(page: Page) {
  await page.goto('/appointments/doctors');
  await page.waitForLoadState('networkidle');

  // 尝试展开折叠的科室
  const expandButton = page.locator('span.material-symbols-outlined:has-text("expand_more")').first();
  const hasExpand = await expandButton.count() > 0;

  if (hasExpand) {
    await expandButton.click();
    await page.waitForTimeout(500); // 短暂等待动画完成
  }

  const doctorButton = page.locator('button:has-text("医生")').first();
  const doctorCount = await doctorButton.count();
  if (doctorCount === 0) {
    throw new Error('未找到医生选项，可能没有可用的医生');
  }
  await doctorButton.click();

  // 等待医生详情加载
  await page.waitForLoadState('networkidle');
}

/**
 * 选择第一个可用时间段
 * @param page Playwright Page 对象
 * @throws 如果找不到可用时间段
 */
export async function selectFirstAvailableSlot(page: Page) {
  const slots = page.locator('button:not([disabled])').first();
  const slotCount = await slots.count();
  if (slotCount === 0) {
    throw new Error('未找到可用的时间段');
  }
  await slots.click();

  // 等待时间段选择状态的视觉反馈
  await page.waitForTimeout(500);
}

/**
 * 确认预约
 * @param page Playwright Page 对象
 * @throws 如果找不到确认按钮
 */
export async function confirmAppointment(page: Page) {
  const confirmButton1 = page.locator('button:has-text("确定")').first();
  const confirm1Count = await confirmButton1.count();
  if (confirm1Count === 0) {
    throw new Error('未找到"确定"按钮');
  }
  await confirmButton1.click();

  // 等待可能的二次确认对话框
  await page.waitForTimeout(500);

  const confirmButton2 = page.locator('button:has-text("确认预约")').first();
  const confirm2Count = await confirmButton2.count();

  if (confirm2Count > 0) {
    await confirmButton2.click();
    await page.waitForURL(/\/appointments$/, { timeout: 10000 });
  }
}

/**
 * 获取第一个预约 ID
 * @param page Playwright Page 对象
 * @returns 预约 ID
 * @throws 如果找不到预约卡片
 */
export async function getFirstAppointmentId(page: Page): Promise<string> {
  const card = page.locator('[data-appointment-card]').first();
  const cardCount = await card.count();
  if (cardCount === 0) {
    throw new Error('未找到预约卡片，可能没有预约记录');
  }

  const id = await card.getAttribute('data-appointment-id');
  if (!id) {
    throw new Error('预约卡片缺少 data-appointment-id 属性');
  }
  return id;
}

/**
 * 创建预约
 * @param page Playwright Page 对象
 * @returns 预约 ID
 */
export async function createAppointment(page: Page): Promise<string> {
  await selectFirstDoctor(page);
  await selectFirstAvailableSlot(page);
  await confirmAppointment(page);
  return await getFirstAppointmentId(page);
}
