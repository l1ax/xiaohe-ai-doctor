import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentStore } from '../../store';
import { appointmentApi, TimeSlot } from '../../services/appointment';

const Schedule = observer(function Schedule() {
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState<{ date: string; slots: TimeSlot[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchedule();
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
    return scheduleItem?.slots || [];
  };

  const handleSelectDate = (date: string) => {
    appointmentStore.selectDate(date);
  };

  const handleSelectSlot = (slot: string) => {
    appointmentStore.selectTimeSlot(slot);
  };

  const canProceed = appointmentStore.selectedDate && appointmentStore.selectedTimeSlot;

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
        <button
          onClick={() => navigate('/appointments/confirm')}
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
