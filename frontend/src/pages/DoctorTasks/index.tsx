import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { userStore } from '../../store';

interface PendingConsultation {
  id: string;
  patientId: string;
  patientPhone: string;
  doctorId: string;
  status: string;
  createdAt: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const DoctorTasks = observer(function DoctorTasks() {
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState<PendingConsultation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingConsultations();
  }, []);

  const fetchPendingConsultations = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/consultations/pending`, {
        headers: { Authorization: `Bearer ${userStore.accessToken}` },
      });
      const data = await res.json();
      if (data.code === 0) setConsultations(data.data);
    } catch (error) {
      console.error('Failed to fetch pending consultations:', error);
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
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold">待办问诊</h1>
        </div>
      </header>

      {/* Pending List */}
      <div className="p-4 space-y-4">
        {consultations.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <span className="material-symbols-outlined text-6xl mb-4 block">check_circle</span>
            <p>暂无待办问诊</p>
          </div>
        ) : (
          consultations.map((consultation) => (
            <div key={consultation.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">person</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">患者 {consultation.patientPhone}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(consultation.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleAccept(consultation.id)}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm"
                >
                  接诊
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

export default DoctorTasks;
