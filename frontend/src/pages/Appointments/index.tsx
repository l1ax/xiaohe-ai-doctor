import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentStore } from '../../store';
import { Appointment } from '../../services/appointment';

type TabType = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';

const Appointments = observer(function Appointments() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('all');

  useEffect(() => {
    appointmentStore.fetchAppointments();
  }, []);

  const filteredAppointments = appointmentStore.appointments.filter((apt) => {
    if (activeTab === 'all') return true;
    return apt.status === activeTab;
  });

  const getStatusText = (status: Appointment['status']) => {
    const statusMap = {
      pending: '待确认',
      confirmed: '已确认',
      completed: '已完成',
      cancelled: '已取消',
    };
    return statusMap[status];
  };

  const getStatusColor = (status: Appointment['status']) => {
    const colorMap = {
      pending: 'text-yellow-600 bg-yellow-50',
      confirmed: 'text-green-600 bg-green-50',
      completed: 'text-gray-600 bg-gray-50',
      cancelled: 'text-red-600 bg-red-50',
    };
    return colorMap[status];
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-800 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold">我的预约</h1>
        <button
          onClick={() => navigate('/appointments/doctors')}
          className="ml-auto p-2 text-blue-600"
        >
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 dark:text-gray-400'
            }`}
          >
            {tab === 'all' ? '全部' : getStatusText(tab as Appointment['status'])}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="p-4 space-y-3">
        {appointmentStore.loading ? (
          <div className="flex justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-4xl text-blue-600">
              progress_activity
            </span>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-6xl text-gray-300 block mb-4">
              calendar_month
            </span>
            <p className="text-gray-500">暂无预约</p>
          </div>
        ) : (
          filteredAppointments.map((apt) => (
            <div
              key={apt.id}
              onClick={() => navigate(`/appointments/${apt.id}`)}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm active:opacity-80"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{apt.doctorName}</h3>
                  <p className="text-sm text-gray-500">{apt.department} · {apt.hospital}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(apt.status)}`}>
                  {getStatusText(apt.status)}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">calendar_month</span>
                  {apt.date}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">schedule</span>
                  {apt.timeSlot}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

export default Appointments;
