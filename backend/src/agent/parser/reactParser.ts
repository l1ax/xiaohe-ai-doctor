/**
 * ReAct 输出解析器
 * 用于解析 LLM 的 ReAct 格式输出
 */
import { jsonrepair } from 'jsonrepair';

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

  // 提取 Action Input - 使用 jsonrepair 进行容错解析
  const actionInputStart = output.indexOf('Action Input:');
  if (actionInputStart !== -1) {
    const afterActionInput = output.slice(actionInputStart + 'Action Input:'.length).trim();
    
    // 找到 JSON 开始位置
    const jsonStart = afterActionInput.indexOf('{');
    if (jsonStart !== -1) {
      // 提取从 { 开始到字符串末尾的内容（或到下一个关键字）
      const nextKeyword = afterActionInput.search(/\n(Thought|Action|Observation):/);
      const jsonContent = nextKeyword !== -1
        ? afterActionInput.slice(jsonStart, nextKeyword)
        : afterActionInput.slice(jsonStart);
      
      try {
        // 使用 jsonrepair 修复并解析 JSON
        const repaired = jsonrepair(jsonContent);
        result.actionInput = JSON.parse(repaired);
      } catch (error) {
        console.error('[ReactParser] jsonrepair failed:', jsonContent.slice(0, 200));
        result.parseError = `JSON 解析失败: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
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
