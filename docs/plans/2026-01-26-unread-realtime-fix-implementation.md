# 专家问诊未读功能和实时更新修复 - 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复专家问诊模块的未读消息显示和医生工作台实时更新功能

**Architecture:** 
- 后端：扩展 Message 模型添加 isRead 字段，WebSocketManager 维护在线医生列表并广播新问诊
- 前端：DoctorConsole 建立 WebSocket 连接实时接收更新，DoctorChat 自动标记消息为已读

**Tech Stack:** Node.js, TypeScript, WebSocket, MobX, React

---

## 阶段 1：后端基础设施

### Task 1: messageStore 添加 isRead 字段

**Files:**
- Modify: `backend/src/services/storage/messageStore.ts`

**实施步骤：**

**Step 1: 扩展 Message 接口**

在 `backend/src/services/storage/messageStore.ts` 中修改：

```typescript
export interface Message {
  id: string;
  consultationId: string;
  senderId: string;
  senderType: 'patient' | 'doctor';
  content: string;
  contentType?: 'text' | 'image' | 'audio';
  imageUrl?: string;
  createdAt: string;
  isRead?: boolean;       // 新增：是否已读（可选，默认 false）
  readAt?: string;        // 新增：已读时间
}
```

**Step 2: 添加标记已读方法**

在 `MessageStore` 类中添加方法：

```typescript
class MessageStore {
  // ... 现有代码

  // 标记消息为已读
  markAsRead(messageId: string): Message | undefined {
    const message = this.messages.get(messageId);
    if (message && !message.isRead) {
      message.isRead = true;
      message.readAt = new Date().toISOString();
    }
    return message;
  }

  // 批量标记已读
  markMultipleAsRead(messageIds: string[]): void {
    const now = new Date().toISOString();
    for (const messageId of messageIds) {
      const message = this.messages.get(messageId);
      if (message && !message.isRead) {
        message.isRead = true;
        message.readAt = now;
      }
    }
  }
}
```

**Step 3: 修改 addMessage 方法**

确保新消息默认 isRead 为 false：

```typescript
addMessage(message: Message): Message {
  // 确保 isRead 有默认值
  const messageWithDefaults = {
    ...message,
    isRead: message.isRead ?? false,
  };
  this.messages.set(messageWithDefaults.id, messageWithDefaults);
  return messageWithDefaults;
}
```

---

### Task 2: WebSocket types 扩展

**Files:**
- Modify: `backend/src/services/websocket/types.ts`

**实施步骤：**

**Step 1: 添加 MARK_READ 消息类型**

在 `WSMessageType` 枚举中添加：

```typescript
export enum WSMessageType {
  MESSAGE = 'message',
  TYPING = 'typing',
  READ = 'read',
  HEARTBEAT = 'heartbeat',
  SYSTEM = 'system',
  JOIN = 'join',
  LEAVE = 'leave',
  CONSULTATION_UPDATE = 'consultation_update',
  NEW_CONSULTATION = 'new_consultation',
  MARK_READ = 'mark_read',  // 新增
}
```

**Step 2: 扩展 ServerMessageData**

添加 isRead 字段：

```typescript
export interface ServerMessageData {
  id: string;
  senderId: string;
  senderType: SenderType;
  contentType: ContentType;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  isRead?: boolean;  // 新增
}
```

**Step 3: 添加 ClientMessage 的 mark_read 数据格式**

在文件末尾添加类型说明注释：

```typescript
/**
 * mark_read 消息格式:
 * {
 *   type: 'mark_read',
 *   conversationId: string,
 *   data: {
 *     messageIds: string[]
 *   }
 * }
 */
```

---

### Task 3: WebSocketManager 核心功能扩展

**Files:**
- Modify: `backend/src/services/websocket/WebSocketManager.ts`

**实施步骤：**

**Step 1: 添加在线医生列表**

在 `WebSocketManager` 类的属性声明部分添加：

```typescript
export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, WSConnection> = new Map();
  private activeConnectionIds: Map<string, string> = new Map();
  private conversations: Map<string, Set<string>> = new Map();
  private onlineDoctors: Set<string> = new Set();  // 新增：在线医生列表
  // ... 其他属性
```

**Step 2: 在 handleConnection 中注册医生**

在 `handleConnection` 方法中，创建连接后添加：

```typescript
this.connections.set(payload.userId, connection);
this.activeConnectionIds.set(payload.userId, connectionId);

// 新增：如果是医生，加入在线医生列表
if (payload.role === 'doctor') {
  this.onlineDoctors.add(payload.userId);
  logger.info('Doctor came online', { doctorId: payload.userId });
}

logger.info('WebSocket connection established', {
  userId: payload.userId,
  role: payload.role,
});
```

**Step 3: 在 handleDisconnection 中移除医生**

在 `handleDisconnection` 方法中，删除连接后添加：

```typescript
this.connections.delete(userId);
this.activeConnectionIds.delete(userId);
this.rateLimitMap.delete(userId);

// 新增：从在线医生列表中移除
this.onlineDoctors.delete(userId);

// 从所有会话中移除用户
for (const [conversationId, userIds] of this.conversations.entries()) {
  // ... 现有代码
}
```

**Step 4: 添加 broadcastToOnlineDoctors 方法**

在类的方法部分添加（建议放在 broadcastToConversation 方法之后）：

```typescript
/**
 * 广播消息给所有在线医生
 */
broadcastToOnlineDoctors(message: ServerMessage): void {
  const doctorCount = this.onlineDoctors.size;
  logger.info('[📡 BROADCAST] 广播给所有在线医生', {
    doctorCount,
    messageType: message.type,
  });

  let successCount = 0;
  for (const doctorId of this.onlineDoctors) {
    const sent = this.sendToUser(doctorId, message);
    if (sent) {
      successCount++;
    }
  }

  logger.info('[✅ BROADCAST] 广播完成', {
    total: doctorCount,
    success: successCount,
  });
}
```

**Step 5: 在 handleMessage 中添加 MARK_READ 处理**

在 `handleMessage` 方法的 switch 语句中添加：

```typescript
switch (message.type) {
  case WSMessageType.JOIN:
    this.handleJoin(userId, message);
    break;

  case WSMessageType.LEAVE:
    this.handleLeave(userId, message);
    break;

  case WSMessageType.MESSAGE:
    this.handleChatMessage(userId, message);
    break;

  case WSMessageType.TYPING:
    this.handleTyping(userId, message);
    break;

  case WSMessageType.MARK_READ:  // 新增
    this.handleMarkRead(userId, message);
    break;

  case WSMessageType.HEARTBEAT:
    break;

  default:
    logger.warn('Unknown message type', { type: message.type });
}
```

**Step 6: 实现 handleMarkRead 方法**

在类的方法部分添加（建议放在 handleTyping 方法之后）：

```typescript
/**
 * 处理标记已读
 */
private handleMarkRead(userId: string, clientMessage: ClientMessage): void {
  const connection = this.connections.get(userId);
  if (!connection) {
    logger.warn('[❌ MARK_READ] 连接不存在', { userId });
    return;
  }

  const messageIds = (clientMessage.data as any)?.messageIds as string[] | undefined;
  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
    logger.warn('[❌ MARK_READ] 消息ID列表无效', { userId, messageIds });
    return;
  }

  logger.info('[📥 MARK_READ] 收到标记已读请求', {
    userId,
    conversationId: clientMessage.conversationId,
    messageCount: messageIds.length,
  });

  // 验证用户是否在会话中
  const conversationUsers = this.conversations.get(clientMessage.conversationId);
  if (!conversationUsers || !conversationUsers.has(userId)) {
    logger.warn('[❌ MARK_READ] 用户不在会话中', {
      userId,
      conversationId: clientMessage.conversationId,
    });
    return;
  }

  // 标记消息为已读
  messageStore.markMultipleAsRead(messageIds);

  logger.info('[✅ MARK_READ] 消息已标记为已读', {
    userId,
    messageCount: messageIds.length,
  });

  // 可选：向发送者推送已读回执（暂不实现）
}
```

**Step 7: 修改 handleChatMessage 设置 isRead 状态**

在 `handleChatMessage` 方法中，构建 `newMessage` 时添加 `isRead` 字段：

```typescript
// 存储消息到 messageStore
const newMessage: Message = {
  id: messageId,
  consultationId: clientMessage.conversationId,
  senderId: userId,
  senderType: connection.userRole === 'doctor' ? 'doctor' : 'patient',
  content,
  createdAt,
  isRead: false,  // 新增：默认未读
};
messageStore.addMessage(newMessage);
```

然后在构建 `serverMessage` 时，广播给接收者时设置 isRead：

```typescript
// 构建服务端消息
const serverMessage: ServerMessage = {
  type: WSMessageType.MESSAGE,
  conversationId: clientMessage.conversationId,
  message: {
    id: messageId,
    senderId: userId,
    senderType: connection.userRole === 'patient' ? SenderType.PATIENT : SenderType.DOCTOR,
    contentType: clientMessage.data?.contentType || ContentType.TEXT,
    content,
    metadata: clientMessage.data?.imageUrl ? { imageUrl: clientMessage.data.imageUrl } : undefined,
    createdAt,
    isRead: false,  // 新增：接收者收到时为未读
  },
};

// 广播到会话中的所有用户（包括发送者）
this.broadcastToConversation(clientMessage.conversationId, serverMessage);
```

注意：由于广播是给所有人的，我们需要在 `broadcastToConversation` 中区分发送者和接收者。让我们修改广播逻辑：

```typescript
// 构建服务端消息 - 先广播给接收者（isRead: false）
const messageForReceivers: ServerMessage = {
  type: WSMessageType.MESSAGE,
  conversationId: clientMessage.conversationId,
  message: {
    id: messageId,
    senderId: userId,
    senderType: connection.userRole === 'patient' ? SenderType.PATIENT : SenderType.DOCTOR,
    contentType: clientMessage.data?.contentType || ContentType.TEXT,
    content,
    metadata: clientMessage.data?.imageUrl ? { imageUrl: clientMessage.data.imageUrl } : undefined,
    createdAt,
    isRead: false,  // 接收者：未读
  },
};

// 构建发送者消息（isRead: true）
const messageForSender: ServerMessage = {
  ...messageForReceivers,
  message: {
    ...messageForReceivers.message!,
    isRead: true,  // 发送者：已读
  },
};

// 广播给接收者（排除发送者）
this.broadcastToConversation(clientMessage.conversationId, messageForReceivers, userId);

// 发送给发送者（确认消息）
this.sendToUser(userId, messageForSender);
```

**Step 8: 在 shutdown 中清理在线医生列表**

在 `shutdown` 方法中添加：

```typescript
shutdown(): void {
  if (this.heartbeatInterval) {
    clearInterval(this.heartbeatInterval);
  }

  for (const [userId, connection] of this.connections.entries()) {
    connection.ws.close();
  }

  this.connections.clear();
  this.activeConnectionIds.clear();
  this.conversations.clear();
  this.rateLimitMap.clear();
  this.onlineDoctors.clear();  // 新增

  if (this.wss) {
    this.wss.close();
  }

  logger.info('WebSocket server shut down');
}
```

---

## 阶段 2：后端业务逻辑

### Task 4: consultationController 广播新问诊

**Files:**
- Modify: `backend/src/controllers/consultationController.ts`

**实施步骤：**

**Step 1: 在 createConsultation 中广播给所有在线医生**

在 `createConsultation` 函数中，找到这段代码：

```typescript
consultationStore.createConsultation(consultation);

// 通知医生有新问诊
wsManager.broadcastConsultationUpdate(consultationId);
```

修改为：

```typescript
consultationStore.createConsultation(consultation);

// 通知该问诊的医生和患者
wsManager.broadcastConsultationUpdate(consultationId);

// 新增：广播给所有在线医生
wsManager.broadcastToOnlineDoctors({
  type: 'consultation_update' as any,
  conversationId: consultationId,
  consultation: {
    id: consultation.id,
    status: consultation.status,
    lastMessage: consultation.lastMessage || '',
    lastMessageTime: consultation.lastMessageTime || consultation.createdAt,
    updatedAt: consultation.updatedAt,
  },
});
```

**Step 2: 验证导入**

确保文件顶部已导入 wsManager：

```typescript
import { wsManager } from '../services/websocket/WebSocketManager';
```

---

## 阶段 3：前端基础服务

### Task 5: websocket.ts 添加标记已读方法

**Files:**
- Modify: `frontend/src/services/websocket.ts`

**实施步骤：**

**Step 1: 添加 markAsRead 方法**

在 `WebSocketService` 类中添加方法（建议放在 sendTyping 方法之后）：

```typescript
markAsRead(conversationId: string, messageIds: string[]): void {
  const payload = {
    type: 'mark_read',
    conversationId,
    data: { messageIds },
  };
  console.log('[WebSocketService] 📤 标记已读', payload);
  this.send(payload);
}
```

**Step 2: 更新 ChatMessage 接口的 isRead 字段**

确保 `ChatMessage` 接口已有 `isRead` 字段：

```typescript
export interface ChatMessage {
  id: string;
  consultationId?: string;
  senderId: string;
  senderType: 'patient' | 'doctor';
  content: string;
  contentType?: 'text' | 'image' | 'audio';
  imageUrl?: string;
  createdAt: string;
  isRead?: boolean;  // 确保存在
}
```

---

## 阶段 4：前端医生聊天页面

### Task 6: DoctorChat 自动标记已读

**Files:**
- Modify: `frontend/src/pages/doctor/Chat/index.tsx`

**实施步骤：**

**Step 1: 添加自动标记已读的 effect**

在 `DoctorChatPage` 组件中，找到 WebSocket 初始化的 useEffect，在监听消息的部分修改：

```typescript
// 监听消息
ws.onMessage((message: WSChatMessage) => {
  console.log('收到新消息:', message);
  setMessages((prev) => {
    // 检查是否已存在该消息
    const exists = prev.some((m) => m.id === message.id);
    if (exists) return prev;

    // 转换消息格式：处理 metadata.imageUrl 和 contentType 默认值
    const chatMessage: ChatMessage = {
      ...message,
      contentType: message.contentType || 'text',
      imageUrl: message.imageUrl || (message as any).metadata?.imageUrl,
    };

    // 新增：如果是对方发送的消息且页面可见，自动标记为已读
    if (message.senderId !== userStore.user?.id && document.visibilityState === 'visible') {
      // 延迟标记已读，避免过于频繁
      setTimeout(() => {
        if (wsRef.current && consultationId) {
          wsRef.current.markAsRead(consultationId, [message.id]);
        }
      }, 1000);
    }

    return [...prev, chatMessage];
  });
});
```

**Step 2: 添加页面可见性监听**

在组件中添加一个新的 useEffect 来处理页面可见性变化：

```typescript
// 页面可见性变化时，标记未读消息为已读
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && consultationId && wsRef.current) {
      // 找出所有未读的对方消息
      const unreadMessages = messages.filter(
        (msg) => !msg.isRead && msg.senderId !== userStore.user?.id
      );
      
      if (unreadMessages.length > 0) {
        const messageIds = unreadMessages.map((msg) => msg.id);
        wsRef.current.markAsRead(consultationId, messageIds);
        
        // 更新本地状态
        setMessages((prev) =>
          prev.map((msg) =>
            messageIds.includes(msg.id) ? { ...msg, isRead: true } : msg
          )
        );
      }
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [consultationId, messages]);
```

---

## 阶段 5：前端医生工作台

### Task 7: DoctorConsole WebSocket 连接

**Files:**
- Modify: `frontend/src/pages/doctor/Console/index.tsx`

**实施步骤：**

**Step 1: 添加必要的导入**

在文件顶部添加导入：

```typescript
import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { doctorStore } from '../../../store/doctorStore';
import { WebSocketService } from '../../../services/websocket';
import { userStore } from '../../../store';
import { DoctorHeader } from './DoctorHeader';
import { StatsCards } from './StatsCards';
import { ConsultationList } from './ConsultationList';

const WS_URL = (import.meta.env as { VITE_API_BASE_URL: string; VITE_WS_URL?: string }).VITE_WS_URL || 'ws://localhost:3000';
```

**Step 2: 添加 WebSocket 引用**

在组件中添加 ref：

```typescript
const DoctorConsole = observer(() => {
  const wsRef = useRef<WebSocketService | null>(null);

  useEffect(() => {
    // 初始化加载数据
    doctorStore.fetchStats();

    // 新增：建立 WebSocket 连接
    if (!wsRef.current && userStore.accessToken) {
      const ws = new WebSocketService(
        `${WS_URL}/ws`,
        userStore.accessToken
      );
      wsRef.current = ws;

      ws.connect()
        .then(() => {
          console.log('[DoctorConsole] WebSocket 连接成功');
          
          // 监听问诊更新
          ws.onConsultationUpdate((consultation) => {
            console.log('[DoctorConsole] 收到问诊更新:', consultation);
            
            // 转换 status 字段
            const statusMap: Record<string, 'pending' | 'ongoing' | 'completed'> = {
              pending: 'pending',
              active: 'ongoing',
              in_progress: 'ongoing',
              closed: 'completed',
              completed: 'completed',
            };
            
            doctorStore.addOrUpdateConsultation({
              id: consultation.id,
              patientId: consultation.userId || '',
              patientName: `患者`,
              symptoms: consultation.chiefComplaint || '咨询健康问题',
              status: statusMap[consultation.status] || 'pending',
              urgency: 'medium' as const,
              createdAt: consultation.createdAt,
            });
          });
        })
        .catch((error) => {
          console.error('[DoctorConsole] WebSocket 连接失败:', error);
        });
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    };
  }, []);

  return (
    // ... 现有 JSX
  );
});
```

---

### Task 8: doctorStore 状态管理

**Files:**
- Modify: `frontend/src/store/doctorStore.ts`

**实施步骤：**

**Step 1: 添加 addOrUpdateConsultation 方法**

在 `DoctorStore` 类中添加方法（建议放在 acceptConsultation 方法之后）：

```typescript
// 添加或更新问诊（WebSocket 实时更新）
addOrUpdateConsultation(consultation: Consultation) {
  const index = this.pendingConsultations.findIndex(c => c.id === consultation.id);
  
  if (index !== -1) {
    // 更新现有问诊
    this.pendingConsultations[index] = {
      ...this.pendingConsultations[index],
      ...consultation,
    };
    console.log('[DoctorStore] 更新问诊:', consultation.id);
  } else if (consultation.status === 'pending') {
    // 添加新问诊到列表开头
    this.pendingConsultations.unshift(consultation);
    this.stats.pending = this.pendingConsultations.length;
    console.log('[DoctorStore] 添加新问诊:', consultation.id);
  }
}
```

---

## 提交和验证

### Task 9: 提交所有更改

**Files:**
- All modified files

**实施步骤：**

**Step 1: 查看所有修改**

```bash
git status
git diff
```

**Step 2: 提交后端更改**

```bash
git add backend/src/services/storage/messageStore.ts
git add backend/src/services/websocket/types.ts
git add backend/src/services/websocket/WebSocketManager.ts
git add backend/src/controllers/consultationController.ts
git commit -m "feat(backend): 添加消息已读功能和在线医生广播机制

- messageStore 添加 isRead 和 readAt 字段
- WebSocketManager 维护在线医生列表
- 处理 mark_read 消息类型
- 发送消息时区分发送者和接收者的 isRead 状态
- 创建问诊时广播给所有在线医生"
```

**Step 3: 提交前端更改**

```bash
git add frontend/src/services/websocket.ts
git add frontend/src/pages/doctor/Chat/index.tsx
git add frontend/src/pages/doctor/Console/index.tsx
git add frontend/src/store/doctorStore.ts
git commit -m "feat(frontend): 实现消息自动标记已读和工作台实时更新

- websocket.ts 添加 markAsRead 方法
- DoctorChat 页面自动标记已读消息
- DoctorConsole 建立 WebSocket 连接监听新问诊
- doctorStore 添加 addOrUpdateConsultation 方法"
```

---

## 验证清单

完成后验证以下功能：

1. **消息已读状态**
   - [ ] 发送消息时，发送者看到消息为"已读"
   - [ ] 接收者收到消息时显示"未读"
   - [ ] 接收者查看消息后自动标记为"已读"
   - [ ] 页面切换回来时批量标记未读消息

2. **医生工作台实时更新**
   - [ ] 患者创建新问诊时，医生工作台立即显示
   - [ ] 医生接诊后，问诊从待处理列表移除
   - [ ] WebSocket 断线重连后数据正确同步

3. **降级和容错**
   - [ ] WebSocket 连接失败时，轮询仍然工作
   - [ ] 标记已读失败不影响消息显示
   - [ ] 并发接诊时正确处理冲突

4. **性能**
   - [ ] 批量标记已读，避免频繁请求
   - [ ] 在线医生列表使用 Set，性能良好
   - [ ] 无内存泄漏

---

## 注意事项

1. **用户要求不执行单元测试**：按照用户要求，只需要实现功能逻辑，不执行测试验证
2. **保持现有测试通过**：虽然不执行新测试，但确保修改不破坏现有功能
3. **WebSocket 稳定性**：保留现有的轮询机制作为降级方案
4. **类型安全**：确保 TypeScript 类型定义正确
5. **日志记录**：添加充分的日志便于调试

## 后续优化（可选）

- 已读回执推送给发送者
- 问诊列表显示未读消息数量
- 浏览器通知（Notification API）
- 消息到达音效
