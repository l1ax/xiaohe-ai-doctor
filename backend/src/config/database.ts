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
 * 解析并验证正整数环境变量
 * @param value 环境变量值
 * @param defaultValue 默认值
 * @returns 解析后的正整数
 * @throws 如果值为 NaN 或不是正整数
 */
function parsePositiveInt(value: string | undefined, defaultValue: string): number {
  const inputValue = value || defaultValue;
  const parsed = parseInt(inputValue, 10);

  if (isNaN(parsed)) {
    throw new Error(`Invalid configuration: expected a positive integer, got "${inputValue}"`);
  }

  if (parsed <= 0) {
    throw new Error(`Invalid configuration: expected a positive integer > 0, got ${parsed}`);
  }

  return parsed;
}

/**
 * 加载数据库配置
 */
export function loadDatabaseConfig(): DatabaseConfig {
  return {
    writer: {
      enabled: process.env.DB_WRITE_ENABLED === 'true',
      batch: {
        maxSize: parsePositiveInt(process.env.DB_BATCH_SIZE, '10'),
        flushInterval: parsePositiveInt(process.env.DB_FLUSH_INTERVAL, '5000'),
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
