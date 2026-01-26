# 专家问诊未读功能和实时更新修复设计

**日期**: 2026-01-26  
**作者**: AI Assistant  
**状态**: 设计完成

## 问题描述

### 问题 1：未读功能不生效
- 前端 ChatArea 组件显示 `isRead` 状态，但后端没有提供该字段
- Message 模型缺少 `isRead` 字段
- 没有标记消息为已读的机制

### 问题 2：医生工作台不能实时看到新问诊
- 创建新问诊时，医生需要刷新页面才能看到
- `broadcastConsultationUpdate` 只发送给已加入会话的用户
- DoctorConsole 页面没有建立 WebSocket 连接
- 只依赖 30 秒轮询，实时性差

## 解决方案

### 方案 1：未读消息功能

**核心思路：基于接收者的未读标记**

#### 数据模型变更

在 `backend/src/services/storage/messageStore.ts` 中：
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
  isRead: boolean;          // 新增：是否已读
  readAt?: string;          // 新增：已读时间
}
```

#### WebSocket 消息类型扩展

在 `backend/src/services/websocket/types.ts` 中：
```typescript
export enum WSMessageType {
  // ... 现有类型
  MARK_READ = 'mark_read',  // 新增：标记已读
}

export interface ServerMessageData {
  id: string;
  senderId: string;
  senderType: SenderType;
  contentType: ContentType;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  isRead?: boolean;         // 新增：已读状态
}
```

#### 发送消息时的已读状态

在 `WebSocketManager.ts` 的 `handleChatMessage` 方法中：
1. 创建消息时，设置 `isRead: false`（默认未读）
2. 存储到 messageStore
3. 广播消息时：
   - 对发送者：设置 `isRead: true`
   - 对接收者：设置 `isRead: false`

#### 标记已读机制

新增 WebSocket 消息处理：
```typescript
// 客户端发送
{
  type: 'mark_read',
  conversationId: 'xxx',
  messageIds: ['msg1', 'msg2']
}

// 服务端处理
handleMarkRead(userId, clientMessage) {
  // 1. 验证用户权限
  // 2. 更新消息的 isRead 和 readAt
  // 3. 可选：向发送者推送已读回执
}
```

#### 前端自动标记已读

在 `frontend/src/pages/doctor/Chat/index.tsx` 中：
1. 收到新消息时，检查页面是否可见（Visibility API）
2. 如果可见，批量标记为已读（延迟 1-2 秒）
3. 如果不可见，等到页面重新可见时标记

### 方案 2：医生工作台实时更新

**核心思路：维护在线医生列表，广播新问诊**

#### WebSocket 架构调整

在 `WebSocketManager.ts` 中：
```typescript
class WebSocketManager {
  // 新增：在线医生列表
  private onlineDoctors: Set<string> = new Set();
  
  // 医生连接时加入列表
  private handleConnection(ws, req) {
    // ... 现有逻辑
    if (connection.userRole === 'doctor') {
      this.onlineDoctors.add(payload.userId);
    }
  }
  
  // 医生断开时移除
  private handleDisconnection(userId, connectionId) {
    // ... 现有逻辑
    this.onlineDoctors.delete(userId);
  }
  
  // 新增：广播给所有在线医生
  broadcastToOnlineDoctors(message: ServerMessage) {
    for (const doctorId of this.onlineDoctors) {
      this.sendToUser(doctorId, message);
    }
  }
}
```

#### 创建问诊时广播

在 `consultationController.ts` 的 `createConsultation` 中：
```typescript
// 原有代码
wsManager.broadcastConsultationUpdate(consultationId);

// 新增：广播给所有在线医生
wsManager.broadcastToOnlineDoctors({
  type: WSMessageType.CONSULTATION_UPDATE,
  conversationId: consultationId,
  consultation: {
    id: consultation.id,
    status: consultation.status,
    patientPhone: consultation.patientPhone,
    createdAt: consultation.createdAt,
    // ... 其他字段
  },
});
```

#### DoctorConsole WebSocket 连接

在 `frontend/src/pages/doctor/Console/index.tsx` 中：
```typescript
useEffect(() => {
  // 初始化加载数据
  doctorStore.fetchStats();
  
  // 建立 WebSocket 连接
  if (!wsRef.current && userStore.accessToken) {
    const ws = new WebSocketService(
      `${WS_URL}/ws`,
      userStore.accessToken
    );
    wsRef.current = ws;
    
    ws.connect().then(() => {
      // 监听问诊更新
      ws.onConsultationUpdate((consultation) => {
        doctorStore.addOrUpdateConsultation(consultation);
      });
    }).catch(console.error);
  }
  
  return () => {
    wsRef.current?.disconnect();
  };
}, []);
```

#### DoctorStore 状态管理

在 `frontend/src/store/doctorStore.ts` 中：
```typescript
class DoctorStore {
  // 新增：添加或更新问诊
  addOrUpdateConsultation(consultation: Consultation) {
    runInAction(() => {
      const index = this.pendingConsultations.findIndex(
        c => c.id === consultation.id
      );
      
      if (index !== -1) {
        // 更新现有问诊
        this.pendingConsultations[index] = consultation;
      } else if (consultation.status === 'pending') {
        // 添加新问诊
        this.pendingConsultations.unshift(consultation);
        this.stats.pending = this.pendingConsultations.length;
      }
    });
  }
}
```

## 错误处理和边界情况

### 1. WebSocket 断线重连
- 客户端重连后，调用 API 获取离线期间的消息和问诊
- 使用最后一条消息时间戳进行增量同步
- 避免重复标记已读

### 2. 离线消息处理
- 医生离线期间创建的问诊，上线后通过初始加载获取
- 首次建立 WebSocket 连接时，调用 `fetchPendingConsultations`
- 实时推送的问诊与 API 获取的问诊去重

### 3. 并发场景
- 多个医生同时接诊：后端检查状态，返回 409 冲突
- 已读状态更新失败：静默失败，不影响用户体验
- WebSocket 消息丢失：通过轮询兜底

### 4. 性能优化
- 批量标记已读（每 2 秒最多发送一次）
- 在线医生列表使用 Set，O(1) 查找
- 限制广播消息大小，只发送必要字段

## 实施计划

### 阶段 1：后端基础设施（必须先完成）

1. **messageStore 添加 isRead 字段**
   - 修改 `Message` 接口
   - 添加 `markAsRead` 方法

2. **WebSocket types 扩展**
   - 添加 `MARK_READ` 消息类型
   - `ServerMessageData` 添加 `isRead` 字段

3. **WebSocketManager 核心功能**
   - 维护 `onlineDoctors` Set
   - 实现 `broadcastToOnlineDoctors` 方法
   - 处理 `mark_read` 消息
   - 发送消息时设置 `isRead` 状态

### 阶段 2：后端业务逻辑

4. **consultationController 修改**
   - `createConsultation` 中广播给所有在线医生
   - 确保消息格式正确

### 阶段 3：前端基础服务

5. **websocket.ts 扩展**
   - 添加 `markAsRead` 方法
   - 添加 `onNewConsultation` 监听器（可选）

### 阶段 4：前端医生聊天页面

6. **DoctorChat/index.tsx 自动标记已读**
   - 页面可见时自动标记新消息为已读
   - 批量标记，避免频繁请求

### 阶段 5：前端医生工作台

7. **DoctorConsole/index.tsx WebSocket 连接**
   - 建立 WebSocket 连接
   - 监听问诊更新

8. **doctorStore 状态管理**
   - 实现 `addOrUpdateConsultation` 方法
   - 处理实时更新

## 测试策略

### 单元测试
- messageStore 的 markAsRead 方法
- WebSocketManager 的 broadcastToOnlineDoctors 方法
- doctorStore 的 addOrUpdateConsultation 方法

### 集成测试
- 创建问诊 → 所有在线医生收到通知
- 发送消息 → 接收者收到未读消息
- 标记已读 → 状态正确更新

### E2E 测试
- 患者创建问诊 → 医生工作台实时显示
- 消息对话 → 未读状态正确显示
- 医生离线后上线 → 正确获取离线期间的问诊

## 风险和注意事项

1. **WebSocket 稳定性**：保持现有轮询作为降级方案
2. **消息顺序**：确保 WebSocket 消息和 HTTP API 的数据一致性
3. **内存泄漏**：及时清理断开的连接和事件监听器
4. **安全性**：验证用户权限，防止跨问诊访问

## 成功标准

1. ✅ 消息显示正确的已读/未读状态
2. ✅ 医生工作台实时显示新问诊（3 秒内）
3. ✅ 断线重连后数据正确同步
4. ✅ 现有测试全部通过
5. ✅ 无性能退化（CPU、内存、网络）

## 后续优化

1. 已读回执推送给发送者（"对方已读"）
2. 问诊列表显示未读消息数量
3. 浏览器通知（Notification API）
4. 消息到达音效
