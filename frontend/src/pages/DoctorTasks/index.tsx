import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { userStore } from '../../store';

interface Consultation {
  id: string;
  patientId: string;
  patientPhone: string;
  doctorId: string;
  status: 'pending' | 'active' | 'closed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
  lastMessageTime?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const DoctorTasks = observer(function DoctorTasks() {
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');

  const tabs = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待接诊' },
    { key: 'active', label: '进行中' },
  ];

  useEffect(() => {
    fetchConsultations(activeTab);
  }, [activeTab]);

  const fetchConsultations = async (statusFilter?: string) => {
    try {
      const params = statusFilter && statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await fetch(`${API_BASE_URL}/api/consultations/doctor${params}`, {
        headers: { Authorization: `Bearer ${userStore.accessToken}` },
      });
      const data = await res.json();
      if (data.code === 0) setConsultations(data.data);
    } catch (error) {
      console.error('Failed to fetch consultations:', error);
    } finally {
      setLoading(false);
    }
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

  if (loading) {
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
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1 rounded-full text-sm ${
                activeTab === tab.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Consultation List */}
      <div className="p-4 space-y-4">
        {consultations.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <span className="material-symbols-outlined text-6xl mb-4 block">check_circle</span>
            <p>暂无问诊</p>
          </div>
        ) : (
          consultations.map((consultation) => (
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
