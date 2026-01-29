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
  date?: string;
  timeSlot?: string;
  appointmentTime: string;
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
    return request.get<{ doctor: Doctor; schedules: { date: string; availableSlots: string[] }[] }>(
      `/appointments/schedule?doctorId=${doctorId}&startDate=${startDate}&endDate=${endDate}`
    ).then(res =>
      res.schedules.map(s => ({
        date: s.date,
        availableSlots: s.availableSlots.map(time => ({ time, available: true }))
      }))
    );
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
