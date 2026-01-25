import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { userStore } from '../../store';

interface Doctor {
  id: string;
  name: string;
  title: string;
  department: string;
  hospital: string;
  avatarUrl?: string;
  consultationFee: number;
  isAvailable: boolean;
  rating: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const DoctorList = observer(function DoctorList() {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDoctors();
    fetchDepartments();
  }, [selectedDept]);

  const fetchDoctors = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedDept) params.append('department', selectedDept);
      params.append('available', 'true');

      const res = await fetch(`${API_BASE_URL}/api/consultations/doctors?${params}`, {
        headers: { Authorization: `Bearer ${userStore.accessToken}` },
      });
      const data = await res.json();
      if (data.code === 0) setDoctors(data.data);
    } catch (error) {
      console.error('Failed to fetch doctors:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/consultations/departments`, {
        headers: { Authorization: `Bearer ${userStore.accessToken}` },
      });
      const data = await res.json();
      if (data.code === 0) setDepartments(data.data);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const handleStartConsultation = async (doctorId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/consultations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userStore.accessToken}`,
        },
        body: JSON.stringify({ doctorId }),
      });
      const data = await res.json();
      if (data.code === 0) {
        navigate(`/doctor-chat/${data.data.id}`);
      }
    } catch (error) {
      console.error('Failed to create consultation:', error);
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
          <h1 className="text-xl font-bold">选择医生</h1>
        </div>
      </header>

      {/* Department Filter */}
      <div className="bg-white border-b overflow-x-auto">
        <div className="flex gap-2 p-3">
          <button
            onClick={() => setSelectedDept('')}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
              !selectedDept ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            全部
          </button>
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
                selectedDept === dept ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Doctor List */}
      <div className="p-4 space-y-4">
        {doctors.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <span className="material-symbols-outlined text-6xl mb-4 block">person_search</span>
            <p>暂无医生可预约</p>
          </div>
        ) : (
          doctors.map((doctor) => (
            <div key={doctor.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex gap-4">
                <img
                  src={doctor.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${doctor.id}`}
                  alt={doctor.name}
                  className="w-16 h-16 rounded-full bg-gray-100"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold">{doctor.name}</h3>
                    <span className="text-sm text-gray-500">{doctor.title}</span>
                  </div>
                  <p className="text-sm text-gray-600">{doctor.department} | {doctor.hospital}</p>
                  <p className="text-sm text-gray-500 mt-1">⭐ {doctor.rating} | 问诊量 500+</p>
                </div>
                <div className="text-right">
                  <p className="text-primary font-bold">¥{(doctor.consultationFee / 100).toFixed(0)}/次</p>
                  <button
                    onClick={() => handleStartConsultation(doctor.id)}
                    className="mt-2 px-4 py-2 bg-primary text-white rounded-lg text-sm"
                  >
                    立即问诊
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

export default DoctorList;
