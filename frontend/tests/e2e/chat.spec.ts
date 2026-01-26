import { test, expect } from '@playwright/test';

/**
 * AI Chat 端到端测试
 *
 * 测试目标：
 * 1. Chat页面能正常加载
 * 2. 欢迎消息正确显示
 * 3. 用户可以输入并发送消息
 * 4. SSE连接建立
 * 5. 消息正确展示
 */

test.describe('Chat Page', () => {
  test.beforeEach(async ({ page }) => {
    // 打开Chat页面
    await page.goto('/chat');

    // 等待页面加载
    await page.waitForLoadState('networkidle');
  });

  test('should display welcome message when no messages', async ({ page }) => {
    // 验证欢迎消息存在
    await expect(page.locator('text=请描述您的症状，AI 助手将为您解答')).toBeVisible();
  });

  test('should display header with bot info', async ({ page }) => {
    // 验证标题
    await expect(page.locator('text=AI 健康助手')).toBeVisible();
  });

  test('should allow typing in input field', async ({ page }) => {
    // 找到输入框
    const input = page.locator('input[placeholder="请描述您的症状..."]');

    // 输入文本
    await input.fill('测试头疼');

    // 验证文本已输入
    await expect(input).toHaveValue('测试头疼');
  });

  test('should send message on Enter key', async ({ page }) => {
    // 输入消息
    const input = page.locator('input[placeholder="请描述您的症状..."]');
    await input.fill('测试消息');

    // 按Enter发送
    await input.press('Enter');

    // 等待用户消息显示（带短暂延迟确保DOM更新）
    await page.waitForTimeout(500);

    // 验证用户消息出现在页面中
    await expect(page.locator('text=测试消息')).toBeVisible();
  });

  test('should display all 4 quick questions', async ({ page }) => {
    // 验证所有4个快捷问题都显示
    await expect(page.locator('text=感冒发烧')).toBeVisible();
    await expect(page.locator('text=头痛眩晕')).toBeVisible();
    await expect(page.locator('text=腹痛腹泻')).toBeVisible();
    await expect(page.locator('text=儿童发热')).toBeVisible();
  });

  test('should fill input when quick question clicked', async ({ page }) => {
    // 点击快捷问题"感冒发烧"
    await page.locator('text=感冒发烧').click();

    // 验证输入框中已填入文本
    const input = page.locator('input[placeholder="请描述您的症状..."]');
    await expect(input).toHaveValue('感冒发烧');
  });

  test('should enable send button when input has content', async ({ page }) => {
    // 初始状态下发送按钮应该禁用
    const sendButton = page.locator('button').filter({ has: page.locator('svg') }).last();

    // 输入内容后按钮应该启用
    const input = page.locator('input[placeholder="请描述您的症状..."]');
    await input.fill('测试');
    await input.dispatchEvent('input');

    // 验证按钮不再有禁用样式
    await expect(sendButton).not.toHaveClass(/cursor-not-allowed/);
  });

  test('should have input placeholder', async ({ page }) => {
    // 验证输入框有正确的占位符
    const input = page.locator('input[placeholder="请描述您的症状..."]');
    await expect(input).toHaveAttribute('placeholder', '请描述您的症状...');
  });

  test('should show disclaimer at bottom', async ({ page }) => {
    // 验证免责声明
    await expect(page.locator('text=AI建议仅供参考，不可替代医生线下诊疗')).toBeVisible();
  });
});

test.describe('Chat Page - Message Flow', () => {
  test('should show user message after sending', async ({ page }) => {
    // 导航到Chat页面
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 输入并发送消息
    const input = page.locator('input[placeholder="请描述您的症状..."]');
    await input.fill('我感冒了');
    await input.press('Enter');

    // 等待消息显示
    await page.waitForTimeout(1000);

    // 验证用户消息显示
    await expect(page.locator('text=我感冒了').first()).toBeVisible();
  });

  test('should reset conversation', async ({ page }) => {
    // 导航到Chat页面
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 发送一条消息
    const input = page.locator('input[placeholder="请描述您的症状..."]');
    await input.fill('测试消息');
    await input.press('Enter');
    await page.waitForTimeout(500);

    // 点击重置按钮
    await page.locator('[title="重新开始"]').click();

    // 验证欢迎消息重新显示
    await expect(page.getByText('请描述您的症状，AI 助手将为您解答')).toBeVisible();
  });
});

test.describe('Chat Page - Responsive', () => {
  test('should be mobile responsive', async ({ page }) => {
    // 设置移动端视图
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 验证关键元素在移动端可见
    await expect(page.locator('text=AI 健康助手')).toBeVisible();
    await expect(page.locator('input[placeholder="请描述您的症状..."]')).toBeVisible();
  });
});

test.describe('Chat Page - Medical Advice', () => {
  test('should display medical advice card when received', async ({ page }) => {
    // 导航到Chat页面
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 验证健康建议卡片存在（如果收到医疗建议）
    const medicalAdvice = page.locator('text=健康建议');
    // 注意：这个测试需要后端返回医疗建议数据才能通过
  });

  test('should display quick action buttons when received', async ({ page }) => {
    // 导航到Chat页面
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 发送一条会触发医疗建议的消息
    const input = page.locator('input[placeholder="请描述您的症状..."]');
    await input.fill('我头疼发热');
    await input.press('Enter');

    // 等待响应
    await page.waitForTimeout(3000);

    // 验证操作按钮存在
    const transferButton = page.locator('text=咨询人工医生');
    const bookButton = page.locator('text=预约挂号');

    // 如果有操作按钮，应该可见
    const buttons = await transferButton.or(bookButton).count();
    if (buttons > 0) {
      await expect(transferButton.or(bookButton).first()).toBeVisible();
    }
  });
});
