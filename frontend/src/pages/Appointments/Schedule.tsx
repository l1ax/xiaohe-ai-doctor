import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentStore } from '../../store';
import { appointmentApi, TimeSlot } from '../../services/appointment';

const Schedule = observer(function Schedule() {
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState<{ date: string; availableSlots: TimeSlot[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSchedule();
    // 每分钟更新一次当前时间，确保时间段过滤准确
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const loadSchedule = async () => {
    if (!appointmentStore.selectedDoctor) {
      navigate('/appointments/doctors');
      return;
    }

    try {
      setLoading(true);
      const data = await appointmentApi.getSchedule(
        appointmentStore.selectedDoctor.id,
        appointmentStore.appointmentDateRange[0],
        appointmentStore.appointmentDateRange[6]
      );
      setSchedule(data);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDay = weekDays[date.getDay()];
    return { month, day, weekDay, full: dateStr };
  };

  const getSlotsForDate = (date: string) => {
    const scheduleItem = schedule.find((s) => s.date === date);
    const slots = scheduleItem?.availableSlots || [];

    // 如果选择的是今天，过滤掉已过去的时间段
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    if (date === todayStr) {
      const currentHours = today.getHours();
      const currentMinutes = today.getMinutes();

      return slots.map((slot) => {
        const [hours, minutes] = slot.time.split(':').map(Number);
        const slotTimeInMinutes = hours * 60 + minutes;
        const currentTimeInMinutes = currentHours * 60 + currentMinutes;

        // 如果时间段已过去，标记为不可用
        return {
          ...slot,
          available: slotTimeInMinutes > currentTimeInMinutes,
        };
      });
    }

    return slots;
  };

  const handleSelectDate = (date: string) => {
    appointmentStore.selectDate(date);
  };

  const handleSelectSlot = (slot: string) => {
    appointmentStore.selectTimeSlot(slot);
  };

  const canProceed = appointmentStore.selectedDate && appointmentStore.selectedTimeSlot;

  const isSlotPastTime = () => {
    if (!appointmentStore.selectedDate || !appointmentStore.selectedTimeSlot) {
      return false;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    if (appointmentStore.selectedDate !== todayStr) {
      return false;
    }

    const [hours, minutes] = appointmentStore.selectedTimeSlot.split(':').map(Number);
    const slotTimeInMinutes = hours * 60 + minutes;
    const currentTimeInMinutes = today.getHours() * 60 + today.getMinutes();

    return slotTimeInMinutes <= currentTimeInMinutes;
  };

  const handleProceed = () => {
    if (isSlotPastTime()) {
      setError('所选时间已过期，请重新选择');
      appointmentStore.selectTimeSlot('');
      return;
    }
    setError(null);
    navigate('/appointments/confirm');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-800 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold">选择时间</h1>
      </div>

      {/* Doctor Info */}
      {appointmentStore.selectedDoctor && (
        <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
          <p className="font-semibold">{appointmentStore.selectedDoctor.name}</p>
          <p className="text-sm text-gray-500">
            {appointmentStore.selectedDoctor.department} · {appointmentStore.selectedDoctor.hospital}
          </p>
        </div>
      )}

      {/* Date Slider */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="flex overflow-x-auto px-4 py-3 gap-2 scrollbar-hide">
          {appointmentStore.appointmentDateRange.map((date) => {
            const { month, day, weekDay } = formatDate(date);
            const isSelected = appointmentStore.selectedDate === date;
            return (
              <button
                key={date}
                onClick={() => handleSelectDate(date)}
                className={`flex-shrink-0 w-16 h-20 rounded-xl flex flex-col items-center justify-center transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <span className="text-xs opacity-70">{weekDay}</span>
                <span className="text-xl font-bold">{day}</span>
                <span className="text-xs">{month}月</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Slots */}
      <div className="flex-1 p-4 overflow-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-4xl text-blue-600">
              progress_activity
            </span>
          </div>
        ) : appointmentStore.selectedDate ? (
          <div>
            <h3 className="font-semibold mb-3">{formatDate(appointmentStore.selectedDate).full}</h3>
            <div className="grid grid-cols-3 gap-3">
              {getSlotsForDate(appointmentStore.selectedDate).map((slot) => (
                <button
                  key={slot.time}
                  onClick={() => slot.available && handleSelectSlot(slot.time)}
                  disabled={!slot.available}
                  className={`py-3 rounded-lg text-sm font-medium transition-colors ${
                    appointmentStore.selectedTimeSlot === slot.time
                      ? 'bg-blue-600 text-white'
                      : slot.available
                      ? 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-600'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">
            <span className="material-symbols-outlined text-6xl text-gray-300 block mb-4">
              schedule
            </span>
            <p>请选择日期</p>
          </div>
        )}
      </div>

      {/* Bottom Button */}
      <div className="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700">
        {/* Error Alert */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
            <span className="material-symbols-outlined text-red-500 mt-0.5">error</span>
            <div className="flex-1">
              <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}
        <button
          onClick={handleProceed}
          disabled={!canProceed}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-colors ${
            canProceed
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          确定
        </button>
      </div>
    </div>
  );
});

export default Schedule;
