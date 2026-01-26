import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { doctorStore } from '../../../store/doctorStore';
import { WebSocketService } from '../../../services/websocket';
import { userStore } from '../../../store';
import { DoctorHeader } from './DoctorHeader';
import { StatsCards } from './StatsCards';
import { ConsultationList } from './ConsultationList';

const WS_URL = (import.meta.env as { VITE_API_BASE_URL: string; VITE_WS_URL?: string }).VITE_WS_URL || 'ws://localhost:3000';

const DoctorConsole = observer(() => {
  const wsRef = useRef<WebSocketService | null>(null);

  useEffect(() => {
    // 初始化加载数据
    doctorStore.fetchStats();

    // 建立 WebSocket 连接
    if (!wsRef.current && userStore.accessToken) {
      const ws = new WebSocketService(
        `${WS_URL}/ws`,
        userStore.accessToken
      );
      wsRef.current = ws;

      ws.connect()
        .then(() => {
          console.log('[DoctorConsole] WebSocket 连接成功');
          
          // 监听问诊更新
          ws.onConsultationUpdate((consultation) => {
            console.log('[DoctorConsole] 收到问诊更新:', consultation);
            
            // 转换 status 字段
            const statusMap: Record<string, 'pending' | 'ongoing' | 'completed'> = {
              pending: 'pending',
              active: 'ongoing',
              in_progress: 'ongoing',
              closed: 'completed',
              completed: 'completed',
            };
            
            doctorStore.addOrUpdateConsultation({
              id: consultation.id,
              patientId: consultation.userId || '',
              patientName: `患者`,
              symptoms: consultation.chiefComplaint || '咨询健康问题',
              status: statusMap[consultation.status] || 'pending',
              urgency: 'medium' as const,
              // 使用 createdAt，如果不存在则使用 updatedAt 作为后备
              createdAt: consultation.createdAt || consultation.updatedAt || new Date().toISOString(),
            });
          });
        })
        .catch((error) => {
          console.error('[DoctorConsole] WebSocket 连接失败:', error);
        });
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    };
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
