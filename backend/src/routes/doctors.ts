import express from 'express';
import {
  updateDoctorStatus,
  getDoctorStats,
} from '../controllers/doctorController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

/**
 * 更新医生在线状态
 * PUT /api/doctors/status
 */
router.put('/status', authMiddleware, updateDoctorStatus);

/**
 * 获取医生统计数据
 * GET /api/doctors/stats
 */
router.get('/stats', authMiddleware, getDoctorStats);

export default router;
