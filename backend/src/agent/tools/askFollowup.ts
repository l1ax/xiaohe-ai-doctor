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
  description: `追问用户更多信息。当症状描述不清楚或需要更多细节时使用。

使用场景：
- 用户只说"头疼"，需要了解持续时间、严重程度
- 用户描述模糊，需要确认具体症状
- 需要了解伴随症状、既往病史等

注意：每次只问一个问题，保持对话自然。`,
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
