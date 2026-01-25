import { test, expect } from '@playwright/test';

test.describe('Profile 页面', () => {
  test.beforeEach(async ({ page }) => {
    // 先登录
    await page.goto('/login');
    await page.fill('input[type="tel"]', '13800138000');
    await page.click('button:has-text("获取验证码")');
    await page.fill('input[type="text"]', '123456');
    await page.click('button:has-text("登录 / 注册")');
    await page.waitForURL('/');

    // 跳转到 Profile 页面
    await page.click('button:has-text("我的")');
    await expect(page).toHaveURL('/profile');
  });

  test('Profile 页面头部显示', async ({ page }) => {
    // 验证标题
    await expect(page.locator('h2:has-text("个人中心")')).toBeVisible();

    // 验证用户信息
    await expect(page.locator('text=白银会员')).toBeVisible();
    await expect(page.locator('text=138****0000')).toBeVisible();

    // 验证二维码按钮
    await expect(page.locator('span.material-symbols-outlined:has-text("qr_code_2")')).toBeVisible();
  });

  test('功能入口网格显示', async ({ page }) => {
    // 验证 4 个功能入口
    await expect(page.locator('text=我的预约')).toBeVisible();
    await expect(page.locator('text=问诊记录')).toBeVisible();
    await expect(page.locator('text=电子处方')).toBeVisible();
    await expect(page.locator('text=健康档案')).toBeVisible();

    // 验证问诊记录红点
    await expect(page.locator('.rounded-full.bg-red-500')).toBeVisible();
  });

  test('VIP 横幅显示', async ({ page }) => {
    await expect(page.locator('text=小禾健康VIP季卡')).toBeVisible();
    await expect(page.locator('text=无限次AI咨询 · 专家号优先约')).toBeVisible();
    await expect(page.locator('button:has-text("立即查看")')).toBeVisible();
  });

  test('列表菜单显示', async ({ page }) => {
    await expect(page.locator('text=家庭成员管理')).toBeVisible();
    await expect(page.locator('text=地址管理')).toBeVisible();
    await expect(page.locator('text=在线客服')).toBeVisible();
    await expect(page.locator('text=设置')).toBeVisible();
  });

  test('页面跳转功能', async ({ page }) => {
    // 点击设置页面
    await page.click('text=设置');
    await expect(page).toHaveURL('/settings');
  });
});
