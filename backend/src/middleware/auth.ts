import { Request, Response, NextFunction } from 'express';
import { jwtService } from '../services/auth/jwt';
import { logger } from '../utils/logger';
import { UnauthorizedError } from '../utils/errorHandler';

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        phone: string;
        role: 'patient' | 'doctor';
      };
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }
    const token = authHeader.substring(7);
    const payload = jwtService.verifyToken(token);
    req.user = {
      userId: payload.userId,
      phone: payload.phone,
      role: payload.role,
    };
    next();
  } catch (error) {
    logger.warn('Authentication failed', { error: error instanceof Error ? error.message : String(error) });
    throw new UnauthorizedError('Invalid or expired token');
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = jwtService.verifyToken(token);
      req.user = {
        userId: payload.userId,
        phone: payload.phone,
        role: payload.role,
      };
    }
  } catch (error) {
    logger.debug('Optional auth failed, continuing without user');
  }
  next();
}

export function requireRole(...allowedRoles: ('patient' | 'doctor')[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    if (!allowedRoles.includes(req.user.role)) {
      throw new UnauthorizedError('Insufficient permissions');
    }
    next();
  };
}
