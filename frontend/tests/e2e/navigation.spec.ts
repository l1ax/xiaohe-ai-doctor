import { test, expect } from '@playwright/test';

test.describe('页面跳转', () => {
  test.beforeEach(async ({ page }) => {
    // 先登录
    await page.goto('/login');
    await page.fill('input[type="tel"]', '13800138000');
    await page.click('button:has-text("获取验证码")');
    await page.fill('input[type="text"]', '123456');
    await page.click('button:has-text("登录 / 注册")');
  });

  test('底部导航切换', async ({ page }) => {
    // 首页
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=首页')).toBeVisible();

    // 切换到问诊
    await page.click('button:has-text("问诊")');
    await expect(page).toHaveURL(/\/chat/);

    // 切换到挂号
    await page.click('button:has-text("挂号")');
    await expect(page).toHaveURL(/\/booking/);

    // 切换到我的
    await page.click('button:has-text("我的")');
    await expect(page).toHaveURL('/profile');
  });

  test('功能入口跳转', async ({ page }) => {
    await page.click('button:has-text("我的")');

    // 点击我的预约
    await page.click('text=我的预约');
    await expect(page).toHaveURL('/appointments');
    await expect(page.locator('text=我的预约')).toBeVisible();

    // 返回 Profile
    await page.goto('/profile');

    // 点击问诊记录
    await page.click('text=问诊记录');
    await expect(page).toHaveURL('/consultations');
  });

  test('设置页面功能', async ({ page }) => {
    await page.click('button:has-text("我的")');
    await page.click('text=设置');

    // 验证设置页面
    await expect(page.locator('text=设置')).toBeVisible();
    await expect(page.locator('text=深色模式')).toBeVisible();
    await expect(page.locator('text=退出登录')).toBeVisible();
  });

  test('主题切换功能', async ({ page }) => {
    await page.click('button:has-text("我的")');
    await page.click('text=设置');

    // 点击深色模式切换
    await page.click('button:has-text("深色模式")');

    // 验证 HTML 包含 dark 类
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('退出登录功能', async ({ page }) => {
    // 验证登录后访问 Profile
    await page.click('button:has-text("我的")');
    await expect(page).toHaveURL('/profile');
    await expect(page.locator('text=白银会员')).toBeVisible();

    // 退出登录
    await page.click('text=设置');
    await page.click('text=退出登录');

    // 验证跳转到登录页
    await expect(page).toHaveURL(/\/login/);
  });
});
