# 专家会诊实时更新优化设计文档

**模块名称**: 专家会诊实时更新优化
**创建日期**: 2026-01-26
**版本**: v1.0
**设计者**: Claude Code

---

## 第一部分：问题总结与整体架构

### 核心问题

当前专家会诊模块存在以下关键问题：

1. **导航混乱**：医生从问诊列表进入聊天页面后，点击返回按钮使用 `navigate(-1)` 可能导航到错误的页面，导致看不到问诊列表。

2. **结束问诊后导航错误**：医生结束问诊后导航到 `/doctor/console`（工作台），而不是 `/doctor/tasks`（问诊列表），无法继续处理其他待诊患者。

3. **列表数据不刷新**：问诊列表页面只在切换 Tab 时刷新数据，当用户从聊天页面返回时不会自动刷新，导致显示过时的数据。

4. **缺少实时通知**：虽然有 WebSocket 聊天消息推送，但问诊列表的状态变化（如新消息、状态更新）没有实时通知机制。

### 整体架构方案

采用**事件驱动的实时更新架构**：

```
┌─────────────────────────────────────────────────────────────┐
│                        WebSocket 服务器                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  消息类型扩展：                                       │   │
│  │  - MESSAGE: 聊天消息（已有）                          │   │
│  │  - CONSULTATION_UPDATE: 问诊状态更新（新增）          │   │
│  │  - NEW_CONSULTATION: 新问诊通知（新增）               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ WebSocket 推送
┌─────────────────────────────────────────────────────────────┐
│                      前端事件总线                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  consultationStore (MobX)                             │   │
│  │  - consultations: ObservableArray                     │   │
│  │  - updateConsultation()                               │   │
│  │  - addConsultation()                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↓ 响应式更新
┌─────────────────────────────────────────────────────────────┐
│                       UI 组件                                 │
│  - DoctorTasks: 问诊列表（自动更新）                          │
│  - ConsultationCard: 问诊卡片（显示最新状态）                │
└─────────────────────────────────────────────────────────────┘
```

---

## 第二部分：WebSocket 协议扩展与后端实现

### WebSocket 消息类型扩展

在现有的 `WSMessageType` 枚举中新增两种消息类型：

```typescript
// backend/src/services/websocket/types.ts

export enum WSMessageType {
  // 现有类型
  MESSAGE = 'message',
  TYPING = 'typing',
  SYSTEM = 'system',
  JOIN = 'join',
  LEAVE = 'leave',
  HEARTBEAT = 'heartbeat',

  // 新增类型
  CONSULTATION_UPDATE = 'consultation_update',  // 问诊状态更新
  NEW_CONSULTATION = 'new_consultation',        // 新问诊通知
}
```

### 服务端消息格式

**1. 问诊状态更新消息**

当问诊的 `lastMessage`、`lastMessageTime` 或 `status` 发生变化时，向相关用户推送：

```typescript
interface ConsultationUpdateMessage {
  type: WSMessageType.CONSULTATION_UPDATE;
  consultation: {
    id: string;
    status: 'pending' | 'active' | 'closed' | 'cancelled';
    lastMessage: string;
    lastMessageTime: string;
    updatedAt: string;
  };
}
```

**2. 新问诊通知**

当有新的问诊分配给医生时，向该医生推送：

```typescript
interface NewConsultationMessage {
  type: WSMessageType.NEW_CONSULTATION;
  consultation: {
    id: string;
    patientId: string;
    patientPhone: string;
    status: 'pending';
    createdAt: string;
  };
}
```

### 后端实现改动

**文件：`backend/src/services/websocket/WebSocketManager.ts`**

1. **新增广播问诊更新方法**：

```typescript
/**
 * 广播问诊更新给相关用户（医生和患者）
 */
broadcastConsultationUpdate(consultationId: string): void {
  const consultation = consultationStore.getById(consultationId);
  if (!consultation) return;

  const updateMessage: ServerMessage = {
    type: WSMessageType.CONSULTATION_UPDATE,
    conversationId: consultationId,
    consultation: {
      id: consultation.id,
      status: consultation.status,
      lastMessage: consultation.lastMessage || '',
      lastMessageTime: consultation.lastMessageTime || consultation.createdAt,
      updatedAt: consultation.updatedAt,
    },
  };

  // 发送给医生
  this.sendToUser(consultation.doctorId, updateMessage);

  // 发送给患者
  this.sendToUser(consultation.patientId, updateMessage);
}
```

2. **在 `handleChatMessage` 中调用广播**：

医生或患者发送消息后，自动触发问诊更新通知：

```typescript
private handleChatMessage(userId: string, clientMessage: ClientMessage): void {
  // ... 现有代码：存储消息、更新 lastMessage ...

  // 新增：广播问诊更新
  this.broadcastConsultationUpdate(clientMessage.conversationId);

  // ... 现有代码：广播消息 ...
}
```

3. **在 `acceptConsultation` 中调用广播**：

医生接诊后通知患者：

```typescript
// backend/src/controllers/consultationController.ts

export const acceptConsultation = async (req: Request, res: Response): Promise<void> => {
  // ... 现有代码 ...

  consultationStore.updateStatus(consultationId, 'active');

  // 新增：通知患者问诊已接诊
  wsManager.broadcastConsultationUpdate(consultationId);

  res.json({ code: 0, data: { ...consultation, status: 'active' } });
};
```

---

## 第三部分：前端状态管理与 MobX Store

### 创建 consultationStore（MobX）

**文件：`frontend/src/store/consultationStore.ts`**

创建一个专门的 MobX Store 来管理问诊列表状态，支持实时更新：

```typescript
import { makeAutoObservable, runInAction } from 'mobx';
import { userStore } from './userStore';

interface Consultation {
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

class ConsultationStore {
  consultations: Consultation[] = [];
  loading = false;
  error: string | null = null;
  currentTab: 'all' | 'pending' | 'active' = 'all';

  constructor() {
    makeAutoObservable(this);
  }

  // 从服务器加载问诊列表
  async loadConsultations(statusFilter?: 'all' | 'pending' | 'active') {
    this.loading = true;
    this.error = null;

    try {
      const params = statusFilter && statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/consultations/doctor${params}`, {
        headers: { Authorization: `Bearer ${userStore.accessToken}` },
      });
      const data = await res.json();

      runInAction(() => {
        if (data.code === 0) {
          this.consultations = data.data;
        }
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = '加载问诊列表失败';
        this.loading = false;
      });
    }
  }

  // 更新单个问诊（WebSocket 收到更新时调用）
  updateConsultation(updatedConsultation: Partial<Consultation> & { id: string }) {
    runInAction(() => {
      const index = this.consultations.findIndex(c => c.id === updatedConsultation.id);

      if (index !== -1) {
        // 更新现有问诊
        this.consultations[index] = {
          ...this.consultations[index],
          ...updatedConsultation,
        };
      } else {
        // 添加新问诊（如果是新分配的）
        if (updatedConsultation.status !== 'closed' && updatedConsultation.status !== 'cancelled') {
          this.consultations.unshift(updatedConsultation as Consultation);
        }
      }
    });
  }

  // 移除问诊（状态变为 closed/cancelled 时）
  removeConsultation(consultationId: string) {
    runInAction(() => {
      this.consultations = this.consultations.filter(c => c.id !== consultationId);
    });
  }

  // 设置当前筛选 Tab
  setCurrentTab(tab: 'all' | 'pending' | 'active') {
    this.currentTab = tab;
    this.loadConsultations(tab);
  }

  // 获取过滤后的问诊列表
  get filteredConsultations() {
    if (this.currentTab === 'all') {
      return this.consultations;
    }
    return this.consultations.filter(c => c.status === this.currentTab);
  }
}

export const consultationStore = new ConsultationStore();
```

### WebSocket 服务扩展

**文件：`frontend/src/services/websocket.ts`**

扩展现有的 WebSocketService，添加问诊更新监听：

```typescript
class WebSocketService {
  // ... 现有代码 ...

  // 监听问诊更新
  onConsultationUpdate(callback: (consultation: any) => void) {
    this.handlers.set('consultation_update', callback);
  }

  // 内部消息处理
  private handleMessage(data: any) {
    switch (data.type) {
      // ... 现有 case ...

      case 'consultation_update':
        this.handlers.get('consultation_update')?.(data.consultation);
        break;
    }
  }
}
```

---

## 第四部分：前端 UI 组件改造

### 1. 医生问诊列表页面改造

**文件：`frontend/src/pages/DoctorTasks/index.tsx`**

主要改动：
1. 使用 `consultationStore` 替代本地状态
2. 移除 `useEffect` 依赖刷新，由 store 自动管理
3. 添加 WebSocket 监听实时更新

```typescript
import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';
import { consultationStore } from '../../store/consultationStore';
import { WebSocketService } from '../../services/websocket';
import { userStore } from '../../store';

const DoctorTasks = observer(function DoctorTasks() {
  const navigate = useNavigate();
  const wsRef = useRef<WebSocketService | null>(null);

  const tabs = [
    { key: 'all', label: '全部' },
    { key: 'pending', label: '待接诊' },
    { key: 'active', label: '进行中' },
  ];

  // 初始化：加载问诊列表
  useEffect(() => {
    consultationStore.loadConsultations(consultationStore.currentTab);

    // 初始化 WebSocket
    if (!wsRef.current && userStore.accessToken) {
      const ws = new WebSocketService(
        `${import.meta.env.VITE_WS_URL || 'ws://localhost:3000'}/ws`,
        userStore.accessToken
      );
      wsRef.current = ws;

      ws.connect().then(() => {
        // 监听问诊更新
        ws.onConsultationUpdate((consultation) => {
          console.log('收到问诊更新:', consultation);
          consultationStore.updateConsultation(consultation);
        });
      });

      return () => {
        ws.disconnect();
        wsRef.current = null;
      };
    }
  }, []);

  // 切换 Tab
  const handleTabChange = (tab: 'all' | 'pending' | 'active') => {
    consultationStore.setCurrentTab(tab);
  };

  // 接诊逻辑
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

  if (consultationStore.loading) {
    return <div className="p-4 text-center">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Tab 切换 */}
      <header className="bg-white shadow-sm p-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold mr-4">我的问诊</h1>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key as any)}
              className={`px-3 py-1 rounded-full text-sm ${
                consultationStore.currentTab === tab.key
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* 问诊列表 - 使用 store 的计算属性 */}
      <div className="p-4 space-y-4">
        {consultationStore.filteredConsultations.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p>暂无问诊</p>
          </div>
        ) : (
          consultationStore.filteredConsultations.map((consultation) => (
            <div key={consultation.id} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary">person</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      consultation.status === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {consultation.status === 'pending' ? '待接诊' : '进行中'}
                    </span>
                    <p className="font-medium">患者 {consultation.patientPhone}</p>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-1">
                    {consultation.lastMessage || '暂无消息'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {consultation.lastMessageTime
                      ? new Date(consultation.lastMessageTime).toLocaleString()
                      : new Date(consultation.createdAt).toLocaleString()}
                  </p>
                </div>
                {consultation.status === 'pending' ? (
                  <button
                    onClick={() => handleAccept(consultation.id)}
                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm flex-shrink-0"
                  >
                    接诊
                  </button>
                ) : (
                  <button
                    onClick={() => navigate(`/doctor-chat/${consultation.id}`)}
                    className="px-4 py-2 border border-primary text-primary rounded-lg text-sm flex-shrink-0"
                  >
                    继续
                  </button>
                )}
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

### 2. 医生聊天页面返回按钮修复

**文件：`frontend/src/pages/doctor/Chat/ChatHeader.tsx`**

修复返回按钮导航，明确导航到问诊列表：

```typescript
// 修改前
onClick={() => navigate(-1)}

// 修改后
onClick={() => navigate('/doctor/tasks')}
```

### 3. 结束问诊导航修复

**文件：`frontend/src/pages/doctor/Chat/index.tsx`**

修改结束问诊后的导航路径：

```typescript
// 修改前（第 199 行）
navigate('/doctor/console');

// 修改后
navigate('/doctor/tasks');
```

---

## 第五部分：测试要点

### 一、API 单元测试

**1. WebSocket 广播方法测试**

**文件：`backend/src/services/websocket/__tests__/WebSocketManager.test.ts`**

```typescript
describe('WebSocketManager - broadcastConsultationUpdate', () => {
  it('应该向医生和患者发送问诊更新消息', async () => {
    // Arrange
    const mockDoctorWs = createMockWebSocket('doctor-id');
    const mockPatientWs = createMockWebSocket('patient-id');

    const consultation = {
      id: 'consultation-123',
      doctorId: 'doctor-id',
      patientId: 'patient-id',
      status: 'active',
      lastMessage: '最新消息',
      lastMessageTime: '2026-01-26T10:30:00Z',
      updatedAt: '2026-01-26T10:30:00Z',
    };

    // Act
    wsManager.broadcastConsultationUpdate('consultation-123');

    // Assert
    expect(mockDoctorWs.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"consultation_update"')
    );
    expect(mockPatientWs.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"consultation_update"')
    );
  });

  it('当问诊不存在时不应该崩溃', () => {
    expect(() => {
      wsManager.broadcastConsultationUpdate('non-existent-id');
    }).not.toThrow();
  });

  it('当用户未连接时不应发送消息', () => {
    const consultation = {
      id: 'consultation-123',
      doctorId: 'offline-doctor',
      patientId: 'offline-patient',
      status: 'active',
    };

    expect(() => {
      wsManager.broadcastConsultationUpdate('consultation-123');
    }).not.toThrow();
  });
});
```

**2. consultationStore 测试**

**文件：`frontend/src/store/__tests__/consultationStore.test.ts`**

```typescript
import { consultationStore } from '../consultationStore';

describe('ConsultationStore', () => {
  beforeEach(() => {
    consultationStore.consultations = [];
  });

  describe('updateConsultation', () => {
    it('应该更新现有问诊的消息', () => {
      consultationStore.consultations = [{
        id: 'c1',
        patientId: 'p1',
        doctorId: 'd1',
        status: 'active',
        patientPhone: '138****0000',
        createdAt: '2026-01-26T10:00:00Z',
        updatedAt: '2026-01-26T10:00:00Z',
        lastMessage: '旧消息',
      }];

      consultationStore.updateConsultation({
        id: 'c1',
        lastMessage: '新消息',
        lastMessageTime: '2026-01-26T10:05:00Z',
      });

      expect(consultationStore.consultations[0].lastMessage).toBe('新消息');
      expect(consultationStore.consultations[0].lastMessageTime).toBe('2026-01-26T10:05:00Z');
    });

    it('应该添加新问诊到列表开头', () => {
      consultationStore.consultations = [{
        id: 'c1',
        patientId: 'p1',
        doctorId: 'd1',
        status: 'active',
        patientPhone: '138****0000',
        createdAt: '2026-01-26T10:00:00Z',
        updatedAt: '2026-01-26T10:00:00Z',
      }];

      consultationStore.updateConsultation({
        id: 'c2',
        patientId: 'p2',
        doctorId: 'd1',
        status: 'pending',
        patientPhone: '139****0000',
        createdAt: '2026-01-26T10:10:00Z',
        updatedAt: '2026-01-26T10:10:00Z',
      });

      expect(consultationStore.consultations).toHaveLength(2);
      expect(consultationStore.consultations[0].id).toBe('c2');
    });

    it('不应该添加已关闭的问诊', () => {
      consultationStore.updateConsultation({
        id: 'c-closed',
        patientId: 'p1',
        doctorId: 'd1',
        status: 'closed',
        patientPhone: '138****0000',
        createdAt: '2026-01-26T10:00:00Z',
        updatedAt: '2026-01-26T10:00:00Z',
      });

      expect(consultationStore.consultations).toHaveLength(0);
    });
  });

  describe('removeConsultation', () => {
    it('应该从列表中移除指定问诊', () => {
      consultationStore.consultations = [
        { id: 'c1', patientId: 'p1', doctorId: 'd1', status: 'closed', patientPhone: '', createdAt: '', updatedAt: '' },
        { id: 'c2', patientId: 'p2', doctorId: 'd1', status: 'active', patientPhone: '', createdAt: '', updatedAt: '' },
      ];

      consultationStore.removeConsultation('c1');

      expect(consultationStore.consultations).toHaveLength(1);
      expect(consultationStore.consultations[0].id).toBe('c2');
    });
  });
});
```

### 二、边界 Case 测试

**1. 并发消息测试**

```typescript
describe('并发消息处理', () => {
  it('应该正确处理同时发送的多条消息', async () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({
      content: `消息 ${i + 1}`,
      consultationId: 'c1',
    }));

    await Promise.all(messages.map(msg =>
      ws.send(JSON.stringify({
        type: 'message',
        conversationId: msg.consultationId,
        data: { content: msg.content },
      }))
    ));

    const storedMessages = messageStore.getByConsultationId('c1');
    expect(storedMessages).toHaveLength(10);
  });

  it('lastMessage 应该是最后一条消息', async () => {
    const consultation = consultationStore.getById('c1');

    for (let i = 1; i <= 3; i++) {
      await handleChatMessage('doctor-id', {
        type: 'message',
        conversationId: 'c1',
        data: { content: `消息 ${i}` },
      });
    }

    const updated = consultationStore.getById('c1');
    expect(updated?.lastMessage).toBe('消息 3');
  });
});
```

**2. 网络异常测试**

```typescript
describe('网络异常场景', () => {
  it('WebSocket 断线后重连应恢复通知', async () => {
    const ws = new WebSocketService(url, token);
    await ws.connect();
    let updateReceived = false;

    ws.onConsultationUpdate(() => {
      updateReceived = true;
    });

    ws.ws.close();
    await ws.connect();
    wsManager.broadcastConsultationUpdate('c1');

    await waitFor(() => expect(updateReceived).toBe(true));
  });

  it('HTTP 请求失败应显示错误提示', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      })
    );

    await consultationStore.loadConsultations();

    expect(consultationStore.error).toBe('加载问诊列表失败');
  });
});
```

**3. 状态边界测试**

```typescript
describe('状态边界场景', () => {
  it('pending -> active 状态转换应正确通知', async () => {
    const consultation = {
      id: 'c1',
      status: 'pending',
      doctorId: 'd1',
      patientId: 'p1',
    };
    consultationStore.createConsultation(consultation);

    let notifiedStatus = '';
    ws.onConsultationUpdate((data) => {
      notifiedStatus = data.status;
    });

    await acceptConsultation('d1', 'c1');

    expect(notifiedStatus).toBe('active');
  });

  it('active -> closed 状态转换应从列表移除', async () => {
    consultationStore.consultations = [{
      id: 'c1',
      status: 'active',
      patientId: 'p1',
      doctorId: 'd1',
      patientPhone: '138****0000',
      createdAt: '',
      updatedAt: '',
    }];

    await closeConsultation('d1', 'c1');
    wsManager.broadcastConsultationUpdate('c1');

    expect(consultationStore.consultations).toHaveLength(0);
  });

  it('cancelled 状态的问诊不应出现在列表', async () => {
    consultationStore.consultations = [{
      id: 'c1',
      status: 'pending',
      patientId: 'p1',
      doctorId: 'd1',
      patientPhone: '138****0000',
      createdAt: '',
      updatedAt: '',
    }];

    consultationStore.updateConsultation({ id: 'c1', status: 'cancelled' });

    expect(consultationStore.filteredConsultations).toHaveLength(0);
  });
});
```

### 三、端到端测试（完整用户流程）

**文件：`backend/src/__tests__/e2e/consultation-realtime-update.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { TestApiClient } from '../helpers/testApiClient';
import { WebSocketClient } from '../helpers/websocketClient';

describe('专家会诊实时更新 - 完整流程', () => {
  let patientClient: TestApiClient;
  let doctorClient: TestApiClient;
  let patientWs: WebSocketClient;
  let doctorWs: WebSocketClient;
  let consultationId: string;

  beforeAll(async () => {
    patientClient = new TestApiClient();
    doctorClient = new TestApiClient();

    await patientClient.registerAndLogin('13800138000', 'password123');
    const patientToken = patientClient.getToken();

    await doctorClient.registerAndLogin('13800138001', 'password123', 'doctor');
    const doctorToken = doctorClient.getToken();

    patientWs = new WebSocketClient(patientToken);
    doctorWs = new WebSocketClient(doctorToken);

    await patientWs.connect();
    await doctorWs.connect();
  });

  afterAll(async () => {
    await patientWs.disconnect();
    await doctorWs.disconnect();
  });

  it('E2E-01: 患者发起问诊 -> 医生看到新问诊通知', async () => {
    let newConsultationReceived = false;
    doctorWs.onMessage((data) => {
      if (data.type === 'new_consultation') {
        newConsultationReceived = true;
        consultationId = data.consultation.id;
      }
    });

    const response = await patientClient.post('/api/consultations', {
      doctorId: doctorClient.getUserId(),
    });

    expect(response.code).toBe(0);
    expect(response.data.doctorId).toBe(doctorClient.getUserId());

    await waitFor(() => expect(newConsultationReceived).toBe(true), { timeout: 3000 });
  });

  it('E2E-02: 患者发送消息 -> 医生问诊列表实时更新 lastMessage', async () => {
    await doctorWs.send({
      type: 'join',
      conversationId: consultationId,
    });

    let lastMessageReceived = '';
    doctorWs.onMessage((data) => {
      if (data.type === 'consultation_update') {
        lastMessageReceived = data.consultation.lastMessage;
      }
    });

    const testMessage = '医生你好，我头疼';
    await patientWs.send({
      type: 'message',
      conversationId: consultationId,
      data: { content: testMessage },
    });

    await waitFor(() => expect(lastMessageReceived).toBe(testMessage), { timeout: 3000 });

    const doctorConsultations = await doctorClient.get('/api/consultations/doctor');
    const consultation = doctorConsultations.data.find((c: any) => c.id === consultationId);
    expect(consultation.lastMessage).toBe(testMessage);
  });

  it('E2E-03: 医生接诊 -> 患者收到状态更新通知', async () => {
    let statusReceived = '';
    patientWs.onMessage((data) => {
      if (data.type === 'consultation_update') {
        statusReceived = data.consultation.status;
      }
    });

    const response = await doctorClient.put(`/api/consultations/${consultationId}/accept`);

    expect(response.data.status).toBe('active');

    await waitFor(() => expect(statusReceived).toBe('active'), { timeout: 3000 });
  });

  it('E2E-04: 医生回复消息 -> 患者收到消息且 lastMessage 更新', async () => {
    let messageReceived = '';
    patientWs.onMessage((data) => {
      if (data.type === 'message') {
        messageReceived = data.message.content;
      }
    });

    const doctorReply = '你好，请问持续多久了？';
    await doctorWs.send({
      type: 'message',
      conversationId: consultationId,
      data: { content: doctorReply },
    });

    await waitFor(() => expect(messageReceived).toBe(doctorReply), { timeout: 3000 });

    const messages = await patientClient.get(`/api/consultations/${consultationId}/messages`);
    expect(messages.data.some((m: any) => m.content === doctorReply)).toBe(true);
  });

  it('E2E-06: 医生结束问诊 -> 导航到问诊列表 -> 问诊不再显示', async () => {
    const response = await doctorClient.put(`/api/consultations/${consultationId}/close`);
    expect(response.data.status).toBe('closed');

    let doctorStatusReceived = '';
    let patientStatusReceived = '';

    doctorWs.onMessage((data) => {
      if (data.type === 'consultation_update') {
        doctorStatusReceived = data.consultation.status;
      }
    });

    patientWs.onMessage((data) => {
      if (data.type === 'consultation_update') {
        patientStatusReceived = data.consultation.status;
      }
    });

    await waitFor(() => {
      expect(doctorStatusReceived).toBe('closed');
      expect(patientStatusReceived).toBe('closed');
    }, { timeout: 3000 });

    const doctorConsultations = await doctorClient.get('/api/consultations/doctor');
    expect(doctorConsultations.data.every((c: any) => c.id !== consultationId)).toBe(true);
  });

  it('E2E-07: 多医生并发场景 - 互不干扰', async () => {
    const doctor2Client = new TestApiClient();
    await doctor2Client.registerAndLogin('13800138002', 'password123', 'doctor');

    const c1 = await patientClient.post('/api/consultations', {
      doctorId: doctorClient.getUserId(),
    });

    const c2 = await patientClient.post('/api/consultations', {
      doctorId: doctor2Client.getUserId(),
    });

    await Promise.all([
      doctorClient.put(`/api/consultations/${c1.data.id}/accept`),
      doctor2Client.put(`/api/consultations/${c2.data.id}/accept`),
    ]);

    const d1Consultations = await doctorClient.get('/api/consultations/doctor');
    const d2Consultations = await doctor2Client.get('/api/consultations/doctor');

    expect(d1Consultations.data.some((c: any) => c.id === c1.data.id)).toBe(true);
    expect(d1Consultations.data.some((c: any) => c.id === c2.data.id)).toBe(false);

    expect(d2Consultations.data.some((c: any) => c.id === c2.data.id)).toBe(true);
    expect(d2Consultations.data.some((c: any) => c.id === c1.data.id)).toBe(false);
  });

  it('E2E-08: WebSocket 断线重连 - 消息不丢失', async () => {
    const testMessage = '测试断线消息';

    await doctorWs.disconnect();

    await patientWs.send({
      type: 'message',
      conversationId: consultationId,
      data: { content: testMessage },
    });

    await doctorWs.connect();
    await doctorWs.send({
      type: 'join',
      conversationId: consultationId,
    });

    const messages = await doctorClient.get(`/api/consultations/${consultationId}/messages`);
    expect(messages.data.some((m: any) => m.content === testMessage)).toBe(true);
  });
});
```

---

## 第六部分：实现步骤清单

### 后端实现步骤

| 步骤 | 文件 | 任务描述 | 优先级 |
|-----|------|---------|--------|
| B1 | `backend/src/services/websocket/types.ts` | 在 `WSMessageType` 枚举中添加 `CONSULTATION_UPDATE` 和 `NEW_CONSULTATION` | P0 |
| B2 | `backend/src/services/websocket/WebSocketManager.ts` | 添加 `broadcastConsultationUpdate(consultationId)` 方法 | P0 |
| B3 | `backend/src/services/websocket/WebSocketManager.ts` | 在 `handleChatMessage` 中调用 `broadcastConsultationUpdate` | P0 |
| B4 | `backend/src/controllers/consultationController.ts` | 在 `acceptConsultation` 中调用 `broadcastConsultationUpdate` | P0 |
| B5 | `backend/src/controllers/consultationController.ts` | 在 `closeConsultation` 中调用 `broadcastConsultationUpdate` | P0 |
| B6 | `backend/src/services/websocket/__tests__/WebSocketManager.test.ts` | 添加 `broadcastConsultationUpdate` 的单元测试 | P1 |
| B7 | `backend/src/__tests__/e2e/consultation-realtime-update.test.ts` | 添加实时更新的端到端测试 | P1 |

### 前端实现步骤

| 步骤 | 文件 | 任务描述 | 优先级 |
|-----|------|---------|--------|
| F1 | `frontend/src/store/consultationStore.ts` | 创建 MobX consultationStore | P0 |
| F2 | `frontend/src/services/websocket.ts` | 添加 `onConsultationUpdate` 监听器 | P0 |
| F3 | `frontend/src/pages/DoctorTasks/index.tsx` | 改用 `consultationStore`，添加 WebSocket 监听 | P0 |
| F4 | `frontend/src/pages/doctor/Chat/ChatHeader.tsx` | 修复返回按钮导航：`navigate(-1)` → `navigate('/doctor/tasks')` | P0 |
| F5 | `frontend/src/pages/doctor/Chat/index.tsx` | 修复结束问诊导航：`navigate('/doctor/console')` → `navigate('/doctor/tasks')` | P0 |
| F6 | `frontend/src/store/__tests__/consultationStore.test.ts` | 添加 consultationStore 单元测试 | P1 |
| F7 | (前端 E2E) | 添加导航流程的端到端测试 | P1 |

### 实施顺序建议

**第一批（核心功能，必须完成）：**
- B1, B2, B3, B4, B5 → 后端实时通知机制
- F1, F2, F3 → 前端状态管理
- F4, F5 → 导航修复

**第二批（测试验证，确保质量）：**
- B6, B7 → 后端测试
- F6 → 前端单元测试
- (前端 E2E) → 前端端到端测试

---

## 附录：相关文件清单

### 后端文件
- `backend/src/services/websocket/types.ts` - WebSocket 类型定义
- `backend/src/services/websocket/WebSocketManager.ts` - WebSocket 管理器
- `backend/src/controllers/consultationController.ts` - 问诊控制器
- `backend/src/services/storage/consultationStore.ts` - 问诊存储
- `backend/src/services/storage/messageStore.ts` - 消息存储

### 前端文件
- `frontend/src/store/consultationStore.ts` - 问诊状态管理（新增）
- `frontend/src/services/websocket.ts` - WebSocket 服务
- `frontend/src/pages/DoctorTasks/index.tsx` - 医生问诊列表
- `frontend/src/pages/doctor/Chat/index.tsx` - 医生聊天页面
- `frontend/src/pages/doctor/Chat/ChatHeader.tsx` - 聊天页面头部

---

**最后更新**：2026-01-26
