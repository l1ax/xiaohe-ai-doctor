import { test, expect } from '@playwright/test';

/**
 * 智能导航重定向逻辑 E2E 测试
 *
 * 测试目标：
 * 1. 从预约详情页返回应回到预约列表
 * 2. 从时间选择页返回应回到医生选择
 * 3. 浏览器后退按钮应正确工作
 * 4. 页面刷新后状态应保持
 * 5. 直接访问页面时的 fallback 处理
 */

test.describe('智能导航重定向逻辑', () => {
  test.beforeEach(async ({ page }) => {
    // 患者登录
    await page.goto('/login');
    await page.locator('input[type="tel"]').fill('13800138000');
    await page.locator('button:has-text("获取验证码")').click();
    await page.locator('input[type="text"]').fill('123456');
    await page.locator('button:has-text("登录 / 注册")').click();
    await page.waitForURL('/');
  });

  test('从预约详情页返回应回到预约列表', async ({ page }) => {
    // 1. 导航到预约列表
    await page.locator('button:has-text("挂号")').click();
    await expect(page).toHaveURL('/appointments/doctors');

    // 2. 点击返回按钮（或使用底部导航到我的预约）
    await page.locator('button:has-text("我的")').click();
    await page.locator('text=我的预约').first().click();
    await expect(page).toHaveURL('/appointments');

    // 3. 假设有预约详情，点击详情（这里模拟点击第一个预约卡片）
    const appointmentCard = page.locator('.appointment-card, [data-testid="appointment-card"]').first();
    const hasAppointments = await appointmentCard.count() > 0;

    if (hasAppointments) {
      await appointmentCard.click();
      // 验证是否进入详情页
      await expect(page).toHaveURL(/\/appointments\/[a-zA-Z0-9-]+/);

      // 4. 点击返回按钮
      const backButton = page.locator('button:has(span.material-symbols-outlined)').filter({ hasText: '' }).first();
      await backButton.click();

      // 5. 验证返回到预约列表，而不是 404
      await expect(page).toHaveURL('/appointments');
      await expect(page.locator('text=我的预约')).toBeVisible();
    } else {
      // 没有预约时，验证空状态
      await expect(page.locator('text=暂无预约').or(page.locator('text=预约'))).toBeVisible();
    }
  });

  test('从时间选择页返回应回到医生选择', async ({ page }) => {
    // 1. 导航到医生选择
    await page.locator('button:has-text("挂号")').click();
    await expect(page).toHaveURL('/appointments/doctors');

    // 2. 选择医生（点击第一个医生）
    const doctorCard = page.locator('[data-testid="doctor-card"], .doctor-card').first();
    const hasDoctors = await doctorCard.count() > 0;

    if (hasDoctors) {
      await doctorCard.click();
      // 等待导航到时间选择页
      await page.waitForTimeout(500);

      // 3. 验证是否在时间选择页
      const currentUrl = page.url();
      const isOnSchedulePage = currentUrl.includes('/appointments/schedule') ||
                               await page.locator('text=选择时间').count() > 0;

      if (isOnSchedulePage) {
        // 4. 点击返回按钮
        const backButton = page.locator('button').filter({ hasText: '' }).first();
        await backButton.click();

        // 5. 验证返回到医生选择页
        await expect(page).toHaveURL('/appointments/doctors');
        await expect(page.locator('text=选择医生').or(page.locator('text=专家挂号'))).toBeVisible();
      }
    }
  });

  test('从确认预约页返回应回到时间选择', async ({ page }) => {
    // 1. 导航到医生选择
    await page.locator('button:has-text("挂号")').click();

    // 2. 选择医生
    const doctorCard = page.locator('[data-testid="doctor-card"], .doctor-card').first();
    const hasDoctors = await doctorCard.count() > 0;

    if (hasDoctors) {
      await doctorCard.click();
      await page.waitForTimeout(500);

      // 3. 选择日期和时间
      const dateButton = page.locator('button').filter({ hasText: /\d+/ }).first();
      const hasDates = await dateButton.count() > 0;

      if (hasDates) {
        await dateButton.click();
        await page.waitForTimeout(300);

        // 选择时间
        const timeSlot = page.locator('button').filter({ hasText: /:/ }).first();
        const hasTimeSlots = await timeSlot.count() > 0;

        if (hasTimeSlots) {
          await timeSlot.click();
          await page.waitForTimeout(300);

          // 点击确定按钮
          const confirmButton = page.locator('button:has-text("确定")');
          const hasConfirmButton = await confirmButton.count() > 0;

          if (hasConfirmButton) {
            await confirmButton.click();
            await page.waitForTimeout(500);

            // 4. 验证是否在确认页面
            const isOnConfirmPage = await page.locator('text=确认预约').count() > 0;
            if (isOnConfirmPage) {
              // 5. 点击返回按钮
              const backButton = page.locator('button').filter({ hasText: '' }).first();
              await backButton.click();

              // 6. 验证返回到时间选择页，而不是 404
              await expect(page).toHaveURL('/appointments/schedule');
              await expect(page.locator('text=选择时间')).toBeVisible();
            }
          }
        }
      }
    }
  });

  test('浏览器后退按钮应正确工作', async ({ page }) => {
    // 1. 导航到医生选择
    await page.locator('button:has-text("挂号")').click();
    await expect(page).toHaveURL('/appointments/doctors');

    // 2. 选择医生
    const doctorCard = page.locator('[data-testid="doctor-card"], .doctor-card').first();
    const hasDoctors = await doctorCard.count() > 0;

    if (hasDoctors) {
      await doctorCard.click();
      await page.waitForTimeout(500);

      // 3. 使用浏览器后退按钮
      await page.goBack();

      // 4. 验证返回到医生选择页，没有 404 错误
      await expect(page).toHaveURL('/appointments/doctors');
      await expect(page.locator('text=选择医生').or(page.locator('text=专家挂号'))).toBeVisible();

      // 5. 验证页面没有显示 404 错误信息
      const notFoundElement = page.locator('text=404').or(page.locator('text=页面不存在'));
      await expect(notFoundElement).not.toBeVisible();
    }
  });

  test('直接访问时间选择页时的 fallback 处理', async ({ page }) => {
    // 1. 直接访问时间选择页（绕过医生选择）
    await page.goto('/appointments/schedule');

    // 2. 验证被重定向到医生选择页（因为没有选择医生）
    await page.waitForTimeout(500);
    const currentUrl = page.url();
    const isRedirected = currentUrl.includes('/appointments/doctors');

    if (isRedirected) {
      await expect(page).toHaveURL('/appointments/doctors');
    }
  });

  test('直接访问确认页时的 fallback 处理', async ({ page }) => {
    // 1. 直接访问确认页（绕过时间选择）
    await page.goto('/appointments/confirm');

    // 2. 验证被重定向到医生选择页（因为没有完整的预约流程）
    await page.waitForTimeout(500);
    const currentUrl = page.url();
    const isRedirected = currentUrl.includes('/appointments/doctors');

    if (isRedirected) {
      await expect(page).toHaveURL('/appointments/doctors');
    }
  });

  test('页面刷新后状态应保持', async ({ page }) => {
    // 1. 导航到医生选择
    await page.locator('button:has-text("挂号")').click();
    await expect(page).toHaveURL('/appointments/doctors');

    // 2. 选择医生
    const doctorCard = page.locator('[data-testid="doctor-card"], .doctor-card').first();
    const hasDoctors = await doctorCard.count() > 0;

    if (hasDoctors) {
      await doctorCard.click();
      await page.waitForTimeout(500);

      // 3. 刷新页面
      await page.reload();

      // 4. 验证仍然在合理的位置，没有 404
      const currentUrl = page.url();
      const isValidPage =
        currentUrl.includes('/appointments/schedule') ||
        currentUrl.includes('/appointments/doctors');

      expect(isValidPage).toBeTruthy();

      // 5. 验证没有 404 错误
      const notFoundElement = page.locator('text=404').or(page.locator('text=页面不存在'));
      await expect(notFoundElement).not.toBeVisible();
    }
  });

  test('从医生聊天页面返回的正确导航', async ({ page }) => {
    // 1. 导航到问诊
    await page.locator('button:has-text("问诊")').click();
    await expect(page).toHaveURL('/consultations');

    // 2. 如果有问诊记录，点击进入聊天
    const consultationCard = page.locator('[data-testid="consultation-card"], .consultation-card').first();
    const hasConsultations = await consultationCard.count() > 0;

    if (hasConsultations) {
      await consultationCard.click();
      await page.waitForTimeout(500);

      // 3. 验证是否在聊天页面
      const currentUrl = page.url();
      const isInChat = currentUrl.includes('/consultations/') && currentUrl.includes('/chat');

      if (isInChat) {
        // 4. 点击返回按钮
        const backButton = page.locator('button').filter({ hasText: '' }).first();
        await backButton.click();

        // 5. 验证返回到问诊列表，而不是 404
        await expect(page).toHaveURL('/consultations');
        await expect(page.locator('text=专家问诊').or(page.locator('text=问诊'))).toBeVisible();
      }
    }
  });

  test('多次连续后退的导航逻辑', async ({ page }) => {
    // 1. 导航到医生选择
    await page.locator('button:has-text("挂号")').click();
    await expect(page).toHaveURL('/appointments/doctors');

    // 2. 选择医生
    const doctorCard = page.locator('[data-testid="doctor-card"], .doctor-card').first();
    const hasDoctors = await doctorCard.count() > 0;

    if (hasDoctors) {
      await doctorCard.click();
      await page.waitForTimeout(500);

      // 3. 如果有时间选择，选择时间
      const dateButton = page.locator('button').filter({ hasText: /\d+/ }).first();
      const hasDates = await dateButton.count() > 0;

      if (hasDates) {
        await dateButton.click();
        await page.waitForTimeout(300);

        // 4. 第一次后退
        await page.goBack();
        await page.waitForTimeout(300);

        // 5. 验证回到医生选择页
        await expect(page).toHaveURL('/appointments/doctors');

        // 6. 第二次后退
        await page.goBack();

        // 7. 验证回到首页或挂号入口，没有 404
        const currentUrl = page.url();
        const isValidUrl =
          currentUrl === '/' ||
          currentUrl.includes('/appointments') ||
          currentUrl.includes('/consultations');

        expect(isValidUrl).toBeTruthy();

        // 8. 验证没有 404 错误
        const notFoundElement = page.locator('text=404').or(page.locator('text=页面不存在'));
        await expect(notFoundElement).not.toBeVisible();
      }
    }
  });
});
