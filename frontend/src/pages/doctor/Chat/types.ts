/**
 * 医生端问诊聊天页面的类型定义
 */

// 重新导出 WebSocket 服务中的 ChatMessage 类型
export type { ChatMessage } from '../../../services/websocket';

// 患者信息
export interface PatientInfo {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  age: number;
  avatar?: string;
  isOnline: boolean;
}

// 问诊详情
export interface ConsultationDetail {
  id: string;
  patientId: string;
  patient: PatientInfo;
  doctorId: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  type: 'ai' | 'expert';
  chiefComplaint: string;
  aiReport?: AIReport;
  createdAt: string;
  updatedAt: string;
}

// AI 初步问诊报告
export interface AIReport {
  id: string;
  consultationId: string;
  chiefComplaint: string;
  symptoms: string[];
  medicalHistory: string;
  preliminaryDiagnosis: string;
  recommendations: string[];
  urgencyLevel: 'low' | 'medium' | 'high';
  createdAt: string;
}

// WebSocket 消息类型
export type WSMessageType = 'join' | 'leave' | 'message' | 'typing' | 'system';

export interface WSMessage {
  type: WSMessageType;
  consultationId?: string;
  data?: {
    content?: string;
    senderId?: string;
    text?: string;
    isTyping?: boolean;
  };
  message?: any; // 使用 any 避免循环引用
}

// API 响应类型
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
