import express from 'express';
import {
  getDoctors,
  getDoctorDetail,
  getDepartmentsList,
  getHospitalsList,
  createConsultation,
  getConsultations,
  getConsultationDetail,
  updateConsultationStatus,
  joinConsultation,
  leaveConsultation,
} from '../controllers/consultationController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

/**
 * 获取医生列表
 * GET /api/consultations/doctors
 */
router.get('/doctors', authMiddleware, getDoctors);

/**
 * 获取医生详情
 * GET /api/consultations/doctors/:id
 */
router.get('/doctors/:id', authMiddleware, getDoctorDetail);

/**
 * 获取科室列表
 * GET /api/consultations/departments
 */
router.get('/departments', authMiddleware, getDepartmentsList);

/**
 * 获取医院列表
 * GET /api/consultations/hospitals
 */
router.get('/hospitals', authMiddleware, getHospitalsList);

/**
 * 创建问诊
 * POST /api/consultations
 */
router.post('/', authMiddleware, createConsultation);

/**
 * 获取问诊列表
 * GET /api/consultations
 */
router.get('/', authMiddleware, getConsultations);

/**
 * 获取问诊详情
 * GET /api/consultations/:id
 */
router.get('/:id', authMiddleware, getConsultationDetail);

/**
 * 更新问诊状态
 * PUT /api/consultations/:id/status
 */
router.put('/:id/status', authMiddleware, updateConsultationStatus);

/**
 * 加入问诊
 * POST /api/consultations/:id/join
 */
router.post('/:id/join', authMiddleware, joinConsultation);

/**
 * 离开问诊
 * POST /api/consultations/:id/leave
 */
router.post('/:id/leave', authMiddleware, leaveConsultation);

export default router;
