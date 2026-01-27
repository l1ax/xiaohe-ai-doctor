import { describe, it, expect, vi } from 'vitest';
import { askFollowupQuestion, askFollowupTool } from '../askFollowup';
import { AgentEventEmitter } from '../../events/AgentEventEmitter';

describe('ask_followup_question tool', () => {
  it('should return success with question', async () => {
    const emitter = new AgentEventEmitter();
    const context = {
      conversationId: 'test-conv',
      messageId: 'test-msg',
      userId: 'test-user',
      userIntent: ['symptom_consult' as const],
      eventEmitter: emitter,
    };

    const result = await askFollowupQuestion(
      {
        question: '头疼多久了？',
        reason: '需要了解症状持续时间',
      },
      context
    );

    expect(result.success).toBe(true);
    expect(result.result).toEqual({
      question: '头疼多久了？',
      sent: true,
    });
  });

  it('should emit message:content event', async () => {
    const emitter = new AgentEventEmitter();
    const events: any[] = [];

    // Use the generic EventEmitter on method to listen to custom events
    (emitter as any).on('message:content', (event: any) => {
      events.push(event);
    });

    const context = {
      conversationId: 'test-conv',
      messageId: 'test-msg',
      userId: 'test-user',
      userIntent: ['symptom_consult' as const],
      eventEmitter: emitter,
    };

    await askFollowupQuestion(
      {
        question: '有其他症状吗？',
        reason: '收集更多信息',
      },
      context
    );

    expect(events.length).toBeGreaterThan(0);
    expect(events[0].data.conversationId).toBe('test-conv');
  });

  it('should have correct tool definition', () => {
    expect(askFollowupTool.name).toBe('ask_followup_question');
    expect(askFollowupTool.description).toContain('追问');
    expect(askFollowupTool.parameters.type).toBe('object');
    expect(askFollowupTool.parameters.required).toContain('question');
  });
});
