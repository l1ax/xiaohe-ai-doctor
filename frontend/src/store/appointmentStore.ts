import { makeAutoObservable, runInAction } from 'mobx';
import { appointmentApi, Doctor, Appointment } from '../services/appointment';

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
        appointmentTime: `${this.selectedDate}T${this.selectedTimeSlot}:00.000Z`,
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
