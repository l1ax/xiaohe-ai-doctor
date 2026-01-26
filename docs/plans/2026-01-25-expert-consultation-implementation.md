# 专家问诊模块实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 实现专家问诊模块 MVP 功能，包括医生列表浏览、发起问诊、实时聊天、医生待办列表。

**Architecture:** 采用前后端分离架构，后端使用 Express + WebSocket，前端使用 React H5 + WebSocket。MVP 阶段数据存储在内存中。

**Tech Stack:** Node.js + TypeScript + Express + WebSocket + React + MobX + Vitest

---

## 后端实现

### Task 1: 扩展 WebSocket 消息类型（支持 join/leave）

**Files:**
- Modify: `backend/src/services/websocket/types.ts`

**Step 1: 写入失败的测试**

```typescript
// backend/src/services/websocket/__tests__/types.test.ts
import { WSMessageType, ClientMessage } from '../types';

describe('WebSocket Message Types', () => {
  it('should support join message type', () => {
    const joinMessage: ClientMessage = {
      type: 'join',
      conversationId: 'conv_123',
    };
    expect(joinMessage.type).toBe('join');
    expect(joinMessage.conversationId).toBe('conv_123');
  });

  it('should support leave message type', () => {
    const leaveMessage: ClientMessage = {
      type: 'leave',
      conversationId: 'conv_123',
    };
    expect(leaveMessage.type).toBe('leave');
    expect(leaveMessage.conversationId).toBe('conv_123');
  });
});
```

**Step 2: 运行测试验证失败**

Run: `cd backend && pnpm test:run -- --reporter=verbose src/services/websocket/__tests__/types.test.ts`
Expected: FAIL - "join" and "leave" types not in WSMessageType enum

**Step 3: 实现代码**

Modify `backend/src/services/websocket/types.ts`:

```typescript
export enum WSMessageType {
  MESSAGE = 'message',
  TYPING = 'typing',
  READ = 'read',
  HEARTBEAT = 'heartbeat',
  SYSTEM = 'system',
  JOIN = 'join',      // 新增
  LEAVE = 'leave',    // 新增
}
```

**Step 4: 运行测试验证通过**

Run: `cd backend && pnpm test:run -- --reporter=verbose src/services/websocket/__tests__/types.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
cd /Users/cong/chenzhicong/project/xiaohe-ai-doctor/.worktrees/expert-consultation
git add backend/src/services/websocket/types.ts backend/src/services/websocket/__tests__/types.test.ts
git commit -m "feat(websocket): add join/leave message types"
```

---

### Task 2: 实现消息存储服务

**Files:**
- Create: `backend/src/services/storage/messageStore.ts`

**Step 1: 写入失败的测试**

```typescript
// backend/src/services/storage/__tests__/messageStore.test.ts
import { messageStore, Message } from '../messageStore';

describe('MessageStore', () => {
  beforeEach(() => {
    messageStore.clear();
  });

  it('should add a message', () => {
    const message: Message = {
      id: 'msg_1',
      conversationId: 'conv_123',
      senderId: 'user_1',
      senderType: 'patient',
      content: 'Hello',
      createdAt: new Date().toISOString(),
    };
    messageStore.addMessage(message);
    const messages = messageStore.getMessagesByConversation('conv_123');
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hello');
  });

  it('should get messages by conversation', () => {
    const msg1: Message = {
      id: 'msg_1',
      conversationId: 'conv_123',
      senderId: 'user_1',
      senderType: 'patient',
      content: 'Hello',
      createdAt: new Date().toISOString(),
    };
    const msg2: Message = {
      id: 'msg_2',
      conversationId: 'conv_123',
      senderId: 'user_2',
      senderType: 'doctor',
      content: 'Hi there',
      createdAt: new Date().toISOString(),
    };
    messageStore.addMessage(msg1);
    messageStore.addMessage(msg2);
    const messages = messageStore.getMessagesByConversation('conv_123');
    expect(messages).toHaveLength(2);
  });

  it('should clear all messages', () => {
    const message: Message = {
      id: 'msg_1',
      conversationId: 'conv_123',
      senderId: 'user_1',
      senderType: 'patient',
      content: 'Hello',
      createdAt: new Date().toISOString(),
    };
    messageStore.addMessage(message);
    messageStore.clear();
    const messages = messageStore.getMessagesByConversation('conv_123');
    expect(messages).toHaveLength(0);
  });
});
```

**Step 2: 运行测试验证失败**

Run: `cd backend && pnpm test:run -- --reporter=verbose src/services/storage/__tests__/messageStore.test.ts`
Expected: FAIL - messageStore module not found

**Step 3: 实现代码**

Create `backend/src/services/storage/messageStore.ts`:

```typescript
/**
 * 消息存储服务（MVP 阶段使用内存存储）
 */

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'patient' | 'doctor';
  content: string;
  createdAt: string;
}

class MessageStore {
  private messages: Map<string, Message> = new Map();

  addMessage(message: Message): void {
    this.messages.set(message.id, message);
  }

  getMessagesByConversation(conversationId: string): Message[] {
    return Array.from(this.messages.values())
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  getMessageById(id: string): Message | undefined {
    return this.messages.get(id);
  }

  clear(): void {
    this.messages.clear();
  }
}

export const messageStore = new MessageStore();
```

**Step 4: 运行测试验证通过**

Run: `cd backend && pnpm test:run -- --reporter=verbose src/services/storage/__tests__/messageStore.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/storage/messageStore.ts backend/src/services/storage/__tests__/messageStore.test.ts
git commit -m "feat(storage): implement message store service"
```

---

### Task 3: 实现问诊会话存储服务

**Files:**
- Create: `backend/src/services/storage/consultationStore.ts`

**Step 1: 写入失败的测试**

```typescript
// backend/src/services/storage/__tests__/consultationStore.test.ts
import { consultationStore, Consultation } from '../consultationStore';

describe('ConsultationStore', () => {
  beforeEach(() => {
    consultationStore.clear();
  });

  it('should create a consultation', () => {
    const consultation: Consultation = {
      id: 'conv_123',
      patientId: 'patient_1',
      patientPhone: '13800138000',
      doctorId: 'doctor_001',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const created = consultationStore.createConsultation(consultation);
    expect(created.id).toBe('conv_123');
    expect(created.status).toBe('pending');
  });

  it('should find consultation by id', () => {
    const consultation: Consultation = {
      id: 'conv_123',
      patientId: 'patient_1',
      patientPhone: '13800138000',
      doctorId: 'doctor_001',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    consultationStore.createConsultation(consultation);
    const found = consultationStore.getById('conv_123');
    expect(found).toBeDefined();
    expect(found?.patientId).toBe('patient_1');
  });

  it('should find consultations by doctor id', () => {
    const conv1: Consultation = {
      id: 'conv_1',
      patientId: 'patient_1',
      patientPhone: '13800138000',
      doctorId: 'doctor_001',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const conv2: Consultation = {
      id: 'conv_2',
      patientId: 'patient_2',
      patientPhone: '13900139000',
      doctorId: 'doctor_001',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    consultationStore.createConsultation(conv1);
    consultationStore.createConsultation(conv2);
    const consultations = consultationStore.getByDoctorId('doctor_001');
    expect(consultations).toHaveLength(2);
  });

  it('should update consultation status', () => {
    const consultation: Consultation = {
      id: 'conv_123',
      patientId: 'patient_1',
      patientPhone: '13800138000',
      doctorId: 'doctor_001',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    consultationStore.createConsultation(consultation);
    consultationStore.updateStatus('conv_123', 'active');
    const updated = consultationStore.getById('conv_123');
    expect(updated?.status).toBe('active');
  });
});
```

**Step 2: 运行测试验证失败**

Run: `cd backend && pnpm test:run -- --reporter=verbose src/services/storage/__tests__/consultationStore.test.ts`
Expected: FAIL - consultationStore module not found

**Step 3: 实现代码**

Create `backend/src/services/storage/consultationStore.ts`:

```typescript
/**
 * 问诊会话存储服务（MVP 阶段使用内存存储）
 */

export interface Consultation {
  id: string;
  patientId: string;
  patientPhone: string;
  doctorId: string;
  status: 'pending' | 'active' | 'closed';
  createdAt: string;
  updatedAt: string;
}

class ConsultationStore {
  private consultations: Map<string, Consultation> = new Map();

  createConsultation(data: Consultation): Consultation {
    this.consultations.set(data.id, data);
    return data;
  }

  getById(id: string): Consultation | undefined {
    return this.consultations.get(id);
  }

  getByPatientId(patientId: string): Consultation[] {
    return Array.from(this.consultations.values())
      .filter((c) => c.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getByDoctorId(doctorId: string): Consultation[] {
    return Array.from(this.consultations.values())
      .filter((c) => c.doctorId === doctorId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  getPendingByDoctorId(doctorId: string): Consultation[] {
    return Array.from(this.consultations.values())
      .filter((c) => c.doctorId === doctorId && c.status === 'pending')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  updateStatus(id: string, status: Consultation['status']): Consultation | undefined {
    const consultation = this.consultations.get(id);
    if (consultation) {
      consultation.status = status;
      consultation.updatedAt = new Date().toISOString();
    }
    return consultation;
  }

  clear(): void {
    this.consultations.clear();
  }
}

export const consultationStore = new ConsultationStore();
```

**Step 4: 运行测试验证通过**

Run: `cd backend && pnpm test:run -- --reporter=verbose src/services/storage/__tests__/consultationStore.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/storage/consultationStore.ts backend/src/services/storage/__tests__/consultationStore.test.ts
git commit -m "feat(storage): implement consultation store service"
```

---

### Task 4: 扩展问诊控制器（接诊/结束/获取医生列表）

**Files:**
- Modify: `backend/src/controllers/consultationController.ts`

**Step 1: 写入失败的测试**

```typescript
// backend/src/__tests__/integration/consultation.test.ts (new tests)
describe('Consultation Controller - Accept/Close', () => {
  let patientToken: string;
  let doctorToken: string;

  beforeAll(async () => {
    // Setup tokens for patient and doctor
  });

  it('should allow doctor to accept a consultation', async () => {
    // Create consultation first
    // Then accept as doctor
  });

  it('should allow doctor to close a consultation', async () => {
    // Create consultation, accept, then close
  });

  it('should return pending consultations for doctor', async () => {
    // Get pending consultations
  });
});
```

**Step 2: 运行测试验证失败**

Run: `cd backend && pnpm test:run -- --reporter=verbose src/__tests__/integration/consultation.test.ts`
Expected: FAIL - accept/close endpoints not implemented

**Step 3: 实现代码**

Modify `backend/src/controllers/consultationController.ts`:

Add new functions:

```typescript
import { consultationStore } from '../services/storage/consultationStore';

/**
 * 获取待处理的问诊（医生端）
 * GET /api/consultations/pending
 */
export const getPendingConsultations = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      throw new UnauthorizedError('Doctor access required');
    }

    const consultations = consultationStore.getPendingByDoctorId(req.user.userId);

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
    logger.error('Get pending consultations error', error);
    throw error;
  }
};

/**
 * 医生接诊
 * PUT /api/consultations/:id/accept
 */
export const acceptConsultation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      throw new UnauthorizedError('Doctor access required');
    }

    const consultationId = getRouteParam(req.params.id);
    const consultation = consultationStore.getById(consultationId);

    if (!consultation) {
      throw new NotFoundError('Consultation not found');
    }

    if (consultation.doctorId !== req.user.userId) {
      throw new UnauthorizedError('Not your consultation');
    }

    if (consultation.status !== 'pending') {
      throw new ValidationError('Consultation is not pending');
    }

    consultationStore.updateStatus(consultationId, 'active');

    logger.info('Consultation accepted', { consultationId, doctorId: req.user.userId });

    res.json({
      code: 0,
      data: { ...consultation, status: 'active' },
      message: 'success',
    });
  } catch (error) {
    logger.error('Accept consultation error', error);
    throw error;
  }
};

/**
 * 结束问诊
 * PUT /api/consultations/:id/close
 */
export const closeConsultation = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'doctor') {
      throw new UnauthorizedError('Doctor access required');
    }

    const consultationId = getRouteParam(req.params.id);
    const consultation = consultationStore.getById(consultationId);

    if (!consultation) {
      throw new NotFoundError('Consultation not found');
    }

    if (consultation.doctorId !== req.user.userId) {
      throw new UnauthorizedError('Not your consultation');
    }

    consultationStore.updateStatus(consultationId, 'closed');

    logger.info('Consultation closed', { consultationId, doctorId: req.user.userId });

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

function maskPhone(phone: string): string {
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}
```

**Step 验证通过**

Run4: 运行测试: `cd backend && pnpm test:run -- --reporter=verbose src/__tests__/integration/consultation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/controllers/consultationController.ts
git commit -m "feat(consultation): add accept/close/pending endpoints for doctors"
```

---

### Task 5: 扩展 WebSocket 管理器（支持 join/leave）

**Files:**
- Modify: `backend/src/services/websocket/WebSocketManager.ts`

**Step 1: 写入失败的测试**

```typescript
// backend/src/services/websocket/__tests__/WebSocketManager.test.ts
describe('WebSocketManager - Join/Leave', () => {
  // Mock WebSocket for testing
});
```

**Step 2: 运行测试验证失败**

Run: `cd backend && pnpm test:run -- --reporter=verbose src/services/websocket/__tests__/WebSocketManager.test.ts`
Expected: FAIL - join/leave not implemented

**Step 3: 实现代码**

Modify `backend/src/services/websocket/WebSocketManager.ts`:

Add handling for JOIN and LEAVE message types in handleMessage method:

```typescript
case WSMessageType.JOIN:
  this.handleJoin(userId, message);
  break;

case WSMessageType.LEAVE:
  this.handleLeave(userId, message);
  break;
```

Add new methods:

```typescript
private handleJoin(userId: string, message: ClientMessage): void {
  const { conversationId } = message;
  if (!conversationId) {
    this.sendToUser(userId, {
      type: WSMessageType.SYSTEM,
      conversationId: '',
      data: { text: 'Conversation ID required' },
    });
    return;
  }

  this.joinConversation(userId, conversationId);

  // Notify others in the conversation
  this.broadcastToConversation(
    conversationId,
    {
      type: WSMessageType.SYSTEM,
      conversationId,
      data: { text: 'User joined the conversation' },
    },
    userId
  );

  // Send confirmation to user
  this.sendToUser(userId, {
    type: WSMessageType.SYSTEM,
    conversationId,
    data: { text: 'Joined conversation' },
  });
}

private handleLeave(userId: string, message: ClientMessage): void {
  const { conversationId } = message;
  if (!conversationId) return;

  this.leaveConversation(userId, conversationId);

  // Notify others in the conversation
  this.broadcastToConversation(
    conversationId,
    {
      type: WSMessageType.SYSTEM,
      conversationId,
      data: { text: 'User left the conversation' },
    },
    userId
  );
}
```

**Step 4: 运行测试验证通过**

Run: `cd backend && pnpm test:run -- --reporter=verbose src/services/websocket/__tests__/WebSocketManager.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/services/websocket/WebSocketManager.ts
git commit -m "feat(websocket): add join/leave message handling"
```

---

### Task 6: 扩展问诊路由

**Files:**
- Modify: `backend/src/routes/consultations.ts`

**Step 1: 写入失败的测试**

```typescript
// Test new routes exist
describe('Consultation Routes - Extended', () => {
  it('GET /api/consultations/pending should return pending consultations', async () => {
    // Test
  });

  it('PUT /api/consultations/:id/accept should accept consultation', async () => {
    // Test
  });

  it('PUT /api/consultations/:id/close should close consultation', async () => {
    // Test
  });
});
```

**Step 2: 运行测试验证失败**

Run: `cd backend && pnpm test:run -- --reporter=verbose src/__tests__/integration/consultation.test.ts`
Expected: FAIL - new routes not defined

**Step 3: 实现代码**

Modify `backend/src/routes/consultations.ts`:

```typescript
import express from 'express';
import {
  // ... existing imports
  getPendingConsultations,
  acceptConsultation,
  closeConsultation,
} from '../controllers/consultationController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

// ... existing routes

/**
 * 获取待处理的问诊（医生端）
 * GET /api/consultations/pending
 */
router.get('/pending', authMiddleware, getPendingConsultations);

/**
 * 医生接诊
 * PUT /api/consultations/:id/accept
 */
router.put('/:id/accept', authMiddleware, acceptConsultation);

/**
 * 结束问诊
 * PUT /api/consultations/:id/close
 */
router.put('/:id/close', authMiddleware, closeConsultation);

export default router;
```

**Step 4: 运行测试验证通过**

Run: `cd backend && pnpm test:run -- --reporter=verbose src/__tests__/integration/consultation.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/routes/consultations.ts
git commit -m "feat(routes): add pending/accept/close endpoints"
```

---

## 前端实现

### Task 7: WebSocket 服务封装

**Files:**
- Create: `frontend/src/services/websocket.ts`

**Step 1: 写入失败的测试**

```typescript
// frontend/src/services/__tests__/websocket.test.ts
import { WebSocketService } from '../websocket';

describe('WebSocketService', () => {
  it('should connect to WebSocket server', () => {
    // Test connection
  });

  it('should send message', () => {
    // Test sending
  });

  it('should handle incoming messages', () => {
    // Test message handling
  });
});
```

**Step 2: 运行测试验证失败**

Run: `cd frontend && pnpm test:run -- --reporter=verbose src/services/__tests__/websocket.test.ts`
Expected: FAIL - websocket service not found

**Step 3: 实现代码**

Create `frontend/src/services/websocket.ts`:

```typescript
/**
 * WebSocket 服务封装
 */

export interface ChatMessage {
  id: string;
  senderId: string;
  senderType: 'patient' | 'doctor';
  content: string;
  createdAt: string;
}

export type MessageHandler = (message: ChatMessage) => void;
export type SystemHandler = (text: string) => void;
export type TypingHandler = (senderId: string) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private messageHandlers: Set<MessageHandler> = new Set();
  private systemHandlers: Set<SystemHandler> = new Set();
  private typingHandlers: Set<TypingHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${this.url}?token=${this.token}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        console.log('WebSocket connected');
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.handleDisconnect();
      };
    });
  }

  join(conversationId: string): void {
    this.send({ type: 'join', conversationId });
  }

  leave(conversationId: string): void {
    this.send({ type: 'leave', conversationId });
  }

  sendMessage(conversationId: string, content: string): void {
    this.send({
      type: 'message',
      conversationId,
      data: { content, contentType: 'text' },
    });
  }

  sendTyping(conversationId: string, isTyping: boolean): void {
    this.send({ type: 'typing', conversationId, isTyping });
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onSystem(handler: SystemHandler): () => void {
    this.systemHandlers.add(handler);
    return () => this.systemHandlers.delete(handler);
  }

  onTyping(handler: TypingHandler): () => void {
    this.typingHandlers.add(handler);
    return () => this.typingHandlers.delete(handler);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private send(data: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private handleMessage(data: Record<string, unknown>): void {
    switch (data.type) {
      case 'message':
        this.messageHandlers.forEach((h) => h(data.message as ChatMessage));
        break;
      case 'system':
        this.systemHandlers.forEach((h) => h(data.data?.text || ''));
        break;
      case 'typing':
        this.typingHandlers.forEach((h) => h(data.data?.senderId || ''));
        break;
    }
  }

  private handleDisconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    }
  }
}
```

**Step 4: 运行测试验证通过**

Run: `cd frontend && pnpm test:run -- --reporter=verbose src/services/__tests__/websocket.test.ts`
Expected: PASS (may need to mock WebSocket)

**Step 5: Commit**

```bash
git add frontend/src/services/websocket.ts frontend/src/services/__tests__/websocket.test.ts
git commit -m "feat(frontend): implement WebSocket service"
```

---

### Task 8: 医生列表页

**Files:**
- Create: `frontend/src/pages/DoctorList/index.tsx`
- Create: `frontend/src/pages/DoctorList/DoctorCard.tsx`

**Step 1: 写入失败的测试**

```typescript
// frontend/src/pages/DoctorList/__tests__/index.test.tsx
import { render, screen } from '@testing-library/react';
import DoctorList from '../index';

describe('DoctorList Page', () => {
  it('should display doctor list', () => {
    // Test
  });
});
```

**Step 2: 运行测试验证失败**

Run: `cd frontend && pnpm test:run -- --reporter=verbose src/pages/DoctorList/__tests__/index.test.tsx`
Expected: FAIL - DoctorList page not found

**Step 3: 实现代码**

Create `frontend/src/pages/DoctorList/index.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { userStore } from '../../store';

interface Doctor {
  id: string;
  name: string;
  title: string;
  department: string;
  hospital: string;
  avatarUrl?: string;
  consultationFee: number;
  isAvailable: boolean;
  rating: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const DoctorList = observer(function DoctorList() {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDoctors();
    fetchDepartments();
  }, [selectedDept]);

  const fetchDoctors = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedDept) params.append('department', selectedDept);
      params.append('available', 'true');

      const res = await fetch(`${API_BASE_URL}/api/consultations/doctors?${params}`, {
        headers: { Authorization: `Bearer ${userStore.accessToken}` },
      });
      const data = await res.json();
      if (data.code === 0) setDoctors(data.data);
    } catch (error) {
      console.error('Failed to fetch doctors:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/consultations/departments`);
      const data = await res.json();
      if (data.code === 0) setDepartments(data.data);
    } catch (error) {
      console.error('Failed to fetch departments:', error);
    }
  };

  const handleStartConsultation = async (doctorId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/consultations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userStore.accessToken}`,
        },
        body: JSON.stringify({ doctorId }),
      });
      const data = await res.json();
      if (data.code === 0) {
        navigate(`/doctor-chat/${data.data.id}`);
      }
    } catch (error) {
      console.error('Failed to create consultation:', error);
    }
  };

  if (loading) {
    return <div className="p-4 text-center">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm p-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold">选择医生</h1>
        </div>
      </header>

      {/* Department Filter */}
      <div className="bg-white border-b overflow-x-auto">
        <div className="flex gap-2 p-3">
          <button
            onClick={() => setSelectedDept('')}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
              !selectedDept ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            全部
          </button>
          {departments.map((dept) => (
            <button
              key={dept}
              onClick={() => setSelectedDept(dept)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${
                selectedDept === dept ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {dept}
            </button>
          ))}
        </div>
      </div>

      {/* Doctor List */}
      <div className="p-4 space-y-4">
        {doctors.map((doctor) => (
          <div key={doctor.id} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex gap-4">
              <img
                src={doctor.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${doctor.id}`}
                alt={doctor.name}
                className="w-16 h-16 rounded-full bg-gray-100"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold">{doctor.name}</h3>
                  <span className="text-sm text-gray-500">{doctor.title}</span>
                </div>
                <p className="text-sm text-gray-600">{doctor.department} | {doctor.hospital}</p>
                <p className="text-sm text-gray-500 mt-1">⭐ {doctor.rating} | 问诊量 500+</p>
              </div>
              <div className="text-right">
                <p className="text-primary font-bold">¥{(doctor.consultationFee / 100).toFixed(0)}/次</p>
                <button
                  onClick={() => handleStartConsultation(doctor.id)}
                  className="mt-2 px-4 py-2 bg-primary text-white rounded-lg text-sm"
                >
                  立即问诊
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

export default DoctorList;
```

**Step 4: 运行测试验证通过**

Run: `cd frontend && pnpm test:run -- --reporter=verbose src/pages/DoctorList/__tests__/index.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/pages/DoctorList/
git commit -m "feat(frontend): implement doctor list page"
```

---

### Task 9: 专家问诊聊天页

**Files:**
- Create: `frontend/src/pages/DoctorChat/index.tsx`

**Step 1: 写入失败的测试**

```typescript
// frontend/src/pages/DoctorChat/__tests__/index.test.tsx
import { render, screen } from '@testing-library/react';
import DoctorChat from '../index';

describe('DoctorChat Page', () => {
  it('should display chat interface', () => {
    // Test
  });
});
```

**Step 2: 运行测试验证失败**

Run: `cd frontend && pnpm test:run -- --reporter=verbose src/pages/DoctorChat/__tests__/index.test.tsx`
Expected: FAIL - DoctorChat page not found

**Step 3: 实现代码**

Create `frontend/src/pages/DoctorChat/index.tsx`:

```typescript
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { userStore } from '../../store';
import { WebSocketService, ChatMessage } from '../../services/websocket';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';

interface Consultation {
  id: string;
  patientId: string;
  doctorId: string;
  status: string;
  doctor: {
    name: string;
    title: string;
    department: string;
  };
}

interface Message {
  id: string;
  senderId: string;
  senderType: 'patient' | 'doctor';
  content: string;
  createdAt: string;
}

const DoctorChat = observer(function DoctorChat() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const wsRef = useRef<WebSocketService | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    fetchConsultation();
    connectWebSocket();
    return () => wsRef.current?.disconnect();
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConsultation = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/consultations/${id}`, {
        headers: { Authorization: `Bearer ${userStore.accessToken}` },
      });
      const data = await res.json();
      if (data.code === 0) setConsultation(data.data);
    } catch (error) {
      console.error('Failed to fetch consultation:', error);
    }
  };

  const connectWebSocket = async () => {
    if (!id || !userStore.accessToken) return;

    const ws = new WebSocketService(WS_URL, userStore.accessToken);
    wsRef.current = ws;

    try {
      await ws.connect();
      setIsConnected(true);
      ws.join(id);

      ws.onMessage((message: ChatMessage) => {
        setMessages((prev) => [...prev, {
          id: message.id,
          senderId: message.senderId,
          senderType: message.senderType,
          content: message.content,
          createdAt: message.createdAt,
        }]);
      });

      ws.onTyping(() => setIsTyping(true));
    } catch (error) {
      console.error('WebSocket connection failed:', error);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !id || !wsRef.current) return;

    wsRef.current.sendMessage(id, inputValue);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  if (!consultation) {
    return <div className="p-4 text-center">加载中...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm px-4 py-3 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1">
          <h1 className="font-bold">{consultation.doctor?.name}</h1>
          <p className="text-sm text-gray-500">{consultation.doctor?.department}</p>
        </div>
        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.senderId === userStore.user?.id ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                msg.senderId === userStore.user?.id
                  ? 'bg-primary text-white rounded-br-sm'
                  : 'bg-white rounded-bl-sm'
              }`}
            >
              <p>{msg.content}</p>
              <p className={`text-xs mt-1 ${msg.senderId === userStore.user?.id ? 'text-white/70' : 'text-gray-400'}`}>
                {new Date(msg.createdAt).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-2">
              <p className="text-sm text-gray-500">对方正在输入...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t p-4">
        <div className="flex items-center gap-2">
          <input
            className="flex-1 border rounded-full px-4 py-2 focus:outline-none focus:border-primary"
            placeholder="输入消息..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isConnected}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || !isConnected}
            className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center disabled:bg-gray-300"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export default DoctorChat;
```

**Step 4: 运行测试验证通过**

Run: `cd frontend && pnpm test:run -- --reporter=verbose src/pages/DoctorChat/__tests__/index.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/pages/DoctorChat/
git commit -m "feat(frontend): implement doctor chat page"
```

---

### Task 10: 医生待办页

**Files:**
- Create: `frontend/src/pages/DoctorTasks/index.tsx`

**Step 1: 写入失败的测试**

```typescript
// frontend/src/pages/DoctorTasks/__tests__/index.test.tsx
import { render, screen } from '@testing-library/react';
import DoctorTasks from '../index';

describe('DoctorTasks Page', () => {
  it('should display pending consultations', () => {
    // Test
  });
});
```

**Step 2: 运行测试验证失败**

Run: `cd frontend && pnpm test:run -- --reporter=verbose src/pages/DoctorTasks/__tests__/index.test.tsx`
Expected: FAIL - DoctorTasks page not found

**Step 3: 实现代码**

Create `frontend/src/pages/DoctorTasks/index.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { userStore } from '../../store';

interface PendingConsultation {
  id: string;
  patientId: string;
  patientPhone: string;
  doctorId: string;
  status: string;
  createdAt: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const DoctorTasks = observer(function DoctorTasks() {
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState<PendingConsultation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingConsultations();
  }, []);

  const fetchPendingConsultations = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/consultations/pending`, {
        headers: { Authorization: `Bearer ${userStore.accessToken}` },
      });
      const data = await res.json();
      if (data.code === 0) setConsultations(data.data);
    } catch (error) {
      console.error('Failed to fetch pending consultations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (consultationId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/consultations/${consultationId}/accept`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${userStore.accessToken}` },
      });
      const data = await res.json();
      if (data.code === 0) {
        navigate(`/doctor-chat/${consultationId}`);
      }
    } catch (error) {
      console.error('Failed to accept consultation:', error);
    }
  };

  if (loading) {
    return <div className="p-4 text-center">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm p-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold">待办问诊</h1>
        </div>
      </header>

      {/* Pending List */}
      <div className="p-4 space-y-4">
        {consultations.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <span className="material-symbols-outlined text-6xl mb-4 block">check_circle</span>
            <p>暂无待办问诊</p>
          </div>
        ) : (
          consultations.map((consultation) => (
            <div key={consultation.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary">person</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium">患者 {consultation.patientPhone}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(consultation.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleAccept(consultation.id)}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm"
                >
                  接诊
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});

export default DoctorTasks;
```

**Step 4: 运行测试验证通过**

Run: `cd frontend && pnpm test:run -- --reporter=verbose src/pages/DoctorTasks/__tests__/index.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/pages/DoctorTasks/
git commit -m "feat(frontend): implement doctor tasks page"
```

---

### Task 11: 更新路由

**Files:**
- Modify: `frontend/src/router.tsx`

**Step 1: 写入失败的测试**

```typescript
// frontend/src/__tests__/router.test.ts
import { router } from '../router';

describe('Router', () => {
  it('should have doctor-list route', () => {
    // Test
  });

  it('should have doctor-chat route with param', () => {
    // Test
  });

  it('should have doctor-tasks route', () => {
    // Test
  });
});
```

**Step 2: 运行测试验证失败**

Run: `cd frontend && pnpm test:run -- --reporter=verbose src/__tests__/router.test.ts`
Expected: FAIL - new routes not found

**Step 3: 实现代码**

Modify `frontend/src/router.tsx`:

```typescript
import { createBrowserRouter } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Appointments from './pages/Appointments';
import Consultations from './pages/Consultations';
import Prescriptions from './pages/Prescriptions';
import HealthRecords from './pages/HealthRecords';
import FamilyMembers from './pages/FamilyMembers';
import Address from './pages/Address';
import CustomerService from './pages/CustomerService';
import VIP from './pages/VIP';
import Chat from './pages/Chat';
import DoctorList from './pages/DoctorList';
import DoctorChat from './pages/DoctorChat';
import DoctorTasks from './pages/DoctorTasks';
import Layout from './components/Layout';

const withLayout = (element: React.ReactNode) => <Layout>{element}</Layout>;

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/', element: withLayout(<Home />) },
  { path: '/profile', element: withLayout(<Profile />) },
  { path: '/settings', element: <Settings /> },
  { path: '/appointments', element: withLayout(<Appointments />) },
  { path: '/consultations', element: withLayout(<Consultations />) },
  { path: '/prescriptions', element: withLayout(<Prescriptions />) },
  { path: '/health-records', element: withLayout(<HealthRecords />) },
  { path: '/family-members', element: withLayout(<FamilyMembers />) },
  { path: '/address', element: withLayout(<Address />) },
  { path: '/customer-service', element: withLayout(<CustomerService />) },
  { path: '/vip', element: withLayout(<VIP />) },
  { path: '/booking', element: withLayout(<div>挂号页面（开发中）</div>) },
  { path: '/chat', element: <Chat /> },
  { path: '/doctor-list', element: withLayout(<DoctorList />) },
  { path: '/doctor-chat/:id', element: <DoctorChat /> },
  { path: '/doctor/tasks', element: <DoctorTasks /> },
]);
```

**Step 4: 运行测试验证通过**

Run: `cd frontend && pnpm test:run -- --reporter=verbose src/__tests__/router.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/router.tsx
git commit -m "feat(frontend): add doctor routes"
```

---

### Task 12: 更新登录页支持角色选择

**Files:**
- Modify: `frontend/src/pages/Login/index.tsx`

**Step 1: 写入失败的测试**

```typescript
// frontend/src/pages/Login/__tests__/index.test.tsx
import { render, screen } from '@testing-library/react';
import Login from '../index';

describe('Login Page', () => {
  it('should display role selection', () => {
    // Test
  });
});
```

**Step 2: 运行测试验证失败**

Run: `cd frontend && pnpm test:run -- --reporter=verbose src/pages/Login/__tests__/index.test.tsx`
Expected: FAIL - role selection not found

**Step 3: 实现代码**

Modify `frontend/src/pages/Login/index.tsx`:

Add role selection UI:

```typescript
// Add state for selected role
const [selectedRole, setSelectedRole] = useState<'patient' | 'doctor'>('patient');

// Add role selection UI before the login button
<div className="flex gap-4 mb-6">
  <button
    type="button"
    onClick={() => setSelectedRole('patient')}
    className={`flex-1 py-3 rounded-lg border-2 ${
      selectedRole === 'patient'
        ? 'border-primary bg-primary/5'
        : 'border-gray-200'
    }`}
  >
    <span className="material-symbols-outlined block text-center mb-1">person</span>
    <span className="text-sm">患者</span>
  </button>
  <button
    type="button"
    onClick={() => setSelectedRole('doctor')}
    className={`flex-1 py-3 rounded-lg border-2 ${
      selectedRole === 'doctor'
        ? 'border-primary bg-primary/5'
        : 'border-gray-200'
    }`}
  >
    <span className="material-symbols-outlined block text-center mb-1">medical_services</span>
    <span className="text-sm">医生</span>
  </button>
</div>
```

**Step 4: 运行测试验证通过**

Run: `cd frontend && pnpm test:run -- --reporter=verbose src/pages/Login/__tests__/index.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/pages/Login/index.tsx
git commit -m "feat(frontend): add role selection to login page"
```

---

## 验证计划

### 功能验证清单

- [ ] 后端测试全部通过
- [ ] 前端测试全部通过
- [ ] 医生列表页正常显示
- [ ] 发起问诊创建会话
- [ ] WebSocket 连接成功
- [ ] 实时消息收发
- [ ] 医生待办页显示待处理问诊
- [ ] 医生接诊后进入聊天
- [ ] 角色选择登录正常

---

## 注意事项

1. MVP 阶段数据存储在内存中，服务重启会丢失
2. WebSocket 心跳间隔 30 秒，超时 60 秒断开
3. 消息限流：每分钟最多 60 条
4. 后续可迁移到 Supabase PostgreSQL 持久化存储
