import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { UnauthorizedError, ValidationError } from '../utils/errorHandler';
import { consultationStore } from '../services/storage/consultationStore';
import { getDoctorById } from '../services/doctors/doctorService';

/**
 * 更新医生在线状态
 * PUT /api/doctors/status
 */
export const updateDoctorStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      throw new UnauthorizedError('Doctor access required');
    }

    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      throw new ValidationError('isAvailable must be a boolean');
    }

    // 更新医生的可用状态
    const doctor = getDoctorById(req.user.userId);
    if (!doctor) {
      throw new ValidationError('Doctor not found');
    }

    doctor.isAvailable = isAvailable;

    logger.info('Doctor status updated', {
      doctorId: req.user.userId,
      isAvailable,
    });

    res.json({
      code: 0,
      data: {
        isAvailable,
      },
      message: 'success',
    });
  } catch (error) {
    logger.error('Update doctor status error', error);
    throw error;
  }
};

/**
 * 获取医生统计数据
 * GET /api/doctors/stats
 */
export const getDoctorStats = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      throw new UnauthorizedError('Doctor access required');
    }

    const doctorId = req.user.userId;

    // 获取所有问诊
    const allConsultations = consultationStore.getByDoctorId(doctorId);

    // 计算今日接诊数
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayConsultations = allConsultations.filter((c) => {
      const createdAt = new Date(c.createdAt);
      return createdAt >= today && c.status !== 'cancelled';
    });

    // 计算待处理数
    const pendingConsultations = allConsultations.filter(
      (c) => c.status === 'pending'
    );

    // 计算今日收入（模拟数据，根据完成的问诊数量计算）
    const completedConsultations = allConsultations.filter(
      (c) => c.status === 'closed' && new Date(c.createdAt) >= today
    );
    const income = completedConsultations.length * 50; // 假设每次问诊50元

    res.json({
      code: 0,
      data: {
        today: todayConsultations.length,
        pending: pendingConsultations.length,
        income,
      },
      message: 'success',
    });
  } catch (error) {
    logger.error('Get doctor stats error', error);
    throw error;
  }
};
