# 医生推荐功能设计文档

**日期**：2026-01-29
**功能**：AI Agent 医生推荐卡片与挂号跳转
**状态**：设计完成，待实施

---

## 概述

当用户询问医生推荐时（例如："推荐北京协和医院看心脏好的医生"），AI Agent 应识别意图，查询知识库，并在聊天界面中返回医生推荐卡片，用户点击"立即挂号"按钮可直接跳转到预约页面。

---

## 第一部分：整体架构与数据流

### 架构概述

功能分为三层实现：

**1. Agent 层（后端）**
- 在用户询问医生推荐时，Agent 识别意图为 `hospital_recommend`
- 使用现有的 `knowledge_base` 工具查询医生信息
- 在 `finish` 工具中，将医生信息包装为 `recommend_doctor` 类型的 action
- Action 数据结构：
  ```typescript
  {
    type: 'recommend_doctor',
    label: '立即挂号',
    data: {
      doctorId: 'doctor_001',
      doctorName: '张医生',
      hospital: '北京协和医院',
      department: '心内科'
    }
  }
  ```

**2. 传输层**
- 通过 SSE 的 `message:metadata` 事件传输 actions
- 前端通过 MobX AgentView 接收并存储 actions

**3. 前端展示层**
- 创建 `MessageMetadataEvent` 和 `DoctorRecommendCard` 组件
- 根据 `actions` 中的 `recommend_doctor` 类型渲染医生卡片
- 点击按钮跳转到：`/appointments/book?doctorId=${data.doctorId}`

---

## 第二部分：Agent 层实现细节

### Agent 如何处理医生推荐

**1. 意图识别**
- 当用户消息包含"推荐医生"、"哪个医生好"、"看XX病找谁"等关键词时
- Intent Classifier 会将 `primaryIntent` 标记为 `hospital_recommend`

**2. 知识库查询**
- Agent 在 ReAct 循环中调用 `knowledge_base` 工具
- 查询参数示例：`"北京协和医院 心内科 医生推荐"`
- 知识库返回包含医生信息的文本

**3. 解析医生信息**
- Agent 需要从知识库返回的文本中提取结构化数据：
  - 医生姓名：`张医生`
  - 医生ID：`doctor_001`
  - 医院：`北京协和医院`
  - 科室：`心内科`

**4. 在 finish 工具中组装 action**
```typescript
await finish({
  summary: "用户询问北京协和医院心内科医生推荐",
  keyFindings: ["推荐张医生", "擅长冠心病和心律失常"],
  actions: [{
    type: 'recommend_doctor',
    label: '立即挂号',
    data: {
      doctorId: 'doctor_001',
      doctorName: '张医生',
      hospital: '北京协和医院',
      department: '心内科'
    }
  }],
  informationSources: ['knowledge_base']
}, context);
```

---

## 第三部分：前端展示层实现细节

### 前端架构说明

前端使用 **MobX + AgentView** 架构：

**数据流**：
```
SSE 事件
  → Conversation.handleSSEEvent()
  → AgentResponse.view.handleSSEEvent() (AgentView)
  → EventFactory.createFromSSE() 创建 Event
  → AgentView.events 数组
  → AgentViewRenderer 渲染
```

### 前端实现方案

**1. 创建 MessageMetadataEvent 类**
```typescript
// frontend/src/models/events/MessageMetadataEvent.ts
export interface MessageAction {
  type: 'recommend_doctor' | 'transfer_to_doctor' | 'book_appointment';
  label: string;
  data?: Record<string, any>;
}

export class MessageMetadataEvent extends Event {
  @observable actions: MessageAction[] = [];

  constructor(data: { id: string; actions: MessageAction[] }) {
    super(data.id, 'message_metadata');
    this.actions = data.actions;
    makeObservable(this);
  }
}
```

**2. 修改 EventFactory**
- 处理 `message_metadata` 事件（目前返回 null）
- 创建 `MessageMetadataEvent` 实例

**3. 修改 AgentView.groups**
- 将 `message_metadata` 归类到独立的分组类型

**4. 创建 DoctorRecommendCard 组件**
```tsx
// frontend/src/components/message/DoctorRecommendCard.tsx

interface DoctorRecommendCardProps {
  doctorId: string;
  doctorName: string;
  hospital: string;
  department: string;
  label: string;  // "立即挂号"
}

export const DoctorRecommendCard: React.FC<DoctorRecommendCardProps> = ({
  doctorId, doctorName, hospital, department, label
}) => {
  const handleBooking = () => {
    window.location.href = `/appointments/book?doctorId=${doctorId}`;
  };

  return (
    <Card className="mt-3 border shadow-sm">
      <CardContent className="p-4 flex items-center justify-between">
        <div className="flex-1">
          <p className="font-semibold text-base">{doctorName}</p>
          <p className="text-sm text-muted-foreground">{hospital} · {department}</p>
        </div>
        <Button onClick={handleBooking} size="sm">
          {label}
        </Button>
      </CardContent>
    </Card>
  );
};
```

**5. 在 AgentViewRenderer 中渲染**
- 新增对 `message_metadata` 分组的渲染
- 根据 action.type 渲染不同的卡片

---

## 第四部分：完整数据流示例

### 端到端数据流示例

**用户输入**：
```
"推荐北京协和医院看心脏好的医生"
```

**1. Agent 处理流程**
```typescript
// Intent Classifier 识别
primaryIntent: 'hospital_recommend'

// ReAct 循环
Thought: 用户需要医生推荐，我需要查询知识库
Action: knowledge_base
Action Input: "北京协和医院 心内科 医生推荐"

// 知识库返回
Observation: "心内科挂号推荐 北京协和医院 的主任医师张医生
Doctor Name: 张医生
Doctor ID: doctor_001
Hospital: 北京协和医院
Department: 心内科"

// Agent 解析并调用 finish
finish({
  summary: "用户咨询北京协和医院心内科医生推荐",
  keyFindings: [
    "推荐张医生，主任医师",
    "擅长冠心病、心律失常等心内科疾病"
  ],
  actions: [{
    type: 'recommend_doctor',
    label: '立即挂号',
    data: {
      doctorId: 'doctor_001',
      doctorName: '张医生',
      hospital: '北京协和医院',
      department: '心内科'
    }
  }],
  informationSources: ['knowledge_base']
})
```

**2. SSE 事件序列**
```javascript
// 事件 1: 消息内容
{
  type: 'message_content',
  data: {
    messageId: 'msg_123',
    delta: '根据您的需求，我推荐北京协和医院心内科的张医生...',
    isLast: true
  }
}

// 事件 2: 元数据（actions）
{
  type: 'message_metadata',
  data: {
    messageId: 'msg_123',
    actions: [{
      type: 'recommend_doctor',
      label: '立即挂号',
      data: {
        doctorId: 'doctor_001',
        doctorName: '张医生',
        hospital: '北京协和医院',
        department: '心内科'
      }
    }]
  }
}

// 事件 3: 对话结束
{ type: 'conversation_end', data: {} }
```

**3. 前端渲染结果**
```
┌─────────────────────────────────────┐
│ 👤 用户                              │
│ "推荐北京协和医院看心脏好的医生"    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 🤖 小荷AI医生                        │
│                                     │
│ 根据您的需求，我推荐北京协和医院    │
│ 心内科的张医生，张医生是该院心内科  │
│ 主任医师，擅长冠心病、心律失常等    │
│ 疾病的诊治。                         │
│                                     │
│ ┌─────────────────────────────┐    │
│ │ 张医生                       │    │
│ │ 北京协和医院 · 心内科        │    │
│ │                   [立即挂号] │    │
│ └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

---

## 第五部分：实施步骤与注意事项

### 实施步骤

**阶段 1：后端 Agent 层**
1. 在 `finish` 工具的 `FinishParams` 中确认 `actions` 类型支持 `recommend_doctor`
2. Agent 需要能够解析知识库返回的医生信息并提取结构化数据
3. 测试 Agent 能否正确识别医生推荐意图并返回 action

**阶段 2：前端事件处理**
1. 创建 `MessageMetadataEvent` 类
2. 修改 `EventFactory` 处理 `message_metadata` 事件
3. 在 `AgentView` 中添加新的分组类型
4. 测试 SSE 事件能否正确转换为 Event

**阶段 3：前端 UI 组件**
1. 创建 `DoctorRecommendCard` 组件
2. 在 `AgentViewRenderer` 中添加渲染逻辑
3. 实现跳转到预约页面的功能
4. 测试样式和交互

**阶段 4：集成测试**
1. 端到端测试：从用户输入到医生卡片显示
2. 验证点击按钮能否正确跳转
3. 测试多种医生推荐场景

### 关键注意事项

**1. 知识库数据格式**
- 当前知识库中的医生信息需要保持稳定的格式
- 建议格式化为：
  ```
  Doctor Name: xxx
  Doctor ID: xxx
  Hospital: xxx
  Department: xxx
  ```

**2. Agent 解析能力**
- Agent 需要从自由文本中提取结构化数据
- 如果解析失败，应该降级为纯文本回复（不显示卡片）

**3. 前端兼容性**
- 确保旧的对话历史（没有 actions）仍能正常显示
- MessageMetadataEvent 可能不存在时的降级处理

**4. 扩展性**
- 未来可能支持多个医生推荐
- Action 类型可能扩展（如：在线咨询、查看医生详情等）

---

## 附录：类型定义

### 后端类型

```typescript
// backend/src/agent/tools/types.ts
export interface FinishParams {
  summary: string;
  keyFindings: string[];
  actions?: Array<{
    type: 'transfer_to_doctor' | 'view_more' | 'book_appointment' | 'retry' | 'cancel' | 'recommend_doctor';
    label: string;
    data?: Record<string, any>;
  }>;
  informationSources?: Array<'knowledge_base' | 'web_search' | 'model_knowledge' | 'user_provided'>;
  reliabilityNote?: string;
}
```

### 前端类型

```typescript
// frontend/src/models/events/MessageMetadataEvent.ts
export interface MessageAction {
  type: 'recommend_doctor' | 'transfer_to_doctor' | 'book_appointment' | 'retry' | 'cancel' | 'view_more';
  label: string;
  data?: {
    doctorId?: string;
    doctorName?: string;
    hospital?: string;
    department?: string;
    [key: string]: any;
  };
}

export interface DoctorRecommendData {
  doctorId: string;
  doctorName: string;
  hospital: string;
  department: string;
}
```

---

**文档版本**：1.0
**最后更新**：2026-01-29
