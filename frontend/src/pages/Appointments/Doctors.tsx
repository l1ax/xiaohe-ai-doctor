import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentApi, Doctor } from '../../services/appointment';

const Doctors = observer(function Doctors() {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDoctors();
  }, []);

  const loadDoctors = async () => {
    try {
      setLoading(true);
      const data = await appointmentApi.getDoctors();
      setDoctors(data);
      // 默认展开第一个科室
      if (data.length > 0) {
        setExpandedDepts(new Set([data[0].department]));
      }
    } finally {
      setLoading(false);
    }
  };

  const departments = [...new Set(doctors.map((d) => d.department))];

  const toggleDept = (dept: string) => {
    const newExpanded = new Set(expandedDepts);
    if (newExpanded.has(dept)) {
      newExpanded.delete(dept);
    } else {
      newExpanded.add(dept);
    }
    setExpandedDepts(newExpanded);
  };

  const getDoctorsByDept = (dept: string) => doctors.filter((d) => d.department === dept);

  const handleSelectDoctor = (doctor: Doctor) => {
    // 统一使用 URL 参数传递医生信息
    const params = new URLSearchParams({
      doctorId: doctor.id,
      doctorName: doctor.name,
      hospital: doctor.hospital,
      department: doctor.department,
    });
    navigate(`/appointments/schedule?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-800 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold">选择医生</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-4xl text-blue-600">
            progress_activity
          </span>
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {departments.map((dept) => (
            <div key={dept} className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm">
              <button
                onClick={() => toggleDept(dept)}
                className="w-full px-4 py-3 flex items-center justify-between bg-white dark:bg-gray-800"
              >
                <span className="font-semibold">{dept}</span>
                <span
                  className={`material-symbols-outlined transition-transform ${
                    expandedDepts.has(dept) ? 'rotate-180' : ''
                  }`}
                >
                  expand_more
                </span>
              </button>
              {expandedDepts.has(dept) && (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {getDoctorsByDept(dept).map((doctor) => (
                    <button
                      key={doctor.id}
                      onClick={() => handleSelectDoctor(doctor)}
                      disabled={!doctor.available}
                      className="w-full px-4 py-4 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700 active:opacity-80 disabled:opacity-50"
                    >
                      <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">
                          person
                        </span>
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{doctor.name}</span>
                          <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded">
                            {doctor.title}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">{doctor.hospital}</p>
                        <div className="flex items-center gap-3 mt-1 text-sm">
                          <span className="flex items-center gap-1 text-yellow-600">
                            <span className="material-symbols-outlined text-sm">star</span>
                            {doctor.rating}
                          </span>
                          {!doctor.available && (
                            <span className="text-red-500">暂不可约</span>
                          )}
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-gray-400">
                        chevron_right
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default Doctors;
