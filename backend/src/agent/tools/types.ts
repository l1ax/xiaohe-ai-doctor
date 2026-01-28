import type { AgentEventEmitter } from '../events/AgentEventEmitter';
import type { UserIntent } from '../types';

/**
 * 工具执行上下文
 */
export interface ToolContext {
  conversationId: string;
  messageId: string;
  userId: string;
  userIntent: UserIntent[];
  eventEmitter: AgentEventEmitter;
  iteration?: number;
}

/**
 * 工具执行结果
 */
export interface ToolResult<T = any> {
  success: boolean;
  result?: T;
  error?: string;
  errorType?: string;
}

/**
 * 工具参数 JSON Schema
 */
export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * 工具定义
 */
export interface Tool {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  execute: (params: any, context: ToolContext) => Promise<ToolResult>;
}

/**
 * ask_followup_question 工具参数
 */
export interface AskFollowupParams {
  question: string;
  reason: string;
}

/**
 * finish 工具参数
 * 注意：不再接收 finalResponse，而是由工具内部调用 LLM 流式生成
 */
export interface FinishParams {
  summary: string;  // 问诊总结，用于指导 LLM 生成最终响应
  keyFindings: string[];  // 关键发现列表
  actions?: Array<{
    type: 'transfer_to_doctor' | 'view_more' | 'book_appointment' | 'retry' | 'cancel' | 'recommend_doctor';
    label: string;
    data?: Record<string, any>;
  }>;
  informationSources?: Array<'knowledge_base' | 'web_search' | 'model_knowledge' | 'user_provided'>;
  reliabilityNote?: string;
}

/**
 * assess_risk 工具结果
 */
export interface AssessRiskResult {
  level: 'low' | 'medium' | 'high' | 'emergency';
  reason: string;
  shouldSeeDoctor: boolean;
}

/**
 * check_emergency 工具结果
 */
export interface CheckEmergencyResult {
  isEmergency: boolean;
  emergencyType?: string;
  action: string;
}
