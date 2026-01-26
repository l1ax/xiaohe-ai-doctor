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

  // 等待跳转到首页
  await page.waitForURL('/', { timeout: 10000 });

  // 等待 React 状态更新和 storage 写入完成
  await page.waitForTimeout(1000);

  // 验证 storage 中有 token
  const tokenData = await page.evaluate(() => {
    const token = localStorage.getItem('xiaohe_token');
    const user = localStorage.getItem('xiaohe_user');
    return { token: token ? JSON.parse(token) : null, user: user ? JSON.parse(user) : null };
  });
  console.log('患者登录后 token:', tokenData.token ? '存在' : '不存在');
  console.log('患者 user:', tokenData.user);
}

/**
 * 医生登录辅助函数
 * 使用固定的测试医生手机号（13800138000），会被映射到 doctor_001
 * @param page Playwright Page 对象
 * @throws 如果登录流程中任何步骤失败
 */
export async function loginAsDoctor(page: Page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  const roleButton = page.getByRole('button', { name: '医生' });
  await roleButton.click();

  const phoneInput = page.locator('input[type="tel"]').first();
  // 使用 13800138000，这个手机号会被映射到 doctor_001
  await phoneInput.fill('13800138000');

  const getCodeButton = page.getByRole('button', { name: '获取验证码' });
  await getCodeButton.click();

  const codeInput = page.locator('input[type="text"]').first();
  await codeInput.fill('123456');

  const loginButton = page.getByRole('button', { name: '登录 / 注册' });
  await loginButton.click();

  // 等待跳转到医生工作台
  await page.waitForURL('/doctor/console', { timeout: 10000 });

  // 等待 React 状态更新和 storage 写入完成
  await page.waitForTimeout(1000);

  // 验证 storage 中有 token
  const tokenData = await page.evaluate(() => {
    const token = localStorage.getItem('xiaohe_token');
    const user = localStorage.getItem('xiaohe_user');
    return { token: token ? JSON.parse(token) : null, user: user ? JSON.parse(user) : null };
  });
  console.log('医生登录后 token:', tokenData.token ? '存在' : '不存在');
  console.log('医生 user:', tokenData.user);
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
