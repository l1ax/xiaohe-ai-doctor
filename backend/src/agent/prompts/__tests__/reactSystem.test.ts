import { describe, it, expect } from 'vitest';
import { buildReActSystemPrompt, injectToolDescriptions } from '../reactSystem';

describe('ReAct System Prompt', () => {
  it('should include ReAct format instructions', () => {
    const prompt = buildReActSystemPrompt();

    expect(prompt).toContain('Thought:');
    expect(prompt).toContain('Action:');
    expect(prompt).toContain('Action Input:');
    expect(prompt).toContain('Observation:');
  });

  it('should include medical guidelines', () => {
    const prompt = buildReActSystemPrompt();

    expect(prompt).toContain('专业医疗建议');
    expect(prompt).toContain('风险评估');
  });

  it('should include information priority', () => {
    const prompt = buildReActSystemPrompt();

    expect(prompt).toContain('knowledge_base');
    expect(prompt).toContain('web_search');
    expect(prompt).toContain('model_knowledge');
  });

  it('should inject tool descriptions into prompt', () => {
    const prompt = buildReActSystemPrompt();
    const toolDesc = 'Tool 1: Description\nTool 2: Description';
    const injected = injectToolDescriptions(prompt, toolDesc);

    expect(injected).toContain('Tool 1: Description');
    expect(injected).toContain('Tool 2: Description');
    expect(injected).not.toContain('{tool_descriptions}');
  });
});
