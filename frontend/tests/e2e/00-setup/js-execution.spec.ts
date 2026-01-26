/**
 * JavaScript 执行测试
 */

import { test, expect } from '@playwright/test';

test('JavaScript 应该能够执行', async ({ page }) => {
  console.log('测试 JavaScript 执行');

  // 监听错误
  page.on('pageerror', error => {
    console.log('页面错误:', error.message);
  });

  // 直接导航到 about:blank 并执行内联脚本
  await page.goto('about:blank');
  await page.waitForLoadState('domcontentloaded');

  // 执行简单的 JavaScript
  const result = await page.evaluate(() => {
    const div = document.createElement('div');
    div.id = 'test';
    div.textContent = 'Hello from JavaScript';
    document.body.appendChild(div);
    return {
      textContent: div.textContent,
      documentReadyState: document.readyState,
      timestamp: Date.now()
    };
  });

  console.log('JavaScript 执行结果:', JSON.stringify(result, null, 2));

  // 验证
  expect(result.textContent).toBe('Hello from JavaScript');
  expect(result.documentReadyState).toBe('complete');

  console.log('JavaScript 执行测试通过');
});
