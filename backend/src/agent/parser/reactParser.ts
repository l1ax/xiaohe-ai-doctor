/**
 * ReAct 输出解析器
 * 用于解析 LLM 的 ReAct 格式输出
 */

/**
 * ReAct 解析结果接口
 */
export interface ReActParseResult {
  /** 思考内容 */
  thought: string | null;
  /** 动作名称 */
  action: string | null;
  /** 动作输入 (JSON 对象) */
  actionInput: Record<string, any> | null;
  /** 是否为完成动作 */
  isFinished: boolean;
  /** 解析错误信息 */
  parseError?: string;
  /** 原始输出 */
  rawOutput: string;
}

/**
 * 解析 ReAct 格式输出
 *
 * @param output - LLM 的原始输出
 * @returns 解析结果
 *
 * @example
 * ```typescript
 * const output = `
 * Thought: 用户询问头疼原因
 * Action: ask_followup_question
 * Action Input: {"question": "头疼多久了？"}
 * `;
 * const result = parseReActOutput(output);
 * ```
 */
export function parseReActOutput(output: string): ReActParseResult {
  const result: ReActParseResult = {
    thought: null,
    action: null,
    actionInput: null,
    isFinished: false,
    rawOutput: output,
  };

  // 提取 Thought
  const thoughtMatch = output.match(/Thought:\s*(.+?)(?=\nAction:|$)/s);
  if (thoughtMatch) {
    result.thought = thoughtMatch[1].trim();
  }

  // 提取 Action
  const actionMatch = output.match(/Action:\s*(\w+)/);
  if (actionMatch) {
    result.action = actionMatch[1].trim();

    // 检查是否为完成动作
    if (result.action === 'finish') {
      result.isFinished = true;
    }
  }

  // 提取 Action Input - 使用更健壮的解析逻辑
  let actionInputMatch = output.match(/Action Input:\s*(\{[\s\S]*?\})\s*(?:\n|$)/);

  // 回退方案：尝试匹配到行尾的 JSON
  if (!actionInputMatch) {
    actionInputMatch = output.match(/Action Input:\s*(\{[^\n]*\})/);
  }

  // 再次回退：尝试提取 { 到最后一个 }
  if (!actionInputMatch) {
    const actionInputStart = output.indexOf('Action Input:');
    if (actionInputStart !== -1) {
      const jsonStart = output.indexOf('{', actionInputStart);
      const jsonEnd = output.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd > jsonStart) {
        const potentialJson = output.slice(jsonStart, jsonEnd + 1);
        try {
          result.actionInput = JSON.parse(potentialJson);
        } catch {
          result.parseError = `无法解析 Action Input: ${potentialJson.slice(0, 100)}...`;
        }
      }
    }
  }

  if (actionInputMatch && !result.actionInput) {
    try {
      result.actionInput = JSON.parse(actionInputMatch[1]);
    } catch (error) {
      result.parseError = formatParseError(error);
    }
  }

  return result;
}

/**
 * 验证 ReAct 输出是否有效
 *
 * @param parseResult - 解析结果
 * @returns 是否有效
 */
export function isValidReActOutput(parseResult: ReActParseResult): boolean {
  // 至少需要有 thought 或 action
  if (!parseResult.thought && !parseResult.action) {
    return false;
  }

  // 如果有 action，必须有 actionInput（除非有解析错误）
  if (parseResult.action && !parseResult.actionInput && !parseResult.parseError) {
    return false;
  }

  return true;
}

/**
 * 格式化解析错误信息
 *
 * @param error - 错误对象
 * @returns 格式化的错误信息
 */
export function formatParseError(error: unknown): string {
  if (error instanceof Error) {
    return `JSON 解析失败: ${error.message}`;
  }
  if (typeof error === 'object' && error !== null) {
    try {
      return `JSON 解析失败: ${JSON.stringify(error)}`;
    } catch {
      return `JSON 解析失败: 无法序列化错误对象`;
    }
  }
  return `JSON 解析失败: ${String(error)}`;
}
