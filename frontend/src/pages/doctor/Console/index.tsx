import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { doctorStore } from '../../../store/doctorStore';
import { DoctorHeader } from './DoctorHeader';
import { StatsCards } from './StatsCards';
import { ConsultationList } from './ConsultationList';

const DoctorConsole = observer(() => {
  useEffect(() => {
    // 初始化加载数据
    doctorStore.fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark pb-24">
      {/* 顶部标题栏 */}
      <div className="bg-white dark:bg-slate-800 sticky top-0 z-10 px-4 py-3 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">工作台</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* 医生信息头部 */}
        <DoctorHeader />

        {/* 统计卡片 */}
        <StatsCards />

        {/* 待处理问诊列表 */}
        <ConsultationList />
      </div>
    </div>
  );
});

export default DoctorConsole;
