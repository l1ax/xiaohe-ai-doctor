/**
 * Supabase Database Client
 *
 * 提供 Supabase 数据库客户端单例
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

/**
 * 获取 Supabase 客户端单例
 * @throws 如果环境变量未配置
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!url || !serviceKey) {
      throw new Error(
        'Supabase credentials not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
      );
    }

    supabaseClient = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseClient;
}

/**
 * 检查 Supabase 是否已配置
 * 如果设置了 USE_MEMORY_STORAGE=true，强制使用内存模式
 */
export function isSupabaseConfigured(): boolean {
  // 强制内存模式
  if (process.env.USE_MEMORY_STORAGE === 'true') {
    return false;
  }
  return !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY));
}

/**
 * 重置客户端（用于测试）
 */
export function resetSupabaseClient(): void {
  supabaseClient = null;
}
