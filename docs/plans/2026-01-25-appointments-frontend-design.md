# 预约挂号模块设计文档

**创建日期**：2026-01-25

## 概述

实现预约挂号功能的前端页面，串联完整预约流程，后端数据暂时使用 Mock。

## 页面流程

```
底部导航[挂号] → 选择医生 → 选择时间 → 确认预约 → 我的预约列表
                                        ↓
我的预约[点击详情] → 预约详情页[可取消]
```

## 页面结构

| 路由 | 组件 | 功能 |
|------|------|------|
| `/appointments` | `index.tsx` | 我的预约列表，Tabs 切换（待确认/已确认/已完成/已取消） |
| `/appointments/doctors` | `Doctors.tsx` | 按科室分组展示医生列表，卡片式设计 |
| `/appointments/schedule` | `Schedule.tsx` | 日期滑块 + 时间段选择 |
| `/appointments/confirm` | `Confirm.tsx` | 确认预约信息，提交预约 |
| `/appointments/:id` | `AppointmentDetail.tsx` | 预约详情展示，取消预约 |

## API 端点（后端已实现）

```
GET    /api/appointments/schedule  - 获取医生排班
POST   /api/appointments           - 创建预约
GET    /api/appointments           - 获取我的预约列表
GET    /api/appointments/:id       - 获取预约详情
PUT    /api/appointments/:id/cancel - 取消预约
```

## 技术实现

### 文件结构

```
frontend/src/
├── services/
│   └── appointment.ts    # API 服务层
├── store/
│   └── appointmentStore.ts  # MobX 状态管理
└── pages/
    └── Appointments/
        ├── index.tsx          # 改造为列表页
        ├── Doctors.tsx        # 医生选择页（新增）
        ├── Schedule.tsx       # 时间选择页（新增）
        ├── Confirm.tsx        # 确认页（新增）
        └── AppointmentDetail.tsx  # 详情页（新增）
```

### 状态管理 (appointmentStore)

```typescript
class AppointmentStore {
  // 当前预约流程状态
  selectedDoctor: Doctor | null = null;
  selectedDate: string = '';
  selectedTimeSlot: string = '';
  appointmentDateRange: string[] = []; // 未来7天

  // 预约列表
  appointments: Appointment[] = [];
  loading = false;

  // Actions
  selectDoctor(doctor: Doctor)
  selectDate(date: string)
  selectTimeSlot(slot: string)
  createAppointment()
  cancelAppointment(id: string)
  fetchAppointments()
  resetFlow()
}
```

### UI 设计

#### 医生选择页 (Doctors.tsx)
- 按科室分组折叠卡片
- 每个医生显示：名字、职称、医院、科室、评分、可约状态
- 点击医生进入时间选择

#### 时间选择页 (Schedule.tsx)
- 横向日期滑块（未来7天）
- 点击日期后显示可用时间段（09:00, 09:30...）
- 选中状态高亮

#### 确认页 (Confirm.tsx)
- 展示：医生姓名、医院、科室、预约时间
- 确认按钮提交预约

#### 我的预约列表 (index.tsx)
- Tabs：待确认 / 已确认 / 已完成 / 已取消
- 列表项显示：医生、日期时间、状态
- 点击进入详情

#### 预约详情页 (AppointmentDetail.tsx)
- 完整预约信息展示
- 待确认状态可取消

## Mock 数据

后端已有 Mock 数据：
- 4 位医生（心内科、呼吸内科、消化内科、神经内科）
- 未来7天排班（每天约6-10个时段）

## 实施顺序

1. 创建 API 服务层 (appointment.ts)
2. 创建状态管理 (appointmentStore.ts)
3. 改造我的预约列表页
4. 实现医生选择页
5. 实现时间选择页
6. 实现确认页
7. 实现预约详情页
8. 更新路由配置
