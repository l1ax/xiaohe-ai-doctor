import { describe, it, expect } from 'vitest';
import { formatToolDescriptions, getP0Tools } from '../../tools/index';

describe('Tool Description Formatting', () => {
  it('should format tool with JSON schema parameters', () => {
    const tools = getP0Tools();
    const formatted = formatToolDescriptions(tools);

    expect(formatted).toContain('ask_followup_question');
    expect(formatted).toContain('question');
    expect(formatted).toContain('reason');
  });

  it('should include tool descriptions', () => {
    const tools = getP0Tools();
    const formatted = formatToolDescriptions(tools);

    expect(formatted).toContain('追问用户');
    expect(formatted).toContain('结束对话');
  });

  it('should format all P0 tools', () => {
    const tools = getP0Tools();
    const formatted = formatToolDescriptions(tools);

    expect(formatted).toContain('ask_followup_question');
    expect(formatted).toContain('finish');
    expect(formatted).toContain('query_knowledge_base');
    expect(formatted).toContain('search_web');
  });
});
