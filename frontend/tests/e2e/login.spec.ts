import { test, expect } from '@playwright/test';

test.describe('登录流程', () => {
  test.beforeEach(async ({ page }) => {
    // 清除本地存储，确保每次测试从未登录状态开始
    await page.evaluate(() => localStorage.clear());
  });

  test('完整登录流程', async ({ page }) => {
    // 1. 访问首页，未登录应该停留在首页（不会强制跳转）
    await page.goto('/');

    // 2. 点击"我的"跳转到登录页
    await page.click('button:has-text("我的")');
    await expect(page).toHaveURL(/\/login/);

    // 3. 输入手机号
    await page.fill('input[type="tel"]', '13800138000');

    // 4. 点击获取验证码
    await page.click('button:has-text("获取验证码")');

    // 5. 输入验证码 123456
    await page.fill('input[type="text"]', '123456');

    // 6. 点击登录按钮
    await page.click('button:has-text("登录 / 注册")');

    // 7. 登录成功后跳转到首页
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=小禾AI医生')).toBeVisible();
  });

  test('登录后访问 Profile 页面显示用户信息', async ({ page }) => {
    // 先登录
    await page.goto('/login');
    await page.fill('input[type="tel"]', '13800138000');
    await page.click('button:has-text("获取验证码")');
    await page.fill('input[type="text"]', '123456');
    await page.click('button:has-text("登录 / 注册")');
    await page.waitForURL('/');

    // 跳转到 Profile 页面
    await page.click('button:has-text("我的")');

    // 验证用户信息显示
    await expect(page.locator('text=白银会员')).toBeVisible();
    await expect(page.locator('text=138****0000')).toBeVisible();
  });

  test('验证码倒计时功能', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="tel"]', '13800138000');
    await page.click('button:has-text("获取验证码")');

    // 验证倒计时显示
    await expect(page.locator('button:has-text("60s")')).toBeVisible();

    // 60秒后恢复（跳过实际等待，使用较快的方式验证）
    // 这里我们只验证点击后按钮变为禁用状态
    await expect(page.locator('button:has-text("获取验证码")')).toBeDisabled();
  });
});
