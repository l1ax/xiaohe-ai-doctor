import { Request, Response } from 'express';
import { jwtService, TokenPayload } from '../services/auth/jwt';
import { logger } from '../utils/logger';
import { ValidationError, UnauthorizedError, NotFoundError } from '../utils/errorHandler';

// 临时存储用户数据（MVP 阶段）
const mockUsers: Map<string, {
  id: string;
  phone: string;
  nickname?: string;
  avatarUrl?: string;
  role: 'patient' | 'doctor';
}> = new Map();

const MOCK_VERIFY_CODE = '123456';

export const sendVerificationCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone } = req.body;
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phone || !phoneRegex.test(phone)) {
      throw new ValidationError('Invalid phone number format');
    }
    logger.info('Verification code requested', { phone });
    logger.info('Mock verification code sent', { phone, code: MOCK_VERIFY_CODE });
    res.json({ code: 0, data: { message: 'Verification code sent' }, message: 'success' });
  } catch (error) {
    logger.error('Send verification code error', error);
    throw error;
  }
};

export const loginOrRegister = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, verifyCode } = req.body;
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phone || !phoneRegex.test(phone)) {
      throw new ValidationError('Invalid phone number format');
    }
    if (!verifyCode || verifyCode !== MOCK_VERIFY_CODE) {
      throw new ValidationError('Invalid verification code');
    }
    let user = mockUsers.get(phone);
    if (!user) {
      user = {
        id: `user_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        phone,
        role: 'patient',
      };
      mockUsers.set(phone, user);
      logger.info('New user registered', { phone, userId: user.id });
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
      data: { id: user.id, phone: user.phone, nickname: user.nickname, avatarUrl: user.avatarUrl, role: user.role },
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
      data: { id: user.id, phone: user.phone, nickname: user.nickname, avatarUrl: user.avatarUrl, role: user.role },
      message: 'success',
    });
  } catch (error) {
    logger.error('Update profile error', error);
    throw error;
  }
};
