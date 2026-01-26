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

  /**
   * 获取医生排班
   */
  async getDoctorSchedule(
    token: string,
    doctorId: string,
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    const response: Response = await request(this.app)
      .get('/api/appointments/schedule')
      .query({ doctorId, startDate, endDate })
      .set('Authorization', `Bearer ${token}`);

    if (response.status !== 200) {
      throw new Error(`Get doctor schedule failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as { code: number; data: { schedules: any[] } };
    if (body.code !== 0 || !body.data.schedules) {
      throw new Error(`Get doctor schedule response invalid: ${JSON.stringify(body)}`);
    }

    return body.data.schedules;
  }

  /**
   * 创建预约
   */
  async createAppointment(
    token: string,
    data: {
      doctorId: string;
      patientName: string;
      appointmentTime: string;
    }
  ): Promise<any> {
    const response: Response = await request(this.app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send(data);

    if (response.status !== 201) {
      throw new Error(`Create appointment failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as { code: number; data: any };
    if (body.code !== 0 || !body.data.id) {
      throw new Error(`Create appointment response invalid: ${JSON.stringify(body)}`);
    }

    return body.data;
  }

  /**
   * 获取我的预约列表
   */
  async getMyAppointments(token: string): Promise<any[]> {
    const response: Response = await request(this.app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${token}`);

    if (response.status !== 200) {
      throw new Error(`Get my appointments failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as { code: number; data: any[] };
    if (body.code !== 0) {
      throw new Error(`Get my appointments response invalid: ${JSON.stringify(body)}`);
    }

    return body.data;
  }

  /**
   * 获取预约详情
   */
  async getAppointmentDetail(token: string, appointmentId: string): Promise<any> {
    const response: Response = await request(this.app)
      .get(`/api/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${token}`);

    if (response.status !== 200) {
      throw new Error(`Get appointment detail failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as { code: number; data: any };
    if (body.code !== 0) {
      throw new Error(`Get appointment detail response invalid: ${JSON.stringify(body)}`);
    }

    return body.data;
  }

  /**
   * 取消预约
   */
  async cancelAppointment(token: string, appointmentId: string): Promise<void> {
    const response: Response = await request(this.app)
      .put(`/api/appointments/${appointmentId}/cancel`)
      .set('Authorization', `Bearer ${token}`);

    if (response.status !== 200) {
      throw new Error(`Cancel appointment failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as { code: number };
    if (body.code !== 0) {
      throw new Error(`Cancel appointment response invalid: ${JSON.stringify(body)}`);
    }
  }

  /**
   * 获取预约医生列表
   */
  async getAppointmentDoctors(
    token: string,
    filters?: {
      department?: string;
      hospital?: string;
      available?: boolean;
    }
  ): Promise<any[]> {
    const response: Response = await request(this.app)
      .get('/api/appointments/doctors')
      .query(filters || {})
      .set('Authorization', `Bearer ${token}`);

    if (response.status !== 200) {
      throw new Error(`Get appointment doctors failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as { code: number; data: any[] };
    if (body.code !== 0) {
      throw new Error(`Get appointment doctors response invalid: ${JSON.stringify(body)}`);
    }

    return body.data;
  }

  /**
   * 获取医生的预约列表（医生端）
   */
  async getDoctorAppointments(
    token: string,
    status?: string
  ): Promise<any[]> {
    const response: Response = await request(this.app)
      .get('/api/appointments/doctor')
      .query(status ? { status } : {})
      .set('Authorization', `Bearer ${token}`);

    if (response.status !== 200) {
      throw new Error(`Get doctor appointments failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as { code: number; data: any[] };
    if (body.code !== 0) {
      throw new Error(`Get doctor appointments response invalid: ${JSON.stringify(body)}`);
    }

    return body.data;
  }

  /**
   * 获取问诊消息历史
   */
  async getConsultationMessages(token: string, consultationId: string): Promise<any[]> {
    const response: Response = await request(this.app)
      .get(`/api/consultations/${consultationId}/messages`)
      .set('Authorization', `Bearer ${token}`);

    if (response.status !== 200) {
      throw new Error(`Get consultation messages failed: ${JSON.stringify(response.body)}`);
    }

    const body = response.body as { code: number; data: any[] };
    if (body.code !== 0) {
      throw new Error(`Get consultation messages response invalid: ${JSON.stringify(body)}`);
    }

    return body.data;
  }
}
