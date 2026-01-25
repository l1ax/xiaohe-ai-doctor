# 前后端消息协议验证方案

> **日期**: 2026-01-25
> **目标**: 验证后端能否正确产出消息，以及前端能否正确验证

---

## 1. 协议概述

### 1.1 事件类型定义

后端定义在 `backend/src/agent/events/chat-event-types.ts`：

| 事件类型 | 用途 | 关键字段 |
|---------|------|---------|
| `conversation:status` | 对话状态变更 | status, previousStatus, message |
| `message:status` | 消息状态变更 | messageId, status, role |
| `message:content` | 流式内容输出 | messageId, delta, index, isFirst, isLast |
| `message:metadata` | 消息元数据 | messageId, sources, actions, medicalAdvice |
| `tool:call` | 工具调用 | toolId, toolName, status, input, output, duration |
| `conversation:end` | 对话结束 | messageId, duration, messageCount |
| `error` | 错误事件 | code, message, recoverable, suggestion |

### 1.2 事件数据格式示例

```typescript
// conversation:status
{
  type: 'conversation:status',
  data: {
    conversationId: 'conv_123',
    status: 'processing',
    previousStatus: 'sending',
    message: '正在分析您的问题...',
    timestamp: '2026-01-25T10:00:00.000Z'
  }
}

// message:content
{
  type: 'message:content',
  data: {
    conversationId: 'conv_123',
    messageId: 'msg_456',
    delta: '您',
    index: 0,
    isFirst: true,
    isLast: false,
    timestamp: '2026-01-25T10:00:01.000Z'
  }
}
```

---

## 2. 后端验证

### 2.1 已验证的节点事件发送

| 节点 | 发送的事件类型 | 验证结果 |
|------|--------------|---------|
| `classifyIntent.ts:43-55` | `conversation:status`, `message:status` | ✅ |
| `symptomAnalysis.ts:36-92` | `tool:call`, `message:content`, `message:metadata` | ✅ |
| `consultation.ts:31-70` | `tool:call`, `message:content` | ✅ |
| `hospitalRecommend.ts:36-86` | `tool:call`, `message:content`, `message:metadata` | ✅ |
| `medicineInfo.ts:37-76` | `tool:call`, `message:content` | ✅ |
| `synthesizeResponse.ts:23-28` | `conversation:end` | ✅ |

### 2.2 问题清单

| 问题 | 严重程度 | 状态 |
|------|---------|------|
| `classifyIntent.ts` 发送 `agent:intent`，但前端不处理 | 低 | 待修复 |

---

## 3. 前端验证

### 3.1 事件解析器

文件: `frontend/src/machines/chatMachine.ts`

`parseServerEvent` 函数负责将后端事件转换为前端状态机事件：

```typescript
export function parseServerEvent(event: ChatEvent): ChatEventType | null {
  switch (event.type) {
    case 'conversation:status':
      return { type: 'CONVERSATION_STATUS', ... };
    case 'message:status':
      return { type: 'MESSAGE_STATUS', ... };
    case 'message:content':
      return { type: 'MESSAGE_CONTENT', ... };
    case 'message:metadata':
      return { type: 'MESSAGE_METADATA', ... };
    case 'tool:call':
      return { type: 'TOOL_CALL', ... };
    case 'conversation:end':
      return { type: 'DONE' };
    case 'error':
      return { type: 'ERROR', ... };
    case 'agent:intent':
      return null; // 前端不需要显示意图
    // ... 旧事件兼容
    default:
      return null;
  }
}
```

### 3.2 SSE 客户端事件监听

文件: `frontend/src/services/sseClient.ts`

监听的事件类型映射：

| 后端发送 | 前端监听 | 验证 |
|---------|---------|------|
| `conversation:status` | `conversation_status` | ✅ |
| `message:status` | `message_status` | ✅ |
| `message:content` | `message_content` | ✅ |
| `message:metadata` | `message_metadata` | ✅ |
| `tool:call` | `tool_call` | ✅ |
| `conversation:end` | `conversation_end` | ✅ |

---

## 4. 修复计划

### Task: 添加 `agent:intent` 事件处理

**文件**: `frontend/src/machines/chatMachine.ts`

**修改位置**: `parseServerEvent` 函数中

**修改内容**:
```typescript
// 在 switch 语句的 default 之前添加
case 'agent:intent':
  return null;
```

---

## 5. 测试验证

### 5.1 运行现有测试

```bash
# 后端测试
cd backend && pnpm test:run

# 前端测试（如果有）
cd frontend && pnpm test:run
```

### 5.2 验证事件流

1. 发送消息 "我头疼"
2. 验证收到的事件序列：
   - `conversation:status` (processing)
   - `message:status` (sending)
   - `tool:call` (running -> completed)
   - `message:content` (流式输出)
   - `message:metadata` (医疗建议)
   - `conversation:end`

---

## 6. 总结

| 检查项 | 状态 |
|-------|------|
| 后端事件格式正确 | ✅ |
| 前端解析器覆盖所有事件 | ✅ |
| SSE 事件类型匹配 | ✅ |
| agent:intent 处理 | 待修复 |
