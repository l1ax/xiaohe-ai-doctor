import { describe, it, expect, vi, beforeEach } from 'vitest';
import { classifyIntent } from '../classifyIntent';
import type { AgentStateType } from '../../state';
import { AgentEventEmitter } from '../../events/AgentEventEmitter';

// Mock LLM
const mockInvoke = vi.fn();
vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn(function() {
    return {
      invoke: mockInvoke,
    };
  }),
}));

beforeEach(() => {
  mockInvoke.mockReset();
});

describe('classifyIntent - Multi-Intent Support', () => {
  it('should identify multiple intents', async () => {
    mockInvoke.mockResolvedValueOnce({
      content: JSON.stringify({
        intents: ['symptom_consult', 'medicine_info'],
        entities: {
          symptoms: ['头疼'],
          bodyParts: ['头部'],
        },
        riskIndicators: {
          hasEmergencyKeywords: false,
          severity: 'mild',
        },
      }),
    });

    const mockState: Partial<AgentStateType> = {
      messages: [
        { role: 'user', content: '我头疼，该吃什么药？' } as any,
      ],
      conversationId: 'test-conv',
      eventEmitter: new AgentEventEmitter(),
    };

    const result = await classifyIntent(mockState as AgentStateType);

    expect(result.userIntent).toContain('symptom_consult');
    expect(result.userIntent).toContain('medicine_info');
    expect(result.primaryIntent).toBe('symptom_consult');
  });

  it('should extract risk indicators', async () => {
    mockInvoke.mockResolvedValueOnce({
      content: JSON.stringify({
        intents: ['emergency'],
        entities: { symptoms: ['胸痛', '呼吸困难'] },
        riskIndicators: {
          hasEmergencyKeywords: true,
          severity: 'severe',
        },
      }),
    });

    const mockState: Partial<AgentStateType> = {
      messages: [
        { role: 'user', content: '胸痛，呼吸困难' } as any,
      ],
      conversationId: 'test-conv',
      eventEmitter: new AgentEventEmitter(),
    };

    const result = await classifyIntent(mockState as AgentStateType);

    expect(result.riskIndicators.hasEmergencyKeywords).toBe(true);
    expect(result.riskIndicators.severity).toBe('severe');
  });
});
