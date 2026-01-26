import { request } from '../../../utils/request';
import type { Appointment, AppointmentStatus } from './types';

/**
 * 获取医生预约列表
 */
export const getAppointments = async (status?: AppointmentStatus): Promise<Appointment[]> => {
  const params = status ? `?status=${status}` : '';
  return request.get<Appointment[]>(`/appointments/doctor${params}`);
};

/**
 * 确认预约
 */
export const confirmAppointment = async (id: string): Promise<Appointment> => {
  return request.put<Appointment>(`/appointments/${id}/confirm`);
};

/**
 * 取消预约
 */
export const cancelAppointment = async (id: string): Promise<Appointment> => {
  return request.put<Appointment>(`/appointments/${id}/cancel`);
};
