import { storage } from '../../../utils/storage';
import { DoctorSchedule } from './types';

// API 响应类型
interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

// 获取医生排班列表
export const getSchedules = async (date?: string): Promise<DoctorSchedule[]> => {
  const tokenData = storage.getToken();
  const token = tokenData?.accessToken || '';

  const url = date
    ? `/api/doctors/schedules?date=${date}`
    : '/api/doctors/schedules';

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error('获取排班数据失败');
  }

  const result: ApiResponse<DoctorSchedule[]> = await res.json();
  return result.data || [];
};

// 获取特定日期的排班
export const getScheduleByDate = async (date: string): Promise<DoctorSchedule[]> => {
  return getSchedules(date);
};

// 设置排班（创建或更新）
export const setSchedule = async (
  date: string,
  timeSlot: 'morning' | 'afternoon' | 'evening',
  data: { isAvailable: boolean; maxPatients: number }
): Promise<DoctorSchedule> => {
  const tokenData = storage.getToken();
  const token = tokenData?.accessToken || '';

  const res = await fetch('/api/doctors/schedules', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      date,
      timeSlot,
      ...data
    })
  });

  if (!res.ok) {
    throw new Error('保存排班失败');
  }

  const result: ApiResponse<DoctorSchedule> = await res.json();
  return result.data;
};

// 批量设置排班
export const batchSetSchedules = async (
  dates: string[],
  schedules: Array<{ timeSlot: 'morning' | 'afternoon' | 'evening'; isAvailable: boolean; maxPatients: number }>
): Promise<DoctorSchedule[]> => {
  const tokenData = storage.getToken();
  const token = tokenData?.accessToken || '';

  const res = await fetch('/api/doctors/schedules/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ dates, schedules })
  });

  if (!res.ok) {
    throw new Error('批量设置排班失败');
  }

  const result: ApiResponse<DoctorSchedule[]> = await res.json();
  return result.data || [];
};

// 删除排班
export const deleteSchedule = async (id: string): Promise<void> => {
  const tokenData = storage.getToken();
  const token = tokenData?.accessToken || '';

  const res = await fetch(`/api/doctors/schedules/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error('删除排班失败');
  }
};

// 删除特定日期的所有排班
export const deleteScheduleByDate = async (date: string): Promise<void> => {
  const tokenData = storage.getToken();
  const token = tokenData?.accessToken || '';

  const res = await fetch(`/api/doctors/schedules/date/${date}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    throw new Error('删除排班失败');
  }
};
