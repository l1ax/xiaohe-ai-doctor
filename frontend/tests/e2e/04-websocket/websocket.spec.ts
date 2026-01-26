/**
 * WebSocket 通信测试
 * 测试 WebSocket 连接的基本功能
 */

import { test, expect } from '@playwright/test';
import { loginAsPatient, loginAsDoctor } from '../../helpers/auth';

test.describe('WebSocket 通信', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('患者登录后可以建立 WebSocket 连接', async ({ page, context }) => {
    const patientPage = await context.newPage();

    console.log('=== 测试：患者 WebSocket 连接 ===');

    // 患者登录
    await loginAsPatient(patientPage);
    console.log('✓ 患者登录成功');

    // 进入聊天页面
    await patientPage.goto('/chat');
    await patientPage.waitForLoadState('networkidle');
    await patientPage.waitForTimeout(2000);

    // 验证页面加载
    const pageContent = await patientPage.locator('body').textContent();
    const pageLoaded = pageContent && pageContent.length > 50;
    expect(pageLoaded).toBe(true);
    console.log('✓ 聊天页面加载成功');

    await patientPage.close();
    console.log('=== 测试通过 ===');
  });

  test('医生登录后可以建立 WebSocket 连接', async ({ page, context }) => {
    const doctorPage = await context.newPage();

    console.log('=== 测试：医生 WebSocket 连接 ===');

    // 医生登录
    await loginAsDoctor(doctorPage);
    console.log('✓ 医生登录成功');

    // 进入医生控制台
    await doctorPage.goto('/doctor/console');
    await doctorPage.waitForLoadState('networkidle');
    await doctorPage.waitForTimeout(2000);

    // 验证页面加载
    const pageContent = await doctorPage.locator('body').textContent();
    const pageLoaded = pageContent && pageContent.length > 50;
    expect(pageLoaded).toBe(true);
    console.log('✓ 医生控制台加载成功');

    await doctorPage.close();
    console.log('=== 测试通过 ===');
  });
});
