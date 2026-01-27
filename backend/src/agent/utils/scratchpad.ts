/**
 * Scratchpad 管理工具
 * 用于管理 ReAct 循环的思考记录
 */

/**
 * Scratchpad 条目接口
 */
export interface ScratchpadEntry {
  thought: string;
  action: string;
  actionInput: Record<string, unknown>;
  observation: string;
}

/**
 * 格式化 Scratchpad 条目
 * @param entry - Scratchpad 条目
 * @returns 格式化后的字符串
 */
export function formatScratchpadEntry(entry: ScratchpadEntry): string {
  const lines = [
    `Thought: ${entry.thought}`,
    `Action: ${entry.action}`,
    `Action Input: ${JSON.stringify(entry.actionInput)}`,
    `Observation: ${entry.observation}`,
  ];

  return lines.join('\n') + '\n';
}

/**
 * 追加新条目到 Scratchpad
 * @param existing - 已有的 Scratchpad 内容
 * @param newEntry - 新的格式化条目
 * @returns 更新后的 Scratchpad
 */
export function appendToScratchpad(
  existing: string,
  newEntry: string,
): string {
  // 如果已有内容，确保有双换行符分隔
  if (existing.trim()) {
    // 如果已有内容不是以双换行结束，添加一个换行
    if (!existing.endsWith('\n\n')) {
      existing = existing.trimEnd() + '\n\n';
    }
  }

  return existing + newEntry;
}

/**
 * 解析 Scratchpad 为迭代列表
 * @param scratchpad - Scratchpad 内容
 * @returns 解析后的迭代列表
 */
export function parseScratchpad(scratchpad: string): ScratchpadEntry[] {
  const iterations: ScratchpadEntry[] = [];

  // 按双换行符分割迭代
  const blocks = scratchpad
    .trim()
    .split('\n\n')
    .filter((block) => block.trim());

  for (const block of blocks) {
    const lines = block.split('\n').filter((line) => line.trim());
    const entry: Partial<ScratchpadEntry> = {};

    for (const line of lines) {
      if (line.startsWith('Thought:')) {
        entry.thought = line.substring('Thought:'.length).trim();
      } else if (line.startsWith('Action:')) {
        entry.action = line.substring('Action:'.length).trim();
      } else if (line.startsWith('Action Input:')) {
        const inputStr = line.substring('Action Input:'.length).trim();
        try {
          entry.actionInput = JSON.parse(inputStr);
        } catch {
          entry.actionInput = {};
        }
      } else if (line.startsWith('Observation:')) {
        entry.observation = line.substring('Observation:'.length).trim();
      }
    }

    // 只有当所有必需字段都存在时才添加
    if (
      entry.thought &&
      entry.action &&
      entry.actionInput !== undefined &&
      entry.observation
    ) {
      iterations.push(entry as ScratchpadEntry);
    }
  }

  return iterations;
}

/**
 * 截断 Scratchpad（保留最近的 N 次迭代）
 * @param scratchpad - Scratchpad 内容
 * @param maxIterations - 最大迭代次数
 * @returns 截断后的 Scratchpad
 */
export function truncateScratchpad(
  scratchpad: string,
  maxIterations: number = 5,
): string {
  const iterations = parseScratchpad(scratchpad);

  if (iterations.length <= maxIterations) {
    return scratchpad;
  }

  // 保留最后 N 次迭代
  const kept = iterations.slice(-maxIterations);
  return kept.map((entry) => formatScratchpadEntry(entry)).join('\n');
}
