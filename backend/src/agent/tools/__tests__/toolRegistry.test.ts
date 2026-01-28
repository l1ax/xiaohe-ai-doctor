import { describe, it, expect } from 'vitest';
import { getToolByName, getAllTools, P0_TOOLS } from '../index';

describe('Tool Registry', () => {
  it('should get tool by name', () => {
    const tool = getToolByName('ask_followup_question');

    expect(tool).toBeDefined();
    expect(tool?.name).toBe('ask_followup_question');
  });

  it('should return undefined for non-existent tool', () => {
    const tool = getToolByName('non_existent_tool');

    expect(tool).toBeUndefined();
  });

  it('should get all P0 tools', () => {
    const tools = getAllTools();

    expect(tools.length).toBeGreaterThanOrEqual(4); // P0: 至少4个工具
    expect(tools.map(t => t.name)).toContain('ask_followup_question');
    expect(tools.map(t => t.name)).toContain('finish');
    expect(tools.map(t => t.name)).toContain('query_knowledge_base');
    expect(tools.map(t => t.name)).toContain('search_web');
  });

  it('P0_TOOLS should contain core tools', () => {
    expect(P0_TOOLS).toContain('ask_followup_question');
    expect(P0_TOOLS).toContain('query_knowledge_base');
    expect(P0_TOOLS).toContain('search_web');
    expect(P0_TOOLS).toContain('finish');
  });
});
