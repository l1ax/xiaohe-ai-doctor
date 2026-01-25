/**
 * 医生排班存储服务（MVP 阶段使用内存存储）
 *
 * 当前实现：内存存储 (Map)
 * 迁移目标：PostgreSQL doctor_schedules 表
 *
 * ========================================
 * 数据库迁移方案
 * ========================================
 *
 * 1. 创建数据库迁移文件
 *    backend/src/database/migrations/001_create_doctor_schedules.ts
 *
 * 2. SQL 建表语句
 *    CREATE TABLE doctor_schedules (
 *      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *      doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
 *      date DATE NOT NULL,
 *      time_slot TEXT NOT NULL CHECK (time_slot IN ('morning', 'afternoon', 'evening')),
 *      is_available BOOLEAN DEFAULT true,
 *      max_patients INTEGER DEFAULT 10,
 *      created_at TIMESTAMPTZ DEFAULT NOW(),
 *      updated_at TIMESTAMPTZ DEFAULT NOW(),
 *      UNIQUE(doctor_id, date, time_slot)
 *    );
 *
 * 3. 创建索引
 *    CREATE INDEX idx_schedules_doctor_date ON doctor_schedules(doctor_id, date);
 *    CREATE INDEX idx_schedules_available ON doctor_schedules(is_available) WHERE is_available = true;
 *
 * 4. 迁移步骤
 *    a. 使用 Prisma/Kysely 创建 ORM 模型
 *    b. 实现数据访问层 (DAL)
 *    c. 替换本文件中的内存实现为数据库调用
 *    d. 添加数据迁移脚本导出现有数据
 */

import { v4 as uuidv4 } from 'uuid';

export type TimeSlot = 'morning' | 'afternoon' | 'evening';

export interface DoctorSchedule {
  id: string;
  doctorId: string;
  date: string; // YYYY-MM-DD
  timeSlot: TimeSlot;
  isAvailable: boolean;
  maxPatients: number;
}

class ScheduleStore {
  private schedules: Map<string, DoctorSchedule> = new Map();

  /**
   * 获取医生的所有排班
   *
   * 数据库迁移后替换为：
   * ```sql
   * SELECT * FROM doctor_schedules
   * WHERE doctor_id = $1
   * ORDER BY date ASC
   * ```
   */
  getByDoctorId(doctorId: string): DoctorSchedule[] {
    return Array.from(this.schedules.values())
      .filter(s => s.doctorId === doctorId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 获取医生特定日期的排班
   *
   * 数据库迁移后替换为：
   * ```sql
   * SELECT * FROM doctor_schedules
   * WHERE doctor_id = $1 AND date = $2
   * ORDER BY time_slot ASC
   * ```
   */
  getByDate(doctorId: string, date: string): DoctorSchedule[] {
    return Array.from(this.schedules.values())
      .filter(s => s.doctorId === doctorId && s.date === date)
      .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot));
  }

  /**
   * 设置排班（创建或更新）
   *
   * 数据库迁移后替换为：
   * ```sql
   * INSERT INTO doctor_schedules (doctor_id, date, time_slot, is_available, max_patients)
   * VALUES ($1, $2, $3, $4, $5)
   * ON CONFLICT (doctor_id, date, time_slot)
   * DO UPDATE SET is_available = $4, max_patients = $5, updated_at = NOW()
   * RETURNING *
   * ```
   */
  setSchedule(schedule: Omit<DoctorSchedule, 'id'>): DoctorSchedule {
    // 查找是否已存在相同的排班
    const existing = Array.from(this.schedules.values()).find(s =>
      s.doctorId === schedule.doctorId &&
      s.date === schedule.date &&
      s.timeSlot === schedule.timeSlot
    );

    if (existing) {
      // 更新已有排班
      const updated = { ...existing, ...schedule };
      this.schedules.set(existing.id, updated);
      return updated;
    }

    // 创建新排班
    const newSchedule: DoctorSchedule = {
      id: uuidv4(),
      ...schedule
    };
    this.schedules.set(newSchedule.id, newSchedule);
    return newSchedule;
  }

  /**
   * 删除排班
   *
   * 数据库迁移后替换为：
   * ```sql
   * DELETE FROM doctor_schedules
   * WHERE doctor_id = $1 AND date = $2 AND time_slot = $3
   * RETURNING *
   * ```
   */
  deleteSchedule(doctorId: string, date: string, timeSlot: TimeSlot): boolean {
    const schedule = Array.from(this.schedules.values()).find(s =>
      s.doctorId === doctorId &&
      s.date === date &&
      s.timeSlot === timeSlot
    );
    if (schedule) {
      return this.schedules.delete(schedule.id);
    }
    return false;
  }

  /**
   * 根据 ID 获取排班
   *
   * 数据库迁移后替换为：
   * ```sql
   * SELECT * FROM doctor_schedules WHERE id = $1
   * ```
   */
  getById(id: string): DoctorSchedule | undefined {
    return this.schedules.get(id);
  }

  /**
   * 清空所有排班（主要用于测试）
   */
  clear(): void {
    this.schedules.clear();
  }

  /**
   * 数据迁移辅助方法
   * 导出所有排班数据用于数据库迁移
   */
  exportForMigration(): DoctorSchedule[] {
    return Array.from(this.schedules.values());
  }
}

export const scheduleStore = new ScheduleStore();
