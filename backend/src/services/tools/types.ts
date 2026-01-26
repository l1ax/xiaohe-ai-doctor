import { UserIntent } from '../../agent/types';
import { AgentEventEmitter } from '../../agent/events/AgentEventEmitter';

/**
 * 图片识别配置
 */
export interface ImageRecognitionConfig {
  intent: UserIntent;
  customPrompt?: string;
}

/**
 * 图片识别结果
 */
export interface ImageRecognitionResult {
  description: string;
  confidence?: number;
}

/**
 * 知识库查询结果
 */
export interface KnowledgeQueryResult {
  hasResults: boolean;
  documents: Array<{
    documentId: string;
    output: string;
  }>;
  source: 'knowledge_base';
}

/**
 * 网络搜索结果
 */
export interface WebSearchResult {
  hasResults: boolean;
  summary: string;
  sources: Array<{
    title: string;
    url: string;
    content: string;
  }>;
  source: 'web_search';
}

/**
 * 工具编排器上下文
 */
export interface ToolContext {
  query: string;
  intent: UserIntent;
  imageUrls?: string[];
  conversationId: string;
  messageId: string;
  eventEmitter: AgentEventEmitter;
}

/**
 * 工具编排器结果
 */
export interface ToolResult {
  success: boolean;
  data?: {
    imageDescription?: string;
    knowledgeBase?: string;
    webSearch?: string;
  };
  enhancedQuery: string;
  toolsUsed: string[];
}

/**
 * 超时配置
 */
export const TIMEOUT_CONFIG = {
  imageRecognition: 10000,   // 10s
  knowledgeBase: 5000,       // 5s
  webSearch: 8000,           // 8s
} as const;
