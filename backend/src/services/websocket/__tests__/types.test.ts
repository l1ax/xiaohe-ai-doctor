import { describe, it, expect } from 'vitest';
import { WSMessageType, ConsultationUpdateData, NewConsultationData } from '../types';

describe('WebSocket Message Types', () => {
  it('should have join message type', () => {
    expect(WSMessageType.JOIN).toBe('join');
  });

  it('should have leave message type', () => {
    expect(WSMessageType.LEAVE).toBe('leave');
  });

  it('should have consultation_update message type', () => {
    expect(WSMessageType.CONSULTATION_UPDATE).toBe('consultation_update');
  });

  it('should have new_consultation message type', () => {
    expect(WSMessageType.NEW_CONSULTATION).toBe('new_consultation');
  });
});

describe('ConsultationUpdateData', () => {
  it('should accept valid consultation update data', () => {
    const data: ConsultationUpdateData = {
      id: 'consultation-123',
      status: 'active',
      lastMessage: 'Patient reports headache',
      lastMessageTime: '2026-01-26T10:30:00Z',
      updatedAt: '2026-01-26T10:30:00Z',
    };
    expect(data.id).toBe('consultation-123');
    expect(data.status).toBe('active');
  });

  it('should accept all valid status values', () => {
    const statuses: Array<ConsultationUpdateData['status']> = ['pending', 'active', 'closed', 'cancelled'];
    expect(statuses).toHaveLength(4);
  });
});

describe('NewConsultationData', () => {
  it('should accept valid new consultation data', () => {
    const data: NewConsultationData = {
      id: 'consultation-456',
      patientId: 'patient-789',
      patientPhone: '+1234567890',
      status: 'pending',
      createdAt: '2026-01-26T10:30:00Z',
    };
    expect(data.id).toBe('consultation-456');
    expect(data.status).toBe('pending');
  });
});
