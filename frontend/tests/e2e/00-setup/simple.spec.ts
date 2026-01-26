/**
 * 简单的验证测试
 * 用于验证测试基础设施是否正常工作
 */

import { test, expect } from '@playwright/test';

test('应该能够加载登录页面', async ({ page }) => {
  console.log('开始测试: 加载登录页面');

  // 监听页面错误
  const pageErrors: string[] = [];
  page.on('pageerror', error => {
    pageErrors.push(error.message);
  });

  // 监听控制台消息
  page.on('console', msg => {
    console.log(`[CONSOLE ${msg.type()}] ${msg.text()}`);
  });

  // 导航到页面
  await page.goto('/login', {
    waitUntil: 'commit',
    timeout: 60000
  });
  console.log('页面导航完成');

  // 等待一段时间让 JavaScript 执行
  await page.waitForTimeout(5000);

  // 检查 JavaScript 是否执行 - 注入测试代码
  const jsExecuted = await page.evaluate(() => {
    // 检查 React 是否加载
    const hasReact = typeof window.React !== 'undefined' || document.querySelector('[data-reactroot]') !== null;
    // 检查 root 是否有内容
    const rootContent = document.getElementById('root')?.innerHTML || '';
    // 尝试执行一个简单的操作
    const testVar = 'test_value_' + Date.now();

    // 返回测试结果
    return {
      hasReact,
      rootContentLength: rootContent.length,
      bodyHTML: document.body.innerHTML.substring(0, 200),
      timestamp: Date.now()
    };
  });

  console.log('JavaScript 执行结果:', JSON.stringify(jsExecuted, null, 2));

  // 打印页面错误
  if (pageErrors.length > 0) {
    console.log('页面错误:', pageErrors);
  }

  // 如果 root 是空的，尝试手动触发 React
  if (jsExecuted.rootContentLength === 0) {
    console.log('React 未渲染，尝试手动加载...');

    // 检查是否所有脚本都已加载
    const scriptsLoaded = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      return scripts.map(s => ({
        src: s.getAttribute('src'),
        type: s.getAttribute('type'),
        loaded: !s.getAttribute('src') || s.readyState === 'complete' || s.readyState === 'loaded'
      }));
    });
    console.log('脚本加载状态:', JSON.stringify(scriptsLoaded, null, 2));
  }

  // 最终检查
  const finalContent = await page.evaluate(() => document.getElementById('root')?.innerHTML || '');
  console.log('最终 root 内容长度:', finalContent.length);

  // 失败时打印更多信息
  if (finalContent.length === 0) {
    console.log('FAIL: React 未渲染任何内容到 root 元素');
    console.log('页面 HTML:', await page.content());
  }

  // 简单断言
  expect(jsExecuted.rootContentLength).toBeGreaterThan(0);
});
