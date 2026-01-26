import { useState } from 'react';
import { TIME_SLOTS } from './types';

interface BatchOperationsProps {
  onBatchApply: (dates: string[], schedules: Array<{ timeSlot: 'morning' | 'afternoon' | 'evening'; isAvailable: boolean; maxPatients: number }>) => Promise<void>;
  isLoading: boolean;
}

export const BatchOperations = ({ onBatchApply, isLoading }: BatchOperationsProps) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 工作日批量设置
  const handleWorkdaysSetup = async () => {
    const today = new Date();
    const dates: string[] = [];
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // 获取当月所有工作日（周一到周五）
    for (let day = 1; day <= 31; day++) {
      const date = new Date(currentYear, currentMonth, day);
      if (date.getMonth() !== currentMonth) break;

      const weekDay = date.getDay();
      if (weekDay >= 1 && weekDay <= 5) { // 周一到周五
        dates.push(formatDateStr(date));
      }
    }

    if (dates.length === 0) {
      alert('没有找到工作日');
      return;
    }

    // 设置默认工作时段
    const schedules = TIME_SLOTS.map(slot => ({
      timeSlot: slot.key,
      isAvailable: true,
      maxPatients: slot.defaultMaxPatients
    }));

    await onBatchApply(dates, schedules);
  };

  // 节假日批量关闭
  const handleHolidaysClose = async () => {
    const today = new Date();
    const dates: string[] = [];
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // 获取当月所有周末（周六和周日）
    for (let day = 1; day <= 31; day++) {
      const date = new Date(currentYear, currentMonth, day);
      if (date.getMonth() !== currentMonth) break;

      const weekDay = date.getDay();
      if (weekDay === 0 || weekDay === 6) { // 周日和周六
        dates.push(formatDateStr(date));
      }
    }

    if (dates.length === 0) {
      alert('没有找到周末');
      return;
    }

    // 关闭所有时段
    const schedules = TIME_SLOTS.map(slot => ({
      timeSlot: slot.key,
      isAvailable: false,
      maxPatients: slot.defaultMaxPatients
    }));

    await onBatchApply(dates, schedules);
  };

  // 日期范围批量设置
  const handleRangeSetup = async () => {
    if (!startDate || !endDate) {
      alert('请选择开始和结束日期');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      alert('开始日期不能晚于结束日期');
      return;
    }

    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(formatDateStr(new Date(d)));
    }

    // 设置默认工作时段
    const schedules = TIME_SLOTS.map(slot => ({
      timeSlot: slot.key,
      isAvailable: true,
      maxPatients: slot.defaultMaxPatients
    }));

    await onBatchApply(dates, schedules);
    setShowDatePicker(false);
    setStartDate('');
    setEndDate('');
  };

  const formatDateStr = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
        批量操作
      </h3>

      <div className="space-y-3">
        {/* 快捷操作 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleWorkdaysSetup}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined">work</span>
            <span className="font-medium">工作日开启</span>
          </button>

          <button
            onClick={handleHolidaysClose}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined">free_breakfast</span>
            <span className="font-medium">周末关闭</span>
          </button>
        </div>

        {/* 日期范围设置 */}
        <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-xl transition-colors"
          >
            <span className="material-symbols-outlined">date_range</span>
            <span className="font-medium">自定义日期范围</span>
          </button>

          {showDatePicker && (
            <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  开始日期
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  结束日期
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleRangeSetup}
                  disabled={isLoading || !startDate || !endDate}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? '设置中...' : '确认设置'}
                </button>
                <button
                  onClick={() => {
                    setShowDatePicker(false);
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-lg transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 操作说明 */}
      <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[20px] mt-0.5">
            warning
          </span>
          <div className="text-sm text-amber-800 dark:text-amber-300">
            <p className="font-medium mb-1">注意</p>
            <ul className="space-y-1 text-amber-700 dark:text-amber-400">
              <li>• 批量操作会覆盖已有排班设置</li>
              <li>• 工作日开启：将当月所有周一到周五设为可预约</li>
              <li>• 周末关闭：将当月所有周六周日设为不可预约</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
