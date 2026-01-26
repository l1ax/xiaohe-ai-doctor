export interface DoctorSchedule {
  id: string;
  doctorId: string;
  date: string;        // YYYY-MM-DD
  timeSlot: 'morning' | 'afternoon' | 'evening';
  isAvailable: boolean;
  maxPatients: number;
}

export interface ScheduleDay {
  date: string;
  schedules: DoctorSchedule[];
}

export interface TimeSlotConfig {
  key: 'morning' | 'afternoon' | 'evening';
  label: string;
  timeRange: string;
  defaultMaxPatients: number;
}

export const TIME_SLOTS: TimeSlotConfig[] = [
  { key: 'morning', label: '上午', timeRange: '8:00-12:00', defaultMaxPatients: 10 },
  { key: 'afternoon', label: '下午', timeRange: '14:00-18:00', defaultMaxPatients: 10 },
  { key: 'evening', label: '晚上', timeRange: '18:00-21:00', defaultMaxPatients: 8 },
];
