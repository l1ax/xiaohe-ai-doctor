import { request } from '../utils/request';

export interface User {
  id: string;
  phone: string;
  nickname?: string;
  avatarUrl?: string;
  role: 'patient' | 'doctor';
  name?: string;
  department?: string;
  hospital?: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export const authApi = {
  sendCode(phone: string) {
    return request.post<{ message: string }>('/auth/send-code', { phone });
  },

  login(phone: string, verifyCode: string, role?: 'patient' | 'doctor') {
    return request.post<LoginResponse>('/auth/login', { phone, verifyCode, role });
  },

  refreshToken(refreshToken: string) {
    return request.post<{ accessToken: string; refreshToken: string }>('/auth/refresh', { refreshToken });
  },

  getProfile() {
    return request.get<{ user: User }>('/auth/profile');
  },

  updateProfile(data: { nickname?: string; avatarUrl?: string }) {
    return request.put<{ user: User }>('/auth/profile', data);
  },
};
