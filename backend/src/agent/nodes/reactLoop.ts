import type { AgentStateType } from '../state';
import { buildReActSystemPrompt, injectToolDescriptions } from '../prompts/reactSystem';
import { buildIntentGuidance, buildPriorityReminder } from '../prompts/intentGuidance';
import { formatToolDescriptions, getP0Tools } from '../tools/index';
import { parseReActOutput, isValidReActOutput, formatParseError } from '../parser/reactParser';
import { formatScratchpadEntry, appendToScratchpad } from '../utils/scratchpad';
import { getToolByName } from '../tools/index';
import { createZhipuLLM } from '../../utils/llm';

/**
 * ReAct Loop 节点 - 执行一次 Think → Act → Observe 循环
 */
export async function reactLoop(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const {
    messages,
    conversationId,
    messageId,
    userId,
    userIntent,
    riskIndicators,
    eventEmitter,
    agentIteration,
    maxIterations,
    scratchpad,
    isFinished,
    toolsUsed,
  } = state;

  // 检查是否已完成
  if (isFinished) {
    return { isFinished: true };
  }

  // 检查是否达到最大迭代次数
  if (agentIteration >= maxIterations) {
    return {
      isFinished: true,
      fallbackResponse: '抱歉，我遇到了一些困难。请您换个方式描述问题，或者联系人工客服。',
    };
  }

  try {
    // 1. 构建 Prompt
    const tools = getP0Tools();
    const toolDescriptions = formatToolDescriptions(tools);
    const systemPrompt = injectToolDescriptions(
      buildReActSystemPrompt(),
      toolDescriptions
    );
    const intentGuidance = buildIntentGuidance(userIntent, riskIndicators);
    const priorityReminder = buildPriorityReminder();

    // 2. 构建完整输入
    const fullPrompt = `${systemPrompt}

${intentGuidance}

${priorityReminder}

# 当前对话历史

${scratchpad}

用户最新消息: ${messages[messages.length - 1].content}

现在，按照 ReAct 格式开始你的思考和行动：`;

    // 3. 调用 LLM
    const llm = createZhipuLLM(0.7);

    const response = await llm.invoke(fullPrompt);
    const llmOutput = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    // 4. 解析输出
    const parsed = parseReActOutput(llmOutput);

    // 5. 验证解析结果
    if (!isValidReActOutput(parsed)) {
      console.error('[ReactLoop] Parse error:', formatParseError(parsed));

      // 构建完整的错误反馈到 scratchpad
      const errorEntry = [
        `Thought: ${parsed.thought || 'Parse error'}`,
        parsed.action ? `Action: ${parsed.action}` : '',
        parsed.parseError
          ? `Observation: ${parsed.parseError}`
          : `Observation: 输出格式错误，请按照 ReAct 格式输出（Thought → Action → Action Input）`,
        '',
      ].filter(Boolean).join('\n') + '\n';

      return {
        agentIteration: agentIteration + 1,
        scratchpad: appendToScratchpad(scratchpad, errorEntry),
      };
    }

    // 6. 执行工具
    const tool = getToolByName(parsed.action!);
    if (!tool) {
      console.error(`[ReactLoop] Tool not found: ${parsed.action}`);
      return {
        agentIteration: agentIteration + 1,
        scratchpad: appendToScratchpad(
          scratchpad,
          `Thought: ${parsed.thought}\nAction: ${parsed.action}\nObservation: 工具不存在\n\n`
        ),
      };
    }

    // 检查 actionInput 是否有效
    if (!parsed.actionInput) {
      console.error(`[ReactLoop] Invalid action input for tool: ${parsed.action}`);
      return {
        agentIteration: agentIteration + 1,
        scratchpad: appendToScratchpad(
          scratchpad,
          `Thought: ${parsed.thought}\nAction: ${parsed.action}\nObservation: 工具参数无效（Action Input 为空）\n\n`
        ),
      };
    }

    const toolResult = await tool.execute(parsed.actionInput, {
      conversationId,
      messageId,
      userId,
      userIntent,
      eventEmitter,
      iteration: agentIteration + 1,
    });

    // 7. 更新 scratchpad
    const observation = toolResult.success
      ? JSON.stringify(toolResult.result)
      : `Error: ${toolResult.error}`;

    const newEntry = formatScratchpadEntry({
      thought: parsed.thought!,
      action: parsed.action!,
      actionInput: parsed.actionInput,
      observation,
    });

    const updatedScratchpad = appendToScratchpad(scratchpad, newEntry);

    // 8. 检查是否是需要等待用户回复的工具
    // ask_followup_question 执行后应该结束当前回合，等待用户回复
    const shouldWaitForUser = parsed.action === 'ask_followup_question' && toolResult.success;

    // 9. 返回更新
    return {
      agentIteration: agentIteration + 1,
      scratchpad: updatedScratchpad,
      isFinished: parsed.isFinished || shouldWaitForUser,
      toolsUsed: [...toolsUsed, parsed.action!],
    };
  } catch (error) {
    console.error('[ReactLoop] Error:', error);
    return {
      agentIteration: agentIteration + 1,
      isFinished: true,
      fallbackResponse: '抱歉，我遇到了技术问题。请稍后再试。',
    };
  }
}
