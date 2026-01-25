import { describe, it, expect, beforeEach } from 'vitest';
import { consultationStore, Consultation } from '../consultationStore';

describe('ConsultationStore', () => {
  beforeEach(() => {
    consultationStore.clear();
  });

  it('should create a consultation', () => {
    const consultation: Consultation = {
      id: 'conv_123',
      patientId: 'patient_1',
      patientPhone: '13800138000',
      doctorId: 'doctor_001',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const created = consultationStore.createConsultation(consultation);
    expect(created.id).toBe('conv_123');
    expect(created.status).toBe('pending');
  });

  it('should find consultation by id', () => {
    const consultation: Consultation = {
      id: 'conv_123',
      patientId: 'patient_1',
      patientPhone: '13800138000',
      doctorId: 'doctor_001',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    consultationStore.createConsultation(consultation);
    const found = consultationStore.getById('conv_123');
    expect(found).toBeDefined();
    expect(found?.patientId).toBe('patient_1');
  });

  it('should find consultations by doctor id', () => {
    const conv1: Consultation = {
      id: 'conv_1',
      patientId: 'patient_1',
      patientPhone: '13800138000',
      doctorId: 'doctor_001',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const conv2: Consultation = {
      id: 'conv_2',
      patientId: 'patient_2',
      patientPhone: '13900139000',
      doctorId: 'doctor_001',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    consultationStore.createConsultation(conv1);
    consultationStore.createConsultation(conv2);
    const consultations = consultationStore.getByDoctorId('doctor_001');
    expect(consultations).toHaveLength(2);
  });

  it('should update consultation status', () => {
    const consultation: Consultation = {
      id: 'conv_123',
      patientId: 'patient_1',
      patientPhone: '13800138000',
      doctorId: 'doctor_001',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    consultationStore.createConsultation(consultation);
    consultationStore.updateStatus('conv_123', 'active');
    const updated = consultationStore.getById('conv_123');
    expect(updated?.status).toBe('active');
  });

  it('should get pending consultations by doctor id', () => {
    const conv1: Consultation = {
      id: 'conv_1',
      patientId: 'patient_1',
      patientPhone: '13800138000',
      doctorId: 'doctor_001',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const conv2: Consultation = {
      id: 'conv_2',
      patientId: 'patient_2',
      patientPhone: '13900139000',
      doctorId: 'doctor_001',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    consultationStore.createConsultation(conv1);
    consultationStore.createConsultation(conv2);
    const pending = consultationStore.getPendingByDoctorId('doctor_001');
    expect(pending).toHaveLength(1);
    expect(pending[0].status).toBe('pending');
  });
});
