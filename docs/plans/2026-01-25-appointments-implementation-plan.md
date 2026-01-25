# 预约挂号模块实现计划

**创建日期**：2026-01-25
**基于设计**：2026-01-25-appointments-frontend-design.md

---

## 任务 1：创建预约 API 服务层

**文件**：`frontend/src/services/appointment.ts`

```typescript
import { request } from '../utils/request';

// 医生类型
export interface Doctor {
  id: string;
  name: string;
  title: string;
  hospital: string;
  department: string;
  rating: number;
  available: boolean;
}

// 时间段类型
export interface TimeSlot {
  time: string;
  available: boolean;
}

// 排班类型
export interface Schedule {
  doctorId: string;
  date: string;
  slots: TimeSlot[];
}

// 预约类型
export interface Appointment {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorTitle: string;
  hospital: string;
  department: string;
  date: string;
  timeSlot: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
}

// 创建预约请求
export interface CreateAppointmentRequest {
  doctorId: string;
  date: string;
  timeSlot: string;
}

export const appointmentApi = {
  // 获取医生列表（按科室分组）
  getDoctors() {
    return request.get<Doctor[]>('/appointments/doctors');
  },

  // 获取医生排班
  getSchedule(doctorId: string, startDate: string, endDate: string) {
    return request.get<Schedule[]>(`/appointments/schedule?doctorId=${doctorId}&startDate=${startDate}&endDate=${endDate}`);
  },

  // 创建预约
  createAppointment(data: CreateAppointmentRequest) {
    return request.post<Appointment>('/appointments', data);
  },

  // 获取我的预约列表
  getMyAppointments(status?: string) {
    const endpoint = status ? `/appointments?status=${status}` : '/appointments';
    return request.get<Appointment[]>(endpoint);
  },

  // 获取预约详情
  getAppointmentDetail(id: string) {
    return request.get<Appointment>(`/appointments/${id}`);
  },

  // 取消预约
  cancelAppointment(id: string) {
    return request.put<Appointment>(`/appointments/${id}/cancel`, {});
  },
};
```

**验证**：运行 `pnpm dev` 后前端无 TS 错误

---

## 任务 2：创建预约状态管理

**文件**：`frontend/src/store/appointmentStore.ts`

```typescript
import { makeAutoObservable, runInAction } from 'mobx';
import { appointmentApi, Doctor, Appointment, Schedule, TimeSlot } from '../services/appointment';

class AppointmentStore {
  // 当前预约流程状态
  selectedDoctor: Doctor | null = null;
  selectedDate: string = '';
  selectedTimeSlot: string = '';
  appointmentDateRange: string[] = [];

  // 预约列表
  appointments: Appointment[] = [];
  appointmentDetail: Appointment | null = null;
  loading = false;
  error: string | null = null;

  constructor() {
    makeAutoObservable(this);
    this.generateDateRange();
  }

  private generateDateRange() {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }
    this.appointmentDateRange = dates;
  }

  // Actions
  selectDoctor(doctor: Doctor) {
    this.selectedDoctor = doctor;
    this.selectedDate = '';
    this.selectedTimeSlot = '';
  }

  selectDate(date: string) {
    this.selectedDate = date;
    this.selectedTimeSlot = '';
  }

  selectTimeSlot(slot: string) {
    this.selectedTimeSlot = slot;
  }

  async fetchAppointments(status?: string) {
    try {
      this.loading = true;
      this.error = null;
      const appointments = await appointmentApi.getMyAppointments(status);
      runInAction(() => {
        this.appointments = appointments;
      });
    } catch (e: any) {
      runInAction(() => {
        this.error = e.message;
      });
      throw e;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async fetchAppointmentDetail(id: string) {
    try {
      this.loading = true;
      this.error = null;
      const detail = await appointmentApi.getAppointmentDetail(id);
      runInAction(() => {
        this.appointmentDetail = detail;
      });
    } catch (e: any) {
      runInAction(() => {
        this.error = e.message;
      });
      throw e;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async createAppointment() {
    if (!this.selectedDoctor || !this.selectedDate || !this.selectedTimeSlot) {
      throw new Error('请选择医生、日期和时间');
    }

    try {
      this.loading = true;
      this.error = null;
      await appointmentApi.createAppointment({
        doctorId: this.selectedDoctor.id,
        date: this.selectedDate,
        timeSlot: this.selectedTimeSlot,
      });
    } catch (e: any) {
      runInAction(() => {
        this.error = e.message;
      });
      throw e;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  async cancelAppointment(id: string) {
    try {
      this.loading = true;
      this.error = null;
      await appointmentApi.cancelAppointment(id);
      // 刷新列表
      await this.fetchAppointments();
    } catch (e: any) {
      runInAction(() => {
        this.error = e.message;
      });
      throw e;
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }

  resetFlow() {
    this.selectedDoctor = null;
    this.selectedDate = '';
    this.selectedTimeSlot = '';
  }
}

export const appointmentStore = new AppointmentStore();
```

**验证**：运行 `pnpm dev` 后前端无 TS 错误

---

## 任务 3：导出 appointmentStore

**文件**：`frontend/src/store/index.ts`（追加）

```typescript
export { userStore } from './userStore';
export { appointmentStore } from './appointmentStore';
```

**验证**：运行 `pnpm dev` 后前端无 TS 错误

---

## 任务 4：改造我的预约列表页

**文件**：`frontend/src/pages/Appointments/index.tsx`

```typescript
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentStore } from '../../store';
import { Appointment } from '../../services/appointment';

type TabType = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled';

const Appointments = observer(function Appointments() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('all');

  useEffect(() => {
    appointmentStore.fetchAppointments();
  }, []);

  const filteredAppointments = appointmentStore.appointments.filter((apt) => {
    if (activeTab === 'all') return true;
    return apt.status === activeTab;
  });

  const getStatusText = (status: Appointment['status']) => {
    const statusMap = {
      pending: '待确认',
      confirmed: '已确认',
      completed: '已完成',
      cancelled: '已取消',
    };
    return statusMap[status];
  };

  const getStatusColor = (status: Appointment['status']) => {
    const colorMap = {
      pending: 'text-yellow-600 bg-yellow-50',
      confirmed: 'text-green-600 bg-green-50',
      completed: 'text-gray-600 bg-gray-50',
      cancelled: 'text-red-600 bg-red-50',
    };
    return colorMap[status];
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-800 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold">我的预约</h1>
        <button
          onClick={() => navigate('/appointments/doctors')}
          className="ml-auto p-2 text-blue-600"
        >
          <span className="material-symbols-outlined">add</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        {(['all', 'pending', 'confirmed', 'completed', 'cancelled'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 dark:text-gray-400'
            }`}
          >
            {tab === 'all' ? '全部' : getStatusText(tab as Appointment['status'])}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="p-4 space-y-3">
        {appointmentStore.loading ? (
          <div className="flex justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-4xl text-blue-600">
              progress_activity
            </span>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-6xl text-gray-300 block mb-4">
              calendar_month
            </span>
            <p className="text-gray-500">暂无预约</p>
          </div>
        ) : (
          filteredAppointments.map((apt) => (
            <div
              key={apt.id}
              onClick={() => navigate(`/appointments/${apt.id}`)}
              className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm active:opacity-80"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{apt.doctorName}</h3>
                  <p className="text-sm text-gray-500">{apt.department} · {apt.hospital}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(apt.status)}`}>
                  {getStatusText(apt.status)}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">calendar_month</span>
                  {apt.date}
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">schedule</span>
                  {apt.timeSlot}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

export default Appointments;
```

**验证**：
1. 运行 `pnpm dev` 访问 `/appointments` 页面正常显示
2. 点击 tabs 可以筛选预约

---

## 任务 5：实现医生选择页

**文件**：`frontend/src/pages/Appointments/Doctors.tsx`

```typescript
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentStore } from '../../store';
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
    appointmentStore.selectDoctor(doctor);
    navigate('/appointments/schedule');
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
```

**验证**：
1. 运行 `pnpm dev` 访问 `/appointments/doctors` 页面正常显示
2. 科室可以折叠/展开
3. 点击可用医生跳转到时间选择页

---

## 任务 6：实现时间选择页

**文件**：`frontend/src/pages/Appointments/Schedule.tsx`

```typescript
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appointmentStore } from '../../store';
import { appointmentApi, TimeSlot } from '../../services/appointment';

const Schedule = observer(function Schedule() {
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState<{ date: string; slots: TimeSlot[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    if (!appointmentStore.selectedDoctor) {
      navigate('/appointments/doctors');
      return;
    }

    try {
      setLoading(true);
      const data = await appointmentApi.getSchedule(
        appointmentStore.selectedDoctor.id,
        appointmentStore.appointmentDateRange[0],
        appointmentStore.appointmentDateRange[6]
      );
      setSchedule(data);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekDay = weekDays[date.getDay()];
    return { month, day, weekDay, full: dateStr };
  };

  const getSlotsForDate = (date: string) => {
    const scheduleItem = schedule.find((s) => s.date === date);
    return scheduleItem?.slots || [];
  };

  const handleSelectDate = (date: string) => {
    appointmentStore.selectDate(date);
  };

  const handleSelectSlot = (slot: string) => {
    appointmentStore.selectTimeSlot(slot);
  };

  const canProceed = appointmentStore.selectedDate && appointmentStore.selectedTimeSlot;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-800 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold">选择时间</h1>
      </div>

      {/* Doctor Info */}
      {appointmentStore.selectedDoctor && (
        <div className="px-4 py-3 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
          <p className="font-semibold">{appointmentStore.selectedDoctor.name}</p>
          <p className="text-sm text-gray-500">
            {appointmentStore.selectedDoctor.department} · {appointmentStore.selectedDoctor.hospital}
          </p>
        </div>
      )}

      {/* Date Slider */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="flex overflow-x-auto px-4 py-3 gap-2 scrollbar-hide">
          {appointmentStore.appointmentDateRange.map((date) => {
            const { month, day, weekDay } = formatDate(date);
            const isSelected = appointmentStore.selectedDate === date;
            return (
              <button
                key={date}
                onClick={() => handleSelectDate(date)}
                className={`flex-shrink-0 w-16 h-20 rounded-xl flex flex-col items-center justify-center transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <span className="text-xs opacity-70">{weekDay}</span>
                <span className="text-xl font-bold">{day}</span>
                <span className="text-xs">{month}月</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Slots */}
      <div className="flex-1 p-4 overflow-auto">
        {loading ? (
          <div className="flex justify-center py-20">
            <span className="material-symbols-outlined animate-spin text-4xl text-blue-600">
              progress_activity
            </span>
          </div>
        ) : appointmentStore.selectedDate ? (
          <div>
            <h3 className="font-semibold mb-3">{formatDate(appointmentStore.selectedDate).full}</h3>
            <div className="grid grid-cols-3 gap-3">
              {getSlotsForDate(appointmentStore.selectedDate).map((slot) => (
                <button
                  key={slot.time}
                  onClick={() => slot.available && handleSelectSlot(slot.time)}
                  disabled={!slot.available}
                  className={`py-3 rounded-lg text-sm font-medium transition-colors ${
                    appointmentStore.selectedTimeSlot === slot.time
                      ? 'bg-blue-600 text-white'
                      : slot.available
                      ? 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-600'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">
            <span className="material-symbols-outlined text-6xl text-gray-300 block mb-4">
              schedule
            </span>
            <p>请选择日期</p>
          </div>
        )}
      </div>

      {/* Bottom Button */}
      <div className="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700">
        <button
          onClick={() => navigate('/appointments/confirm')}
          disabled={!canProceed}
          className={`w-full py-4 rounded-xl font-semibold text-lg transition-colors ${
            canProceed
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          确定
        </button>
      </div>
    </div>
  );
});

export default Schedule;
```

**验证**：
1. 运行 `pnpm dev` 访问 `/appointments/schedule` 页面正常显示
2. 日期滑块可以左右滑动
3. 选择日期后显示时间段
4. 选择日期和时间后确定按钮可用

---

## 任务 7：实现确认页

**文件**：`frontend/src/pages/Appointments/Confirm.tsx`

```typescript
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { appointmentStore } from '../../store';

const Confirm = observer(function Confirm() {
  const navigate = useNavigate();

  const handleConfirm = async () => {
    try {
      await appointmentStore.createAppointment();
      appointmentStore.resetFlow();
      navigate('/appointments');
    } catch (error) {
      alert('预约失败，请重试');
    }
  };

  if (!appointmentStore.selectedDoctor) {
    navigate('/appointments/doctors');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-800 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
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
```

**验证**：
1. 运行 `pnpm dev` 访问 `/appointments/confirm` 页面正常显示
2. 显示预约信息预览
3. 点击确认预约按钮提交请求
4. 预约成功后跳转到列表页

---

## 任务 8：实现预约详情页

**文件**：`frontend/src/pages/Appointments/AppointmentDetail.tsx`

```typescript
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { appointmentStore } from '../../store';

const AppointmentDetail = observer(function AppointmentDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  useEffect(() => {
    if (id) {
      appointmentStore.fetchAppointmentDetail(id);
    }
    return () => {
      appointmentStore.appointmentDetail = null;
    };
  }, [id]);

  const detail = appointmentStore.appointmentDetail;

  const getStatusConfig = (status: string) => {
    const config = {
      pending: { text: '待确认', color: 'text-yellow-600 bg-yellow-50', icon: 'pending' },
      confirmed: { text: '已确认', color: 'text-green-600 bg-green-50', icon: 'check_circle' },
      completed: { text: '已完成', color: 'text-gray-600 bg-gray-50', icon: 'task_alt' },
      cancelled: { text: '已取消', color: 'text-red-600 bg-red-50', icon: 'cancel' },
    };
    return config[status as keyof typeof config] || config.pending;
  };

  const handleCancel = async () => {
    if (window.confirm('确定要取消预约吗？')) {
      try {
        await appointmentStore.cancelAppointment(id!);
        navigate('/appointments');
      } catch (error) {
        alert('取消失败，请重试');
      }
    }
  };

  if (!detail) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-blue-600">
          progress_activity
        </span>
      </div>
    );
  }

  const statusConfig = getStatusConfig(detail.status);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center gap-4 px-4 py-3 bg-white dark:bg-gray-800 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-xl font-bold">预约详情</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <span className={`material-symbols-outlined ${statusConfig.color.split(' ')[0]}`}>
              {statusConfig.icon}
            </span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig.color}`}>
              {statusConfig.text}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            预约号：{detail.id.slice(0, 8).toUpperCase()}
          </p>
        </div>

        {/* Doctor Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-lg mb-4">医生信息</h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-3xl">
                person
              </span>
            </div>
            <div>
              <p className="font-semibold text-lg">{detail.doctorName}</p>
              <p className="text-sm text-gray-500">{detail.doctorTitle}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <span className="material-symbols-outlined text-sm">location_on</span>
              <span>{detail.hospital} · {detail.department}</span>
            </div>
          </div>
        </div>

        {/* Appointment Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
          <h2 className="font-semibold text-lg mb-4">预约信息</h2>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-500">预约日期</span>
              <span className="font-medium">{detail.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">预约时间</span>
              <span className="font-medium">{detail.timeSlot}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">预约时间</span>
              <span className="font-medium">{new Date(detail.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        {detail.status === 'pending' && (
          <button
            onClick={handleCancel}
            disabled={appointmentStore.loading}
            className="w-full py-4 rounded-xl font-semibold text-lg border-2 border-red-600 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            取消预约
          </button>
        )}
      </div>
    </div>
  );
});

export default AppointmentDetail;
```

**验证**：
1. 运行 `pnpm dev` 访问 `/appointments/:id` 页面正常显示
2. 显示预约详细信息
3. 待确认状态下可以取消预约

---

## 任务 9：更新路由配置

**文件**：`frontend/src/router.tsx`

```typescript
import { createBrowserRouter } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Appointments from './pages/Appointments';
import Consultations from './pages/Consultations';
import Prescriptions from './pages/Prescriptions';
import HealthRecords from './pages/HealthRecords';
import FamilyMembers from './pages/FamilyMembers';
import Address from './pages/Address';
import CustomerService from './pages/CustomerService';
import VIP from './pages/VIP';
import Chat from './pages/Chat';
import Layout from './components/Layout';

// 预约模块页面
import Doctors from './pages/Appointments/Doctors';
import Schedule from './pages/Appointments/Schedule';
import Confirm from './pages/Appointments/Confirm';
import AppointmentDetail from './pages/Appointments/AppointmentDetail';

// 需要底部导航的页面包裹
const withLayout = (element: React.ReactNode) => <Layout>{element}</Layout>;

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/', element: withLayout(<Home />) },
  { path: '/profile', element: withLayout(<Profile />) },
  { path: '/settings', element: <Settings /> },
  { path: '/appointments', element: withLayout(<Appointments />) },
  { path: '/appointments/doctors', element: withLayout(<Doctors />) },
  { path: '/appointments/schedule', element: withLayout(<Schedule />) },
  { path: '/appointments/confirm', element: withLayout(<Confirm />) },
  { path: '/appointments/:id', element: withLayout(<AppointmentDetail />) },
  { path: '/consultations', element: withLayout(<Consultations />) },
  { path: '/prescriptions', element: withLayout(<Prescriptions />) },
  { path: '/health-records', element: withLayout(<HealthRecords />) },
  { path: '/family-members', element: withLayout(<FamilyMembers />) },
  { path: '/address', element: withLayout(<Address />) },
  { path: '/customer-service', element: withLayout(<CustomerService />) },
  { path: '/vip', element: withLayout(<VIP />) },
  { path: '/booking', element: withLayout(<div>挂号页面（开发中）</div>) },
  { path: '/chat', element: <Chat /> },
]);
```

**验证**：
1. 运行 `pnpm dev` 访问各路由正常
2. 页面导航正常

---

## 任务 10：更新底部导航

**文件**：`frontend/src/components/Layout.tsx`

将底部导航的"挂号"按钮链接到 `/appointments/doctors`。

```typescript
// 在 Layout.tsx 中找到导航配置，修改对应的 path：
{
  path: '/appointments/doctors', // 原来是 /booking
  icon: 'calendar_month',
  label: '挂号',
}
```

**验证**：
1. 点击底部导航"挂号"跳转到医生选择页

---

## 依赖关系

```
appointment.ts → appointmentStore.ts → 各页面组件 → router.tsx → Layout.tsx
```

---

## 验证命令

```bash
# 启动开发服务器
pnpm dev

# 运行类型检查
pnpm tsc --noEmit

# 构建项目
pnpm build
```
