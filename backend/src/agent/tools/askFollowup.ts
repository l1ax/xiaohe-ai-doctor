import type { Tool, ToolContext, ToolResult, AskFollowupParams } from './types';
import { createMessageContentEvent } from '../events/chat-event-types';

/**
 * 追问用户更多信息
 *
 * @param params 包含 question 和 reason
 * @param context 工具执行上下文
 * @returns 工具执行结果
 */
export async function askFollowupQuestion(
  params: AskFollowupParams,
  context: ToolContext
): Promise<ToolResult<{ question: string; sent: boolean }>> {
  const { question, reason } = params;
  const { conversationId, messageId, eventEmitter } = context;

  try {
    // 分句发送，模拟自然打字
    const sentences = question.split(/([。？！.?!])/g).filter(Boolean);
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

        // 小延迟，模拟打字
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }

    // 记录追问原因（内部日志）
    console.log(`[AskFollowup] Reason: ${reason}`);

    return {
      success: true,
      result: {
        question,
        sent: true,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      errorType: 'FOLLOWUP_ERROR',
    };
  }
}

/**
 * ask_followup_question 工具定义
 */
export const askFollowupTool: Tool = {
  name: 'ask_followup_question',
  description: `追问用户更多信息。⚠️ 仅在信息极度缺乏时使用，优先基于现有信息给出建议。

使用场景（仅限以下情况）：
- 用户只说"我不舒服"/"哪里疼"/"身体不好" 等极度模糊的描述
- 紧急症状需要确认严重程度时（如"胸痛"需确认是否持续、是否伴随呼吸困难）
- 症状描述完全无法判断可能原因时

不要追问的情况：
- 用户已提供基本症状和持续时间（如"头疼三天"）→ 直接查询知识库/搜索并给建议
- 用户描述相对清晰（有症状名称 + 基本特征）→ 基于现有信息回答
- 可以通过知识库/网络搜索获取信息时 → 使用工具而非追问

原则：能查询就查询，能回答就回答，万不得已才追问。`,
  parameters: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: '要问用户的问题，保持自然、专业',
      },
      reason: {
        type: 'string',
        description: '为什么要问这个问题（内部记录，用于调试）',
      },
    },
    required: ['question', 'reason'],
  },
  execute: askFollowupQuestion,
};
