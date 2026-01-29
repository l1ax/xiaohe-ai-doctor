import type { Tool, ToolContext, ToolResult, FinishParams } from './types';
import { createMessageContentEvent, createMessageMetadataEvent } from '../events/chat-event-types';
import { createDeepSeekLLM, streamLLMResponse } from '../../utils/llm';

/**
 * 构建最终响应的 Prompt
 */
function buildFinalResponsePrompt(
  summary: string,
  keyFindings: string[],
  informationSources: string[],
  reliabilityNote?: string
): string {
  const sourceLabels: Record<string, string> = {
    knowledge_base: '专业医疗知识库',
    web_search: '网络搜索',
    model_knowledge: '通用医学知识',
    user_provided: '用户提供',
  };

  const sourcesText = informationSources
    .map(s => sourceLabels[s] || s)
    .join('、');

  return `你是一位专业、友善的AI医疗助手。请根据以下问诊总结，生成一份给用户的最终回复。

## 问诊总结
${summary}

## 关键发现
${keyFindings.map((f, i) => `${i + 1}. ${f}`).join('\n')}

## 信息来源
${sourcesText || '通用医学知识'}

${reliabilityNote ? `## 可靠性说明\n${reliabilityNote}` : ''}

## 要求
1. 语气专业但亲切，避免过于医学化的术语
2. 结构清晰，包含：症状分析、可能原因、建议措施
3. 适当提醒注意事项和何时需要就医
4. 不要重复"根据您的描述"等开头
5. 控制在 300 字以内

请直接输出回复内容，不需要任何前缀或解释：`;
}

/**
 * 结束对话，内部调用 LLM 流式生成最终回复
 *
 * @param params 包含 summary、keyFindings、actions 等
 * @param context 工具执行上下文
 * @returns 工具执行结果
 */
export async function finish(
  params: FinishParams,
  context: ToolContext
): Promise<ToolResult<{ finished: true }>> {
  const {
    summary,
    keyFindings = [],
    actions = [],
    informationSources = [],
    reliabilityNote,
  } = params;
  const { conversationId, messageId, eventEmitter } = context;

  try {
    // 1. 构建 Prompt
    const prompt = buildFinalResponsePrompt(
      summary,
      keyFindings,
      informationSources,
      reliabilityNote
    );

    // 2. 流式调用 LLM 生成最终响应
    console.log('[Finish] 流式调用 LLM 生成最终响应...');
    const llm = createDeepSeekLLM(0.7);
    await streamLLMResponse(llm, prompt, conversationId, messageId, eventEmitter);

    // 3. 发送元数据（操作按钮、信息来源等）
    const sources = informationSources.map(source => ({
      title: getSourceLabel(source),
      url: '',
      snippet: `来源：${getSourceLabel(source)} (可靠性：${getSourceReliability(source)})${reliabilityNote ? `\n${reliabilityNote}` : ''}`,
    }));

    eventEmitter.emit('message:metadata', createMessageMetadataEvent(
      conversationId,
      messageId,
      sources.length > 0 ? sources : undefined,
      actions.length > 0 ? actions : undefined,
      undefined,
      undefined
    ));

    console.log(`[Finish] Summary: ${summary}`);
    console.log(`[Finish] Key Findings: ${keyFindings.join(', ')}`);

    return {
      success: true,
      result: { finished: true },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Finish] Error:', errorMessage);
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
 * finish 工具定义
 */
export const finishTool: Tool = {
  name: 'finish',
  description: `结束对话，由系统生成最终回复。当收集到足够信息并准备好给出建议时调用。

何时调用：
- 已经收集到足够的症状信息
- 已经查询了知识库或网络搜索
- 已经评估了风险等级（如有必要）
- 准备结束对话

注意：
- summary 应该是对问诊过程的简洁总结
- keyFindings 列出关键发现，系统会据此生成最终回复
- 必须标注信息来源（informationSources）`,
  parameters: {
    type: 'object',
    properties: {
      summary: {
        type: 'string',
        description: '问诊总结，简洁描述用户症状和问诊过程',
      },
      keyFindings: {
        type: 'array',
        description: '关键发现列表，用于生成最终回复',
        items: { type: 'string' },
      },
      actions: {
        type: 'array',
        description: `附带的操作按钮。可用类型：
- recommend_doctor: 推荐医生（需要 data 包含 doctorId, doctorName, hospital, department）
- book_appointment: 预约挂号
- transfer_to_doctor: 转人工医生
- view_more: 查看更多
- retry: 重试
- cancel: 取消`,
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['recommend_doctor', 'book_appointment', 'transfer_to_doctor', 'view_more', 'retry', 'cancel'],
              description: '操作类型，必须是枚举值之一',
            },
            label: {
              type: 'string',
              description: '按钮显示文本',
            },
            data: {
              type: 'object',
              description: '操作相关数据（recommend_doctor 类型必需）',
            },
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
    required: ['summary', 'keyFindings'],
  },
  execute: finish,
};
