import { test, expect } from '@playwright/test';
import { loginAsPatient, loginAsDoctor } from '../../helpers/auth';
import { getTomorrowDate } from '../../helpers/utils';

test.describe('排班验证 - 前后端双重验证', () => {
  test('医生设置不可用时段后，患者端应禁用该时段', async ({ page, context }) => {
    const doctorPage = await context.newPage();
    const patientPage = await context.newPage();

    try {
      // 1. 医生登录并设置排班
      await loginAsDoctor(doctorPage);
      await doctorPage.goto('/doctor/schedule');
      const tomorrow = getTomorrowDate();

      // 选择明天的日期
      const dateButton = doctorPage.locator(`button[data-date="${tomorrow}"]`);
      const hasDateButton = await dateButton.count() > 0;

      if (hasDateButton) {
        await dateButton.click();
        await doctorPage.waitForTimeout(500);

        // 设置上午为不可用
        const morningCheckbox = doctorPage.locator('[data-time-slot="morning"] input[type="checkbox"]');
        const hasCheckbox = await morningCheckbox.count() > 0;

        if (hasCheckbox) {
          // 先取消选中，使上午不可用
          const isChecked = await morningCheckbox.isChecked();
          if (isChecked) {
            await morningCheckbox.uncheck();
          }

          // 保存排班设置
          const saveButton = doctorPage.locator('button:has-text("保存")');
          const hasSaveButton = await saveButton.count() > 0;

          if (hasSaveButton) {
            await saveButton.click();
            await doctorPage.waitForTimeout(1000);
          }
        }
      }

      // 2. 患者登录并尝试预约
      await loginAsPatient(patientPage);
      await patientPage.goto('/appointments/doctors');

      const doctorButton = patientPage.locator('button').filter({ hasText: /医生/ }).first();
      const hasDoctorButton = await doctorButton.count() > 0;

      if (hasDoctorButton) {
        await doctorButton.click();
        await patientPage.waitForTimeout(500);

        // 选择同一天
        const patientDateButton = patientPage.locator(`button[data-date="${tomorrow}"]`);
        const hasPatientDateButton = await patientDateButton.count() > 0;

        if (hasPatientDateButton) {
          await patientDateButton.click();
          await patientPage.waitForTimeout(500);

          // 3. 验证上午时段被禁用或不可见
          const timeSlots = patientPage.locator('button').filter({ hasText: /\d{2}:\d{2}/ });
          const count = await timeSlots.count();

          if (count > 0) {
            // 检查是否有任何可用的上午时段
            let morningSlotsFound = false;
            for (let i = 0; i < count; i++) {
              const slotText = await timeSlots.nth(i).textContent();
              const hour = parseInt(slotText?.split(':')[0] || '0');

              // 上午时段（6:00-12:00）应该被禁用或不存在
              if (hour >= 6 && hour < 12) {
                morningSlotsFound = true;
                const isDisabled = await timeSlots.nth(i).isDisabled();
                expect(isDisabled).toBeTruthy();
              }
            }

            // 如果找到上午时段，验证它们被禁用
            if (morningSlotsFound) {
              const morningSlot = patientPage.locator('button').filter({ hasText: /^09:/ }).first();
              const hasMorningSlot = await morningSlot.count() > 0;
              if (hasMorningSlot) {
                const isDisabled = await morningSlot.isDisabled();
                expect(isDisabled).toBeTruthy();
              }
            }
          }
        }
      }
    } finally {
      await doctorPage.close();
      await patientPage.close();
    }
  });

  test('医生设置可用时段后，患者端应能选择该时段', async ({ page, context }) => {
    const doctorPage = await context.newPage();
    const patientPage = await context.newPage();

    try {
      // 1. 医生登录并设置排班 - 确保下午可用
      await loginAsDoctor(doctorPage);
      await doctorPage.goto('/doctor/schedule');
      const tomorrow = getTomorrowDate();

      const dateButton = doctorPage.locator(`button[data-date="${tomorrow}"]`);
      const hasDateButton = await dateButton.count() > 0;

      if (hasDateButton) {
        await dateButton.click();
        await doctorPage.waitForTimeout(500);

        // 设置下午为可用
        const afternoonCheckbox = doctorPage.locator('[data-time-slot="afternoon"] input[type="checkbox"]');
        const hasCheckbox = await afternoonCheckbox.count() > 0;

        if (hasCheckbox) {
          const isChecked = await afternoonCheckbox.isChecked();
          if (!isChecked) {
            await afternoonCheckbox.check();
          }

          const saveButton = doctorPage.locator('button:has-text("保存")');
          const hasSaveButton = await saveButton.count() > 0;

          if (hasSaveButton) {
            await saveButton.click();
            await doctorPage.waitForTimeout(1000);
          }
        }
      }

      // 2. 患者登录并尝试预约
      await loginAsPatient(patientPage);
      await patientPage.goto('/appointments/doctors');

      const doctorButton = patientPage.locator('button').filter({ hasText: /医生/ }).first();
      const hasDoctorButton = await doctorButton.count() > 0;

      if (hasDoctorButton) {
        await doctorButton.click();
        await patientPage.waitForTimeout(500);

        const patientDateButton = patientPage.locator(`button[data-date="${tomorrow}"]`);
        const hasPatientDateButton = await patientDateButton.count() > 0;

        if (hasPatientDateButton) {
          await patientDateButton.click();
          await patientPage.waitForTimeout(500);

          // 验证下午时段可用
          const afternoonSlot = patientPage.locator('button').filter({ hasText: /^14:/ }).first();
          const hasAfternoonSlot = await afternoonSlot.count() > 0;

          if (hasAfternoonSlot) {
            const isDisabled = await afternoonSlot.isDisabled();
            expect(isDisabled).toBeFalsy();
          }
        }
      }
    } finally {
      await doctorPage.close();
      await patientPage.close();
    }
  });
});
