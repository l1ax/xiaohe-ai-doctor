import express from 'express';
import {
  getDoctorSchedules,
  setSchedule,
  deleteSchedule,
} from '../controllers/scheduleController';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = express.Router();

/**
 * 获取医生排班列表
 * GET /api/doctors/schedules
 *
 * 查询参数：
 * - date: string (可选) - 筛选特定日期的排班，格式 YYYY-MM-DD
 *
 * 需要医生身份验证
 */
router.get('/', authMiddleware, requireRole('doctor'), getDoctorSchedules);

/**
 * 设置排班（创建或更新）
 * POST /api/doctors/schedules
 *
 * 请求体：
 * {
 *   "date": "2026-01-26",
 *   "timeSlot": "morning",
 *   "isAvailable": true,
 *   "maxPatients": 10
 * }
 *
 * 需要医生身份验证
 */
router.post('/', authMiddleware, requireRole('doctor'), setSchedule);

/**
 * 删除排班
 * DELETE /api/doctors/schedules/:id
 *
 * 需要医生身份验证
 */
router.delete('/:id', authMiddleware, requireRole('doctor'), deleteSchedule);

export default router;
