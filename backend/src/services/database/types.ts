import { UserIntent } from '../../agent/types';

// Re-export UserIntent for use in MessageWriter
export { UserIntent } from '../../agent/types';

export type MessageType = 'text' | 'image' | 'system';

export type ConversationType = 'ai' | 'doctor';

export type ConversationStatus = 'active' | 'closed';

export type UserRole = 'patient' | 'doctor';

export interface MessageMetadata {
  agentSteps?: number;
  toolCalls?: Array<{
    tool: string;
    status: 'running' | 'completed' | 'failed';
    input?: any;
    output?: any;
    error?: string;
  }>;
  sources?: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  medicalAdvice?: {
    symptoms: string[];
    possibleConditions: string[];
    suggestions: string[];
    urgencyLevel: 'low' | 'medium' | 'high';
  };
  actions?: Array<{
    type: 'transfer_to_doctor' | 'view_more' | 'book_appointment';
    label: string;
    data?: any;
  }>;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  systemType?: string;
  intent?: UserIntent;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  patient_id: string;
  doctor_id?: string;
  status: ConversationStatus;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content_type: MessageType;
  content: string;
  metadata?: MessageMetadata;
  created_at: string;
}

export interface WriterConfig {
  enabled: boolean;
  batch: {
    maxSize: number;
    flushInterval: number;
  };
}
