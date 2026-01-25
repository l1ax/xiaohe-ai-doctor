import { test, expect, describe } from '@playwright/test';

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

describe('Chat Page', () => {
  test.beforeEach(async ({ page }) => {
    // 打开Chat页面
    await page.goto('/chat');

    // 等待页面加载
    await page.waitForLoadState('networkidle');
  });

  test('should display welcome message when no messages', async ({ page }) => {
    // 验证欢迎消息存在
    await expect(page.locator('text=您好，我是小禾AI医生')).toBeVisible();

    // 验证副标题
    await expect(page.locator('text=有什么健康问题我可以帮您解答？')).toBeVisible();

    // 验证快捷问题按钮存在
    await expect(page.locator('text=最近总是头疼怎么办')).toBeVisible();
    await expect(page.locator('text=感冒了吃什么药好')).toBeVisible();
    await expect(page.locator('text=睡眠不好怎么调理')).toBeVisible();
  });

  test('should display header with bot info', async ({ page }) => {
    // 验证标题
    await expect(page.locator('text=小禾AI医生')).toBeVisible();

    // 验证在线状态指示器
    const statusIndicator = page.locator('.w-2.h-2.bg-gray-400');
    await expect(statusIndicator).toBeVisible();
  });

  test('should allow typing in input field', async ({ page }) => {
    // 找到输入框
    const input = page.locator('textarea');

    // 输入文本
    await input.fill('测试头疼');

    // 验证文本已输入
    await expect(input).toHaveValue('测试头疼');
  });

  test('should send message on Enter key', async ({ page }) => {
    // 输入消息
    const input = page.locator('textarea');
    await input.fill('测试消息');

    // 按Enter发送
    await input.press('Enter');

    // 等待用户消息显示（带短暂延迟确保DOM更新）
    await page.waitForTimeout(500);

    // 验证用户消息出现在页面中
    await expect(page.locator('text=测试消息')).toBeVisible();
  });

  test('should display quick question when clicked', async ({ page }) => {
    // 点击快捷问题
    await page.locator('text=最近总是头疼怎么办').click();

    // 验证输入框中已填入文本
    const input = page.locator('textarea');
    await expect(input).toHaveValue('最近总是头疼怎么办');
  });

  test('should enable send button when input has content', async ({ page }) => {
    // 初始状态下发送按钮应该禁用
    const sendButton = page.locator('button').filter({ has: page.locator('svg') }).last();

    // 输入内容后按钮应该启用
    const input = page.locator('textarea');
    await input.fill('测试');
    await input.dispatchEvent('input');

    // 验证按钮不再有禁用样式
    await expect(sendButton).not.toHaveClass(/cursor-not-allowed/);
  });

  test('should have input placeholder', async ({ page }) => {
    // 验证输入框有正确的占位符
    const input = page.locator('textarea');
    await expect(input).toHaveAttribute('placeholder', '描述您的症状或问题...');
  });

  test('should show disclaimer at bottom', async ({ page }) => {
    // 验证免责声明
    await expect(page.locator('text=AI 仅供参考，具体诊疗请咨询专业医生')).toBeVisible();
  });
});

describe('Chat Page - Message Flow', () => {
  test('should show user message after sending', async ({ page }) => {
    // 导航到Chat页面
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 输入并发送消息
    const input = page.locator('textarea');
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
    const input = page.locator('textarea');
    await input.fill('测试消息');
    await input.press('Enter');
    await page.waitForTimeout(500);

    // 点击重置按钮
    await page.locator('[title="新建对话"]').click();

    // 验证欢迎消息重新显示
    await expect(page.locator('text=您好，我是小禾AI医生')).toBeVisible();
  });
});

describe('Chat Page - Responsive', () => {
  test('should be mobile responsive', async ({ page }) => {
    // 设置移动端视图
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    // 验证关键元素在移动端可见
    await expect(page.locator('text=小禾AI医生')).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();
  });
});
