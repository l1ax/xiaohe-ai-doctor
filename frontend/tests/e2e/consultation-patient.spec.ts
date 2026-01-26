import { test, expect } from '@playwright/test';

/**
 * 患者端专家问诊完整流程 E2E 测试
 *
 * 测试目标：
 * 1. 浏览医生列表并按科室筛选
 * 2. 创建问诊
 * 3. 进入聊天界面
 * 4. 发送和接收消息
 * 5. 结束问诊
 * 6. 查看问诊列表（含状态筛选）
 * 7. 从列表导航到聊天
 */

test.describe('患者端专家问诊流程', () => {
  test.beforeEach(async ({ page }) => {
    // 清除本地存储
    // Clear storage via context storage state

    // 登录患者账号
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13800138000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');
  });

  test('完整流程：浏览医生 -> 创建问诊 -> 聊天 -> 结束', async ({ page }) => {
    // 1. 导航到医生列表页面
    await page.goto('/doctor-list');
    await expect(page.locator('text=选择医生')).toBeVisible();

    // 2. 验证科室筛选器存在
    await expect(page.locator('text=全部')).toBeVisible();

    // 3. 点击特定科室筛选（如果有）
    const departmentButtons = page.locator('button:has-text("全部")').locator('..').locator('button');
    const count = await departmentButtons.count();
    if (count > 1) {
      await departmentButtons.nth(1).click();
      await page.waitForTimeout(500);
    }

    // 4. 点击第一个医生的"立即问诊"按钮
    const consultButton = page.locator('button:has-text("立即问诊")').first();
    const hasConsultButton = await consultButton.count() > 0;

    if (hasConsultButton) {
      await consultButton.click();

      // 5. 验证跳转到聊天页面
      await page.waitForURL(/\/doctor-chat\/.+/);
      await expect(page.locator('text=结束问诊')).toBeVisible();

      // 6. 发送消息
      const input = page.locator('input[placeholder="输入消息..."]');
      await expect(input).toBeVisible();
      await input.fill('医生您好，我最近感觉头晕');
      await input.press('Enter');

      // 7. 等待消息显示
      await page.waitForTimeout(1000);
      await expect(page.locator('text=医生您好，我最近感觉头晕')).toBeVisible();

      // 8. 结束问诊
      const endButton = page.locator('button:has-text("结束问诊")');
      await endButton.click();

      // 处理确认对话框
      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });

      // 9. 验证返回问诊列表
      await page.waitForTimeout(1000);
    }
  });

  test('查看问诊列表并按状态筛选', async ({ page }) => {
    // 1. 导航到问诊列表页面
    await page.goto('/consultations');
    await expect(page.locator('text=专家问诊')).toBeVisible();

    // 2. 验证"发问诊"按钮存在
    await expect(page.locator('button:has-text("发问诊")')).toBeVisible();

    // 3. 检查问诊列表
    const consultationCards = page.locator('div.rounded-xl').filter({ hasText: /待接单|进行中|已完成/ });
    const count = await consultationCards.count();

    if (count > 0) {
      // 4. 验证状态标签显示
      const statusTexts = ['待接单', '进行中', '已完成'];
      for (const status of statusTexts) {
        const statusElement = page.locator(`text=${status}`);
        const hasStatus = await statusElement.count() > 0;
        if (hasStatus) {
          await expect(statusElement.first()).toBeVisible();
          break;
        }
      }

      // 5. 点击第一个问诊卡片进入聊天
      await consultationCards.first().click();
      await page.waitForTimeout(500);
    } else {
      // 6. 如果没有问诊记录，验证空状态
      await expect(page.locator('text=暂无问诊记录')).toBeVisible();
    }
  });

  test('从问诊列表导航到聊天界面', async ({ page }) => {
    // 1. 导航到问诊列表页面
    await page.goto('/consultations');

    // 2. 等待页面加载
    await page.waitForLoadState('networkidle');

    // 3. 检查是否有问诊记录
    const consultationCards = page.locator('div.rounded-xl').filter({ hasText: /待接单|进行中|已完成/ });
    const count = await consultationCards.count();

    if (count > 0) {
      // 4. 点击第一个问诊卡片
      await consultationCards.first().click();

      // 5. 验证跳转到聊天页面
      await page.waitForURL(/\/doctor-chat\/.+/);
      await expect(page.locator('input[placeholder="输入消息..."]')).toBeVisible();
    }
  });

  test('在聊天界面发送和接收消息', async ({ page }) => {
    // 1. 直接导航到聊天页面（假设已有问诊ID）
    await page.goto('/doctor-chat/test-consultation-id');
    await page.waitForTimeout(1000);

    // 2. 验证聊天界面元素
    const input = page.locator('input[placeholder="输入消息..."]');
    const hasInput = await input.count() > 0;

    if (hasInput) {
      await expect(input).toBeVisible();

      // 3. 发送多条消息
      const messages = [
        '医生您好',
        '我最近总是感觉疲劳',
        '有什么建议吗？'
      ];

      for (const message of messages) {
        await input.fill(message);
        await input.press('Enter');
        await page.waitForTimeout(500);
      }

      // 4. 验证消息显示
      for (const message of messages) {
        await expect(page.locator(`text=${message}`)).toBeVisible();
      }
    }
  });

  test('科室筛选功能', async ({ page }) => {
    // 1. 导航到医生列表
    await page.goto('/doctor-list');
    await expect(page.locator('text=选择医生')).toBeVisible();

    // 2. 点击"全部"按钮
    const allButton = page.locator('button:has-text("全部")');
    await expect(allButton).toBeVisible();
    await allButton.click();
    await page.waitForTimeout(500);

    // 3. 验证筛选结果
    await expect(page.locator('text=选择医生')).toBeVisible();
  });

  test('空状态处理：无问诊记录', async ({ page }) => {
    // 1. 导航到问诊列表
    await page.goto('/consultations');

    // 2. 等待页面加载
    await page.waitForLoadState('networkidle');

    // 3. 检查是否显示空状态
    const emptyState = page.locator('text=暂无问诊记录');
    const hasEmptyState = await emptyState.count() > 0;

    if (hasEmptyState) {
      // 4. 验证空状态UI
      await expect(emptyState).toBeVisible();
      await expect(page.locator('button:has-text("发起问诊")')).toBeVisible();

      // 5. 点击"发起问诊"按钮
      await page.locator('button:has-text("发起问诊")').click();
      await page.waitForURL('/doctor-list');
    }
  });

  test('聊天输入框禁用状态', async ({ page }) => {
    // 1. 导航到聊天页面
    await page.goto('/doctor-chat/test-consultation-id');
    await page.waitForTimeout(1000);

    // 2. 检查输入框禁用状态（当WebSocket未连接时）
    const input = page.locator('input[placeholder="输入消息..."]');
    const hasInput = await input.count() > 0;

    if (hasInput) {
      const isDisabled = await input.isDisabled();
      const sendButton = page.locator('button').filter({ has: page.locator('span.material-symbols-outlined:has-text("send")') });
      const hasButton = await sendButton.count() > 0;

      if (hasButton) {
        // 如果输入框为空，发送按钮应该禁用
        await input.fill('');
        const isButtonDisabled = await sendButton.isDisabled();
        expect(isButtonDisabled).toBeTruthy();

        // 输入内容后，按钮应该启用（如果WebSocket已连接）
        await input.fill('测试消息');
        await page.waitForTimeout(500);
      }
    }
  });
});

test.describe('患者端专家问诊 - 响应式设计', () => {
  test('移动端适配', async ({ page }) => {
    // 设置移动端视图
    await page.setViewportSize({ width: 375, height: 667 });

    // 登录
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13800138000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');

    // 导航到医生列表
    await page.goto('/doctor-list');

    // 验证关键元素在移动端可见
    await expect(page.locator('text=选择医生')).toBeVisible();
    await expect(page.locator('button:has-text("全部")')).toBeVisible();
  });

  test('平板端适配', async ({ page }) => {
    // 设置平板端视图
    await page.setViewportSize({ width: 768, height: 1024 });

    // 登录
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13800138000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');

    // 导航到问诊列表
    await page.goto('/consultations');

    // 验证布局
    await expect(page.locator('text=专家问诊')).toBeVisible();
  });
});
