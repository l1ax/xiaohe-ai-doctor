-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- tool_calls 表（工具调用记录）
CREATE TABLE IF NOT EXISTS tool_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  input JSONB,
  output JSONB,
  error TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- agent_iterations 表（Agent 思考记录，可选）
CREATE TABLE IF NOT EXISTS agent_iterations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  iteration_number INTEGER NOT NULL,
  thought TEXT,
  action TEXT,
  action_input JSONB,
  observation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 添加注释
COMMENT ON TABLE tool_calls IS 'ReAct Agent 工具调用记录';
COMMENT ON TABLE agent_iterations IS 'ReAct Agent 思考过程记录';
