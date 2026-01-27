import type { Tool, ToolContext, ToolResult } from './types';
import { searchWeb as searchWebService, formatWebSearch } from '../../services/tools/webSearch';
import { createToolCallEvent } from '../events/chat-event-types';
import { v4 as uuidv4 } from 'uuid';

/**
 * 搜索互联网获取医疗信息
 */
export async function searchWeb(
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
      'search_web',
      messageId,
      'running',
      { input: { query }, iteration }
    ));

    const startTime = Date.now();
    const result = await searchWebService(query);
    const duration = Date.now() - startTime;

    // 格式化结果
    const formattedContent = formatWebSearch(result);

    // 发送完成事件
    eventEmitter.emit('tool:call', createToolCallEvent(
      conversationId,
      toolId,
      'search_web',
      messageId,
      'completed',
      {
        output: {
          hasResults: result.hasResults,
          sourceCount: result.sources.length,
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
      'search_web',
      messageId,
      'failed',
      { error: errorMessage, iteration }
    ));

    return {
      success: false,
      error: errorMessage,
      errorType: 'WEB_SEARCH_ERROR',
    };
  }
}

/**
 * search_web 工具定义
 */
export const searchWebTool: Tool = {
  name: 'search_web',
  description: `搜索互联网获取医疗信息（⚠️ 降级使用）。

特点：
- 可获取最新医疗资讯
- 可靠性低于知识库
- 结果已经过 LLM 摘要

使用场景（仅当知识库无结果时）：
- 知识库没有相关信息
- 需要最新医疗资讯
- 查询医院信息

优先级：知识库 > 网络搜索 > 模型内置知识

注意：使用网络搜索结果时，必须在 finish 工具中标注 informationSources 为 ['web_search']，并添加 reliabilityNote。`,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词，应该清晰、具体',
      },
    },
    required: ['query'],
  },
  execute: searchWeb,
};
