import { Annotation } from "@langchain/langgraph";
import { Message, UserIntent, RiskIndicators } from "./types";
import { AgentEventEmitter } from "./events/AgentEventEmitter";

export const AgentState = Annotation.Root({
  // ========== 对话数据 ==========
  // 消息历史
  messages: Annotation<Message[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  // 会话ID
  conversationId: Annotation<string>({
    reducer: (_, update) => update,
    default: () => '',
  }),

  // 消息ID
  messageId: Annotation<string>({
    reducer: (_, update) => update,
    default: () => '',
  }),

  // 用户ID
  userId: Annotation<string>({
    reducer: (_, update) => update,
    default: () => '',
  }),

  // ========== 意图分析 ==========
  // 用户意图列表
  userIntent: Annotation<UserIntent[]>({
    reducer: (_, update) => update,
    default: () => [],
  }),

  // 主要意图
  primaryIntent: Annotation<UserIntent | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  // 意图置信度
  intentConfidence: Annotation<Partial<Record<UserIntent, number>>>({
    reducer: (_, update) => update,
    default: () => ({}),
  }),

  // 意图分类提取的信息
  extractedInfo: Annotation<any>({
    reducer: (_, update) => update,
    default: () => ({}),
  }),

  // 风险指标
  riskIndicators: Annotation<RiskIndicators>({
    reducer: (_, update) => update,
    default: () => ({
      hasEmergencyKeywords: false,
      severity: 'mild' as const,
    }),
  }),

  // 路由决策
  routeDecision: Annotation<'quick' | 'react'>({
    reducer: (_, update) => update,
    default: () => 'react',
  }),

  // ========== ReAct 循环 ==========
  // 思考过程记录
  scratchpad: Annotation<string>({
    reducer: (_, update) => update,
    default: () => '',
  }),

  // 当前迭代次数
  agentIteration: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0,
  }),

  // 最大迭代次数
  maxIterations: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 10,
  }),

  // 是否已完成
  isFinished: Annotation<boolean>({
    reducer: (_, update) => update,
    default: () => false,
  }),

  // 降级响应
  fallbackResponse: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  // ========== 工具使用记录 ==========
  // 已使用的工具列表
  toolsUsed: Annotation<string[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  // ========== 遗留字段（兼容性，后续移除） ==========
  // 各分支的处理结果
  branchResult: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  // ========== 元数据 ==========
  // 开始时间（用于计算对话持续时间）
  startTime: Annotation<number>({
    reducer: (_, update) => update,
    default: () => Date.now(),
  }),

  // 事件发射器
  eventEmitter: Annotation<AgentEventEmitter>({
    reducer: (_, update) => update,
    default: () => new AgentEventEmitter(),
  }),
});

// 导出 State 类型
export type AgentStateType = typeof AgentState.State;
