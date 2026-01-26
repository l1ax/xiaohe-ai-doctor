import { Page } from '@playwright/test';

/**
 * 患者登录辅助函数
 * @param page Playwright Page 对象
 * @throws 如果登录流程中任何步骤失败
 */
export async function loginAsPatient(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  const phoneInput = page.locator('input[type="tel"]').first();
  await phoneInput.fill('13800138000');

  const getCodeButton = page.getByRole('button', { name: '获取验证码' });
  await getCodeButton.click();

  const codeInput = page.locator('input[type="text"]').first();
  await codeInput.fill('123456');

  const loginButton = page.getByRole('button', { name: '登录 / 注册' });
  await loginButton.click();

  await page.waitForURL('/', { timeout: 10000 });
}

/**
 * 医生登录辅助函数
 * @param page Playwright Page 对象
 * @throws 如果登录流程中任何步骤失败
 */
export async function loginAsDoctor(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  const roleButton = page.getByRole('button', { name: '医生' });
  await roleButton.click();

  const phoneInput = page.locator('input[type="tel"]').first();
  await phoneInput.fill('13900139000');

  const getCodeButton = page.getByRole('button', { name: '获取验证码' });
  await getCodeButton.click();

  const codeInput = page.locator('input[type="text"]').first();
  await codeInput.fill('123456');

  const loginButton = page.getByRole('button', { name: '登录 / 注册' });
  await loginButton.click();

  await page.waitForURL('/doctor/console', { timeout: 10000 });
}

/**
 * 登出辅助函数
 * @param page Playwright Page 对象
 */
export async function logout(page: Page) {
  // 清除本地存储
  await page.evaluate(() => localStorage.clear());
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
}
