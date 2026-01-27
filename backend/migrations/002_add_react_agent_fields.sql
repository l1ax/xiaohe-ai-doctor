-- 为 conversations 表添加 ReAct Agent 字段
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- 将 patient_id 的值复制到 user_id（数据迁移）
UPDATE conversations SET user_id = patient_id WHERE user_id IS NULL;

-- 修正 status 约束（允许旧值和新值共存）
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_status_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_status_check
  CHECK (status IN ('active', 'archived', 'deleted', 'closed'));

-- 为 messages 表添加 ReAct Agent 字段（核心：role 字段）
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

-- 将 content_type 映射到 role（数据迁移）
UPDATE messages
SET role = CASE
  WHEN content_type = 'system' THEN 'system'
  WHEN sender_id IS NOT NULL THEN 'user'
  ELSE 'assistant'
END
WHERE role IS NULL;

-- 为 role 字段添加约束
ALTER TABLE messages
  ALTER COLUMN role SET NOT NULL,
  ADD CONSTRAINT messages_role_check CHECK (role IN ('user', 'assistant', 'system'));
