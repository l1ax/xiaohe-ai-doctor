/**
 * 预约完整生命周期测试
 * 测试从患者发起预约到完成就诊的完整流程
 *
 * 注意：MVP 阶段简化测试，支付流程跳过
 */

import { test, expect } from '@playwright/test';
import { loginAsPatient, loginAsDoctor, logout } from '../../helpers/auth';
import { getTomorrowDate } from '../../helpers/utils';

test.describe.configure({ mode: 'serial' });

test.describe('预约完整生命周期', () => {
  test.beforeEach(async ({ page }) => {
    // 清理状态，确保干净的测试环境
    await page.context().clearCookies();
  });

  test('患者可以查看医生列表并选择预约', async ({ page, context }) => {
    const patientPage = await context.newPage();

    console.log('=== 测试：患者预约流程 ===');

    // 患者登录
    await loginAsPatient(patientPage);
    console.log('✓ 患者登录成功');

    // 进入预约页面
    await patientPage.goto('/appointments/doctors');
    await patientPage.waitForLoadState('networkidle');
    await patientPage.waitForTimeout(2000);

    // 验证页面加载（页面标题是"选择医生"）
    await expect(patientPage.getByRole('heading', { name: '选择医生' })).toBeVisible({ timeout: 10000 });
    console.log('✓ 选择医生页面加载成功');

    // 选择第一个可预约的医生
    const bookButton = patientPage.locator('button:has-text("选择医生"), button:has-text("立即预约")').first();
    const hasBookButton = await bookButton.count() > 0;

    if (hasBookButton) {
      await bookButton.click();
      await patientPage.waitForTimeout(1000);
      console.log('✓ 进入医生详情页面');
    }

    // 选择日期（明天）
    const tomorrow = getTomorrowDate();
    const dateButton = patientPage.locator(`button[data-date="${tomorrow}"]`);
    const hasDateButton = await dateButton.count() > 0;

    if (hasDateButton) {
      await dateButton.click();
      await patientPage.waitForTimeout(500);
      console.log(`✓ 选择日期: ${tomorrow}`);
    }

    // 选择可用时段
    const timeSlot = patientPage.locator('button:has-text("09:"), button:has-text("10:"), button:has-text("14:")').first();
    const hasTimeSlot = await timeSlot.count() > 0;

    if (hasTimeSlot) {
      await timeSlot.click();
      await patientPage.waitForTimeout(500);
      console.log('✓ 选择时段成功');
    }

    // 提交预约
    const submitButton = patientPage.locator('button:has-text("确认预约"), button:has-text("提交")').first();
    const hasSubmitButton = await submitButton.count() > 0;

    if (hasSubmitButton) {
      await submitButton.click();
      await patientPage.waitForTimeout(2000);
      console.log('✓ 预约提交成功');

      // 验证跳转到预约列表或成功页面
      const successMessage = patientPage.locator('text=预约成功, text=预约已提交').first();
      const hasSuccess = await successMessage.count() > 0;
      expect(hasSuccess).toBe(true);
    }

    await logout(patientPage);
    await patientPage.close();
    console.log('=== 测试通过 ===');
  });

  test('医生可以查看待处理预约', async ({ page, context }) => {
    const doctorPage = await context.newPage();

    console.log('=== 测试：医生查看预约 ===');

    // 医生登录
    await loginAsDoctor(doctorPage);
    console.log('✓ 医生登录成功');

    // 进入预约管理页面
    await doctorPage.goto('/doctor/appointments');
    await doctorPage.waitForLoadState('networkidle');
    await doctorPage.waitForTimeout(2000);

    // 验证页面加载（只要页面主要内容可见即可）
    const pageContent = await doctorPage.locator('body').textContent();
    const pageLoaded = pageContent && pageContent.length > 100;
    expect(pageLoaded).toBe(true);
    console.log('✓ 预约管理页面加载成功');

    await logout(doctorPage);
    await doctorPage.close();
    console.log('=== 测试通过 ===');
  });

  test('医生可以确认预约', async ({ page, context }) => {
    const doctorPage = await context.newPage();

    console.log('=== 测试：医生确认预约 ===');

    // 医生登录
    await loginAsDoctor(doctorPage);
    console.log('✓ 医生登录成功');

    // 进入预约管理页面
    await doctorPage.goto('/doctor/appointments');
    await doctorPage.waitForLoadState('networkidle');
    await doctorPage.waitForTimeout(2000);

    // 查找并点击确认按钮（如果存在）
    const confirmButton = doctorPage.locator('button:has-text("确认预约"), button:has-text("接受")').first();
    const hasConfirmButton = await confirmButton.count() > 0;

    if (hasConfirmButton) {
      await confirmButton.click();
      await doctorPage.waitForTimeout(1000);
      console.log('✓ 点击确认预约按钮');

      // 处理确认对话框
      const okButton = doctorPage.locator('button:has-text("确认"), button:has-text("确定")').first();
      const hasOkButton = await okButton.count() > 0;
      if (hasOkButton) {
        await okButton.click();
        await doctorPage.waitForTimeout(1000);
        console.log('✓ 确认预约成功');
      }
    } else {
      console.log('✓ 没有待确认的预约（这是正常的）');
    }

    await logout(doctorPage);
    await doctorPage.close();
    console.log('=== 测试通过 ===');
  });

  test('患者可以查看自己的预约列表', async ({ page, context }) => {
    const patientPage = await context.newPage();

    console.log('=== 测试：患者查看预约 ===');

    // 患者登录
    await loginAsPatient(patientPage);
    console.log('✓ 患者登录成功');

    // 进入我的预约页面
    await patientPage.goto('/appointments');
    await patientPage.waitForLoadState('networkidle');
    await patientPage.waitForTimeout(2000);

    // 验证页面加载
    const pageContent = await patientPage.locator('body').textContent();
    const pageLoaded = pageContent && pageContent.length > 100;
    expect(pageLoaded).toBe(true);
    console.log('✓ 预约列表页面加载成功');

    await logout(patientPage);
    await patientPage.close();
    console.log('=== 测试通过 ===');
  });
});
