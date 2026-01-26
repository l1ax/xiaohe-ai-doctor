import express from 'express';
import {
  getSchedule,
  createAppointmentHandler,
  getAppointments,
  getAppointmentDetail,
  cancelAppointmentHandler,
  confirmAppointmentHandler,
  getDoctorsForAppointment,
  getDoctorAppointmentsHandler,
} from '../controllers/appointmentController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

/**
 * 获取医生列表（用于预约）
 * GET /api/appointments/doctors
 */
router.get('/doctors', authMiddleware, getDoctorsForAppointment);

/**
 * 获取医生排班
 * GET /api/appointments/schedule
 */
router.get('/schedule', authMiddleware, getSchedule);

/**
 * 创建预约
 * POST /api/appointments
 */
router.post('/', authMiddleware, createAppointmentHandler);

/**
 * 获取我的预约列表
 * GET /api/appointments
 */
router.get('/', authMiddleware, getAppointments);

/**
 * 获取医生的预约列表（医生端）
 * GET /api/appointments/doctor
 * 注意：此路由必须在 /:id 之前，否则会被拦截
 */
router.get('/doctor', authMiddleware, getDoctorAppointmentsHandler);

/**
 * 获取预约详情
 * GET /api/appointments/:id
 */
router.get('/:id', authMiddleware, getAppointmentDetail);

/**
 * 取消预约
 * PUT /api/appointments/:id/cancel
 */
router.put('/:id/cancel', authMiddleware, cancelAppointmentHandler);

/**
 * 确认预约（医生端）
 * PUT /api/appointments/:id/confirm
 */
router.put('/:id/confirm', authMiddleware, confirmAppointmentHandler);

export default router;
