# 专家会诊功能优化实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 修复专家会诊功能的两个核心问题：1) 专家在待诊列表中可以看到用户已发送的问题；2) 专家回复后问诊不会从列表消失。

**架构:** 扩展现有 consultationStore 存储最后消息，新增 messageStore 存储消息历史，调整 API 返回所有未关闭问诊并支持状态筛选，调整前端显示消息摘要和状态标签。

**技术栈:** Node.js, TypeScript, Express, WebSocket, Vitest, React

---

## 后端实施

### Task 1: 创建消息存储服务 (messageStore.ts)

**文件:**
- 新建: `backend/src/services/storage/messageStore.ts`
- 测试: `backend/src/services/storage/__tests__/messageStore.test.ts`

**Step 1: 编写失败的测试**

```typescript
// backend/src/services/storage/__tests__/messageStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { messageStore, Message } from '../messageStore';

describe('messageStore', () => {
  beforeEach(() => {
    messageStore.clear();
  });

  it('should add and retrieve messages by consultationId', () => {
    const message: Message = {
      id: 'msg1',
      consultationId: 'consult1',
      senderId: 'user1',
      senderType: 'patient',
      content: 'Hello doctor',
      createdAt: '2026-01-25T10:00:00Z',
    };

    messageStore.addMessage(message);
    const messages = messageStore.getByConsultationId('consult1');

    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual(message);
  });

  it('should return empty array for non-existent consultation', () => {
    const messages = messageStore.getByConsultationId('non-existent');
    expect(messages).toEqual([]);
  });

  it('should clear all messages', () => {
    const message: Message = {
      id: 'msg1',
      consultationId: 'consult1',
      senderId: 'user1',
      senderType: 'patient',
      content: 'Hello',
      createdAt: '2026-01-25T10:00:00Z',
    };

    messageStore.addMessage(message);
    messageStore.clear();
    const messages = messageStore.getByConsultationId('consult1');

    expect(messages).toEqual([]);
  });
});
```

**Step 2: 运行测试确认失败**

```bash
cd backend && pnpm test messageStore.test.ts
```
预期: FAIL - "Cannot find module '../messageStore'"

**Step 3: 编写最小实现**

```typescript
// backend/src/services/storage/messageStore.ts
export interface Message {
  id: string;
  consultationId: string;
  senderId: string;
  senderType: 'patient' | 'doctor';
  content: string;
  createdAt: string;
}

class MessageStore {
  private messages: Map<string, Message> = new Map();

  addMessage(message: Message): Message {
    this.messages.set(message.id, message);
    return message;
  }

  getByConsultationId(consultationId: string): Message[] {
    return Array.from(this.messages.values())
      .filter((m) => m.consultationId === consultationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  clear(): void {
    this.messages.clear();
  }
}

export const messageStore = new MessageStore();
```

**Step 4: 运行测试确认通过**

```bash
cd backend && pnpm test messageStore.test.ts
```
预期: PASS (3 tests)

**Step 5: 提交**

```bash
git add backend/src/services/storage/messageStore.ts backend/src/services/storage/__tests__/messageStore.test.ts
git commit -m "feat(consultation): add messageStore for consultation messages"
```

---

### Task 2: 扩展 Consultation 接口

**文件:**
- 修改: `backend/src/services/storage/consultationStore.ts`

**Step 1: 修改接口定义**

在 `backend/src/services/storage/consultationStore.ts` 中，将 Consultation 接口修改为：

```typescript
export interface Consultation {
  id: string;
  patientId: string;
  patientPhone: string;
  doctorId: string;
  status: 'pending' | 'active' | 'closed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
  lastMessageTime?: string;
}
```

**Step 2: 添加 updateLastMessage 方法**

在 `ConsultationStore` 类中添加以下方法：

```typescript
updateLastMessage(id: string, content: string): Consultation | undefined {
  const consultation = this.consultations.get(id);
  if (consultation) {
    consultation.lastMessage = content.length > 50 ? content.slice(0, 50) + '...' : content;
    consultation.lastMessageTime = new Date().toISOString();
    consultation.updatedAt = new Date().toISOString();
  }
  return consultation;
}
```

**Step 3: 提交**

```bash
git add backend/src/services/storage/consultationStore.ts
git commit -m "feat(consultation): extend Consultation with lastMessage fields"
```

---

### Task 3: 创建获取消息历史的 API

**文件:**
- 修改: `backend/src/controllers/consultationController.ts`
- 修改: `backend/src/routes/consultations.ts`
- 测试: `backend/src/__tests__/integration/consultation.test.ts`

**Step 1: 编写失败的测试**

在 `backend/src/__tests__/integration/consultation.test.ts` 中添加：

```typescript
describe('GET /api/consultations/:id/messages', () => {
  it('should return messages for a consultation', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ phone: '13800000001', role: 'patient' });

    const token = loginRes.body.data.token;

    // 创建问诊
    const createRes = await request(app)
      .post('/api/consultations')
      .set('Authorization', `Bearer ${token}`)
      .send({ doctorId: 'doctor_001' });

    const consultationId = createRes.body.data.id;

    // 添加测试消息
    messageStore.addMessage({
      id: 'msg1',
      consultationId,
      senderId: 'patient1',
      senderType: 'patient',
      content: 'Hello doctor',
      createdAt: '2026-01-25T10:00:00Z',
    });

    const res = await request(app)
      .get(`/api/consultations/${consultationId}/messages`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].content).toBe('Hello doctor');
  });
});
```

**Step 2: 运行测试确认失败**

```bash
cd backend && pnpm test consultation.test.ts
```
预期: FAIL - 404 Not Found

**Step 3: 实现控制器**

在 `backend/src/controllers/consultationController.ts` 中添加：

```typescript
import { messageStore } from '../services/storage/messageStore';

/**
 * 获取问诊消息历史
 * GET /api/consultations/:id/messages
 */
export const getConsultationMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const consultationId = getRouteParam(req.params.id);
    const consultation = consultationStore.getById(consultationId);

    if (!consultation) {
      throw new NotFoundError('Consultation not found');
    }

    // 权限检查：患者和医生都可以查看消息
    if (
      consultation.patientId !== req.user.userId &&
      consultation.doctorId !== req.user.userId
    ) {
      throw new UnauthorizedError('Access denied');
    }

    const messages = messageStore.getByConsultationId(consultationId);

    res.json({
      code: 0,
      data: messages,
      message: 'success',
    });
  } catch (error) {
    logger.error('Get consultation messages error', error);
    throw error;
  }
};
```

**Step 4: 添加路由**

在 `backend/src/routes/consultations.ts` 中添加：

```typescript
import { getConsultationMessages } from '../controllers/consultationController';

// 在 getConsultationDetail 路由之后添加
/**
 * 获取问诊消息历史
 * GET /api/consultations/:id/messages
 */
router.get('/:id/messages', authMiddleware, getConsultationMessages);
```

**Step 5: 运行测试确认通过**

```bash
cd backend && pnpm test consultation.test.ts
```
预期: PASS

**Step 6: 提交**

```bash
git add backend/src/controllers/consultationController.ts backend/src/routes/consultations.ts backend/src/__tests__/integration/consultation.test.ts
git commit -m "feat(consultation): add API to get consultation message history"
```

---

### Task 4: 调整医生问诊列表 API

**文件:**
- 修改: `backend/src/controllers/consultationController.ts`
- 修改: `backend/src/routes/consultations.ts`
- 测试: `backend/src/__tests__/integration/consultation.test.ts`

**Step 1: 编写失败的测试**

在 `backend/src/__tests__/integration/consultation.test.ts` 中添加：

```typescript
describe('GET /api/consultations/doctor', () => {
  it('should return all non-closed consultations for doctor', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ phone: '13800000002', role: 'doctor' });

    const token = loginRes.body.data.token;

    const res = await request(app)
      .get('/api/consultations/doctor')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should filter consultations by status', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ phone: '13800000002', role: 'doctor' });

    const token = loginRes.body.data.token;

    const res = await request(app)
      .get('/api/consultations/doctor?status=pending')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((c: any) => c.status === 'pending')).toBe(true);
  });
});
```

**Step 2: 运行测试确认失败**

```bash
cd backend && pnpm test consultation.test.ts
```
预期: FAIL - 404 Not Found

**Step 3: 实现控制器**

在 `backend/src/controllers/consultationController.ts` 中添加：

```typescript
/**
 * 获取医生的问诊列表（所有未关闭）
 * GET /api/consultations/doctor
 */
export const getDoctorConsultations = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      throw new UnauthorizedError('Doctor access required');
    }

    const { status } = req.query;

    let consultations = consultationStore.getByDoctorId(req.user.userId);

    // 只返回未关闭的问诊
    consultations = consultations.filter((c) => c.status !== 'closed' && c.status !== 'cancelled');

    // 按 status 筛选
    if (status && ['pending', 'active'].includes(status as string)) {
      consultations = consultations.filter((c) => c.status === status);
    }

    res.json({
      code: 0,
      data: consultations.map((c) => ({
        ...c,
        patientPhone: maskPhone(c.patientPhone),
        doctor: getDoctorById(c.doctorId),
      })),
      message: 'success',
    });
  } catch (error) {
    logger.error('Get doctor consultations error', error);
    throw error;
  }
};
```

**Step 4: 添加路由**

在 `backend/src/routes/consultations.ts` 中添加：

```typescript
import { getDoctorConsultations } from '../controllers/consultationController';

// 替换原来的 /pending 路由
/**
 * 获取医生的问诊列表
 * GET /api/consultations/doctor
 */
router.get('/doctor', authMiddleware, getDoctorConsultations);
```

**Step 5: 运行测试确认通过**

```bash
cd backend && pnpm test consultation.test.ts
```
预期: PASS

**Step 6: 提交**

```bash
git add backend/src/controllers/consultationController.ts backend/src/routes/consultations.ts backend/src/__tests__/integration/consultation.test.ts
git commit -m "feat(consultation): add doctor consultations API with status filtering"
```

---

### Task 5: 调整结束问诊权限

**文件:**
- 修改: `backend/src/controllers/consultationController.ts`
- 测试: `backend/src/__tests__/integration/consultation.test.ts`

**Step 1: 编写失败的测试**

在 `backend/src/__tests__/integration/consultation.test.ts` 中添加：

```typescript
describe('PUT /api/consultations/:id/close - patient permission', () => {
  it('should allow patient to close consultation', async () => {
    const patientLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ phone: '13800000001', role: 'patient' });

    const patientToken = patientLoginRes.body.data.token;

    // 创建问诊
    const createRes = await request(app)
      .post('/api/consultations')
      .set('Authorization', `Bearer ${patientToken}`)
      .send({ doctorId: 'doctor_001' });

    const consultationId = createRes.body.data.id;

    // 患者关闭问诊
    const res = await request(app)
      .put(`/api/consultations/${consultationId}/close`)
      .set('Authorization', `Bearer ${patientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('closed');
  });
});
```

**Step 2: 运行测试确认失败**

```bash
cd backend && pnpm test consultation.test.ts
```
预期: FAIL - "Doctor access required"

**Step 3: 修改控制器**

将 `backend/src/controllers/consultationController.ts` 中的 `closeConsultation` 函数修改为：

```typescript
export const closeConsultation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const consultationId = getRouteParam(req.params.id);
    const consultation = consultationStore.getById(consultationId);

    if (!consultation) {
      throw new NotFoundError('Consultation not found');
    }

    // 患者和医生都可以结束问诊
    if (
      consultation.patientId !== req.user.userId &&
      consultation.doctorId !== req.user.userId
    ) {
      throw new UnauthorizedError('Access denied');
    }

    consultationStore.updateStatus(consultationId, 'closed');

    logger.info('Consultation closed', {
      consultationId,
      closedBy: req.user.userId,
    });

    res.json({
      code: 0,
      data: { ...consultation, status: 'closed' },
      message: 'success',
    });
  } catch (error) {
    logger.error('Close consultation error', error);
    throw error;
  }
};
```

**Step 4: 运行测试确认通过**

```bash
cd backend && pnpm test consultation.test.ts
```
预期: PASS

**Step 5: 提交**

```bash
git add backend/src/controllers/consultationController.ts backend/src/__tests__/integration/consultation.test.ts
git commit -m "feat(consultation): allow patients to close consultations"
```

---

### Task 6: WebSocket 消息处理时更新 lastMessage

**文件:**
- 修改: `backend/src/services/websocket/WebSocketManager.ts`
- 测试: `backend/src/services/websocket/__tests__/WebSocketManager.test.ts`

**Step 1: 查看 WebSocketManager 当前实现**

```bash
cat backend/src/services/websocket/WebSocketManager.ts | grep -A 20 "case 'message'"
```

**Step 2: 修改消息处理逻辑**

在 `WebSocketManager.ts` 的 `case 'message'` 分支中，添加更新 lastMessage 的逻辑：

```typescript
import { consultationStore } from '../storage/consultationStore';
import { messageStore, Message } from '../storage/messageStore';
import { v4 as uuidv4 } from 'uuid';

// 在 handleMessage 方法中
case 'message': {
  const { conversationId, content } = message;

  // 存储消息
  const newMessage: Message = {
    id: uuidv4(),
    consultationId: conversationId,
    senderId: userId,
    senderType: userRole === 'doctor' ? 'doctor' : 'patient',
    content,
    createdAt: new Date().toISOString(),
  };

  messageStore.addMessage(newMessage);

  // 更新会话的最后消息
  consultationStore.updateLastMessage(conversationId, content);

  // 广播消息
  this.broadcastToConversation(conversationId, {
    type: 'message',
    conversationId,
    message: newMessage,
  });

  break;
}
```

**Step 3: 运行测试**

```bash
cd backend && pnpm test
```
预期: 所有测试通过

**Step 4: 提交**

```bash
git add backend/src/services/websocket/WebSocketManager.ts
git commit -m "feat(websocket): update consultation lastMessage on new message"
```

---

### Task 7: 更新创建问诊时初始化 lastMessage

**文件:**
- 修改: `backend/src/controllers/consultationController.ts`

**Step 1: 修改 createConsultation 函数**

在 `createConsultation` 中创建 consultation 对象后，初始化 lastMessage：

```typescript
const consultation: Consultation = {
  id: consultationId,
  patientId: req.user.userId,
  patientPhone: req.user.phone,
  doctorId,
  status: 'pending',
  createdAt: now,
  updatedAt: now,
  lastMessage: '等待接诊...',
  lastMessageTime: now,
};
```

**Step 2: 运行测试**

```bash
cd backend && pnpm test consultation.test.ts
```
预期: PASS

**Step 3: 提交**

```bash
git add backend/src/controllers/consultationController.ts
git commit -m "feat(consultation): initialize lastMessage on consultation creation"
```

---

## 前端实施

### Task 8: 调整医生问诊列表页面

**文件:**
- 修改: `frontend/src/pages/DoctorTasks/index.tsx` (或对应文件)

**Step 1: 修改 API 调用**

将 API 端点从 `/api/consultations/pending` 改为 `/api/consultations/doctor`：

```typescript
// 修改 API 调用函数
const fetchConsultations = async (statusFilter?: string) => {
  const params = statusFilter && statusFilter !== 'all' ? `?status=${statusFilter}` : '';
  const response = await fetch(`/api/consultations/doctor${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  // ... 处理响应
};
```

**Step 2: 添加状态 Tab 组件**

```typescript
const [activeTab, setActiveTab] = useState<string>('all');

const tabs = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待接诊' },
  { key: 'active', label: '进行中' },
];

// 在 JSX 中渲染
<div className="tabs">
  {tabs.map(tab => (
    <button
      key={tab.key}
      className={activeTab === tab.key ? 'active' : ''}
      onClick={() => setActiveTab(tab.key)}
    >
      {tab.label}
    </button>
  ))}
</div>
```

**Step 3: 显示消息摘要和状态标签**

```typescript
// 在问诊卡片中
<div className="consultation-card">
  <span className={`status-badge ${consultation.status}`}>
    {consultation.status === 'pending' ? '待接诊' : '进行中'}
  </span>
  <p className="patient-phone">{consultation.patientPhone}</p>
  <p className="last-message">{consultation.lastMessage || '暂无消息'}</p>
  <p className="time">{formatTime(consultation.lastMessageTime)}</p>
</div>
```

**Step 4: 提交**

```bash
git add frontend/src/pages/DoctorTasks/index.tsx
git commit -m "feat(consultation): show message summary and status tabs in doctor tasks"
```

---

### Task 9: 调整问诊聊天页加载历史消息

**文件:**
- 修改: `frontend/src/pages/DoctorChat/index.tsx` (或对应文件)

**Step 1: 添加加载历史消息函数**

```typescript
const loadMessageHistory = async (consultationId: string) => {
  try {
    const response = await fetch(`/api/consultations/${consultationId}/messages`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();
    if (data.code === 0) {
      setMessages(data.data);
    }
  } catch (error) {
    console.error('Failed to load message history:', error);
  }
};
```

**Step 2: 在医生接诊时调用**

```typescript
const handleAcceptConsultation = async (consultationId: string) => {
  // ... 接诊逻辑

  // 加载历史消息
  await loadMessageHistory(consultationId);

  // 加入 WebSocket 会话
  // ...
};
```

**Step 3: 提交**

```bash
git add frontend/src/pages/DoctorChat/index.tsx
git commit -m "feat(consultation): load message history when accepting consultation"
```

---

### Task 10: 添加患者端结束问诊按钮

**文件:**
- 修改: `frontend/src/pages/DoctorChat/index.tsx`

**Step 1: 添加结束问诊函数**

```typescript
const handleCloseConsultation = async () => {
  if (!confirm('确定要结束问诊吗？')) return;

  try {
    const response = await fetch(`/api/consultations/${consultationId}/close`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();
    if (data.code === 0) {
      alert('问诊已结束');
      // 跳转回列表页
      navigate('/consultations');
    }
  } catch (error) {
    console.error('Failed to close consultation:', error);
    alert('结束问诊失败，请重试');
  }
};
```

**Step 2: 在患者端显示结束按钮**

```typescript
// 在聊天页面头部
{userRole === 'patient' && (
  <button onClick={handleCloseConsultation} className="close-btn">
    结束问诊
  </button>
)}
```

**Step 3: 提交**

```bash
git add frontend/src/pages/DoctorChat/index.tsx
git commit -m "feat(consultation): add close consultation button for patients"
```

---

## 验证阶段

### Task 11: 运行完整测试套件

**Step 1: 运行后端测试**

```bash
cd backend && pnpm test:run
```

**Step 2: 运行前端测试（如果有）**

```bash
cd frontend && npm test
```

**Step 3: 手动验证功能**

1. 用户发起问诊后立即发送消息
2. 医生在问诊列表中看到消息摘要
3. 医生接诊后看到历史消息
4. 医生回复后问诊仍在列表中
5. 患者可以结束问诊

---

## 相关文档

- 设计文档: `docs/plans/2026-01-25-expert-consultation-fix-design.md`
- 原有设计: `docs/plans/2026-01-25-expert-consultation-design.md`

---

**总计任务数:** 11
**预计时间:** 30-45 分钟
