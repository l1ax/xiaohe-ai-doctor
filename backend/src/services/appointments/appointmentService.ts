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

/**
 * Seeded random number generator for consistent schedule generation
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Simple linear congruential generator
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

/**
 * Validates ISO 8601 date format
 */
export function isValidISODate(dateString: string): boolean {
  if (!dateString) return false;

  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  if (!isoRegex.test(dateString)) return false;

  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Validates date range format (YYYY-MM-DD)
 */
export function isValidDateFormat(dateString: string): boolean {
  if (!dateString) return false;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;

  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Checks if a date is in the past
 */
export function isPastDate(dateString: string): boolean {
  const appointmentDate = new Date(dateString);
  const now = new Date();
  return appointmentDate < now;
}

// Mock 医生排班数据（未来7天）
// Use seeded random for consistent schedule generation
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
  // Use current date as seed for consistency
  const seededRandom = new SeededRandom(today.getDate());

  for (let i = 0; i < 7; i++) {
    // Create a new date object for each iteration to avoid mutation
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    for (const doctorId of doctors) {
      // Use seeded random for consistent slot generation
      const availableSlots = timeSlots.filter(() => seededRandom.next() > 0.3);
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
  // Validate date formats
  if (!isValidDateFormat(startDate) || !isValidDateFormat(endDate)) {
    throw new Error('Invalid date format. Use YYYY-MM-DD format.');
  }

  const schedules: { date: string; availableSlots: string[] }[] = [];

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Validate date range
  if (start > end) {
    throw new Error('Start date must be before end date.');
  }

  // Fixed date loop - create new Date object for each iteration to avoid mutation
  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const key = `${doctorId}_${dateStr}`;
    const availableSlots = mockSchedules.get(key) || [];

    schedules.push({
      date: dateStr,
      availableSlots,
    });

    // Move to next day by creating a new Date object
    current.setDate(current.getDate() + 1);
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
  // Validate ISO 8601 date format
  if (!isValidISODate(appointmentTime)) {
    throw new Error('Invalid appointment time format. Use ISO 8601 format.');
  }

  // Prevent past appointments
  if (isPastDate(appointmentTime)) {
    throw new Error('Cannot book appointments in the past.');
  }

  // Check if the time slot is available and not already booked
  const appointmentDate = new Date(appointmentTime);
  const dateStr = appointmentDate.toISOString().split('T')[0];
  const timeStr = appointmentDate.toTimeString().substring(0, 5); // HH:MM format

  const scheduleKey = `${doctorId}_${dateStr}`;
  const availableSlots = mockSchedules.get(scheduleKey) || [];

  // Check if the time slot exists in the schedule
  if (!availableSlots.includes(timeStr)) {
    throw new Error('Selected time slot is not available for this doctor.');
  }

  // Check for duplicate booking - find existing appointments for the same doctor, date, and time
  const existingAppointments = Array.from(mockAppointments.values()).filter(
    (a) =>
      a.doctorId === doctorId &&
      a.appointmentTime.startsWith(dateStr) &&
      a.appointmentTime.includes(timeStr) &&
      a.status !== 'cancelled'
  );

  if (existingAppointments.length > 0) {
    throw new Error('This time slot is already booked. Please choose another time.');
  }

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

  // Check if appointment is already cancelled or completed
  if (appointment.status === 'cancelled') {
    throw new Error('Appointment is already cancelled.');
  }

  if (appointment.status === 'completed') {
    throw new Error('Cannot cancel a completed appointment.');
  }

  appointment.status = 'cancelled';
  appointment.updatedAt = new Date().toISOString();

  return appointment;
}
