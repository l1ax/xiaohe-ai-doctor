import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { consultationStore } from '../../store/consultationStore';
import { WebSocketService } from '../../services/websocket';
import { userStore } from '../../store';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const WS_URL = (import.meta.env as { VITE_API_BASE_URL: string; VITE_WS_URL?: string }).VITE_WS_URL || 'ws://localhost:3000';

const DoctorTasks = observer(function DoctorTasks() {
  const navigate = useNavigate();
  const wsRef = useRef<WebSocketService | null>(null);

  const tabs = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待接诊' },
    { key: 'active', label: '进行中' },
  ];

  // 初始化：加载问诊列表并建立 WebSocket 连接
  useEffect(() => {
    // 初始加载问诊列表
    consultationStore.loadConsultations(consultationStore.currentTab);

    // 初始化 WebSocket
    if (!wsRef.current && userStore.accessToken) {
      const ws = new WebSocketService(
        `${WS_URL}/ws`,
        userStore.accessToken
      );
      wsRef.current = ws;

      ws.connect().then(() => {
        // 监听问诊更新
        ws.onConsultationUpdate((consultation) => {
          console.log('收到问诊更新:', consultation);
          // 转换 status 字段以匹配 ConsultationStore 的类型
          const statusMap: Record<string, 'pending' | 'active' | 'closed' | 'cancelled'> = {
            pending: 'pending',
            in_progress: 'active',
            completed: 'closed',
            cancelled: 'cancelled',
          };
          consultationStore.updateConsultation({
            ...consultation,
            status: statusMap[consultation.status] || consultation.status,
          });
        });
      }).catch((error) => {
        console.error('WebSocket 连接失败:', error);
      });

      return () => {
        ws.disconnect();
        wsRef.current = null;
      };
    }
  }, []);

  // 切换 Tab
  const handleTabChange = (tab: 'all' | 'pending' | 'active') => {
    consultationStore.setCurrentTab(tab);
  };

  const handleAccept = async (consultationId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/consultations/${consultationId}/accept`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${userStore.accessToken}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        navigate(`/doctor-chat/${consultationId}`);
      }
    } catch (error) {
      console.error('Failed to accept consultation:', error);
    }
  };

  // 使用 store 的计算属性
  if (consultationStore.loading) {
    return <div className="p-4 text-center">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm p-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold mr-4">我的问诊</h1>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key as 'all' | 'pending' | 'active')}
              className={`px-3 py-1 rounded-full text-sm ${
                consultationStore.currentTab === tab.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Consultation List */}
      <div className="p-4 space-y-4">
        {consultationStore.filteredConsultations.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <span className="material-symbols-outlined text-6xl mb-4 block">check_circle</span>
            <p>暂无问诊</p>
          </div>
        ) : (
          consultationStore.filteredConsultations.map((consultation) => (
            <div key={consultation.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary">person</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      consultation.status === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {consultation.status === 'pending' ? '待接诊' : '进行中'}
                    </span>
                    <p className="font-medium">患者 {consultation.patientPhone}</p>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-1">
                    {consultation.lastMessage || '暂无消息'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {consultation.lastMessageTime
                      ? new Date(consultation.lastMessageTime).toLocaleString()
                      : new Date(consultation.createdAt).toLocaleString()}
                  </p>
                </div>
                {consultation.status === 'pending' ? (
                  <button
                    onClick={() => handleAccept(consultation.id)}
                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm flex-shrink-0"
                  >
                    接诊
                  </button>
                ) : (
                  <button
                    onClick={() => navigate(`/doctor-chat/${consultation.id}`)}
                    className="px-4 py-2 border border-primary text-primary rounded-lg text-sm flex-shrink-0"
                  >
                    继续
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

export default DoctorTasks;
