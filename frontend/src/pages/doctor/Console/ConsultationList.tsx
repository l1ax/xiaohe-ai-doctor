import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { doctorStore } from '../../../store/doctorStore';
import { ConsultationCard } from '../../../components/doctor/ConsultationCard';

export const ConsultationList = observer(() => {
  const { pendingConsultations, isLoading } = doctorStore;

  useEffect(() => {
    // 初始加载
    doctorStore.fetchPendingConsultations();

    // 每30秒自动刷新
    const interval = setInterval(() => {
      doctorStore.fetchPendingConsultations();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleAccept = async (id: string) => {
    return await doctorStore.acceptConsultation(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 dark:text-slate-400">加载中...</p>
        </div>
      </div>
    );
  }

  if (pendingConsultations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-4xl text-slate-400 dark:text-slate-500">
            inbox
          </span>
        </div>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          暂无待处理问诊
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
          当有新的患者问诊时，会在这里显示
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          待处理问诊 ({pendingConsultations.length})
        </h3>
        <button
          onClick={() => doctorStore.fetchPendingConsultations()}
          className="text-primary text-sm font-medium flex items-center gap-1 hover:text-primary-dark transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          刷新
        </button>
      </div>

      {pendingConsultations.map((consultation) => (
        <ConsultationCard
          key={consultation.id}
          consultation={consultation}
          onAccept={handleAccept}
        />
      ))}
    </div>
  );
});
