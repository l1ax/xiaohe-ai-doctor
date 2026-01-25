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

  /**
   * 获取医生列表
   */
  async getDoctors(
    token: string,
    filters?: {
      department?: string;
      hospital?: string;
      available?: boolean;
    }
  ): Promise<any[]> {
    const response: Response = await request(this.app)
      .get('/api/consultations/doctors')
      .query(filters || {})
      .set('Authorization', `Bearer ${token}`);

    if (response.status !== 200) {
      throw new Error(`Get doctors failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as { code: number; data: any[] };
    if (body.code !== 0) {
      throw new Error(`Get doctors response invalid: ${JSON.stringify(body)}`);
    }

    return body.data;
  }

  /**
   * 获取医生详情
   */
  async getDoctorDetail(token: string, doctorId: string): Promise<any> {
    const response: Response = await request(this.app)
      .get(`/api/consultations/doctors/${doctorId}`)
      .set('Authorization', `Bearer ${token}`);

    if (response.status !== 200) {
      throw new Error(`Get doctor detail failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as { code: number; data: any };
    if (body.code !== 0) {
      throw new Error(`Get doctor detail response invalid: ${JSON.stringify(body)}`);
    }

    return body.data;
  }

  /**
   * 创建问诊
   */
  async createConsultation(token: string, doctorId: string): Promise<any> {
    const response: Response = await request(this.app)
      .post('/api/consultations')
      .set('Authorization', `Bearer ${token}`)
      .send({ doctorId });

    if (response.status !== 200) {
      throw new Error(`Create consultation failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as { code: number; data: any };
    if (body.code !== 0 || !body.data.id) {
      throw new Error(`Create consultation response invalid: ${JSON.stringify(body)}`);
    }

    return body.data;
  }

  /**
   * 获取待接诊列表（医生端）
   */
  async getPendingConsultations(token: string): Promise<any[]> {
    const response: Response = await request(this.app)
      .get('/api/consultations/pending')
      .set('Authorization', `Bearer ${token}`);

    if (response.status !== 200) {
      throw new Error(`Get pending consultations failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as { code: number; data: any[] };
    if (body.code !== 0) {
      throw new Error(`Get pending consultations response invalid: ${JSON.stringify(body)}`);
    }

    return body.data;
  }

  /**
   * 医生接诊
   */
  async acceptConsultation(token: string, consultationId: string): Promise<void> {
    const response: Response = await request(this.app)
      .put(`/api/consultations/${consultationId}/accept`)
      .set('Authorization', `Bearer ${token}`);

    if (response.status !== 200) {
      throw new Error(`Accept consultation failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as { code: number };
    if (body.code !== 0) {
      throw new Error(`Accept consultation response invalid: ${JSON.stringify(body)}`);
    }
  }

  /**
   * 结束问诊
   */
  async closeConsultation(token: string, consultationId: string): Promise<void> {
    const response: Response = await request(this.app)
      .put(`/api/consultations/${consultationId}/close`)
      .set('Authorization', `Bearer ${token}`);

    if (response.status !== 200) {
      throw new Error(`Close consultation failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as { code: number };
    if (body.code !== 0) {
      throw new Error(`Close consultation response invalid: ${JSON.stringify(body)}`);
    }
  }

  /**
   * 获取问诊详情
   */
  async getConsultationDetail(token: string, consultationId: string): Promise<any> {
    const response: Response = await request(this.app)
      .get(`/api/consultations/${consultationId}`)
      .set('Authorization', `Bearer ${token}`);

    if (response.status !== 200) {
      throw new Error(`Get consultation detail failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as { code: number; data: any };
    if (body.code !== 0) {
      throw new Error(`Get consultation detail response invalid: ${JSON.stringify(body)}`);
    }

    return body.data;
  }

  /**
   * 加入问诊会话
   */
  async joinConsultation(token: string, consultationId: string): Promise<void> {
    const response: Response = await request(this.app)
      .post(`/api/consultations/${consultationId}/join`)
      .set('Authorization', `Bearer ${token}`);

    if (response.status !== 200) {
      throw new Error(`Join consultation failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as { code: number };
    if (body.code !== 0) {
      throw new Error(`Join consultation response invalid: ${JSON.stringify(body)}`);
    }
  }

  /**
   * 离开问诊会话
   */
  async leaveConsultation(token: string, consultationId: string): Promise<void> {
    const response: Response = await request(this.app)
      .post(`/api/consultations/${consultationId}/leave`)
      .set('Authorization', `Bearer ${token}`);

    if (response.status !== 200) {
      throw new Error(`Leave consultation failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as { code: number };
    if (body.code !== 0) {
      throw new Error(`Leave consultation response invalid: ${JSON.stringify(body)}`);
    }
  }
}
