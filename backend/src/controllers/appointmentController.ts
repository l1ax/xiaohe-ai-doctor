import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { ValidationError, NotFoundError, UnauthorizedError } from '../utils/errorHandler';
import { getDoctorById, getDoctorList } from '../services/doctors/doctorService';
import {
  getDoctorSchedule,
  createAppointment,
  getUserAppointments,
  getAppointmentById,
  cancelAppointment,
  getDoctorAppointments,
} from '../services/appointments/appointmentService';

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
 * 获取医生列表（用于预约）
 * GET /api/appointments/doctors
 */
export const getDoctorsForAppointment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { department, hospital, available } = req.query;

    const filters = {
      department: department as string | undefined,
      hospital: hospital as string | undefined,
      available: available === 'true' ? true : available === 'false' ? false : undefined,
    };

    const doctors = getDoctorList(filters);

    // 转换字段名以匹配前端接口 (isAvailable -> available)
    const formattedDoctors = doctors.map((doctor) => ({
      id: doctor.id,
      name: doctor.name,
      title: doctor.title,
      hospital: doctor.hospital,
      department: doctor.department,
      rating: doctor.rating,
      available: doctor.isAvailable,
    }));

    res.json({
      code: 0,
      data: formattedDoctors,
      message: 'success',
    });
  } catch (error) {
    logger.error('Get doctors for appointment error', error);
    throw error;
  }
};

/**
 * 获取医生排班
 * GET /api/appointments/schedule
 */
export const getSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { doctorId, startDate, endDate } = req.query;

    if (!doctorId || !startDate || !endDate) {
      throw new ValidationError('Missing required parameters');
    }

    // 验证医生存在
    const doctor = getDoctorById(doctorId as string);
    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    const schedules = getDoctorSchedule(
      doctorId as string,
      startDate as string,
      endDate as string
    );

    res.json({
      code: 0,
      data: {
        doctor,
        schedules,
      },
      message: 'success',
    });
  } catch (error) {
    logger.error('Get schedule error', error);
    throw error;
  }
};

/**
 * 创建预约
 * POST /api/appointments
 */
export const createAppointmentHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { doctorId, appointmentTime, patientName } = req.body;

    if (!doctorId || !appointmentTime) {
      throw new ValidationError('Missing required fields');
    }

    // 验证医生存在
    const doctor = getDoctorById(doctorId);
    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    // 创建预约
    const appointment = createAppointment(
      req.user.userId,
      patientName || '患者',
      req.user.phone,
      doctorId,
      doctor.name,
      doctor.hospital,
      doctor.department,
      appointmentTime
    );

    logger.info('Appointment created', {
      appointmentId: appointment.id,
      patientId: req.user.userId,
      doctorId,
    });

    res.status(201).json({
      code: 0,
      data: {
        ...appointment,
        doctor,
      },
      message: 'success',
    });
  } catch (error) {
    logger.error('Create appointment error', error);
    throw error;
  }
};

/**
 * 获取我的预约列表
 * GET /api/appointments
 */
export const getAppointments = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const appointments = getUserAppointments(req.user.userId).map((a) => {
      const doctor = getDoctorById(a.doctorId);
      return {
        ...a,
        doctor,
      };
    });

    res.json({
      code: 0,
      data: appointments,
      message: 'success',
    });
  } catch (error) {
    logger.error('Get appointments error', error);
    throw error;
  }
};

/**
 * 获取预约详情
 * GET /api/appointments/:id
 */
export const getAppointmentDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const id = getRouteParam(req.params.id);
    const appointment = getAppointmentById(id);

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    // 权限检查
    if (appointment.patientId !== req.user.userId) {
      throw new UnauthorizedError('Access denied');
    }

    const doctor = getDoctorById(appointment.doctorId);

    res.json({
      code: 0,
      data: {
        ...appointment,
        doctor,
      },
      message: 'success',
    });
  } catch (error) {
    logger.error('Get appointment detail error', error);
    throw error;
  }
};

/**
 * 取消预约
 * PUT /api/appointments/:id/cancel
 */
export const cancelAppointmentHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const id = getRouteParam(req.params.id);
    const appointment = cancelAppointment(id);

    if (!appointment) {
      throw new NotFoundError('Appointment not found');
    }

    // 权限检查
    if (appointment.patientId !== req.user.userId) {
      throw new UnauthorizedError('Access denied');
    }

    logger.info('Appointment cancelled', {
      appointmentId: id,
      patientId: req.user.userId,
    });

    res.json({
      code: 0,
      data: appointment,
      message: 'success',
    });
  } catch (error) {
    logger.error('Cancel appointment error', error);
    throw error;
  }
};

/**
 * 获取医生的预约列表（医生端）
 * GET /api/appointments/doctor
 */
export const getDoctorAppointmentsHandler = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // 验证用户必须是医生角色
    if (req.user.role !== 'doctor') {
      throw new UnauthorizedError('Only doctors can access this endpoint');
    }

    // 从 req.user.userId 获取医生 ID
    const doctorId = req.user.userId;

    // 支持按状态筛选
    const { status } = req.query;
    const appointments = getDoctorAppointments(
      doctorId,
      status as any
    );

    logger.info('Doctor appointments retrieved', {
      doctorId,
      count: appointments.length,
      status: status || 'all',
    });

    res.json({
      code: 0,
      data: appointments,
      message: 'success',
    });
  } catch (error) {
    logger.error('Get doctor appointments error', error);
    throw error;
  }
};
