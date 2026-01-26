import { v4 as uuidv4 } from 'uuid';
import { ValidationError } from '../../utils/errorHandler';
import { scheduleStore, TimeSlot as ScheduleTimeSlot } from '../storage/scheduleStore';

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
 * Checks if a date is in the past (before today)
 * Uses UTC to avoid timezone issues
 */
export function isPastDate(dateString: string): boolean {
  const appointmentDate = new Date(dateString);
  const now = new Date();
  // Use UTC methods to avoid timezone issues
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const appointmentUtc = appointmentDate.getTime();
  return appointmentUtc < todayUtc;
}

/**
 * 为指定时间范围生成时间段数组
 * @param startHour 开始小时（包含）
 * @param endHour 结束小时（不包含）
 * @param intervalMinutes 时间间隔（分钟）
 */
function generateTimeSlotsForPeriod(
  startHour: number,
  endHour: number,
  intervalMinutes: number = 30
): string[] {
  const slots: string[] = [];
  for (let hour = startHour; hour < endHour; hour++) {
    for (let min = 0; min < 60; min += intervalMinutes) {
      const hourStr = String(hour).padStart(2, '0');
      const minStr = String(min).padStart(2, '0');
      slots.push(`${hourStr}:${minStr}`);
    }
  }
  return slots;
}

/**
 * 将具体时间映射到时段（morning/afternoon/evening）
 * 时段定义与前端保持一致：
 * - morning: 8:00-12:00
 * - afternoon: 14:00-18:00
 * - evening: 18:00-21:00
 */
function mapTimeToTimeSlot(time: string): ScheduleTimeSlot {
  const hour = parseInt(time.split(':')[0], 10);

  if (hour >= 8 && hour < 12) {
    return 'morning';
  } else if (hour >= 14 && hour < 18) {
    return 'afternoon';
  } else if (hour >= 18 && hour < 21) {
    return 'evening';
  } else {
    // 其他时间段（6:00-8:00, 12:00-14:00, 21:00之后）不属于任何标准时段
    // 根据最接近的时段返回
    if (hour >= 6 && hour < 8) {
      return 'morning'; // 早晨边缘时段归入上午
    } else if (hour >= 12 && hour < 14) {
      return 'afternoon'; // 午休时段归入下午
    } else {
      return 'evening'; // 其他时段归入晚上
    }
  }
}

/**
 * 根据医生的排班设置，过滤可用的时间段
 */
function filterAvailableSlotsBySchedule(
  doctorId: string,
  date: string,
  allSlots: string[]
): string[] {
  // 获取医生当天的排班设置
  const doctorSchedules = scheduleStore.getByDate(doctorId, date);

  // 如果没有任何排班设置，返回所有可用时段（默认行为）
  if (doctorSchedules.length === 0) {
    return allSlots;
  }

  // 创建一个时段可用性的映射
  const timeSlotAvailability = new Map<ScheduleTimeSlot, boolean>();
  for (const schedule of doctorSchedules) {
    timeSlotAvailability.set(schedule.timeSlot, schedule.isAvailable);
  }

  // 过滤时间段，只保留在可用时段中的时间
  return allSlots.filter(time => {
    const timeSlot = mapTimeToTimeSlot(time);
    const isAvailable = timeSlotAvailability.get(timeSlot);

    // 如果没有设置该时段，默认为可用
    return isAvailable !== false;
  });
}

// Mock 医生排班数据（未来7天）
// Use seeded random for consistent schedule generation
function generateMockSchedules(): Map<string, string[]> {
  const schedules = new Map<string, string[]>();
  const doctors = ['doctor_001', 'doctor_002', 'doctor_003', 'doctor_004'];
  // 生成完整的时间段，覆盖早中晚三个时段
  // 时段定义与前端保持一致
  const timeSlots = [
    ...generateTimeSlotsForPeriod(8, 12),   // Morning: 8:00-11:30
    ...generateTimeSlotsForPeriod(14, 18),  // Afternoon: 14:00-17:30
    ...generateTimeSlotsForPeriod(18, 21),  // Evening: 18:00-20:30
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
 * 集成医生的排班设置，只返回医生设置的可用时段
 */
export function getDoctorSchedule(doctorId: string, startDate: string, endDate: string): {
  date: string;
  availableSlots: string[];
}[] {
  // Validate date formats
  if (!isValidDateFormat(startDate) || !isValidDateFormat(endDate)) {
    throw new ValidationError('Invalid date format. Use YYYY-MM-DD format.');
  }

  const schedules: { date: string; availableSlots: string[] }[] = [];

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Validate date range
  if (start > end) {
    throw new ValidationError('Start date must be before end date.');
  }

  // Fixed date loop - create new Date object for each iteration to avoid mutation
  const current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const key = `${doctorId}_${dateStr}`;
    const allSlots = mockSchedules.get(key) || [];

    // 根据医生的排班设置过滤可用时间段
    const availableSlots = filterAvailableSlotsBySchedule(doctorId, dateStr, allSlots);

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
 * 验证时间段的可用性，包括医生的排班设置和已有预约
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
    throw new ValidationError('Invalid appointment time format. Use ISO 8601 format.');
  }

  // Prevent past appointments
  if (isPastDate(appointmentTime)) {
    throw new ValidationError('Cannot book appointments in the past.');
  }

  // Check if the time slot is available and not already booked
  const appointmentDate = new Date(appointmentTime);
  const dateStr = appointmentDate.toISOString().split('T')[0];
  // Extract time in UTC to match the stored format
  const hours = String(appointmentDate.getUTCHours()).padStart(2, '0');
  const minutes = String(appointmentDate.getUTCMinutes()).padStart(2, '0');
  const timeStr = `${hours}:${minutes}`; // HH:MM format

  const scheduleKey = `${doctorId}_${dateStr}`;
  const allSlots = mockSchedules.get(scheduleKey) || [];

  // 根据医生的排班设置过滤可用时间段
  const availableSlots = filterAvailableSlotsBySchedule(doctorId, dateStr, allSlots);

  // Check if the time slot exists in the schedule and is available according to doctor's schedule settings
  if (!availableSlots.includes(timeStr)) {
    throw new ValidationError('Selected time slot is not available for this doctor.');
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
    throw new ValidationError('This time slot is already booked. Please choose another time.');
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
    throw new ValidationError('Appointment is already cancelled.');
  }

  if (appointment.status === 'completed') {
    throw new ValidationError('Cannot cancel a completed appointment.');
  }

  appointment.status = 'cancelled';
  appointment.updatedAt = new Date().toISOString();

  return appointment;
}

/**
 * 获取医生的预约列表
 */
export function getDoctorAppointments(
  doctorId: string,
  status?: AppointmentStatus
): Appointment[] {
  let appointments = Array.from(mockAppointments.values()).filter(
    (a) => a.doctorId === doctorId
  );

  // 按状态筛选
  if (status) {
    appointments = appointments.filter((a) => a.status === status);
  }

  // 按预约时间倒序排序
  return appointments.sort((a, b) =>
    b.appointmentTime.localeCompare(a.appointmentTime)
  );
}
