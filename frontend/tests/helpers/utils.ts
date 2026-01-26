/**
 * 通用工具函数
 */

/**
 * 获取明天的日期字符串（格式：YYYY-MM-DD）
 * @returns 明天的日期
 */
export function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

/**
 * 从 URL 中提取问诊 ID
 * @param url 问诊页面 URL
 * @returns 问诊 ID
 * @throws 如果 URL 格式无效或无法提取 ID
 */
export function extractConsultationId(url: string): string {
  const match = url.match(/\/doctor-chat\/([a-zA-Z0-9-]+)$/);
  if (!match) {
    throw new Error(`无法从 URL 中提取问诊 ID: ${url}`);
  }
  return match[1];
}
