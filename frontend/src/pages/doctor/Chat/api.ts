/**
 * 医生端问诊聊天 API 服务
 */

import {
  ConsultationDetail,
  ChatMessage,
  APIResponse,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

/**
 * 获取认证头
 */
const getAuthHeaders = () => {
  const token = localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

/**
 * 获取问诊详情
 */
export async function getConsultationDetail(
  consultationId: string
): Promise<ConsultationDetail> {
  const response = await fetch(
    `${API_BASE_URL}/api/consultations/${consultationId}`,
    {
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch consultation: ${response.statusText}`);
  }

  const result: APIResponse<ConsultationDetail> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || '获取问诊详情失败');
  }

  return result.data;
}

/**
 * 获取问诊消息列表
 */
export async function getConsultationMessages(
  consultationId: string
): Promise<ChatMessage[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/consultations/${consultationId}/messages`,
    {
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch messages: ${response.statusText}`);
  }

  const result: APIResponse<ChatMessage[]> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || '获取消息列表失败');
  }

  return result.data;
}

/**
 * 发送消息
 */
export async function sendMessage(
  consultationId: string,
  content: string,
  contentType: 'text' | 'image' = 'text'
): Promise<ChatMessage> {
  const response = await fetch(
    `${API_BASE_URL}/api/consultations/${consultationId}/messages`,
    {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        content,
        contentType,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to send message: ${response.statusText}`);
  }

  const result: APIResponse<ChatMessage> = await response.json();

  if (!result.success || !result.data) {
    throw new Error(result.error?.message || '发送消息失败');
  }

  return result.data;
}

/**
 * 结束问诊
 */
export async function closeConsultation(
  consultationId: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/consultations/${consultationId}/close`,
    {
      method: 'PUT',
      headers: getAuthHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to close consultation: ${response.statusText}`);
  }

  const result: APIResponse<void> = await response.json();

  if (!result.success) {
    throw new Error(result.error?.message || '结束问诊失败');
  }
}
