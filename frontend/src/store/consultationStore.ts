import { makeAutoObservable, runInAction } from 'mobx';
import { userStore } from './userStore';

interface Consultation {
  id: string;
  patientId: string;
  patientPhone: string;
  doctorId: string;
  status: 'pending' | 'active' | 'closed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
  lastMessageTime?: string;
}

class ConsultationStore {
  consultations: Consultation[] = [];
  loading = false;
  error: string | null = null;
  currentTab: 'all' | 'pending' | 'active' = 'all';

  constructor() {
    makeAutoObservable(this);
  }

  // 从服务器加载问诊列表
  async loadConsultations(statusFilter?: 'all' | 'pending' | 'active') {
    this.loading = true;
    this.error = null;

    try {
      const params = statusFilter && statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/consultations/doctor${params}`, {
        headers: { Authorization: `Bearer ${userStore.accessToken}` },
      });
      const data = await res.json();

      runInAction(() => {
        if (data.code === 0) {
          this.consultations = data.data;
        }
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = '加载问诊列表失败';
        this.loading = false;
      });
    }
  }

  // 更新单个问诊（WebSocket 收到更新时调用）
  updateConsultation(updatedConsultation: Partial<Consultation> & { id: string }) {
    runInAction(() => {
      const index = this.consultations.findIndex(c => c.id === updatedConsultation.id);

      if (index !== -1) {
        // 更新现有问诊
        this.consultations[index] = {
          ...this.consultations[index],
          ...updatedConsultation,
        };
      } else {
        // 添加新问诊（如果是新分配的）
        if (updatedConsultation.status !== 'closed' && updatedConsultation.status !== 'cancelled') {
          this.consultations.unshift(updatedConsultation as Consultation);
        }
      }
    });
  }

  // 移除问诊（状态变为 closed/cancelled 时）
  removeConsultation(consultationId: string) {
    runInAction(() => {
      this.consultations = this.consultations.filter(c => c.id !== consultationId);
    });
  }

  // 设置当前筛选 Tab
  setCurrentTab(tab: 'all' | 'pending' | 'active') {
    this.currentTab = tab;
    this.loadConsultations(tab);
  }

  // 获取过滤后的问诊列表
  get filteredConsultations() {
    if (this.currentTab === 'all') {
      return this.consultations;
    }
    return this.consultations.filter(c => c.status === this.currentTab);
  }
}

export const consultationStore = new ConsultationStore();
