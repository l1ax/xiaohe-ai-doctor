import { describe, it, expect } from 'vitest';
import { jwtService, TokenPayload } from '../jwt';

describe('JWTService', () => {
  const mockPayload: TokenPayload = {
    userId: 'user-123',
    phone: '13800138000',
    role: 'patient',
  };

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = jwtService.generateAccessToken(mockPayload);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
    });

    it('should contain correct payload in token', () => {
      const token = jwtService.generateAccessToken(mockPayload);
      const decoded = jwtService.verifyToken(token);
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.phone).toBe(mockPayload.phone);
      expect(decoded.role).toBe(mockPayload.role);
    });
  });

  describe('generateTokenPair', () => {
    it('should generate both access and refresh tokens', () => {
      const tokens = jwtService.generateTokenPair(mockPayload);
      expect(tokens.accessToken).toBeTruthy();
      expect(tokens.refreshToken).toBeTruthy();
      expect(tokens.accessToken).not.toBe(tokens.refreshToken);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', () => {
      const token = jwtService.generateAccessToken(mockPayload);
      const decoded = jwtService.verifyToken(token);
      expect(decoded.userId).toBe(mockPayload.userId);
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        jwtService.verifyToken('invalid-token');
      }).toThrow();
    });
  });
});
