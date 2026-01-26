import { Page } from '@playwright/test';

/**
 * 导航到预约列表页面
 * @param page Playwright Page 对象
 */
export async function navigateToAppointmentList(page: Page) {
  await page.goto('/appointments');
  await page.waitForLoadState('networkidle');
}

/**
 * 导航到医生列表页面
 * @param page Playwright Page 对象
 */
export async function navigateToDoctorList(page: Page) {
  await page.goto('/appointments/doctors');
  await page.waitForLoadState('networkidle');
}

/**
 * 导航到问诊列表页面
 * @param page Playwright Page 对象
 */
export async function navigateToConsultationList(page: Page) {
  await page.goto('/consultations');
  await page.waitForLoadState('networkidle');
}

/**
 * 返回上一页
 * @param page Playwright Page 对象
 */
export async function goBack(page: Page) {
  await page.goBack();
  await page.waitForLoadState('networkidle');
}
