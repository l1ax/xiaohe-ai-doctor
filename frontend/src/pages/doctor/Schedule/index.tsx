import { useState, useEffect, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { CalendarView } from './CalendarView';
import { TimeSlotEditor } from './TimeSlotEditor';
import { BatchOperations } from './BatchOperations';
import { DoctorSchedule } from './types';
import { getSchedules, setSchedule } from './api';

const ScheduleManagement = observer(() => {
  // 当前选中的日期（YYYY-MM-DD 格式）
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  // 所有排班数据（已集成到 scheduledDates 中，保留此变量用于后续扩展）
  // const [allSchedules, setAllSchedules] = useState<DoctorSchedule[]>([]);

  // 当前选中日期的排班数据
  const [currentSchedules, setCurrentSchedules] = useState<DoctorSchedule[]>([]);

  // 已排班的日期集合（用于日历标记）
  const [scheduledDates, setScheduledDates] = useState<Set<string>>(new Set());

  // 加载状态
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 错误信息
  const [error, setError] = useState<string | null>(null);

  // 加载所有排班数据
  const fetchAllSchedules = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSchedules();
      // setAllSchedules(data);

      // 构建已排班日期集合
      const dates = new Set<string>();
      data.forEach(schedule => {
        if (schedule.isAvailable) {
          dates.add(schedule.date);
        }
      });
      setScheduledDates(dates);
    } catch (err) {
      console.error('获取排班数据失败', err);
      setError('获取排班数据失败');
      // setAllSchedules([]);
      setScheduledDates(new Set());
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 加载选中日期的排班数据
  const fetchCurrentSchedules = useCallback(async (date: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSchedules(date);
      setCurrentSchedules(data);
    } catch (err) {
      console.error('获取排班数据失败', err);
      setError('获取排班数据失败');
      setCurrentSchedules([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    fetchAllSchedules();
  }, [fetchAllSchedules]);

  // 当选中日期变化时，加载该日期的排班数据
  useEffect(() => {
    fetchCurrentSchedules(selectedDate);
  }, [selectedDate, fetchCurrentSchedules]);

  // 保存单个日期的排班
  const handleSave = async (slots: Array<{ timeSlot: 'morning' | 'afternoon' | 'evening'; isAvailable: boolean; maxPatients: number }>) => {
    setIsSaving(true);
    setError(null);
    try {
      // 为每个时段创建或更新排班
      for (const slot of slots) {
        await setSchedule(selectedDate, slot.timeSlot, {
          isAvailable: slot.isAvailable,
          maxPatients: slot.maxPatients
        });
      }

      // 重新加载数据
      await fetchAllSchedules();
      await fetchCurrentSchedules(selectedDate);
    } catch (err) {
      console.error('保存排班失败', err);
      setError('保存排班失败');
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  // 批量设置排班
  const handleBatchApply = async (dates: string[], schedules: Array<{ timeSlot: 'morning' | 'afternoon' | 'evening'; isAvailable: boolean; maxPatients: number }>) => {
    setIsSaving(true);
    setError(null);
    try {
      // 为每个日期和时段创建排班
      for (const date of dates) {
        for (const schedule of schedules) {
          await setSchedule(date, schedule.timeSlot, {
            isAvailable: schedule.isAvailable,
            maxPatients: schedule.maxPatients
          });
        }
      }

      // 重新加载数据
      await fetchAllSchedules();
      await fetchCurrentSchedules(selectedDate);

      alert(`成功设置 ${dates.length} 天的排班`);
    } catch (err) {
      console.error('批量设置排班失败', err);
      setError('批量设置排班失败');
      alert('批量设置排班失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark pb-24">
      {/* 顶部标题栏 */}
      <div className="bg-white dark:bg-slate-800 sticky top-0 z-10 px-4 py-3 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">排班管理</h1>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600 dark:text-red-400">error</span>
            <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      <div className="px-4 py-4 space-y-4">
        {/* 日历视图 */}
        <CalendarView
          selectedDate={selectedDate}
          onDateSelect={(date) => {
            setSelectedDate(date);
          }}
          scheduledDates={scheduledDates}
        />

        {/* 时段编辑器 */}
        <TimeSlotEditor
          selectedDate={selectedDate}
          schedules={currentSchedules}
          onSave={handleSave}
          isLoading={isSaving}
        />

        {/* 批量操作 */}
        <BatchOperations
          onBatchApply={handleBatchApply}
          isLoading={isSaving}
        />
      </div>

      {/* 加载状态覆盖 */}
      {isLoading && (
        <div className="fixed inset-0 bg-white/80 dark:bg-slate-900/80 flex items-center justify-center z-50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-600 dark:text-slate-400">加载中...</p>
          </div>
        </div>
      )}
    </div>
  );
});

export default ScheduleManagement;
