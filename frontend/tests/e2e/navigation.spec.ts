import { test, expect } from '@playwright/test';

test.describe('页面跳转', () => {
  test.beforeEach(async ({ page }) => {
    // 先登录
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13800138000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
  });

  test('底部导航切换', async ({ page }) => {
    // 首页
    await expect(page).toHaveURL('/');

    // 切换到问诊
    await page.locator('button:has-text("问诊")').click();
    await expect(page).toHaveURL('/consultations');

    // 切换到挂号
    await page.locator('button:has-text("挂号")').click();
    await expect(page).toHaveURL('/appointments/doctors');

    // 切换到我的
    await page.locator('button:has-text("我的")').click();
    await expect(page).toHaveURL('/profile');
  });

  test('功能入口跳转', async ({ page }) => {
    await page.locator('button:has-text("我的")').click();

    // 点击我的预约
    await page.locator('text=我的预约').first().click();
    await expect(page).toHaveURL('/appointments');
    await expect(page.locator('text=我的预约').first()).toBeVisible();

    // 返回 Profile
    await page.locator('button:has-text("我的")').click();

    // 点击问诊记录
    await page.locator('text=问诊记录').first().click();
    await expect(page).toHaveURL('/consultations');
  });

  test('设置页面功能', async ({ page }) => {
    await page.locator('button:has-text("我的")').click();
    await page.locator('text=设置').first().click();

    // 验证设置页面
    await expect(page.locator('h1:has-text("设置")').first()).toBeVisible();
    await expect(page.locator('text=深色模式').first()).toBeVisible();
    await expect(page.locator('text=退出登录').first()).toBeVisible();
  });

  test('主题切换功能', async ({ page }) => {
    await page.locator('button:has-text("我的")').click();
    await page.locator('text=设置').first().click();

    // 点击深色模式切换
    await page.locator('button:has-text("深色模式")').click();

    // 验证 HTML 包含 dark 类
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('退出登录功能', async ({ page }) => {
    // 验证登录后访问 Profile
    await page.locator('button:has-text("我的")').click();
    await expect(page).toHaveURL('/profile');
    await expect(page.locator('text=白银会员').first()).toBeVisible();

    // 退出登录
    await page.locator('text=设置').first().click();
    await page.locator('text=退出登录').first().click();

    // 验证跳转到登录页
    await expect(page).toHaveURL(/\/login/);
  });
});
