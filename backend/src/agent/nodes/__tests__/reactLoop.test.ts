import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reactLoop } from '../reactLoop';
import type { AgentStateType } from '../../state';
import { AgentEventEmitter } from '../../events/AgentEventEmitter';

// Mock LLM
const mockInvoke = vi.fn().mockResolvedValue({
  content: `Thought: 用户询问头疼
Action: ask_followup_question
Action Input: {"question": "头疼多久了？", "reason": "需要了解持续时间"}`,
});

vi.mock('@langchain/community/chat_models/zhipuai', () => ({
  ChatZhipuAI: vi.fn().mockImplementation(function() {
    return {
      invoke: mockInvoke,
    };
  }),
}));

describe('ReAct Loop Node', () => {
  let mockState: Partial<AgentStateType>;

  beforeEach(() => {
    mockState = {
      messages: [
        { role: 'user', content: '我头疼' } as any,
      ],
      conversationId: 'test-conv',
      messageId: 'test-msg',
      userId: 'test-user',
      userIntent: ['symptom_consult'],
      riskIndicators: {
        hasEmergencyKeywords: false,
        severity: 'mild',
      },
      eventEmitter: new AgentEventEmitter(),
      agentIteration: 0,
      maxIterations: 10,
      scratchpad: '',
      isFinished: false,
      toolsUsed: [],
    };
  });

  it('should perform one ReAct iteration', async () => {
    const result = await reactLoop(mockState as AgentStateType);

    expect(result.agentIteration).toBe(1);
    expect(result.scratchpad).toBeDefined();
    expect(result.scratchpad).toContain('Thought:');
    expect(result.scratchpad).toContain('Action:');
  });

  it('should stop when max iterations reached', async () => {
    mockState.agentIteration = 10;
    mockState.maxIterations = 10;

    const result = await reactLoop(mockState as AgentStateType);

    expect(result.isFinished).toBe(true);
    expect(result.fallbackResponse).toContain('困难');
  });

  it('should mark as finished when finish tool is called', async () => {
    // Mock LLM 返回 finish action
    mockInvoke.mockResolvedValueOnce({
      content: `Thought: 已收集足够信息
Action: finish
Action Input: {"finalResponse": "建议您...", "summary": "咨询"}`,
    });

    const result = await reactLoop(mockState as AgentStateType);

    expect(result.isFinished).toBe(true);
  });
});
