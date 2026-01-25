export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;      // 脱敏
  patientPhone: string;     // 脱敏
  doctorId: string;
  doctorName: string;
  hospital: string;
  department: string;
  appointmentTime: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StatusTab {
  key: AppointmentStatus | 'all';
  label: string;
  count?: number;
}

export interface AppointmentListResponse {
  appointments: Appointment[];
  total: number;
}
