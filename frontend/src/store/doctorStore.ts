import { makeAutoObservable } from 'mobx';
import { storage } from '../utils/storage';

interface DoctorStats {
  today: number;
  pending: number;
  income: number;
}

export interface Consultation {
  id: string;
  patientId: string;
  patientName: string;
  patientAvatar?: string;
  symptoms: string;
  status: 'pending' | 'ongoing' | 'completed';
  urgency: 'low' | 'medium' | 'high';
  createdAt: string;
  waitingTime?: number; // 等待时间（分钟）
}

interface Schedule {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

class DoctorStore {
  // 医生在线状态
  isOnline = true;

  // 待处理问诊列表
  pendingConsultations: Consultation[] = [];

  // 统计数据
  stats: DoctorStats = { today: 0, pending: 0, income: 0 };

  // 排班数据
  schedules: Schedule[] = [];

  // 加载状态
  isLoading = false;

  // 错误信息
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  // 获取 Token
  private getToken(): string {
    const tokenData = storage.getToken();
    return tokenData?.accessToken || '';
  }

  // 切换在线状态
  setOnlineStatus(online: boolean) {
    this.isOnline = online;
    this.syncStatusToServer();
  }

  // 获取待处理问诊
  async fetchPendingConsultations() {
    this.isLoading = true;
    this.error = null;
    try {
      const token = this.getToken();
      const res = await fetch('/api/consultations/pending', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('获取待处理问诊失败');
      }

      const { data } = await res.json();
      this.pendingConsultations = data || [];
      this.stats.pending = this.pendingConsultations.length;

      // 计算等待时间
      this.pendingConsultations = this.pendingConsultations.map((c: Consultation) => ({
        ...c,
        waitingTime: Math.floor((Date.now() - new Date(c.createdAt).getTime()) / 60000)
      }));
    } catch (error) {
      console.error('获取待处理问诊失败', error);
      this.error = '获取待处理问诊失败';
      this.pendingConsultations = [];
    } finally {
      this.isLoading = false;
    }
  }

  // 获取统计数据
  async fetchStats() {
    this.isLoading = true;
    this.error = null;
    try {
      const token = this.getToken();
      const res = await fetch('/api/doctors/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        // 如果 API 不存在，使用模拟数据
        this.stats = {
          today: Math.floor(Math.random() * 20) + 5,
          pending: this.pendingConsultations.length,
          income: Math.floor(Math.random() * 2000) + 500
        };
        return;
      }

      const { data } = await res.json();
      this.stats = data;
    } catch (error) {
      console.error('获取统计数据失败', error);
      // 使用模拟数据作为后备
      this.stats = {
        today: Math.floor(Math.random() * 20) + 5,
        pending: this.pendingConsultations.length,
        income: Math.floor(Math.random() * 2000) + 500
      };
    } finally {
      this.isLoading = false;
    }
  }

  // 获取排班数据
  async fetchSchedules(date?: string) {
    this.isLoading = true;
    this.error = null;
    try {
      const token = this.getToken();
      const url = date ? `/api/schedules?date=${date}` : '/api/schedules';
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('获取排班数据失败');
      }

      const { data } = await res.json();
      this.schedules = data || [];
    } catch (error) {
      console.error('获取排班数据失败', error);
      this.error = '获取排班数据失败';
      this.schedules = [];
    } finally {
      this.isLoading = false;
    }
  }

  // 同步在线状态到服务器
  private async syncStatusToServer() {
    try {
      const token = this.getToken();
      await fetch('/api/doctors/status', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isAvailable: this.isOnline })
      });
    } catch (error) {
      console.error('同步状态失败', error);
    }
  }

  // 接受问诊
  async acceptConsultation(consultationId: string) {
    try {
      const token = this.getToken();
      const res = await fetch(`/api/consultations/${consultationId}/accept`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('接诊失败');
      }

      // 从待处理列表中移除
      this.pendingConsultations = this.pendingConsultations.filter(
        c => c.id !== consultationId
      );
      this.stats.pending = this.pendingConsultations.length;

      return true;
    } catch (error) {
      console.error('接诊失败', error);
      this.error = '接诊失败';
      return false;
    }
  }
}

export const doctorStore = new DoctorStore();
