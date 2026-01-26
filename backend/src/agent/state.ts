import { Annotation } from "@langchain/langgraph";
import { Message, UserIntent } from "./types";
import { AgentEventEmitter } from "./events/AgentEventEmitter";

export const AgentState = Annotation.Root({
  // 消息历史
  messages: Annotation<Message[]>({
    reducer: (current, update) => [...current, ...update],
    default: () => [],
  }),

  // 用户意图
  userIntent: Annotation<UserIntent | null>({
    reducer: (_, update) => update,
    default: () => null,
  }),

  // 意图分类提取的信息
  extractedInfo: Annotation<any>({
    reducer: (_, update) => update,
    default: () => ({}),
  }),

  // 各分支的处理结果
  branchResult: Annotation<string | null>({
    reducer: (_, update) => update,
    default: () => null,
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
