import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { appointmentStore } from '../../store';
import { useSmartNavigation } from '../../utils/navigation';

const Confirm = observer(function Confirm() {
  const navigate = useNavigate();
  const { navigateBack } = useSmartNavigation();

  const handleConfirm = async () => {
    try {
      await appointmentStore.createAppointment();
      appointmentStore.resetFlow();
      navigate('/appointments');
    } catch (error) {
      alert('预约失败，请重试');
    }
  };

  // 导航逻辑移到 useEffect 副作用中，避免在渲染期间更新状态
  useEffect(() => {
    if (!appointmentStore.selectedDoctor) {
      navigate('/appointments/doctors');
    }
  }, [appointmentStore.selectedDoctor, navigate]);

  if (!appointmentStore.selectedDoctor) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-800 shadow-sm">
        <button
          onClick={() => navigateBack('/appointments/schedule')}
          className="p-2 -ml-2"
          aria-label="返回"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold">确认预约</h1>
      </div>

      <div className="flex-1 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-lg mb-4">预约信息</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b dark:border-gray-700">
              <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-2xl">
                  person
                </span>
              </div>
              <div>
                <p className="font-semibold text-lg">{appointmentStore.selectedDoctor.name}</p>
                <p className="text-sm text-gray-500">{appointmentStore.selectedDoctor.title}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                <span className="material-symbols-outlined">location_on</span>
                <span>
                  {appointmentStore.selectedDoctor.hospital} · {appointmentStore.selectedDoctor.department}
                </span>
              </div>
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                <span className="material-symbols-outlined">calendar_month</span>
                <span>{appointmentStore.selectedDate}</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                <span className="material-symbols-outlined">schedule</span>
                <span>{appointmentStore.selectedTimeSlot}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            请确认预约信息无误，预约成功后请按时到达医院就诊。
          </p>
        </div>
      </div>

      <div className="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700">
        <button
          onClick={handleConfirm}
          disabled={appointmentStore.loading}
          className="w-full py-4 rounded-xl font-semibold text-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {appointmentStore.loading ? (
            <>
              <span className="material-symbols-outlined animate-spin">progress_activity</span>
              预约中...
            </>
          ) : (
            '确认预约'
          )}
        </button>
      </div>
    </div>
  );
});

export default Confirm;
