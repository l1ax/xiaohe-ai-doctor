import express from 'express';
import {
  getDoctors,
  getDoctorDetail,
  getDepartmentsList,
  getHospitalsList,
  createConsultation,
  getConsultations,
  getConsultationDetail,
  getConsultationMessages,
  updateConsultationStatus,
  joinConsultation,
  leaveConsultation,
  getPendingConsultations,
  getDoctorConsultations,
  acceptConsultation,
  closeConsultation,
  getUnreadCount,
  markMessagesAsRead,
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
 * 获取待处理的问诊（医生端）
 * 注意：必须放在 /:id 之前，否则会被拦截
 * GET /api/consultations/pending
 */
router.get('/pending', authMiddleware, getPendingConsultations);

/**
 * 获取医生的问诊列表（所有未关闭）
 * 注意：必须放在 /:id 之前，否则会被拦截
 * GET /api/consultations/doctor
 */
router.get('/doctor', authMiddleware, getDoctorConsultations);

/**
 * 获取用户未读消息数
 * GET /api/consultations/unread
 */
router.get('/unread', authMiddleware, getUnreadCount);

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
 * 获取问诊消息历史
 * GET /api/consultations/:id/messages
 */
router.get('/:id/messages', authMiddleware, getConsultationMessages);

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

/**
 * 医生接诊
 * PUT /api/consultations/:id/accept
 */
router.put('/:id/accept', authMiddleware, acceptConsultation);

/**
 * 结束问诊
 * PUT /api/consultations/:id/close
 */
router.put('/:id/close', authMiddleware, closeConsultation);

/**
 * 标记问诊消息为已读
 * PUT /api/consultations/:id/read
 */
router.put('/:id/read', authMiddleware, markMessagesAsRead);

export default router;
