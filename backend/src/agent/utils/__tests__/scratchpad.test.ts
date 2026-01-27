import { describe, it, expect } from 'vitest';
import {
  appendToScratchpad,
  formatScratchpadEntry,
  parseScratchpad,
  truncateScratchpad,
} from '../scratchpad';

describe('Scratchpad Management', () => {
  it('should format scratchpad entry', () => {
    const entry = formatScratchpadEntry({
      thought: '用户询问头疼',
      action: 'ask_followup_question',
      actionInput: { question: '头疼多久了？' },
      observation: '用户回复: 三天了',
    });

    expect(entry).toContain('Thought: 用户询问头疼');
    expect(entry).toContain('Action: ask_followup_question');
    expect(entry).toContain('Observation: 用户回复: 三天了');
  });

  it('should append to existing scratchpad', () => {
    const existing = 'Thought: 第一轮\nAction: tool1\nObservation: 结果1\n\n';
    const newEntry = formatScratchpadEntry({
      thought: '第二轮',
      action: 'tool2',
      actionInput: {},
      observation: '结果2',
    });

    const updated = appendToScratchpad(existing, newEntry);

    expect(updated).toContain('第一轮');
    expect(updated).toContain('第二轮');
  });

  it('should parse scratchpad into iterations', () => {
    const scratchpad = `
Thought: 第一次思考
Action: tool1
Action Input: {"param": "value"}
Observation: 结果1

Thought: 第二次思考
Action: tool2
Action Input: {"param": "value2"}
Observation: 结果2
`;

    const iterations = parseScratchpad(scratchpad);

    expect(iterations).toHaveLength(2);
    expect(iterations[0].thought).toBe('第一次思考');
    expect(iterations[1].action).toBe('tool2');
  });

  it('should truncate scratchpad to keep only recent N iterations', () => {
    // 生成一个包含多次迭代的 scratchpad
    let scratchpad = '';
    for (let i = 1; i <= 5; i++) {
      const entry = formatScratchpadEntry({
        thought: `思考${i}`,
        action: `tool${i}`,
        actionInput: { param: `value${i}` },
        observation: `结果${i}`,
      });
      scratchpad = appendToScratchpad(scratchpad, entry);
    }

    const truncated = truncateScratchpad(scratchpad, 3);
    const iterations = parseScratchpad(truncated);

    expect(iterations).toHaveLength(3);
    expect(iterations[0].thought).toBe('思考3');
    expect(iterations[2].thought).toBe('思考5');
  });

  it('should not truncate when iterations <= maxIterations', () => {
    let scratchpad = '';
    for (let i = 1; i <= 3; i++) {
      const entry = formatScratchpadEntry({
        thought: `思考${i}`,
        action: `tool${i}`,
        actionInput: {},
        observation: `结果${i}`,
      });
      scratchpad = appendToScratchpad(scratchpad, entry);
    }

    const truncated = truncateScratchpad(scratchpad, 5);
    const iterations = parseScratchpad(truncated);

    expect(iterations).toHaveLength(3);
  });
});
