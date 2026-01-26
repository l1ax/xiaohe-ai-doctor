import { test, expect } from '@playwright/test';

test.describe('登录流程', () => {
  test.beforeEach(async ({ context, page }) => {
    // 清除所有 cookies
    await context.clearCookies();

    // 在页面加载前注入脚本来清除存储
    // 这会在每次导航前执行，确保 localStorage 被清除
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('完整登录流程', async ({ page }) => {
    // 1. 访问首页，未登录应该停留在首页（不会强制跳转）
    await page.goto('/');

    // 2. 点击"我的"跳转到 Profile 页面
    await page.locator('button:has-text("我的")').click();
    await expect(page).toHaveURL('/profile');

    // 3. Profile 页面显示"请先登录"按钮，点击跳转到登录页
    await expect(page.locator('text=请先登录')).toBeVisible();
    await page.locator('button:has-text("请先登录")').click();
    await expect(page).toHaveURL('/login');

    // 4. 输入手机号
    await page.locator('input[type="tel"]').fill('13800138000');

    // 5. 点击获取验证码
    await page.locator('button:has-text("获取验证码")').click();

    // 6. 输入验证码 123456
    await page.locator('input[type="text"]').fill('123456');

    // 7. 点击登录按钮
    await page.locator('button:has-text("登录 / 注册")').click();

    // 8. 登录成功后跳转到首页
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=小禾AI医生').first()).toBeVisible();
  });

  test('登录后访问 Profile 页面显示用户信息', async ({ page }) => {
    // 先登录
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13800138000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');

    // 跳转到 Profile 页面
    await page.locator('button:has-text("我的")').click();

    // 验证用户信息显示
    await expect(page.locator('text=白银会员').first()).toBeVisible();
    await expect(page.locator('text=/138\\*\\*\\*\\*0000/').first()).toBeVisible();
  });

  test('验证码倒计时功能', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13800138000');
    await page.locator('button:has-text("获取验证码")').click();

    // 验证倒计时显示 - 使用正则匹配数字+s 的格式
    const getCodeButton = page.locator('button').filter({ hasText: /\d+s/ });
    await expect(getCodeButton).toBeVisible();

    // 验证获取验证码按钮在倒计时期间被禁用
    await expect(getCodeButton).toBeDisabled();
  });
});
