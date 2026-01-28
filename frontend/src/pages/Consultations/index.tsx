import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { userStore } from '../../store';

interface Consultation {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorTitle: string;
  hospital: string;
  department: string;
  status: 'pending' | 'active' | 'completed';
  lastMessage: string;
  updatedAt: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const Consultations = observer(function Consultations() {
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchConsultations();
    fetchUnreadCounts();

    // 每30秒轮询未读数
    const interval = setInterval(fetchUnreadCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchConsultations = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/consultations`, {
        headers: { Authorization: `Bearer ${userStore.accessToken}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        const consultations = (data.data || []).map((c: any) => ({
          id: c.id,
          doctorId: c.doctorId,
          doctorName: c.doctor?.name || '未知医生',
          doctorTitle: c.doctor?.title || '',
          hospital: c.doctor?.hospital || '',
          department: c.doctor?.department || '',
          status: c.status,
          lastMessage: '',
          updatedAt: c.updatedAt,
        }));
        setConsultations(consultations);
      }
    } catch (error) {
      console.error('Failed to fetch consultations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCounts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/consultations/unread`, {
        headers: { Authorization: `Bearer ${userStore.accessToken}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        setUnreadCounts(data.data.byConsultation || {});
      }
    } catch (error) {
      console.error('Failed to fetch unread counts:', error);
    }
  };


  const handleJoinChat = (id: string) => {
    navigate(`/doctor-chat/${id}`);
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '待接单';
      case 'active':
        return '进行中';
      case 'completed':
        return '已完成';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      case 'active':
        return 'text-green-600 bg-green-50';
      case 'completed':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 shadow-sm">
        <h1 className="text-xl font-bold">专家问诊</h1>
        <button
          onClick={() => navigate('/doctor-list')}
          className="flex items-center gap-1 px-3 py-1.5 bg-primary text-white rounded-lg text-sm"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          发问诊
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">

      {/* Consultation List */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-20 text-gray-500">
            <span className="material-symbols-outlined text-6xl mb-4 block animate-spin">sync</span>
            <p>加载中...</p>
          </div>
        ) : consultations.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <span className="material-symbols-outlined text-6xl mb-4 block">clinical_notes</span>
            <p className="mb-4">暂无问诊记录</p>
            <button
              onClick={() => navigate('/doctor-list')}
              className="px-6 py-2 bg-primary text-white rounded-lg"
            >
              发起问诊
            </button>
          </div>
        ) : (
          consultations.map((consultation) => (
            <div
              key={consultation.id}
              onClick={() => handleJoinChat(consultation.id)}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm cursor-pointer active:opacity-80"
            >
              <div className="flex items-start gap-3">
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">person</span>
                  </div>
                  {/* 未读消息徽章 */}
                  {unreadCounts[consultation.id] > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full">
                      {unreadCounts[consultation.id] > 99 ? '99+' : unreadCounts[consultation.id]}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold">{consultation.doctorName}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(consultation.status)}`}>
                      {getStatusText(consultation.status)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {consultation.department} | {consultation.hospital}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 truncate">
                    {consultation.lastMessage || '暂无消息'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(consultation.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      </div>
    </div>
  );
});

export default Consultations;
