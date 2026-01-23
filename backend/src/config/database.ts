// backend/src/config/database.ts

import { WriterConfig } from '../services/database/types';

/**
 * 数据库配置
 */
export interface DatabaseConfig {
  writer: WriterConfig;
  supabase?: {
    url: string;
    anonKey: string;
    serviceKey: string;
  };
}

/**
 * 加载数据库配置
 */
export function loadDatabaseConfig(): DatabaseConfig {
  return {
    writer: {
      enabled: process.env.DB_WRITE_ENABLED !== 'false',
      batch: {
        maxSize: parseInt(process.env.DB_BATCH_SIZE || '10'),
        flushInterval: parseInt(process.env.DB_FLUSH_INTERVAL || '5000'),
      },
    },
    supabase: process.env.SUPABASE_URL
      ? {
          url: process.env.SUPABASE_URL,
          anonKey: process.env.SUPABASE_ANON_KEY || '',
          serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
        }
      : undefined,
  };
}

/**
 * 验证数据库配置
 */
export function validateDatabaseConfig(config: DatabaseConfig): void {
  if (config.writer.enabled && !config.supabase) {
    console.warn('⚠️  Database write enabled but Supabase config missing. Writes will be logged only.');
  }
}
