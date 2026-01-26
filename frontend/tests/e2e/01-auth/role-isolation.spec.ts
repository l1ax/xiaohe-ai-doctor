import { test, expect } from '@playwright/test';
import { loginAsPatient, loginAsDoctor } from '../../helpers/auth';

test.describe('角色隔离 - 医生端', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDoctor(page);
  });

  test('医生无法访问患者端首页', async ({ page }) => {
    await page.goto('/');
    // 应重定向到医生工作台
    await expect(page).toHaveURL('/doctor/console');
  });

  test('医生无法访问患者端问诊列表', async ({ page }) => {
    await page.goto('/consultations');
    await expect(page).toHaveURL('/doctor/console');
  });

  test('医生无法访问患者端预约页面', async ({ page }) => {
    await page.goto('/appointments');
    await expect(page).toHaveURL('/doctor/console');
  });

  test('医生无法访问患者端聊天', async ({ page }) => {
    await page.goto('/doctor-chat/test-id');
    await expect(page).toHaveURL('/doctor/console');
  });

  test('医生无法访问患者端个人中心', async ({ page }) => {
    await page.goto('/profile');
    await expect(page).toHaveURL('/doctor/console');
  });
});

test.describe('角色隔离 - 患者端', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPatient(page);
  });

  test('患者无法访问医生工作台', async ({ page }) => {
    await page.goto('/doctor/console');
    await expect(page).toHaveURL('/');
  });

  test('患者无法访问医生排班管理', async ({ page }) => {
    await page.goto('/doctor/schedule');
    await expect(page).toHaveURL('/');
  });

  test('患者无法访问医生预约管理', async ({ page }) => {
    await page.goto('/doctor/appointments');
    await expect(page).toHaveURL('/');
  });

  test('患者无法访问医生聊天页面', async ({ page }) => {
    await page.goto('/doctor/chat/test-id');
    await expect(page).toHaveURL('/');
  });
});
