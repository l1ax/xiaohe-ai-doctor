import { useState, useEffect, useCallback } from 'react';
import { StatusTabs } from './StatusTabs';
import { AppointmentCard } from './AppointmentCard';
import { EmptyState } from './EmptyState';
import { getAppointments, confirmAppointment, cancelAppointment } from './api';
import type { Appointment, AppointmentStatus } from './types';

export const AppointmentManagement = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activeTab, setActiveTab] = useState<AppointmentStatus | 'all'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载预约列表
  const loadAppointments = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      const status = activeTab === 'all' ? undefined : activeTab;
      const response = await getAppointments(status);

      // 按预约时间倒序排列
      const sortedAppointments = response.appointments.sort((a, b) =>
        new Date(b.appointmentTime).getTime() - new Date(a.appointmentTime).getTime()
      );

      setAppointments(sortedAppointments);
    } catch (err) {
      console.error('加载预约列表失败:', err);
      setError('加载预约列表失败，请稍后重试');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab]);

  // 初始加载
  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  // 确认预约
  const handleConfirm = async (id: string) => {
    try {
      await confirmAppointment(id);
      // 刷新列表
      await loadAppointments();
    } catch (err) {
      console.error('确认预约失败:', err);
      alert('确认预约失败，请稍后重试');
      throw err;
    }
  };

  // 取消预约
  const handleCancel = async (id: string) => {
    try {
      await cancelAppointment(id);
      // 刷新列表
      await loadAppointments();
    } catch (err) {
      console.error('取消预约失败:', err);
      alert('取消预约失败，请稍后重试');
      throw err;
    }
  };

  // 标签切换
  const handleTabChange = (tab: AppointmentStatus | 'all') => {
    setActiveTab(tab);
  };

  // 下拉刷新
  const handleRefresh = async () => {
    await loadAppointments(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-8">
      {/* 顶部标题栏 */}
      <div className="bg-white dark:bg-slate-900 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">预约管理</h1>
        </div>

        {/* 状态筛选标签 */}
        <div className="px-4 pb-3">
          <StatusTabs activeTab={activeTab} onTabChange={handleTabChange} />
        </div>
      </div>

      {/* 预约列表 */}
      <div className="px-4 py-4">
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={() => loadAppointments()}
              className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium underline"
            >
              重新加载
            </button>
          </div>
        )}

        {isLoading && !isRefreshing ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : appointments.length === 0 ? (
          <EmptyState status={activeTab === 'all' ? undefined : activeTab} />
        ) : (
          <div className="space-y-4">
            {appointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )}

        {/* 下拉刷新指示器 */}
        {isRefreshing && (
          <div className="flex items-center justify-center py-4">
            <div className="w-6 h-6 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">刷新中...</span>
          </div>
        )}
      </div>

      {/* 刷新按钮（固定在右下角） */}
      {!isLoading && appointments.length > 0 && (
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="fixed bottom-24 right-4 w-12 h-12 bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 rounded-full flex items-center justify-center text-primary hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-200 disabled:opacity-50"
        >
          <span className={`material-symbols-outlined ${isRefreshing ? 'animate-spin' : ''}`}>
            refresh
          </span>
        </button>
      )}
    </div>
  );
};
