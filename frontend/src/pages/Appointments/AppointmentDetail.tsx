import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { appointmentStore } from '../../store';
import { useSmartNavigation } from '../../utils/navigation';

const AppointmentDetail = observer(function AppointmentDetail() {
  const navigate = useNavigate();
  const { navigateBack } = useSmartNavigation();
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    if (id) {
      appointmentStore.fetchAppointmentDetail(id);
    }
    return () => {
      appointmentStore.appointmentDetail = null;
    };
  }, [id]);

  const detail = appointmentStore.appointmentDetail;

  const getStatusConfig = (status: string) => {
    const config = {
      pending: { text: '待确认', color: 'text-yellow-600 bg-yellow-50', icon: 'pending' },
      confirmed: { text: '已确认', color: 'text-green-600 bg-green-50', icon: 'check_circle' },
      completed: { text: '已完成', color: 'text-gray-600 bg-gray-50', icon: 'task_alt' },
      cancelled: { text: '已取消', color: 'text-red-600 bg-red-50', icon: 'cancel' },
    };
    return config[status as keyof typeof config] || config.pending;
  };

  const handleCancel = async () => {
    if (window.confirm('确定要取消预约吗？')) {
      try {
        await appointmentStore.cancelAppointment(id!);
        navigate('/appointments');
      } catch (error) {
        alert('取消失败，请重试');
      }
    }
  };

  if (!detail) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-blue-600">
          progress_activity
        </span>
      </div>
    );
  }

  const statusConfig = getStatusConfig(detail.status);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-800 shadow-sm">
        <button
          onClick={() => navigateBack('/appointments')}
          className="p-2 -ml-2"
          aria-label="返回"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold">预约详情</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <span className={`material-symbols-outlined ${statusConfig.color.split(' ')[0]}`}>
              {statusConfig.icon}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
              {statusConfig.text}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            预约号：{detail.id.slice(0, 8).toUpperCase()}
          </p>
        </div>

        {/* Doctor Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-lg mb-4">医生信息</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-3xl">
                person
              </span>
            </div>
            <div>
              <p className="font-semibold text-lg">{detail.doctorName}</p>
              <p className="text-sm text-gray-500">{detail.doctorTitle}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <span className="material-symbols-outlined text-sm">location_on</span>
              <span>{detail.hospital} · {detail.department}</span>
            </div>
          </div>
        </div>

        {/* Appointment Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-lg mb-4">预约信息</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-500">预约日期</span>
              <span className="font-medium">{detail.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">预约时间</span>
              <span className="font-medium">{detail.timeSlot}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">预约时间</span>
              <span className="font-medium">{new Date(detail.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {detail.status === 'pending' && (
          <button
            onClick={handleCancel}
            disabled={appointmentStore.loading}
            className="w-full py-4 rounded-xl font-semibold text-lg border-2 border-red-600 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            取消预约
          </button>
        )}
      </div>
    </div>
  );
});

export default AppointmentDetail;
