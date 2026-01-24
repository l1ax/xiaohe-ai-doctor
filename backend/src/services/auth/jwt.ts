import * as jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../../utils/errorHandler';

// Use different defaults for development vs production
const isDevelopment = process.env.NODE_ENV !== 'production';
const DEFAULT_JWT_SECRET = 'dev-secret-key-change-in-production';

if (!isDevelopment && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable must be set in production');
}

const JWT_SECRET: string = (process.env.JWT_SECRET || DEFAULT_JWT_SECRET);
const JWT_EXPIRES_IN = process.env.JWT_ACCESS_TOKEN_EXPIRES_IN ?? '7d';
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_TOKEN_EXPIRES_IN ?? '30d';

// Double-check at runtime that JWT_SECRET is never empty
if (!JWT_SECRET || JWT_SECRET.length === 0) {
  throw new Error('JWT_SECRET cannot be empty');
}

export interface TokenPayload {
  userId: string;
  phone: string;
  role: 'patient' | 'doctor';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class JWTService {
  generateAccessToken(payload: TokenPayload): string {
    // Type assertion needed because process.env returns string | undefined
    // but we've validated it above with the nullish coalescing operator
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN as any });
  }

  generateRefreshToken(payload: TokenPayload): string {
    // Type assertion needed because process.env returns string | undefined
    // but we've validated it above with the nullish coalescing operator
    return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN as any });
  }

  generateTokenPair(payload: TokenPayload): TokenPair {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  verifyToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as TokenPayload;
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired token');
    }
  }

  decodeToken(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch {
      return null;
    }
  }
}

export const jwtService = new JWTService();
