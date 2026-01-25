import { Request, Response } from 'express';
import { jwtService, TokenPayload } from '../services/auth/jwt';
import { logger } from '../utils/logger';
import { ValidationError, UnauthorizedError, NotFoundError } from '../utils/errorHandler';

// Phone number regex constant for Chinese mobile numbers
const PHONE_REGEX = /^1[3-9]\d{9}$/;

// 临时存储用户数据（MVP 阶段）
const mockUsers: Map<string, {
  id: string;
  phone: string;
  nickname?: string;
  avatarUrl?: string;
  role: 'patient' | 'doctor';
}> = new Map();

// Mock verification code for development/testing
// WARNING: This should only be used in development mode with MOCK_MODE=true
const MOCK_VERIFY_CODE = '123456';

export const sendVerificationCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.body;
    if (!phone || !PHONE_REGEX.test(phone)) {
      throw new ValidationError('Invalid phone number format');
    }

    // Check if mock mode is enabled
    const mockMode = process.env.MOCK_MODE === 'true';
    if (mockMode) {
      logger.debug('Mock verification code sent', { phone });
      res.json({ code: 0, data: { message: 'Verification code sent' }, message: 'success' });
      return;
    }

    // TODO: Integrate with SMS service for production
    logger.info('Verification code requested', { phone });
    res.json({ code: 0, data: { message: 'Verification code sent' }, message: 'success' });
  } catch (error) {
    logger.error('Send verification code error', error);
    throw error;
  }
};

export const loginOrRegister = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, verifyCode, role } = req.body;
    if (!phone || !PHONE_REGEX.test(phone)) {
      throw new ValidationError('Invalid phone number format');
    }

    // Validate role if provided
    if (role && role !== 'patient' && role !== 'doctor') {
      throw new ValidationError('Invalid role. Must be "patient" or "doctor"');
    }

    // In mock mode, accept the mock verification code
    const mockMode = process.env.MOCK_MODE === 'true';
    if (mockMode && verifyCode === MOCK_VERIFY_CODE) {
      // Proceed with mock authentication
    } else if (!mockMode) {
      // TODO: Implement proper verification code validation in production
      throw new ValidationError('Verification code validation not implemented');
    } else {
      throw new ValidationError('Invalid verification code');
    }
    let user = mockUsers.get(phone);
    if (!user) {
      // For testing: map test doctor phone to mock doctor IDs
      let userId: string;
      if (role === 'doctor' && phone === '13800138000') {
        userId = 'doctor_001'; // 张医生
      } else if (role === 'doctor' && phone === '13800138001') {
        userId = 'doctor_002'; // 李医生
      } else if (role === 'doctor' && phone === '13800138002') {
        userId = 'doctor_003'; // 王医生
      } else if (role === 'doctor' && phone === '13800138003') {
        userId = 'doctor_004'; // 赵医生
      } else {
        userId = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      }

      user = {
        id: userId,
        phone,
        role: (role as 'patient' | 'doctor') || 'patient',
      };
      mockUsers.set(phone, user);
      logger.info('New user registered', { phone, userId: user.id, role: user.role });
    } else {
      logger.info('User logged in', { phone, userId: user.id });
    }
    const tokenPayload: TokenPayload = {
      userId: user.id,
      phone: user.phone,
      role: user.role,
    };
    const tokens = jwtService.generateTokenPair(tokenPayload);
    res.json({
      code: 0,
      data: {
        user: { id: user.id, phone: user.phone, nickname: user.nickname, avatarUrl: user.avatarUrl, role: user.role },
        ...tokens,
      },
      message: 'success',
    });
  } catch (error) {
    logger.error('Login error', error);
    throw error;
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: refreshTokenReq } = req.body;
    if (!refreshTokenReq) {
      throw new ValidationError('Refresh token is required');
    }
    const payload = jwtService.verifyToken(refreshTokenReq);
    const user = mockUsers.get(payload.phone);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    const tokenPayload: TokenPayload = {
      userId: user.id,
      phone: user.phone,
      role: user.role,
    };
    const tokens = jwtService.generateTokenPair(tokenPayload);
    res.json({ code: 0, data: tokens, message: 'success' });
  } catch (error) {
    logger.error('Refresh token error', error);
    throw new UnauthorizedError('Invalid refresh token');
  }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    const user = mockUsers.get(req.user.phone);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    res.json({
      code: 0,
      data: { user: { id: user.id, phone: user.phone, nickname: user.nickname, avatarUrl: user.avatarUrl, role: user.role } },
      message: 'success',
    });
  } catch (error) {
    logger.error('Get profile error', error);
    throw error;
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    const { nickname, avatarUrl } = req.body;
    const user = mockUsers.get(req.user.phone);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    if (nickname !== undefined) user.nickname = nickname;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    mockUsers.set(req.user.phone, user);
    logger.info('User profile updated', { userId: user.id });
    res.json({
      code: 0,
      data: { user: { id: user.id, phone: user.phone, nickname: user.nickname, avatarUrl: user.avatarUrl, role: user.role } },
      message: 'success',
    });
  } catch (error) {
    logger.error('Update profile error', error);
    throw error;
  }
};
