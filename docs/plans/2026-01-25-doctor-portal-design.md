# 医生端界面重新设计

**项目名称**: 小荷AI医生 - 医生端
**版本**: MVP v1.0
**创建日期**: 2026-01-25
**状态**: 设计阶段

---

## 1. 背景与问题

### 1.1 当前问题

目前医生端的界面与患者端相同，都是去选择专家进行会诊。这不符合实际使用场景：

- **功能错位**：医生不应该去选择其他医生进行会诊
- **缺失功能**：没有待处理问诊列表、排班管理、预约管理等核心功能
- **角色混淆**：医生端和患者端界面相同，用户体验混乱

### 1.2 设计目标

创建符合医生实际工作流程的专业界面，包含：

1. **问诊管理**：查看和处理分配给自己的待处理问诊
2. **排班管理**：设置可预约时段
3. **预约管理**：查看、确认/取消患者对自己的预约

---

## 2. 技术方案

### 2.1 架构选择

采用**单应用多角色**架构：

- **优点**：共享组件和状态管理，统一的构建部署流程，减少代码重复
- **实现**：根据用户角色（`patient`/`doctor`）渲染不同界面

### 2.2 技术栈

- **前端**：React 18 + TypeScript + Vite + MobX
- **后端**：Node.js + Express + TypeScript
- **存储**：内存存储（MVP阶段），可无缝迁移到 PostgreSQL
- **实时通讯**：WebSocket（已实现，复用）

---

## 3. 路由设计

### 3.1 整体路由结构

```
/                           # 根路由，根据用户角色重定向
├── /patient/*              # 患者端路由（现有）
│   ├── /ai-chat
│   ├── /doctors
│   └── /appointments
│
└── /doctor/*               # 医生端路由（新增）
    ├── /console            # 工作台首页
    ├── /chat/:id           # 问诊聊天页
    ├── /schedule           # 排班管理
    └── /appointments       # 预约管理
```

### 3.2 路由守卫实现

```typescript
// router.tsx

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRole: 'patient' | 'doctor';
}

const ProtectedRoute = ({ children, allowedRole }: ProtectedRouteProps) => {
  const { user } = useUserStore();

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (user.role !== allowedRole) {
    // 重定向到对应角色的工作台
    return <Navigate to={`/${user.role}/console`} />;
  }

  return children;
};

// 医生端路由配置
const doctorRoutes = (
  <Route path="/doctor" element={<DoctorLayout />}>
    <Route path="console" element={
      <ProtectedRoute allowedRole="doctor">
        <DoctorConsole />
      </ProtectedRoute>
    } />
    <Route path="chat/:id" element={
      <ProtectedRoute allowedRole="doctor">
        <DoctorChat />
      </ProtectedRoute>
    } />
    <Route path="schedule" element={
      <ProtectedRoute allowedRole="doctor">
        <ScheduleManagement />
      </ProtectedRoute>
    } />
    <Route path="appointments" element={
      <ProtectedRoute allowedRole="doctor">
        <AppointmentManagement />
      </ProtectedRoute>
    } />
  </Route>
);
```

### 3.3 底部导航栏

医生端的底部导航与患者端不同：

| 图标 | 标签 | 功能 |
|------|------|------|
| `grid_view` | 工作台 | 待处理问诊列表（带红点提示数量） |
| `chat_bubble` | 消息 | 当前进行中的问诊 |
| `person` | 我的 | 个人信息、设置、退出登录 |

---

## 4. 页面设计

### 4.1 工作台首页（DoctorConsole）

#### 页面布局

工作台首页分为三个区域：

**1. 顶部状态栏**
- 医生头像 + 姓名 + 职称 + 科室标签
- 在线/忙碌状态切换开关
- 状态变更调用 `PUT /api/doctors/status` 更新 `is_available`

**2. 统计概览卡片（3列）**
- 今日接诊数：当天 `status` 为 `closed` 的问诊数量
- 待处理数：`GET /api/consultations/pending` 返回的数量
- 今日收入：当天完成的问诊费用总和（MVP阶段用Mock数据）

**3. 待处理问诊列表**

调用 `GET /api/consultations/pending` 获取数据，问诊卡片显示：

```
┌─────────────────────────────────────┐
│ 李** (男, 32岁)      [等待 12 min]  │
│ 症状: 持续高烧不退，伴有咽喉肿痛...    │
│                    [立即接诊]       │
└─────────────────────────────────────┘
```

紧急程度标识：
- **红色边框**：等待时间 > 15分钟
- **橙色边框**：等待时间 > 5分钟
- **灰色边框**：等待时间 ≤ 5分钟

#### 数据流实现

```typescript
// pages/doctor/Console/index.tsx

const DoctorConsole: React.FC = () => {
  const { user } = useUserStore();
  const { pendingConsultations, stats, isLoading } = useDoctorStore();
  const navigate = useNavigate();

  useEffect(() => {
    doctorStore.fetchPendingConsultations();
    doctorStore.fetchStats();

    // 每30秒刷新待处理问诊（后续改为WebSocket推送）
    const interval = setInterval(() => {
      doctorStore.fetchPendingConsultations();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleAcceptConsultation = async (consultationId: string) => {
    await doctorAPI.acceptConsultation(consultationId);
    navigate(`/doctor/chat/${consultationId}`);
  };

  return (
    <div className="doctor-console">
      <DoctorHeader doctor={user} />
      <StatsCards stats={stats} />
      <ConsultationList
        consultations={pendingConsultations}
        onAccept={handleAcceptConsultation}
        isLoading={isLoading}
      />
    </div>
  );
};
```

---

### 4.2 问诊聊天页（DoctorChat）

#### 页面布局

**1. 顶部导航栏**
- 返回按钮 → 返回工作台
- 「接诊中」标题 + 患者在线状态指示器
- 更多操作按钮（查看患者资料、历史问诊）

**2. 患者信息横幅**

显示患者基本信息（脱敏）：
- 姓名（如：张**）
- 性别
- 年龄

**3. 聊天区域**

复用现有的聊天组件：
- 患者消息：左侧灰色气泡
- 医生消息：右侧蓝色主色气泡
- 特殊消息：AI 初步问诊报告

**4. 底部操作区**

医生独有快捷操作栏：
- **查看病历**：显示患者历史问诊记录
- **开具处方**：打开处方编辑弹窗（可选功能）
- **结束问诊**：调用 `PUT /api/consultations/:id/close`

#### WebSocket 连接

```typescript
// pages/doctor/Chat/index.tsx

const DoctorChat: React.FC = () => {
  const { consultationId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const { user } = useUserStore();

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:3000/doctor-chat?token=${getToken()}`);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'join',
        consultationId,
        userId: user.userId
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'message' && data.conversationId === consultationId) {
        setMessages(prev => [...prev, data.message]);
      }
    };

    return () => ws.close();
  }, [consultationId]);

  const handleEndConsultation = async () => {
    await doctorAPI.closeConsultation(consultationId!);
    navigate('/doctor/console');
  };

  return (
    <div className="doctor-chat">
      <ChatHeader />
      <PatientInfoBanner />
      <ChatArea messages={messages} />
      <ChatInput
        onSend={(content) => {/* 发送消息 */}}
        doctorActions={{
          onViewHistory: () => {/* 查看病历 */},
          onPrescribe: () => {/* 开具处方 */},
          onEndConsultation: handleEndConsultation
        }}
      />
    </div>
  );
};
```

#### AI 初步问诊报告

当患者从 AI 问诊转人工时，聊天区顶部显示 AI 生成的问诊报告卡片：

```
┌─────────────────────────────────────┐
│ 🤖 AI 初步问诊报告                  │
├─────────────────────────────────────┤
│ 主诉症状: 头痛发热两天...           │
│ 既往史: 无药物过敏史                │
│ 初步判断: 疑似上呼吸道感染          │
│                     [查看完整报告→]  │
└─────────────────────────────────────┘
```

实现方式：在消息中插入特殊类型的消息，`content_type` 为 `ai_report`。

---

### 4.3 排班管理（ScheduleManagement）

#### 功能说明

医生可以设置自己的可预约时段，患者预约时根据排班数据判断是否可预约。

#### 数据存储（内存）

```typescript
// backend/src/services/storage/scheduleStore.ts

/**
 * 排班存储服务
 *
 * 当前实现：内存存储 (Map)
 * 迁移目标：PostgreSQL doctor_schedules 表
 *
 * ========================================
 * 数据库迁移方案
 * ========================================
 *
 * 1. 创建数据库迁移文件
 *    backend/src/database/migrations/001_create_doctor_schedules.ts
 *
 * 2. SQL 建表语句
 *    CREATE TABLE doctor_schedules (
 *      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *      doctor_id UUID REFERENCES doctors(id) ON DELETE CASCADE,
 *      date DATE NOT NULL,
 *      time_slot VARCHAR(20) NOT NULL CHECK (time_slot IN ('morning', 'afternoon', 'evening')),
 *      is_available BOOLEAN DEFAULT true,
 *      max_patients INTEGER DEFAULT 10,
 *      created_at TIMESTAMPTZ DEFAULT NOW(),
 *      updated_at TIMESTAMPTZ DEFAULT NOW(),
 *      UNIQUE(doctor_id, date, time_slot)
 *    );
 *
 * 3. 创建索引
 *    CREATE INDEX idx_schedules_doctor_date ON doctor_schedules(doctor_id, date);
 *    CREATE INDEX idx_schedules_available ON doctor_schedules(is_available) WHERE is_available = true;
 *
 * 4. 迁移步骤
 *    a. 使用 Prisma/Kysely 创建 ORM 模型
 *    b. 替换 Map 操作为数据库查询
 *    c. 添加数据验证约束 (数据库级别)
 *    d. 前端无需修改，API 接口保持不变
 */

export interface DoctorSchedule {
  id: string;
  doctorId: string;
  date: string;        // YYYY-MM-DD
  timeSlot: 'morning' | 'afternoon' | 'evening';
  isAvailable: boolean;
  maxPatients: number;
}

class ScheduleStore {
  private schedules: Map<string, DoctorSchedule> = new Map();

  /**
   * 获取医生的排班列表
   *
   * 数据库迁移后替换为：
   * ```sql
   * SELECT * FROM doctor_schedules
   * WHERE doctor_id = $1
   * ORDER BY date ASC
   * ```
   */
  getByDoctorId(doctorId: string): DoctorSchedule[] {
    return Array.from(this.schedules.values())
      .filter(s => s.doctorId === doctorId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 设置排班（创建或更新）
   *
   * 数据库迁移后替换为：
   * ```sql
   * INSERT INTO doctor_schedules (doctor_id, date, time_slot, is_available, max_patients)
   * VALUES ($1, $2, $3, $4, $5)
   * ON CONFLICT (doctor_id, date, time_slot)
   * DO UPDATE SET is_available = $4, max_patients = $5, updated_at = NOW()
   * RETURNING *
   * ```
   */
  setSchedule(schedule: Omit<DoctorSchedule, 'id'>): DoctorSchedule {
    const key = `${schedule.doctorId}-${schedule.date}-${schedule.timeSlot}`;
    const existing = Array.from(this.schedules.values()).find(s =>
      s.doctorId === schedule.doctorId &&
      s.date === schedule.date &&
      s.timeSlot === schedule.timeSlot
    );

    if (existing) {
      const updated = { ...existing, ...schedule };
      this.schedules.set(existing.id, updated);
      return updated;
    }

    const newSchedule: DoctorSchedule = {
      id: uuidv4(),
      ...schedule
    };
    this.schedules.set(newSchedule.id, newSchedule);
    return newSchedule;
  }

  /**
   * 删除排班
   */
  deleteSchedule(doctorId: string, date: string, timeSlot: string): boolean {
    const schedule = Array.from(this.schedules.values()).find(s =>
      s.doctorId === doctorId &&
      s.date === date &&
      s.timeSlot === timeSlot
    );
    if (schedule) {
      return this.schedules.delete(schedule.id);
    }
    return false;
  }

  /**
   * 数据迁移辅助方法
   */
  exportForMigration(): DoctorSchedule[] {
    return Array.from(this.schedules.values());
  }
}

export const scheduleStore = new ScheduleStore();
```

#### API 端点

```
GET  /api/doctors/schedules          # 获取医生排班列表
POST /api/doctors/schedules          # 设置排班（创建或更新）
DELETE /api/doctors/schedules/:id    # 删除排班
```

#### 前端页面设计

**1. 日历视图**
- 显示当月日历，可切换月份
- 可用的日期标记为蓝色，不可用标记为灰色
- 点击日期显示该日的时段设置

**2. 时段设置**

每日分为三个时段：
- 上午 (8:00-12:00)
- 下午 (14:00-18:00)
- 晚上 (18:00-21:00)

每个时段可设置：
- 是否可预约
- 最大预约人数

**3. 批量操作**
- 工作日批量设置
- 节假日批量关闭

---

### 4.4 预约管理（AppointmentManagement）

医生端预约管理页面显示患者对自己的预约列表。

#### 功能

**1. 预约列表**
- 调用 `GET /api/appointments?doctorId={doctorId}` 获取
- 显示预约日期、时段、患者信息（脱敏）
- 状态筛选：待确认、已确认、已取消

**2. 操作**
- 确认预约：`PUT /api/appointments/:id/confirm`
- 取消预约：`PUT /api/appointments/:id/cancel`

---

## 5. 前端组件设计

### 5.1 目录结构

```
frontend/src/
├── pages/
│   ├── patient/                 # 患者端页面（现有）
│   └── doctor/                  # 医生端页面（新增）
│       ├── Console/
│       │   ├── index.tsx               # 工作台首页
│       │   ├── StatsCards.tsx          # 统计卡片
│       │   ├── ConsultationList.tsx    # 问诊列表
│       │   └── index.module.css
│       ├── Chat/
│       │   ├── index.tsx               # 聊天页面
│       │   ├── PatientInfo.tsx         # 患者信息横幅
│       │   └── AIReportCard.tsx        # AI报告卡片
│       ├── Schedule/
│       │   ├── index.tsx               # 排班管理
│       │   ├── CalendarView.tsx        # 日历视图
│       │   ├── TimeSlotEditor.tsx      # 时段编辑器
│       │   └── index.module.css
│       └── Appointments/
│           ├── index.tsx               # 预约管理
│           ├── AppointmentCard.tsx     # 预约卡片
│           └── index.module.css
│
├── components/
│   ├── shared/                  # 共享组件
│   │   ├── ChatMessage/
│   │   ├── ChatInput/
│   │   └── Header/
│   └── doctor/                  # 医生端专属组件
│       ├── DoctorHeader/
│       ├── ConsultationCard/
│       └── ScheduleCalendar/
│
├── store/
│   ├── userStore.ts             # 用户状态（现有，扩展role字段）
│   ├── chatStore.ts             # 聊天状态（现有）
│   └── doctorStore.ts           # 医生端状态（新增）
│
└── services/
    └── api.ts                   # API封装（扩展医生端接口）
```

### 5.2 医生端状态管理

```typescript
// store/doctorStore.ts

import { makeAutoObservable } from 'mobx';

class DoctorStore {
  isOnline = true;
  pendingConsultations: Consultation[] = [];
  stats = { today: 0, pending: 0, income: 0 };
  schedules: DoctorSchedule[] = [];
  isLoading = false;

  constructor() {
    makeAutoObservable(this);
  }

  setOnlineStatus(online: boolean) {
    this.isOnline = online;
    this.syncStatusToServer();
  }

  async fetchPendingConsultations() {
    this.isLoading = true;
    try {
      const res = await fetch('/api/consultations/pending', {
        headers: { Authorization: `Bearer ${getToken()}` }
      });
      const { data } = await res.json();
      this.pendingConsultations = data;
      this.stats.pending = data.length;
    } finally {
      this.isLoading = false;
    }
  }

  async fetchStats() {
    // TODO: 实现统计数据获取
    this.stats = {
      today: 18,
      pending: this.pendingConsultations.length,
      income: 1280,
    };
  }

  async fetchSchedules(date?: string) {
    const url = date
      ? `/api/doctors/schedules?date=${date}`
      : '/api/doctors/schedules';
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const { data } = await res.json();
    this.schedules = data;
  }

  private async syncStatusToServer() {
    await fetch('/api/doctors/status', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`
      },
      body: JSON.stringify({ isAvailable: this.isOnline })
    });
  }
}

export const doctorStore = new DoctorStore();
```

### 5.3 共享组件复用

```typescript
// components/shared/ChatInput/index.tsx

interface ChatInputProps {
  onSend: (content: string) => void;
  placeholder?: string;
  // 医生端专属
  doctorActions?: {
    onViewHistory?: () => void;
    onPrescribe?: () => void;
    onEndConsultation?: () => void;
  };
  // 患者端专属
  patientActions?: {
    onUploadImage?: () => void;
  };
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  placeholder = '输入消息...',
  doctorActions,
  patientActions,
}) => {
  const [input, setInput] = useState('');

  return (
    <div className="chat-input-container">
      {doctorActions && (
        <div className="doctor-actions">
          <button onClick={doctorActions.onViewHistory}>查看病历</button>
          <button onClick={doctorActions.onPrescribe}>开具处方</button>
          <button onClick={doctorActions.onEndConsultation} className="danger">
            结束问诊
          </button>
        </div>
      )}

      <div className="input-wrapper">
        {patientActions?.onUploadImage && (
          <button onClick={patientActions.onUploadImage}>上传图片</button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
        />
        <button onClick={() => onSend(input)}>发送</button>
      </div>
    </div>
  );
};
```

### 5.4 API 服务封装

```typescript
// services/api.ts

// 医生端专属接口
export const doctorAPI = {
  // 获取待处理问诊
  getPendingConsultations: () =>
    request.get<Consultation[]>('/api/consultations/pending'),

  // 接受问诊
  acceptConsultation: (id: string) =>
    request.put(`/api/consultations/${id}/accept`),

  // 结束问诊
  closeConsultation: (id: string) =>
    request.put(`/api/consultations/${id}/close`),

  // 获取排班
  getSchedules: (date?: string) =>
    request.get<DoctorSchedule[]>('/api/doctors/schedules', { params: { date } }),

  // 设置排班
  setSchedule: (data: Omit<DoctorSchedule, 'id'>) =>
    request.post('/api/doctors/schedules', data),

  // 删除排班
  deleteSchedule: (id: string) =>
    request.delete(`/api/doctors/schedules/${id}`),

  // 获取预约列表
  getAppointments: (status?: string) =>
    request.get<Appointment[]>('/api/appointments/doctor', { params: { status } }),

  // 确认预约
  confirmAppointment: (id: string) =>
    request.put(`/api/appointments/${id}/confirm`),

  // 取消预约
  cancelAppointment: (id: string) =>
    request.put(`/api/appointments/${id}/cancel`),
};
```

---

## 6. 安全性

### 6.1 权限控制

```typescript
// middleware/doctorAuth.ts

export const doctorAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ code: 401, message: '未登录' });
  }

  if (req.user.role !== 'doctor') {
    return res.status(403).json({ code: 403, message: '无权限访问' });
  }

  // 医生只能访问自己的数据
  if (req.params.doctorId && req.params.doctorId !== req.user.userId) {
    return res.status(403).json({ code: 403, message: '无权访问此数据' });
  }

  next();
};
```

### 6.2 数据脱敏

```typescript
// 患者信息在医生端显示时脱敏
interface PatientInfo {
  phone: string;        // 138****1234
  name: string;         // 张**
  idCard?: string;      // 不返回
}

function maskPhone(phone: string): string {
  return phone.slice(0, 3) + '****' + phone.slice(-4);
}

function maskName(name: string): string {
  if (name.length <= 2) return name[0] + '*';
  return name[0] + '*' + name[name.length - 1];
}
```

### 6.3 WebSocket 认证

```typescript
// WebSocket 连接时验证 Token
wsManager.on('connection', (ws, req) => {
  const token = req.query.token;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'doctor') {
      ws.close();
      return;
    }
    // 允许连接
  } catch {
    ws.close();
  }
});
```

---

## 7. 测试策略

### 7.1 单元测试

```typescript
// services/storage/__tests__/scheduleStore.test.ts

describe('ScheduleStore', () => {
  beforeEach(() => {
    scheduleStore.clear();
  });

  test('应该能够创建排班', () => {
    const schedule = scheduleStore.setSchedule({
      doctorId: 'doctor_1',
      date: '2026-01-26',
      timeSlot: 'morning',
      isAvailable: true,
      maxPatients: 10,
    });

    expect(schedule.id).toBeDefined();
    expect(schedule.isAvailable).toBe(true);
  });

  test('应该能够更新已有排班', () => {
    const created = scheduleStore.setSchedule({
      doctorId: 'doctor_1',
      date: '2026-01-26',
      timeSlot: 'morning',
      isAvailable: true,
      maxPatients: 10,
    });

    const updated = scheduleStore.setSchedule({
      doctorId: 'doctor_1',
      date: '2026-01-26',
      timeSlot: 'morning',
      isAvailable: false,
      maxPatients: 5,
    });

    expect(updated.id).toBe(created.id);
    expect(updated.isAvailable).toBe(false);
    expect(updated.maxPatients).toBe(5);
  });
});
```

### 7.2 集成测试

```typescript
// __tests__/integration/doctor-consultation.test.ts

describe('医生问诊流程', () => {
  test('医生应该能够查看待处理问诊', async () => {
    const loginRes = await loginAsDoctor();
    const res = await request(app)
      .get('/api/consultations/pending')
      .set('Authorization', `Bearer ${loginRes.token}`)
      .expect(200);

    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('医生应该能够接受问诊', async () => {
    const consultation = await createTestConsultation();
    const doctorRes = await loginAsDoctor();

    const res = await request(app)
      .put(`/api/consultations/${consultation.id}/accept`)
      .set('Authorization', `Bearer ${doctorRes.token}`)
      .expect(200);

    expect(res.body.data.status).toBe('active');
  });

  test('医生应该能够结束问诊', async () => {
    const consultation = await createActiveConsultation();
    const doctorRes = await loginAsDoctor();

    const res = await request(app)
      .put(`/api/consultations/${consultation.id}/close`)
      .set('Authorization', `Bearer ${doctorRes.token}`)
      .expect(200);

    expect(res.body.data.status).toBe('closed');
  });
});
```

### 7.3 E2E 测试

```typescript
// __tests__/e2e/doctor-workflow.test.ts

describe('医生端工作流 E2E', () => {
  test('完整问诊流程', async () => {
    // 1. 医生登录
    const doctor = await loginAsDoctor();

    // 2. 查看待处理问诊
    const pendingPage = await doctor.goto('/doctor/console');
    await expect(pendingPage.textContent()).resolves.toContain('待处理');

    // 3. 接受问诊
    await pendingPage.click('[data-testid="accept-button"]');
    await expect(page.url()).toContain('/doctor/chat/');

    // 4. 发送消息
    await page.fill('[data-testid="chat-input"]', '你好，请问有什么不舒服？');
    await page.click('[data-testid="send-button"]');

    // 5. 结束问诊
    await page.click('[data-testid="end-consultation"]');
    await expect(page.url()).toBe('/doctor/console');
  });
});
```

---

## 8. 实施计划

### 阶段 1：核心功能（MVP）

| 任务 | 状态 | 说明 |
|------|------|------|
| 后端 API - 待处理问诊列表 | ✅ 已实现 | `GET /api/consultations/pending` |
| 后端 API - 接受/结束问诊 | ✅ 已实现 | `PUT /api/consultations/:id/accept` |
| 前端 - 工作台首页 | ⏳ 待开发 | 路由、组件、状态管理 |
| 前端 - 问诊聊天页 | ⏳ 待开发 | 复用患者端组件 |
| 路由权限控制 | ⏳ 待开发 | 角色检测和重定向 |

### 阶段 2：排班管理

| 任务 | 状态 | 说明 |
|------|------|------|
| 后端 - scheduleStore 实现 | ⏳ 待开发 | 内存存储，含迁移注释 |
| 后端 - 排班 API | ⏳ 待开发 | CRUD 接口 |
| 前端 - 排班管理页面 | ⏳ 待开发 | 日历组件 |
| 前端 - 时段编辑器 | ⏳ 待开发 | 三时段开关 |

### 阶段 3：预约管理

| 任务 | 状态 | 说明 |
|------|------|------|
| 后端 - 医生端预约查询 API | ⏳ 待开发 | `GET /api/appointments/doctor` |
| 前端 - 预约管理页面 | ⏳ 待开发 | 列表、筛选 |
| 预约确认/取消功能 | ⏳ 待开发 | 操作按钮 |

### 阶段 4：优化与扩展

| 任务 | 优先级 | 说明 |
|------|--------|------|
| WebSocket 推送通知 | 高 | 新问诊实时提醒 |
| 统计数据真实化 | 中 | 今日接诊、收入计算 |
| 性能优化 | 中 | 虚拟滚动、缓存 |
| 数据库迁移 | 低 | PostgreSQL |

---

## 9. 技术债务

| 项目 | 当前状态 | 后续计划 |
|------|---------|---------|
| 数据存储 | 内存 Map | 迁移到 PostgreSQL（已预留迁移注释） |
| 统计数据 | Mock 数据 | 真实统计计算 |
| 推送通知 | 轮询（30秒） | WebSocket 推送 |
| 文件上传 | 未实现 | Supabase Storage |
| 处方功能 | 未实现 | 可选扩展功能 |

---

## 10. 数据库迁移检查清单

当准备从内存存储迁移到数据库时，按以下步骤操作：

```
□ 1. 创建数据库迁移文件
   backend/src/database/migrations/001_create_doctor_schedules.ts

□ 2. 执行建表 SQL 语句
   CREATE TABLE doctor_schedules (...);

□ 3. 创建 ORM 模型 (Prisma/Kysely)

□ 4. 修改 ScheduleStore 实现
   替换 Map 操作为数据库查询

□ 5. 编写数据迁移脚本
   导出现有内存数据并导入数据库

□ 6. 执行数据导入

□ 7. 运行集成测试验证
   确保功能正常

□ 8. 前端无需修改
   API 接口保持不变
```

---

## 附录：参考资料

- 现有设计文档：`docs/plans/2026-01-23-xiaohe-ai-doctor-design.md`
- 后端代码：`backend/src/`
- 前端设计稿：`frontendDesign/doctorConsole.html`、`doctorChat.html`
