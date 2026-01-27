export type UserIntent =
  | 'symptom_consult'      // 症状咨询 → 患处分析分支
  | 'general_qa'           // 通用问答 → 问诊分支
  | 'hospital_recommend'   // 医院推荐 → 医生推荐分支
  | 'medicine_info';       // 药品咨询 → 药品识别分支

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  imageUrls?: string[];  // 新增：支持多张图片
}

// Export event types
export type { AgentEventEmitter } from './events/AgentEventEmitter';
export type { AgentEvent, AgentEventType } from './events/types';
