import { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { ValidationError, NotFoundError, UnauthorizedError } from '../utils/errorHandler';
import { v4 as uuidv4 } from 'uuid';
import { wsManager } from '../services/websocket/WebSocketManager';
import { getDoctorList, getDoctorById, getDepartments, getHospitals } from '../services/doctors/doctorService';
import { consultationStore, Consultation } from '../services/storage/consultationStore';
import { messageStore } from '../services/storage/messageStore';

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

// 移除重复的接口定义和本地存储，统一使用 consultationStore

/**
 * 获取医生列表
 * GET /api/consultations/doctors
 */
export const getDoctors = async (req: Request, res: Response): Promise<void> => {
  try {
    const { department, hospital, available } = req.query;

    const filters = {
      department: department as string | undefined,
      hospital: hospital as string | undefined,
      available: available === 'true' ? true : available === 'false' ? false : undefined,
    };

    const doctors = getDoctorList(filters);

    res.json({
      code: 0,
      data: doctors,
      message: 'success',
    });
  } catch (error) {
    logger.error('Get doctors error', error);
    throw error;
  }
};

/**
 * 获取医生详情
 * GET /api/consultations/doctors/:id
 */
export const getDoctorDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const doctorId = getRouteParam(req.params.id);

    const doctor = getDoctorById(doctorId);

    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    res.json({
      code: 0,
      data: doctor,
      message: 'success',
    });
  } catch (error) {
    logger.error('Get doctor detail error', error);
    throw error;
  }
};

/**
 * 获取科室列表
 * GET /api/consultations/departments
 */
export const getDepartmentsList = async (req: Request, res: Response): Promise<void> => {
  try {
    const departments = getDepartments();

    res.json({
      code: 0,
      data: departments,
      message: 'success',
    });
  } catch (error) {
    logger.error('Get departments error', error);
    throw error;
  }
};

/**
 * 获取医院列表
 * GET /api/consultations/hospitals
 */
export const getHospitalsList = async (req: Request, res: Response): Promise<void> => {
  try {
    const hospitals = getHospitals();

    res.json({
      code: 0,
      data: hospitals,
      message: 'success',
    });
  } catch (error) {
    logger.error('Get hospitals error', error);
    throw error;
  }
};

/**
 * 创建问诊
 * POST /api/consultations
 */
export const createConsultation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { doctorId } = req.body;

    if (!doctorId) {
      throw new ValidationError('Doctor ID is required');
    }

    // 验证医生存在且可用
    const doctor = getDoctorById(doctorId);
    if (!doctor) {
      throw new NotFoundError('Doctor not found');
    }

    if (!doctor.isAvailable) {
      throw new ValidationError('Doctor is not available');
    }

    // 创建问诊
    const consultationId = uuidv4();
    const now = new Date().toISOString();

    const consultation: Consultation = {
      id: consultationId,
      patientId: req.user.userId,
      patientPhone: req.user.phone,
      doctorId,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    consultationStore.createConsultation(consultation);

    logger.info('Consultation created', {
      consultationId,
      patientId: req.user.userId,
      doctorId,
    });

    res.json({
      code: 0,
      data: {
        ...consultation,
        doctor,
      },
      message: 'success',
    });
  } catch (error) {
    logger.error('Create consultation error', error);
    throw error;
  }
};

/**
 * 获取问诊列表
 * GET /api/consultations
 */
export const getConsultations = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const consultations = consultationStore
      .getByPatientId(req.user.userId)
      .map((c) => ({
        ...c,
        doctor: getDoctorById(c.doctorId),
      }));

    res.json({
      code: 0,
      data: consultations,
      message: 'success',
    });
  } catch (error) {
    logger.error('Get consultations error', error);
    throw error;
  }
};

/**
 * 获取问诊详情
 * GET /api/consultations/:id
 */
export const getConsultationDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const consultationId = getRouteParam(req.params.id);
    const consultation = consultationStore.getById(consultationId);

    if (!consultation) {
      throw new NotFoundError('Consultation not found');
    }

    // 权限检查：患者和医生都可以查看问诊详情
    if (
      consultation.patientId !== req.user.userId &&
      consultation.doctorId !== req.user.userId
    ) {
      throw new UnauthorizedError('Access denied');
    }

    res.json({
      code: 0,
      data: {
        ...consultation,
        doctor: getDoctorById(consultation.doctorId),
      },
      message: 'success',
    });
  } catch (error) {
    logger.error('Get consultation detail error', error);
    throw error;
  }
};

/**
 * 更新问诊状态
 * PUT /api/consultations/:id/status
 */
export const updateConsultationStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const consultationId = getRouteParam(req.params.id);
    const { status } = req.body;

    if (!['pending', 'active', 'closed', 'cancelled'].includes(status)) {
      throw new ValidationError('Invalid status');
    }

    const consultation = consultationStore.getById(consultationId);

    if (!consultation) {
      throw new NotFoundError('Consultation not found');
    }

    // 权限检查
    if (consultation.patientId !== req.user.userId) {
      throw new UnauthorizedError('Access denied');
    }

    // 更新状态
    const updatedConsultation = consultationStore.updateStatus(consultationId, status);

    logger.info('Consultation status updated', {
      consultationId: consultationId,
      status,
    });

    res.json({
      code: 0,
      data: updatedConsultation,
      message: 'success',
    });
  } catch (error) {
    logger.error('Update consultation status error', error);
    throw error;
  }
};

/**
 * 加入问诊（WebSocket 连接后调用）
 * POST /api/consultations/:id/join
 */
export const joinConsultation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const consultationId = getRouteParam(req.params.id);
    const consultation = consultationStore.getById(consultationId);

    if (!consultation) {
      throw new NotFoundError('Consultation not found');
    }

    // 权限检查
    if (consultation.patientId !== req.user.userId) {
      throw new UnauthorizedError('Access denied');
    }

    // 更新状态为 active
    if (consultation.status === 'pending') {
      consultationStore.updateStatus(consultationId, 'active');
    }

    // 用户加入 WebSocket 会话
    wsManager.joinConversation(req.user.userId, consultationId);

    logger.info('User joined consultation', {
      consultationId: consultationId,
      userId: req.user.userId,
    });

    res.json({
      code: 0,
      data: {
        consultationId: consultationId,
        status: consultation.status,
      },
      message: 'success',
    });
  } catch (error) {
    logger.error('Join consultation error', error);
    throw error;
  }
};

/**
 * 离开问诊
 * POST /api/consultations/:id/leave
 */
export const leaveConsultation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const consultationId = getRouteParam(req.params.id);

    // 用户离开 WebSocket 会话
    wsManager.leaveConversation(req.user.userId, consultationId);

    logger.info('User left consultation', {
      consultationId: consultationId,
      userId: req.user.userId,
    });

    res.json({
      code: 0,
      data: { success: true },
      message: 'success',
    });
  } catch (error) {
    logger.error('Leave consultation error', error);
    throw error;
  }
};

/**
 * 获取待处理的问诊（医生端）
 * GET /api/consultations/pending
 */
export const getPendingConsultations = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      throw new UnauthorizedError('Doctor access required');
    }

    const consultations = consultationStore.getPendingByDoctorId(req.user.userId);

    res.json({
      code: 0,
      data: consultations.map((c) => ({
        ...c,
        patientPhone: maskPhone(c.patientPhone),
        doctor: getDoctorById(c.doctorId),
      })),
      message: 'success',
    });
  } catch (error) {
    logger.error('Get pending consultations error', error);
    throw error;
  }
};

/**
 * 获取医生的问诊列表（所有未关闭）
 * GET /api/consultations/doctor
 */
export const getDoctorConsultations = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      throw new UnauthorizedError('Doctor access required');
    }

    const { status } = req.query;

    let consultations = consultationStore.getByDoctorId(req.user.userId);

    // 只返回未关闭的问诊
    consultations = consultations.filter((c) => c.status !== 'closed' && c.status !== 'cancelled');

    // 按 status 筛选
    if (status && ['pending', 'active'].includes(status as string)) {
      consultations = consultations.filter((c) => c.status === status);
    }

    res.json({
      code: 0,
      data: consultations.map((c) => ({
        ...c,
        patientPhone: maskPhone(c.patientPhone),
        doctor: getDoctorById(c.doctorId),
      })),
      message: 'success',
    });
  } catch (error) {
    logger.error('Get doctor consultations error', error);
    throw error;
  }
};

/**
 * 医生接诊
 * PUT /api/consultations/:id/accept
 */
export const acceptConsultation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      throw new UnauthorizedError('Doctor access required');
    }

    const consultationId = getRouteParam(req.params.id);
    const consultation = consultationStore.getById(consultationId);

    if (!consultation) {
      throw new NotFoundError('Consultation not found');
    }

    if (consultation.doctorId !== req.user.userId) {
      throw new UnauthorizedError('Not your consultation');
    }

    if (consultation.status !== 'pending') {
      throw new ValidationError('Consultation is not pending');
    }

    consultationStore.updateStatus(consultationId, 'active');

    logger.info('Consultation accepted', { consultationId, doctorId: req.user.userId });

    res.json({
      code: 0,
      data: { ...consultation, status: 'active' },
      message: 'success',
    });
  } catch (error) {
    logger.error('Accept consultation error', error);
    throw error;
  }
};

/**
 * 结束问诊
 * PUT /api/consultations/:id/close
 */
export const closeConsultation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      throw new UnauthorizedError('Doctor access required');
    }

    const consultationId = getRouteParam(req.params.id);
    const consultation = consultationStore.getById(consultationId);

    if (!consultation) {
      throw new NotFoundError('Consultation not found');
    }

    if (consultation.doctorId !== req.user.userId) {
      throw new UnauthorizedError('Not your consultation');
    }

    consultationStore.updateStatus(consultationId, 'closed');

    logger.info('Consultation closed', { consultationId, doctorId: req.user.userId });

    res.json({
      code: 0,
      data: { ...consultation, status: 'closed' },
      message: 'success',
    });
  } catch (error) {
    logger.error('Close consultation error', error);
    throw error;
  }
};

function maskPhone(phone: string): string {
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

/**
 * 获取问诊消息历史
 * GET /api/consultations/:id/messages
 */
export const getConsultationMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const consultationId = getRouteParam(req.params.id);
    const consultation = consultationStore.getById(consultationId);

    if (!consultation) {
      throw new NotFoundError('Consultation not found');
    }

    // 权限检查：患者和医生都可以查看消息
    if (
      consultation.patientId !== req.user.userId &&
      consultation.doctorId !== req.user.userId
    ) {
      throw new UnauthorizedError('Access denied');
    }

    const messages = messageStore.getByConsultationId(consultationId);

    res.json({
      code: 0,
      data: messages,
      message: 'success',
    });
  } catch (error) {
    logger.error('Get consultation messages error', error);
    throw error;
  }
};
