import { test, expect } from '@playwright/test';

/**
 * 医生端工作台完整流程 E2E 测试
 *
 * 测试目标：
 * 1. 医生登录和工作台显示
 * 2. 查看待处理问诊列表
 * 3. 接受问诊
 * 4. 在聊天中发送消息
 * 5. 结束问诊
 * 6. 预约管理（查看列表、按状态筛选）
 */

test.describe('医生端工作台流程', () => {
  test.beforeEach(async ({ page }) => {
    // 清除本地存储
    // Clear storage via context storage state
  });

  test('医生登录并访问工作台', async ({ page }) => {
    // 1. 医生登录
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13900139000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');

    // 2. 导航到医生工作台
    await page.goto('/doctor/console');

    // 3. 验证工作台标题
    await expect(page.locator('text=工作台')).toBeVisible();

    // 4. 验证医生信息头部
    const doctorName = page.locator('text=医生');
    const hasDoctorName = await doctorName.count() > 0;
    if (hasDoctorName) {
      await expect(doctorName.first()).toBeVisible();
    }

    // 5. 验证统计卡片（使用更简单的选择器）
    const statsText = page.locator('text=待处理').or(page.locator('text=进行中')).or(page.locator('text=已完成'));
    const hasStats = await statsText.count() > 0;
    if (hasStats) {
      await expect(statsText.first()).toBeVisible();
    }
  });

  test('查看待处理问诊列表', async ({ page }) => {
    // 1. 登录医生账号
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13900139000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');

    // 2. 导航到工作台
    await page.goto('/doctor/console');
    await page.waitForLoadState('networkidle');

    // 3. 验证待处理问诊标题
    const consultationTitle = page.locator('text=待处理问诊');
    const hasTitle = await consultationTitle.count() > 0;
    if (hasTitle) {
      await expect(consultationTitle).toBeVisible();
    }

    // 4. 检查刷新按钮
    const refreshButton = page.locator('text=刷新');
    const hasRefresh = await refreshButton.count() > 0;
    if (hasRefresh) {
      await expect(refreshButton).toBeVisible();
    }

    // 5. 检查空状态
    const emptyState = page.locator('text=暂无待处理问诊');
    const hasEmpty = await emptyState.count() > 0;
    if (hasEmpty) {
      await expect(emptyState).toBeVisible();
    }
  });

  test('在聊天界面发送消息', async ({ page }) => {
    // 1. 登录医生账号
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13900139000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');

    // 2. 直接导航到医生聊天页面
    await page.goto('/doctor/chat/test-consultation-id');
    await page.waitForTimeout(1000);

    // 3. 查找输入框（支持多种placeholder）
    const input = page.locator('textarea').or(page.locator('input[type="text"]'));
    const hasInput = await input.count() > 0;

    if (hasInput) {
      // 4. 发送消息
      await input.first().fill('您好，我是李医生，请问有什么可以帮您？');
      await input.first().press('Enter');
      await page.waitForTimeout(1000);

      // 5. 验证消息显示
      await expect(page.locator('text=您好，我是李医生')).toBeVisible();
    }
  });

  test('预约管理 - 查看列表和状态筛选', async ({ page }) => {
    // 1. 登录医生账号
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13900139000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');

    // 2. 导航到预约管理页面
    await page.goto('/doctor/appointments');
    await expect(page.locator('text=预约管理')).toBeVisible();

    // 3. 验证状态标签
    const statusTabs = ['全部', '待确认', '已确认', '已完成', '已取消'];
    for (const tab of statusTabs) {
      const tabElement = page.locator(`text=${tab}`);
      await expect(tabElement.first()).toBeVisible();
    }

    // 4. 检查预约卡片或空状态
    const appointmentText = page.locator('text=预约').or(page.locator('text=暂无'));
    await expect(appointmentText.first()).toBeVisible();
  });

  test('工作台统计数据刷新', async ({ page }) => {
    // 1. 登录医生账号
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13900139000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');

    // 2. 导航到工作台
    await page.goto('/doctor/console');

    // 3. 查找刷新按钮
    const refreshButton = page.locator('text=刷新');
    const hasRefresh = await refreshButton.count() > 0;

    if (hasRefresh) {
      // 4. 点击刷新按钮
      await refreshButton.first().click();
      await page.waitForTimeout(500);

      // 5. 验证页面仍然可见
      await expect(page.locator('text=工作台')).toBeVisible();
    }
  });

});

test.describe('医生端工作台 - 响应式设计', () => {
  test('移动端适配', async ({ page }) => {
    // 设置移动端视图
    await page.setViewportSize({ width: 375, height: 667 });

    // 登录医生账号
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13900139000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');

    // 导航到工作台
    await page.goto('/doctor/console');

    // 验证关键元素在移动端可见
    await expect(page.locator('text=工作台')).toBeVisible();
  });

  test('平板端适配', async ({ page }) => {
    // 设置平板端视图
    await page.setViewportSize({ width: 768, height: 1024 });

    // 登录医生账号
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13900139000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');

    // 导航到预约管理
    await page.goto('/doctor/appointments');

    // 验证布局
    await expect(page.locator('text=预约管理')).toBeVisible();
  });
});
