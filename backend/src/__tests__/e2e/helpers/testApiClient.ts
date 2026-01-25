import request from 'supertest';
import { Response } from 'supertest';
import type { Express } from 'express';

interface AuthResponse {
  code: number;
  data: {
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      phone: string;
      nickname?: string;
      avatarUrl?: string;
      role?: string;
    };
  };
}

export class TestApiClient {
  private app: Express;
  private patientToken: string | null = null;
  private doctorToken: string | null = null;

  constructor(expressApp: Express) {
    this.app = expressApp;
  }

  /**
   * 患者登录
   */
  async loginPatient(phone: string, code: string): Promise<string> {
    const response: Response = await request(this.app)
      .post('/api/auth/login')
      .send({ phone, verifyCode: code });

    if (response.status !== 200) {
      throw new Error(`Login failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as AuthResponse;
    if (body.code !== 0 || !body.data.accessToken) {
      throw new Error(`Login response invalid: ${JSON.stringify(body)}`);
    }

    this.patientToken = body.data.accessToken;
    return this.patientToken;
  }

  /**
   * 医生登录
   */
  async loginDoctor(phone: string, code: string): Promise<string> {
    const response: Response = await request(this.app)
      .post('/api/auth/login')
      .send({ phone, verifyCode: code, role: 'doctor' });

    if (response.status !== 200) {
      throw new Error(`Doctor login failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as AuthResponse;
    if (body.code !== 0 || !body.data.accessToken) {
      throw new Error(`Doctor login response invalid: ${JSON.stringify(body)}`);
    }

    this.doctorToken = body.data.accessToken;
    return this.doctorToken;
  }

  /**
   * 获取存储的 token
   */
  getPatientToken(): string {
    if (!this.patientToken) {
      throw new Error('Patient not logged in');
    }
    return this.patientToken;
  }

  getDoctorToken(): string {
    if (!this.doctorToken) {
      throw new Error('Doctor not logged in');
    }
    return this.doctorToken;
  }
}
