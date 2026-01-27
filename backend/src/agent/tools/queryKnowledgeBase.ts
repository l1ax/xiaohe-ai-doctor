import type { Tool, ToolContext, ToolResult } from './types';
import { queryKnowledgeBase as queryKB, formatKnowledgeBase } from '../../services/tools/knowledgeBase';
import { createToolCallEvent } from '../events/chat-event-types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 查询专业医疗知识库
 */
export async function queryKnowledgeBase(
  params: { query: string },
  context: ToolContext
): Promise<ToolResult<{ content: string; hasResults: boolean }>> {
  const { query } = params;
  const { conversationId, messageId, eventEmitter, iteration } = context;
  const toolId = `tool_${uuidv4()}`;

  try {
    // 发送工具调用开始事件
    eventEmitter.emit('tool:call', createToolCallEvent(
      conversationId,
      toolId,
      'query_knowledge_base',
      messageId,
      'running',
      { input: { query }, iteration }
    ));

    const startTime = Date.now();
    const result = await queryKB(query);
    const duration = Date.now() - startTime;

    // 格式化结果
    const formattedContent = formatKnowledgeBase(result);

    // 发送完成事件
    eventEmitter.emit('tool:call', createToolCallEvent(
      conversationId,
      toolId,
      'query_knowledge_base',
      messageId,
      'completed',
      {
        output: {
          hasResults: result.hasResults,
          documentCount: result.documents.length,
        },
        duration,
        iteration,
      }
    ));

    return {
      success: true,
      result: {
        content: formattedContent,
        hasResults: result.hasResults,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // 发送失败事件
    eventEmitter.emit('tool:call', createToolCallEvent(
      conversationId,
      toolId,
      'query_knowledge_base',
      messageId,
      'failed',
      { error: errorMessage, iteration }
    ));

    return {
      success: false,
      error: errorMessage,
      errorType: 'KNOWLEDGE_BASE_ERROR',
    };
  }
}

/**
 * query_knowledge_base 工具定义
 */
export const queryKnowledgeBaseTool: Tool = {
  name: 'query_knowledge_base',
  description: `查询专业医疗知识库（⭐ 最优先使用）。

特点：
- 包含经过审核的专业医疗内容
- 可靠性最高，应优先使用
- 涵盖疾病症状、治疗方法、药品信息、健康建议等

使用场景：
- 分析症状时
- 回答医疗健康问题
- 提供药品信息
- 给出健康建议

优先级：知识库 > 网络搜索 > 模型内置知识`,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '查询内容，应该清晰、具体',
      },
    },
    required: ['query'],
  },
  execute: queryKnowledgeBase,
};
