/**
 * 问诊会话存储服务（MVP 阶段使用内存存储）
 */

export interface Consultation {
  id: string;
  patientId: string;
  patientPhone: string;
  doctorId: string;
  status: 'pending' | 'active' | 'closed';
  createdAt: string;
  updatedAt: string;
}

class ConsultationStore {
  private consultations: Map<string, Consultation> = new Map();

  createConsultation(data: Consultation): Consultation {
    this.consultations.set(data.id, data);
    return data;
  }

  getById(id: string): Consultation | undefined {
    return this.consultations.get(id);
  }

  getByPatientId(patientId: string): Consultation[] {
    return Array.from(this.consultations.values())
      .filter((c) => c.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getByDoctorId(doctorId: string): Consultation[] {
    return Array.from(this.consultations.values())
      .filter((c) => c.doctorId === doctorId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getPendingByDoctorId(doctorId: string): Consultation[] {
    return Array.from(this.consultations.values())
      .filter((c) => c.doctorId === doctorId && c.status === 'pending')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  updateStatus(id: string, status: Consultation['status']): Consultation | undefined {
    const consultation = this.consultations.get(id);
    if (consultation) {
      consultation.status = status;
      consultation.updatedAt = new Date().toISOString();
    }
    return consultation;
  }

  clear(): void {
    this.consultations.clear();
  }
}

export const consultationStore = new ConsultationStore();
