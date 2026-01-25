import { useState } from 'react';

interface CalendarViewProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  scheduledDates: Set<string>;
}

export const CalendarView = ({ selectedDate, onDateSelect, scheduledDates }: CalendarViewProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 获取当月第一天和最后一天
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

  // 获取今天日期
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // 生成日历数据
  const calendarDays = [];

  // 填充月初空白
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push(null);
  }

  // 填充日期
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarDays.push({
      day,
      dateStr,
      isToday: dateStr === todayStr,
      isScheduled: scheduledDates.has(dateStr)
    });
  }

  // 星期标题
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  // 切换月份
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    onDateSelect(todayStr);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm">
      {/* 月份导航 */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">
            chevron_left
          </span>
        </button>

        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {year}年{month + 1}月
          </h3>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            今天
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-slate-600 dark:text-slate-400">
              chevron_right
            </span>
          </button>
        </div>
      </div>

      {/* 星期标题 */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-slate-500 dark:text-slate-400 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* 日期网格 */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((dayInfo, index) => {
          if (!dayInfo) {
            return <div key={index} className="aspect-square" />;
          }

          const { day, dateStr, isToday, isScheduled } = dayInfo;
          const isSelected = dateStr === selectedDate;

          return (
            <button
              key={dateStr}
              onClick={() => onDateSelect(dateStr)}
              className={`aspect-square flex flex-col items-center justify-center rounded-lg transition-all relative ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md'
                  : isToday
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <span className="text-sm">{day}</span>

              {/* 有排班的标记 */}
              {isScheduled && !isSelected && (
                <div className="absolute bottom-1 w-1.5 h-1.5 bg-blue-500 rounded-full" />
              )}

              {/* 今天的标记 */}
              {isToday && !isSelected && (
                <div className="absolute bottom-1 w-1.5 h-1.5 bg-blue-400 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* 图例 */}
      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-600" />
          <span className="text-xs text-slate-600 dark:text-slate-400">已选择</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-xs text-slate-600 dark:text-slate-400">有排班</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-400" />
          <span className="text-xs text-slate-600 dark:text-slate-400">今天</span>
        </div>
      </div>
    </div>
  );
};
