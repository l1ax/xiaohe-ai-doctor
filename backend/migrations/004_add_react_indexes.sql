-- messages 表索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_role
  ON messages(role);

-- tool_calls 表索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tool_calls_conversation_created
  ON tool_calls(conversation_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tool_calls_status
  ON tool_calls(status);

-- agent_iterations 表索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_iterations_conversation
  ON agent_iterations(conversation_id, iteration_number);

-- conversations 表索引
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_user_status
  ON conversations(user_id, status, updated_at DESC);
