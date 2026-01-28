import { useState, useEffect } from 'react';
import { TIME_SLOTS, DoctorSchedule } from './types';
import { TimeSlotItem } from './TimeSlotItem';

interface TimeSlotEditorProps {
  selectedDate: string;
  schedules: DoctorSchedule[];
  onSave: (slots: Array<{ timeSlot: 'morning' | 'afternoon' | 'evening'; isAvailable: boolean; maxPatients: number }>) => Promise<void>;
  isLoading: boolean;
}

export const TimeSlotEditor = ({ selectedDate, schedules, onSave, isLoading }: TimeSlotEditorProps) => {
  // 将排班数据转换为映射，方便快速查找
  const scheduleMap = new Map<string, DoctorSchedule>(schedules.map(s => [`${s.date}-${s.timeSlot}`, s]));

  // 获取时段状态
  const getSlotState = (timeSlot: 'morning' | 'afternoon' | 'evening') => {
    const key = `${selectedDate}-${timeSlot}`;
    const schedule = scheduleMap.get(key);
    return {
      // 默认开启（与患者端逻辑一致：未设置排班时全部可用）
      isAvailable: schedule?.isAvailable ?? true,
      maxPatients: schedule?.maxPatients || TIME_SLOTS.find(s => s.key === timeSlot)?.defaultMaxPatients || 10
    };
  };

  // 临时状态
  const [tempStates, setTempStates] = useState<Record<string, { isAvailable: boolean; maxPatients: number }>>({
    morning: getSlotState('morning'),
    afternoon: getSlotState('afternoon'),
    evening: getSlotState('evening')
  });

  // 初始化或选中日期变化时重置临时状态
  useEffect(() => {
    setTempStates({
      morning: getSlotState('morning'),
      afternoon: getSlotState('afternoon'),
      evening: getSlotState('evening')
    });
  }, [selectedDate, schedules]);

  const handleToggle = (timeSlot: 'morning' | 'afternoon' | 'evening') => {
    setTempStates(prev => ({
      ...prev,
      [timeSlot]: {
        ...prev[timeSlot],
        isAvailable: !prev[timeSlot].isAvailable
      }
    }));
  };

  const handleMaxPatientsChange = (timeSlot: 'morning' | 'afternoon' | 'evening', value: number) => {
    setTempStates(prev => ({
      ...prev,
      [timeSlot]: {
        ...prev[timeSlot],
        maxPatients: value
      }
    }));
  };

  const handleSave = async () => {
    const slots = TIME_SLOTS.map(slot => ({
      timeSlot: slot.key,
      isAvailable: tempStates[slot.key].isAvailable,
      maxPatients: tempStates[slot.key].maxPatients
    }));
    await onSave(slots);
  };

  // 检查是否有变化
  const hasChanges = TIME_SLOTS.some(slot => {
    const currentState = getSlotState(slot.key);
    const tempState = tempStates[slot.key];
    return currentState.isAvailable !== tempState.isAvailable ||
           currentState.maxPatients !== tempState.maxPatients;
  });

  // 格式化日期显示
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDay = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()];
    return `${year}年${month}月${day}日 ${weekDay}`;
  };

  // 检查时段是否已过期
  const isSlotExpired = (timeRange: string) => {
    // 1. 安全解析选中日期 (YYYY-MM-DD -> Local Date)
    const [sYear, sMonth, sDay] = selectedDate.split('-').map(Number);
    const selectedDateObj = new Date(sYear, sMonth - 1, sDay);
    selectedDateObj.setHours(0, 0, 0, 0);

    // 2. 获取今天的 00:00:00
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 3. 比较日期
    if (selectedDateObj.getTime() < today.getTime()) return true; // 过去的日期
    if (selectedDateObj.getTime() > today.getTime()) return false; // 未来的日期

    // 4. 如果是今天，比较时间
    const endStr = timeRange.split('-')[1]; // "12:00"
    const endHour = parseInt(endStr.split(':')[0], 10);
    const currentHour = new Date().getHours();
    
    // Debug log
    console.log('[TimeSlotEditor] Check Expired:', {
      timeRange,
      endHour,
      currentHour,
      isExpired: endHour <= currentHour,
      selectedDate,
      todayStr: today.toLocaleDateString()
    });

    return endHour <= currentHour;
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm" data-time-slot-editor>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            时段设置
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {formatDate(selectedDate)}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || isLoading}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            hasChanges && !isLoading
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              保存中
            </span>
          ) : (
            '保存排班'
          )}
        </button>
      </div>

      <div className="space-y-3">
        {TIME_SLOTS.map((slot) => {
          const state = tempStates[slot.key];
          const isDisabled = isSlotExpired(slot.timeRange);
          
          return (
            <TimeSlotItem
              key={slot.key}
              config={slot}
              isAvailable={state.isAvailable}
              maxPatients={state.maxPatients}
              onToggle={() => !isDisabled && handleToggle(slot.key)}
              onMaxPatientsChange={(value) => !isDisabled && handleMaxPatientsChange(slot.key, value)}
              disabled={isDisabled}
            />
          );
        })}
      </div>

      {/* 提示信息 */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
        <div className="flex items-start gap-2">
          <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[20px] mt-0.5">
            info
          </span>
          <div className="text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium mb-1">提示</p>
            <ul className="space-y-1 text-blue-700 dark:text-blue-400">
              <li>• 开启时段后，患者可以在该时段预约</li>
              <li>• 设置最大预约人数，超过后患者将无法预约</li>
              <li>• 点击"保存排班"后生效</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
