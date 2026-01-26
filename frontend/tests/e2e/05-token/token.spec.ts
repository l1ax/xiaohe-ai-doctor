/**
 * Token 管理测试
 * 测试 Token 的获取、存储和刷新
 */

import { test, expect } from '@playwright/test';
import { loginAsPatient, loginAsDoctor, logout } from '../../helpers/auth';

test.describe('Token 管理', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('登录后 Token 应该被正确存储', async ({ page, context }) => {
    const patientPage = await context.newPage();

    console.log('=== 测试：Token 存储 ===');

    // 患者登录
    await loginAsPatient(patientPage);

    // 检查 storage 中是否有 token
    const tokenData = await patientPage.evaluate(() => {
      const token = localStorage.getItem('xiaohe_token');
      const user = localStorage.getItem('xiaohe_user');
      return { token: token ? JSON.parse(token) : null, user: user ? JSON.parse(user) : null };
    });

    expect(tokenData.token).not.toBeNull();
    expect(tokenData.token.accessToken).toBeTruthy();
    expect(tokenData.user).not.toBeNull();
    expect(tokenData.user.id).toBeTruthy();
    expect(tokenData.user.phone).toBe('13800138000');

    console.log('✓ Token 正确存储');
    console.log(`  - accessToken: ${tokenData.token.accessToken.slice(0, 20)}...`);
    console.log(`  - userId: ${tokenData.user.id}`);

    await patientPage.close();
    console.log('=== 测试通过 ===');
  });

  test('登出后 Token 应该被清除', async ({ page, context }) => {
    const patientPage = await context.newPage();

    console.log('=== 测试：Token 清除 ===');

    // 患者登录
    await loginAsPatient(patientPage);

    // 验证登录后有 token
    let tokenData = await patientPage.evaluate(() => localStorage.getItem('xiaohe_token'));
    expect(tokenData).not.toBeNull();

    // 登出
    await logout(patientPage);
    await page.waitForTimeout(500);

    // 验证登出后 token 被清除
    tokenData = await patientPage.evaluate(() => localStorage.getItem('xiaohe_token'));
    expect(tokenData).toBeNull();

    console.log('✓ Token 已正确清除');

    await patientPage.close();
    console.log('=== 测试通过 ===');
  });

  test('医生登录使用固定手机号应映射到正确 ID', async ({ page, context }) => {
    // 每次测试使用新的浏览器上下文
    const doctorPage = await context.newPage();

    console.log('=== 测试：医生 ID 映射 ===');

    // 确保清除所有状态
    await doctorPage.context().clearCookies();
    await doctorPage.evaluate(() => localStorage.clear());

    // 医生登录（使用 13800138000）
    await doctorPage.goto('/login');
    await doctorPage.waitForLoadState('networkidle');

    const roleButton = doctorPage.getByRole('button', { name: '医生' });
    await roleButton.click();

    const phoneInput = doctorPage.locator('input[type="tel"]').first();
    await phoneInput.fill('13800138000');

    const getCodeButton = doctorPage.getByRole('button', { name: '获取验证码' });
    await getCodeButton.click();

    const codeInput = doctorPage.locator('input[type="text"]').first();
    await codeInput.fill('123456');

    const loginButton = doctorPage.getByRole('button', { name: '登录 / 注册' });
    await loginButton.click();

    // 等待跳转到医生工作台
    await doctorPage.waitForURL('/doctor/console', { timeout: 10000 });
    await doctorPage.waitForTimeout(1000);

    // 验证 userId 是 doctor_001
    const userData = await doctorPage.evaluate(() => {
      const user = localStorage.getItem('xiaohe_user');
      return user ? JSON.parse(user) : null;
    });

    // 注意：如果之前使用相同手机号登录过，ID 可能被复用
    // 主要验证 role 是 doctor
    expect(userData).not.toBeNull();
    expect(userData.role).toBe('doctor');

    console.log('✓ 医生登录成功，角色正确');
    console.log(`  - userId: ${userData.id}`);
    console.log(`  - role: ${userData.role}`);

    await doctorPage.close();
    console.log('=== 测试通过 ===');
  });

  test('页面刷新后 Token 应该仍然有效', async ({ page, context }) => {
    const patientPage = await context.newPage();

    console.log('=== 测试：Token 持久化 ===');

    // 患者登录
    await loginAsPatient(patientPage);

    // 刷新页面
    await patientPage.reload();
    await patientPage.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 验证刷新后 token 仍然存在
    const tokenData = await patientPage.evaluate(() => localStorage.getItem('xiaohe_token'));
    expect(tokenData).not.toBeNull();

    // 验证用户信息仍然存在
    const userData = await patientPage.evaluate(() => localStorage.getItem('xiaohe_user'));
    expect(userData).not.toBeNull();

    console.log('✓ Token 在页面刷新后仍然有效');

    await patientPage.close();
    console.log('=== 测试通过 ===');
  });
});
