import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { consultationStore } from '../consultationStore';

// Mock userStore
vi.mock('../userStore', () => ({
  userStore: {
    get accessToken() {
      return 'test-token';
    },
  },
}));

// Mock fetch
global.fetch = vi.fn();

describe('ConsultationStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    consultationStore.consultations = [];
    consultationStore.loading = false;
    consultationStore.error = null;
    consultationStore.currentTab = 'all';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('updateConsultation', () => {
    it('应该更新现有问诊的消息', () => {
      consultationStore.consultations = [{
        id: 'c1',
        patientId: 'p1',
        doctorId: 'd1',
        status: 'active' as const,
        patientPhone: '138****0000',
        createdAt: '2026-01-26T10:00:00Z',
        updatedAt: '2026-01-26T10:00:00Z',
        lastMessage: '旧消息',
      }];

      consultationStore.updateConsultation({
        id: 'c1',
        lastMessage: '新消息',
        lastMessageTime: '2026-01-26T10:05:00Z',
      });

      expect(consultationStore.consultations[0].lastMessage).toBe('新消息');
      expect(consultationStore.consultations[0].lastMessageTime).toBe('2026-01-26T10:05:00Z');
    });

    it('应该添加新问诊到列表开头', () => {
      consultationStore.consultations = [{
        id: 'c1',
        patientId: 'p1',
        doctorId: 'd1',
        status: 'active' as const,
        patientPhone: '138****0000',
        createdAt: '2026-01-26T10:00:00Z',
        updatedAt: '2026-01-26T10:00:00Z',
      }];

      consultationStore.updateConsultation({
        id: 'c2',
        patientId: 'p2',
        doctorId: 'd1',
        status: 'pending' as const,
        patientPhone: '139****0000',
        createdAt: '2026-01-26T10:10:00Z',
        updatedAt: '2026-01-26T10:10:00Z',
      });

      expect(consultationStore.consultations).toHaveLength(2);
      expect(consultationStore.consultations[0].id).toBe('c2');
    });

    it('不应该添加已关闭的问诊', () => {
      consultationStore.updateConsultation({
        id: 'c-closed',
        patientId: 'p1',
        doctorId: 'd1',
        status: 'closed' as const,
        patientPhone: '138****0000',
        createdAt: '2026-01-26T10:00:00Z',
        updatedAt: '2026-01-26T10:00:00Z',
      });

      expect(consultationStore.consultations).toHaveLength(0);
    });

    it('不应该添加已取消的问诊', () => {
      consultationStore.updateConsultation({
        id: 'c-cancelled',
        patientId: 'p1',
        doctorId: 'd1',
        status: 'cancelled' as const,
        patientPhone: '138****0000',
        createdAt: '2026-01-26T10:00:00Z',
        updatedAt: '2026-01-26T10:00:00Z',
      });

      expect(consultationStore.consultations).toHaveLength(0);
    });

    it('应该更新现有问诊的状态', () => {
      consultationStore.consultations = [{
        id: 'c1',
        patientId: 'p1',
        doctorId: 'd1',
        status: 'pending' as const,
        patientPhone: '138****0000',
        createdAt: '2026-01-26T10:00:00Z',
        updatedAt: '2026-01-26T10:00:00Z',
      }];

      consultationStore.updateConsultation({
        id: 'c1',
        status: 'active' as const,
        updatedAt: '2026-01-26T10:05:00Z',
      });

      expect(consultationStore.consultations[0].status).toBe('active');
      expect(consultationStore.consultations[0].updatedAt).toBe('2026-01-26T10:05:00Z');
    });
  });

  describe('removeConsultation', () => {
    it('应该从列表中移除指定问诊', () => {
      consultationStore.consultations = [
        {
          id: 'c1',
          patientId: 'p1',
          doctorId: 'd1',
          status: 'closed' as const,
          patientPhone: '',
          createdAt: '2026-01-26T10:00:00Z',
          updatedAt: '2026-01-26T10:00:00Z',
        },
        {
          id: 'c2',
          patientId: 'p2',
          doctorId: 'd1',
          status: 'active' as const,
          patientPhone: '',
          createdAt: '2026-01-26T10:00:00Z',
          updatedAt: '2026-01-26T10:00:00Z',
        },
      ];

      consultationStore.removeConsultation('c1');

      expect(consultationStore.consultations).toHaveLength(1);
      expect(consultationStore.consultations[0].id).toBe('c2');
    });

    it('移除不存在的问诊不应报错', () => {
      consultationStore.consultations = [{
        id: 'c1',
        patientId: 'p1',
        doctorId: 'd1',
        status: 'active' as const,
        patientPhone: '',
        createdAt: '2026-01-26T10:00:00Z',
        updatedAt: '2026-01-26T10:00:00Z',
      }];

      consultationStore.removeConsultation('non-existent');

      expect(consultationStore.consultations).toHaveLength(1);
    });

    it('应该能够移除列表中的第一个问诊', () => {
      consultationStore.consultations = [
        {
          id: 'c1',
          patientId: 'p1',
          doctorId: 'd1',
          status: 'active' as const,
          patientPhone: '',
          createdAt: '2026-01-26T10:00:00Z',
          updatedAt: '2026-01-26T10:00:00Z',
        },
        {
          id: 'c2',
          patientId: 'p2',
          doctorId: 'd1',
          status: 'active' as const,
          patientPhone: '',
          createdAt: '2026-01-26T10:00:00Z',
          updatedAt: '2026-01-26T10:00:00Z',
        },
      ];

      consultationStore.removeConsultation('c1');

      expect(consultationStore.consultations).toHaveLength(1);
      expect(consultationStore.consultations[0].id).toBe('c2');
    });

    it('应该能够移除列表中的最后一个问诊', () => {
      consultationStore.consultations = [
        {
          id: 'c1',
          patientId: 'p1',
          doctorId: 'd1',
          status: 'active' as const,
          patientPhone: '',
          createdAt: '2026-01-26T10:00:00Z',
          updatedAt: '2026-01-26T10:00:00Z',
        },
        {
          id: 'c2',
          patientId: 'p2',
          doctorId: 'd1',
          status: 'active' as const,
          patientPhone: '',
          createdAt: '2026-01-26T10:00:00Z',
          updatedAt: '2026-01-26T10:00:00Z',
        },
      ];

      consultationStore.removeConsultation('c2');

      expect(consultationStore.consultations).toHaveLength(1);
      expect(consultationStore.consultations[0].id).toBe('c1');
    });
  });

  describe('filteredConsultations', () => {
    it('应该根据当前筛选返回对应问诊', () => {
      consultationStore.consultations = [
        {
          id: 'c1',
          patientId: 'p1',
          doctorId: 'd1',
          status: 'pending' as const,
          patientPhone: '',
          createdAt: '2026-01-26T10:00:00Z',
          updatedAt: '2026-01-26T10:00:00Z',
        },
        {
          id: 'c2',
          patientId: 'p2',
          doctorId: 'd1',
          status: 'active' as const,
          patientPhone: '',
          createdAt: '2026-01-26T10:00:00Z',
          updatedAt: '2026-01-26T10:00:00Z',
        },
        {
          id: 'c3',
          patientId: 'p3',
          doctorId: 'd1',
          status: 'pending' as const,
          patientPhone: '',
          createdAt: '2026-01-26T10:00:00Z',
          updatedAt: '2026-01-26T10:00:00Z',
        },
      ];

      consultationStore.currentTab = 'pending';

      expect(consultationStore.filteredConsultations).toHaveLength(2);
      expect(consultationStore.filteredConsultations.every(c => c.status === 'pending')).toBe(true);
    });

    it('应该返回所有问诊当筛选为 all 时', () => {
      consultationStore.consultations = [
        {
          id: 'c1',
          patientId: 'p1',
          doctorId: 'd1',
          status: 'pending' as const,
          patientPhone: '',
          createdAt: '2026-01-26T10:00:00Z',
          updatedAt: '2026-01-26T10:00:00Z',
        },
        {
          id: 'c2',
          patientId: 'p2',
          doctorId: 'd1',
          status: 'active' as const,
          patientPhone: '',
          createdAt: '2026-01-26T10:00:00Z',
          updatedAt: '2026-01-26T10:00:00Z',
        },
      ];

      consultationStore.currentTab = 'all';

      expect(consultationStore.filteredConsultations).toHaveLength(2);
    });

    it('应该只返回 active 状态的问诊', () => {
      consultationStore.consultations = [
        {
          id: 'c1',
          patientId: 'p1',
          doctorId: 'd1',
          status: 'pending' as const,
          patientPhone: '',
          createdAt: '2026-01-26T10:00:00Z',
          updatedAt: '2026-01-26T10:00:00Z',
        },
        {
          id: 'c2',
          patientId: 'p2',
          doctorId: 'd1',
          status: 'active' as const,
          patientPhone: '',
          createdAt: '2026-01-26T10:00:00Z',
          updatedAt: '2026-01-26T10:00:00Z',
        },
        {
          id: 'c3',
          patientId: 'p3',
          doctorId: 'd1',
          status: 'active' as const,
          patientPhone: '',
          createdAt: '2026-01-26T10:00:00Z',
          updatedAt: '2026-01-26T10:00:00Z',
        },
      ];

      consultationStore.currentTab = 'active';

      expect(consultationStore.filteredConsultations).toHaveLength(2);
      expect(consultationStore.filteredConsultations.every(c => c.status === 'active')).toBe(true);
    });

    it('空列表应该返回空数组', () => {
      consultationStore.consultations = [];
      consultationStore.currentTab = 'pending';

      expect(consultationStore.filteredConsultations).toHaveLength(0);
    });
  });

  describe('loadConsultations', () => {
    it('应该成功加载问诊列表', async () => {
      const mockConsultations = [
        {
          id: 'c1',
          patientId: 'p1',
          doctorId: 'd1',
          status: 'active',
          patientPhone: '138****0000',
          createdAt: '2026-01-26T10:00:00Z',
          updatedAt: '2026-01-26T10:00:00Z',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ code: 0, data: mockConsultations }),
      });

      await consultationStore.loadConsultations();

      expect(consultationStore.consultations).toEqual(mockConsultations);
      expect(consultationStore.loading).toBe(false);
      expect(consultationStore.error).toBe(null);
    });

    it('应该支持状态筛选', async () => {
      const mockConsultations = [
        {
          id: 'c1',
          patientId: 'p1',
          doctorId: 'd1',
          status: 'pending',
          patientPhone: '138****0000',
          createdAt: '2026-01-26T10:00:00Z',
          updatedAt: '2026-01-26T10:00:00Z',
        },
      ];

      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ code: 0, data: mockConsultations }),
      });

      await consultationStore.loadConsultations('pending');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('?status=pending'),
        expect.any(Object)
      );
      expect(consultationStore.consultations).toEqual(mockConsultations);
    });

    it('应该处理加载失败的情况', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      await consultationStore.loadConsultations();

      expect(consultationStore.consultations).toEqual([]);
      expect(consultationStore.loading).toBe(false);
      expect(consultationStore.error).toBe('加载问诊列表失败');
    });

    it('应该在加载时设置 loading 为 true', async () => {
      (global.fetch as any).mockImplementation(() => new Promise(resolve => {
        setTimeout(() => resolve({
          json: async () => ({ code: 0, data: [] }),
        }), 100);
      }));

      const loadPromise = consultationStore.loadConsultations();

      expect(consultationStore.loading).toBe(true);

      await loadPromise;

      expect(consultationStore.loading).toBe(false);
    });

    it('应该使用正确的 API 端点和认证头', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ code: 0, data: [] }),
      });

      await consultationStore.loadConsultations();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/consultations/doctor'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });
  });

  describe('setCurrentTab', () => {
    it('应该设置当前标签并加载对应的问诊列表', async () => {
      const mockConsultations = [
        {
          id: 'c1',
          patientId: 'p1',
          doctorId: 'd1',
          status: 'pending',
          patientPhone: '138****0000',
          createdAt: '2026-01-26T10:00:00Z',
          updatedAt: '2026-01-26T10:00:00Z',
        },
      ];

      // Setup the mock before calling setCurrentTab
      (global.fetch as any).mockResolvedValue({
        json: async () => ({ code: 0, data: mockConsultations }),
      });

      // Call setCurrentTab and wait for it to complete
      await consultationStore.setCurrentTab('pending');

      // Wait a bit for MobX runInAction to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consultationStore.currentTab).toBe('pending');
      expect(consultationStore.consultations).toEqual(mockConsultations);
    });
  });
});
