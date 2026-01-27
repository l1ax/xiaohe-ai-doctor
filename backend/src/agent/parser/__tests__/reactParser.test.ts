import { describe, it, expect } from 'vitest';
import {
  parseReActOutput,
  ReActParseResult,
  isValidReActOutput,
} from '../reactParser';

describe('ReAct Output Parser', () => {
  it('should parse valid ReAct output', () => {
    const output = `
Thought: 用户询问头疼原因
Action: ask_followup_question
Action Input: {"question": "头疼多久了？", "reason": "需要了解持续时间"}
`;

    const result = parseReActOutput(output);

    expect(result.thought).toBe('用户询问头疼原因');
    expect(result.action).toBe('ask_followup_question');
    expect(result.actionInput).toEqual({
      question: '头疼多久了？',
      reason: '需要了解持续时间',
    });
    expect(result.isFinished).toBe(false);
  });

  it('should handle finish action', () => {
    const output = `
Thought: 已收集足够信息
Action: finish
Action Input: {"finalResponse": "建议您...", "summary": "头疼咨询"}
`;

    const result = parseReActOutput(output);

    expect(result.action).toBe('finish');
    expect(result.isFinished).toBe(true);
  });

  it('should handle JSON parsing errors gracefully', () => {
    const output = `
Thought: 测试
Action: test_tool
Action Input: {invalid json}
`;

    const result = parseReActOutput(output);

    expect(result.parseError).toBeDefined();
    expect(result.action).toBe('test_tool');
  });

  it('should extract thought even without action', () => {
    const output = `Thought: 仅有思考内容`;

    const result = parseReActOutput(output);

    expect(result.thought).toBe('仅有思考内容');
    expect(result.action).toBeNull();
  });
});

describe('isValidReActOutput', () => {
  it('should return false when both thought and action are null', () => {
    const result: ReActParseResult = {
      thought: null,
      action: null,
      actionInput: null,
      isFinished: false,
      rawOutput: '',
    };
    expect(isValidReActOutput(result)).toBe(false);
  });

  it('should return true when only thought is present', () => {
    const result: ReActParseResult = {
      thought: '思考中',
      action: null,
      actionInput: null,
      isFinished: false,
      rawOutput: 'Thought: 思考中',
    };
    expect(isValidReActOutput(result)).toBe(true);
  });

  it('should return false when action exists but actionInput is null without error', () => {
    const result: ReActParseResult = {
      thought: '思考',
      action: 'test_tool',
      actionInput: null,
      isFinished: false,
      rawOutput: 'Thought: 思考\nAction: test_tool',
    };
    expect(isValidReActOutput(result)).toBe(false);
  });

  it('should return true when action has parse error', () => {
    const result: ReActParseResult = {
      thought: '思考',
      action: 'test_tool',
      actionInput: null,
      isFinished: false,
      parseError: 'JSON解析失败',
      rawOutput: 'Thought: 思考\nAction: test_tool\nAction Input: {invalid}',
    };
    expect(isValidReActOutput(result)).toBe(true);
  });
});
