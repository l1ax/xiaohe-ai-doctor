# 数据库迁移

## 执行顺序
1. 001_initial_schema.sql - 初始表结构（已存在）
2. 002_add_react_agent_fields.sql - 为 ReAct Agent 扩展现有表
3. 003_create_react_agent_tables.sql - 创建 ReAct Agent 专用表
4. 004_add_react_indexes.sql - 添加性能优化索引

## 执行方法
在 Supabase SQL Editor 中按顺序执行这些 SQL 文件。
