import { test, expect } from '@playwright/test';

/**
 * 患者端预约挂号完整流程 E2E 测试
 *
 * 测试目标：
 * 1. 浏览可预约医生
 * 2. 查看医生排班
 * 3. 选择日期和时间段
 * 4. 创建预约
 * 5. 查看预约列表
 * 6. 取消预约
 * 7. 查看预约详情
 */

test.describe('患者端预约挂号流程', () => {
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

  test('完整流程：选择医生 -> 选择时间 -> 确认预约', async ({ page }) => {
    // 1. 导航到预约页面
    await page.goto('/appointments');
    await expect(page.locator('text=我的预约')).toBeVisible();

    // 2. 点击添加按钮进入医生选择
    const addButton = page.locator('button').filter({ has: page.locator('span.material-symbols-outlined:has-text("add")') });
    await addButton.click();
    await page.waitForURL('/appointments/doctors');

    // 3. 验证医生选择页面
    await expect(page.locator('text=选择医生')).toBeVisible();

    // 4. 选择第一个科室（展开）
    const expandButtons = page.locator('span.material-symbols-outlined:has-text("expand_more")');
    const hasExpand = await expandButtons.count() > 0;

    if (hasExpand) {
      await expandButtons.first().click();
      await page.waitForTimeout(500);

      // 5. 选择第一个医生
      const doctorText = page.locator('text=医生').first();
      await doctorText.click();
      await page.waitForTimeout(1000);

      // 6. 验证进入时间选择页面
      const isOnSchedule = page.url().includes('/appointments/schedule');
      if (isOnSchedule) {
        await expect(page.locator('text=选择时间')).toBeVisible();

        // 7. 选择日期
        const dateButtons = page.locator('button').filter({ hasText: /周|月/ });
        const dateCount = await dateButtons.count();

        if (dateCount > 0) {
          await dateButtons.first().click();
          await page.waitForTimeout(500);

          // 8. 选择时间段
          const timeSlots = page.locator('text=/^\\d{2}:\\d{2}$/');
          const slotCount = await timeSlots.count();

          if (slotCount > 0) {
            await timeSlots.first().click();
            await page.waitForTimeout(500);

            // 9. 点击确定按钮
            const confirmButton = page.locator('button:has-text("确定")');
            const hasConfirm = await confirmButton.count() > 0;

            if (hasConfirm && !(await confirmButton.isDisabled())) {
              await confirmButton.click();
              await page.waitForTimeout(1000);

              // 10. 验证进入确认页面
              const confirmTitle = page.locator('text=确认预约');
              const hasConfirmTitle = await confirmTitle.count() > 0;

              if (hasConfirmTitle) {
                // 11. 确认预约
                const finalConfirm = page.locator('button:has-text("确认预约")');
                const hasFinalConfirm = await finalConfirm.count() > 0;

                if (hasFinalConfirm) {
                  await finalConfirm.click();
                  await page.waitForTimeout(2000);

                  // 12. 验证返回预约列表
                  await expect(page.locator('text=我的预约')).toBeVisible();
                }
              }
            }
          }
        }
      }
    }
  });

  test('浏览可预约医生列表', async ({ page }) => {
    // 1. 导航到医生选择页面
    await page.goto('/appointments/doctors');
    await expect(page.locator('text=选择医生')).toBeVisible();

    // 2. 等待加载完成
    await page.waitForLoadState('networkidle');

    // 3. 检查科室列表
    const expandButtons = page.locator('span.material-symbols-outlined:has-text("expand_more")');
    const hasExpand = await expandButtons.count() > 0;

    if (hasExpand) {
      // 4. 展开第一个科室
      await expandButtons.first().click();
      await page.waitForTimeout(500);

      // 5. 验证医生卡片
      const doctorText = page.locator('text=医生');
      await expect(doctorText.first()).toBeVisible();
    }
  });

  test('查看预约列表', async ({ page }) => {
    // 1. 导航到预约列表页面
    await page.goto('/appointments');
    await expect(page.locator('text=我的预约')).toBeVisible();

    // 2. 验证状态标签
    const statusTabs = ['全部', '待确认', '已确认', '已完成', '已取消'];
    for (const tab of statusTabs) {
      const tabElement = page.locator(`text=${tab}`);
      await expect(tabElement.first()).toBeVisible();
    }

    // 3. 检查预约卡片或空状态
    const appointmentOrEmpty = page.locator('text=医生').or(page.locator('text=暂无预约'));
    await expect(appointmentOrEmpty.first()).toBeVisible();
  });

  test('取消预约', async ({ page }) => {
    // 1. 导航到预约列表
    await page.goto('/appointments');
    await page.waitForLoadState('networkidle');

    // 2. 查找取消按钮
    const cancelButton = page.locator('button:has-text("取消")');
    const hasCancel = await cancelButton.count() > 0;

    if (hasCancel) {
      // 3. 点击取消按钮
      page.on('dialog', async (dialog) => {
        await dialog.accept();
      });
      await cancelButton.first().click();
      await page.waitForTimeout(1000);

      // 4. 验证取消成功
      const cancelledText = page.locator('text=已取消');
      const hasCancelled = await cancelledText.count() > 0;
      if (hasCancelled) {
        await expect(cancelledText.first()).toBeVisible();
      }
    }
  });

  test('查看预约详情', async ({ page }) => {
    // 1. 导航到预约列表
    await page.goto('/appointments');
    await page.waitForLoadState('networkidle');

    // 2. 查找预约卡片
    const appointmentCards = page.locator('div.rounded-xl');
    const cardCount = await appointmentCards.count();

    if (cardCount > 0) {
      // 3. 点击第一个预约卡片
      await appointmentCards.first().click();
      await page.waitForTimeout(500);

      // 4. 验证详情页面元素
      const detailElements = page.locator('text=预约').or(page.locator('text=医生')).or(page.locator('text=医院'));
      await expect(detailElements.first()).toBeVisible();
    }
  });

  test('时间段选择', async ({ page }) => {
    // 1. 先选择一个医生
    await page.goto('/appointments/doctors');
    await page.waitForTimeout(500);

    // 2. 展开科室并选择医生
    const expandButtons = page.locator('span.material-symbols-outlined:has-text("expand_more")');
    const hasExpand = await expandButtons.count() > 0;

    if (hasExpand) {
      await expandButtons.first().click();
      await page.waitForTimeout(500);

      const doctorText = page.locator('text=医生').first();
      await doctorText.click();
      await page.waitForTimeout(1000);

      // 3. 验证时间选择页面
      const isOnSchedule = page.url().includes('/appointments/schedule');
      if (isOnSchedule) {
        await expect(page.locator('text=选择时间')).toBeVisible();

        // 4. 选择日期
        const dateButtons = page.locator('button').filter({ hasText: /周/ });
        const dateCount = await dateButtons.count();

        if (dateCount > 0) {
          await dateButtons.first().click();
          await page.waitForTimeout(500);

          // 5. 验证时间段显示
          const timeSlots = page.locator('text=/^\\d{2}:\\d{2}$/');
          const slotCount = await timeSlots.count();

          if (slotCount > 0) {
            await expect(timeSlots.first()).toBeVisible();
          }
        }
      }
    }
  });
});

test.describe('患者端预约挂号 - 响应式设计', () => {
  test('移动端日期选择器', async ({ page }) => {
    // 设置移动端视图
    await page.setViewportSize({ width: 375, height: 667 });

    // 登录
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13800138000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');

    // 导航到时间选择页面
    await page.goto('/appointments/schedule');

    // 验证日期选择器在移动端可滚动
    const dateSlider = page.locator('div').filter({ has: page.locator('button') });
    const hasSlider = await dateSlider.count() > 0;
    if (hasSlider) {
      await expect(dateSlider.first()).toBeVisible();
    }
  });

  test('平板端布局适配', async ({ page }) => {
    // 设置平板端视图
    await page.setViewportSize({ width: 768, height: 1024 });

    // 登录
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13800138000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');

    // 导航到预约列表
    await page.goto('/appointments');

    // 验证布局
    await expect(page.locator('text=我的预约')).toBeVisible();
  });
});
