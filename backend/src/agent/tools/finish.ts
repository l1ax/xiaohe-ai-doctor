import type { Tool, ToolContext, ToolResult, FinishParams } from './types';
import { createMessageContentEvent, createMessageMetadataEvent } from '../events/chat-event-types';

/**
 * 结束对话，给出最终回复
 *
 * @param params 包含 finalResponse、summary、actions 等
 * @param context 工具执行上下文
 * @returns 工具执行结果
 */
export async function finish(
  params: FinishParams,
  context: ToolContext
): Promise<ToolResult<{ finished: true }>> {
  const {
    finalResponse,
    summary,
    actions = [],
    informationSources = [],
    reliabilityNote,
  } = params;
  const { conversationId, messageId, eventEmitter } = context;

  try {
    // 1. 流式发送最终回复
    const sentences = finalResponse.split(/([。？！.?!])/g).filter(Boolean);
    let chunkIndex = 0;

    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i] + (sentences[i + 1] || '');

      if (sentence.trim()) {
        eventEmitter.emit('message:content', createMessageContentEvent(
          conversationId,
          messageId,
          sentence,
          chunkIndex++,
          chunkIndex === 1,
          i >= sentences.length - 2
        ));

        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }

    // 2. 发送元数据（操作按钮、信息来源等）
    // 将信息来源转换为 sources 格式
    const sources = informationSources.map(source => ({
      title: getSourceLabel(source),
      url: '', // 暂不提供 URL
      snippet: `来源：${getSourceLabel(source)} (可靠性：${getSourceReliability(source)})${reliabilityNote ? `\n${reliabilityNote}` : ''}`,
    }));

    eventEmitter.emit('message:metadata', createMessageMetadataEvent(
      conversationId,
      messageId,
      sources.length > 0 ? sources : undefined,
      actions.length > 0 ? actions : undefined,
      undefined, // medicalAdvice
      undefined  // toolsUsed
    ));

    console.log(`[Finish] Summary: ${summary}`);
    console.log(`[Finish] Sources: ${informationSources.join(', ')}`);

    return {
      success: true,
      result: { finished: true },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      errorType: 'FINISH_ERROR',
    };
  }
}

/**
 * 获取信息来源的显示标签
 */
function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    knowledge_base: '专业医疗知识库',
    web_search: '网络搜索',
    model_knowledge: '通用医学知识',
    user_provided: '用户提供',
  };
  return labels[source] || source;
}

/**
 * 获取信息来源的可靠性等级
 */
function getSourceReliability(source: string): 'high' | 'medium' | 'low' {
  const reliability: Record<string, 'high' | 'medium' | 'low'> = {
    knowledge_base: 'high',
    web_search: 'medium',
    model_knowledge: 'low',
    user_provided: 'high',
  };
  return reliability[source] || 'low';
}

/**
 * 获取信息来源的图标
 */
function getSourceIcon(source: string): string {
  const icons: Record<string, string> = {
    knowledge_base: '🏥',
    web_search: '🔍',
    model_knowledge: '📚',
    user_provided: '👤',
  };
  return icons[source] || '📄';
}

/**
 * finish 工具定义
 */
export const finishTool: Tool = {
  name: 'finish',
  description: `结束对话，给出最终回复。当收集到足够信息并准备好完整建议时调用。

何时调用：
- 已经收集到足够的症状信息
- 已经查询了知识库或网络搜索
- 已经评估了风险等级（如有必要）
- 准备给出完整、专业的建议

注意：
- finalResponse 应该完整、专业、有帮助
- 必须标注信息来源（informationSources）
- 如果使用了 web_search 或 model_knowledge，需要添加 reliabilityNote`,
  parameters: {
    type: 'object',
    properties: {
      finalResponse: {
        type: 'string',
        description: '给用户的最终完整回复，应该专业、清晰、有帮助',
      },
      summary: {
        type: 'string',
        description: '本次问诊总结（内部记录，用于分析）',
      },
      actions: {
        type: 'array',
        description: '附带的操作按钮',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            label: { type: 'string' },
          },
          required: ['type', 'label'],
        },
      },
      informationSources: {
        type: 'array',
        description: '信息来源列表',
        items: {
          type: 'string',
          enum: ['knowledge_base', 'web_search', 'model_knowledge', 'user_provided'],
        },
      },
      reliabilityNote: {
        type: 'string',
        description: '可靠性说明（当使用 web_search 或 model_knowledge 时需要）',
      },
    },
    required: ['finalResponse', 'summary'],
  },
  execute: finish,
};
