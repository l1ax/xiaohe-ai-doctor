import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { ValidationError, NotFoundError, UnauthorizedError } from '../utils/errorHandler';
import { scheduleStore } from '../services/storage/scheduleStore';

/**
 * Utility function to safely extract route parameter
 * Handles both string and string[] types from Express route params
 */
function getRouteParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) {
    return param[0];
  }
  return param || '';
}

/**
 * 获取医生排班列表
 * GET /api/doctors/schedules
 *
 * 查询参数：
 * - date: string (可选) - 筛选特定日期的排班，格式 YYYY-MM-DD
 */
export const getDoctorSchedules = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // 验证用户角色必须是医生
    if (req.user.role !== 'doctor') {
      throw new UnauthorizedError('Only doctors can access schedules');
    }

    const { date } = req.query;
    const doctorId = req.user.userId;

    let schedules;
    if (date && typeof date === 'string') {
      // 验证日期格式 YYYY-MM-DD
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        throw new ValidationError('Invalid date format. Expected YYYY-MM-DD');
      }

      // 获取特定日期的排班
      schedules = scheduleStore.getByDate(doctorId, date);
    } else {
      // 获取所有排班
      schedules = scheduleStore.getByDoctorId(doctorId);
    }

    res.json({
      code: 0,
      data: schedules,
      message: 'success',
    });
  } catch (error) {
    logger.error('Get doctor schedules error', error);
    throw error;
  }
};

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
 */
export const setSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // 验证用户角色必须是医生
    if (req.user.role !== 'doctor') {
      throw new UnauthorizedError('Only doctors can set schedules');
    }

    const { date, timeSlot, isAvailable, maxPatients } = req.body;

    // 验证必填字段
    if (!date || !timeSlot || isAvailable === undefined || !maxPatients) {
      throw new ValidationError('Missing required fields: date, timeSlot, isAvailable, maxPatients');
    }

    // 验证日期格式 YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new ValidationError('Invalid date format. Expected YYYY-MM-DD');
    }

    // 验证日期必须在今天或之后
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduleDate = new Date(date);
    scheduleDate.setHours(0, 0, 0, 0);

    if (scheduleDate < today) {
      throw new ValidationError('Schedule date cannot be in the past');
    }

    // 验证时段
    const validTimeSlots = ['morning', 'afternoon', 'evening'];
    if (!validTimeSlots.includes(timeSlot)) {
      throw new ValidationError(`Invalid timeSlot. Must be one of: ${validTimeSlots.join(', ')}`);
    }

    // 验证最大患者数
    if (typeof maxPatients !== 'number' || maxPatients < 1 || maxPatients > 100) {
      throw new ValidationError('maxPatients must be a number between 1 and 100');
    }

    // 验证布尔值
    if (typeof isAvailable !== 'boolean') {
      throw new ValidationError('isAvailable must be a boolean');
    }

    const doctorId = req.user.userId;

    // 创建或更新排班
    const schedule = scheduleStore.setSchedule({
      doctorId,
      date,
      timeSlot,
      isAvailable,
      maxPatients,
    });

    logger.info('Schedule set successfully', {
      scheduleId: schedule.id,
      doctorId,
      date,
      timeSlot,
    });

    res.json({
      code: 0,
      data: schedule,
      message: 'success',
    });
  } catch (error) {
    logger.error('Set schedule error', error);
    throw error;
  }
};

/**
 * 删除排班
 * DELETE /api/doctors/schedules/:id
 */
export const deleteSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // 验证用户角色必须是医生
    if (req.user.role !== 'doctor') {
      throw new UnauthorizedError('Only doctors can delete schedules');
    }

    const scheduleId = getRouteParam(req.params.id);

    if (!scheduleId) {
      throw new ValidationError('Schedule ID is required');
    }

    // 获取排班信息
    const schedule = scheduleStore.getById(scheduleId);

    if (!schedule) {
      throw new NotFoundError('Schedule not found');
    }

    // 验证权限：只能删除自己的排班
    if (schedule.doctorId !== req.user.userId) {
      throw new UnauthorizedError('You can only delete your own schedules');
    }

    // 删除排班
    const deleted = scheduleStore.deleteSchedule(
      schedule.doctorId,
      schedule.date,
      schedule.timeSlot
    );

    if (!deleted) {
      throw new NotFoundError('Failed to delete schedule');
    }

    logger.info('Schedule deleted successfully', {
      scheduleId,
      doctorId: req.user.userId,
    });

    res.json({
      code: 0,
      data: { id: scheduleId },
      message: 'success',
    });
  } catch (error) {
    logger.error('Delete schedule error', error);
    throw error;
  }
};
