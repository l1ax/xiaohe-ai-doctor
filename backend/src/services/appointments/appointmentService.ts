import { v4 as uuidv4 } from 'uuid';

/**
 * 预约状态
 */
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

/**
 * 预约信息
 */
export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  hospital: string;
  department: string;
  appointmentTime: string; // ISO 8601 格式
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
}

// Mock 医生排班数据（未来7天）
function generateMockSchedules(): Map<string, string[]> {
  const schedules = new Map<string, string[]>();
  const doctors = ['doctor_001', 'doctor_002', 'doctor_003', 'doctor_004'];
  const timeSlots = [
    '09:00',
    '09:30',
    '10:00',
    '10:30',
    '11:00',
    '14:00',
    '14:30',
    '15:00',
    '15:30',
    '16:00',
  ];

  const today = new Date();
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    for (const doctorId of doctors) {
      // 随机生成一些可预约时段
      const availableSlots = timeSlots.filter(() => Math.random() > 0.3);
      schedules.set(`${doctorId}_${dateStr}`, availableSlots);
    }
  }

  return schedules;
}

const mockSchedules = generateMockSchedules();
const mockAppointments: Map<string, Appointment> = new Map();

/**
 * 获取医生排班
 */
export function getDoctorSchedule(doctorId: string, startDate: string, endDate: string): {
  date: string;
  availableSlots: string[];
}[] {
  const schedules: { date: string; availableSlots: string[] }[] = [];

  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const key = `${doctorId}_${dateStr}`;
    const availableSlots = mockSchedules.get(key) || [];

    schedules.push({
      date: dateStr,
      availableSlots,
    });
  }

  return schedules;
}

/**
 * 创建预约
 */
export function createAppointment(
  patientId: string,
  patientName: string,
  patientPhone: string,
  doctorId: string,
  doctorName: string,
  hospital: string,
  department: string,
  appointmentTime: string
): Appointment {
  const appointmentId = uuidv4();
  const now = new Date().toISOString();

  const appointment: Appointment = {
    id: appointmentId,
    patientId,
    patientName,
    patientPhone,
    doctorId,
    doctorName,
    hospital,
    department,
    appointmentTime,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  mockAppointments.set(appointmentId, appointment);

  return appointment;
}

/**
 * 获取用户预约列表
 */
export function getUserAppointments(patientId: string): Appointment[] {
  return Array.from(mockAppointments.values())
    .filter((a) => a.patientId === patientId)
    .sort((a, b) => b.appointmentTime.localeCompare(a.appointmentTime));
}

/**
 * 获取预约详情
 */
export function getAppointmentById(id: string): Appointment | undefined {
  return mockAppointments.get(id);
}

/**
 * 取消预约
 */
export function cancelAppointment(id: string): Appointment | undefined {
  const appointment = mockAppointments.get(id);
  if (!appointment) {
    return undefined;
  }

  appointment.status = 'cancelled';
  appointment.updatedAt = new Date().toISOString();

  return appointment;
}
