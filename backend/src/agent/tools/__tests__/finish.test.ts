import { describe, it, expect } from 'vitest';
import { finish, finishTool } from '../finish';
import { AgentEventEmitter } from '../../events/AgentEventEmitter';

describe('finish tool', () => {
  it('should send final response via SSE', async () => {
    const emitter = new AgentEventEmitter();
    const events: any[] = [];

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

    const result = await finish(
      {
        finalResponse: '根据您的症状，建议...',
        summary: '头疼咨询',
        actions: [
          { type: 'transfer_to_doctor', label: '咨询人工医生' },
        ],
        informationSources: ['knowledge_base'],
      },
      context
    );

    expect(result.success).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });

  it('should emit metadata with actions and sources', async () => {
    const emitter = new AgentEventEmitter();
    const metadataEvents: any[] = [];

    (emitter as any).on('message:metadata', (event: any) => {
      metadataEvents.push(event);
    });

    const context = {
      conversationId: 'test-conv',
      messageId: 'test-msg',
      userId: 'test-user',
      userIntent: ['symptom_consult' as const],
      eventEmitter: emitter,
    };

    await finish(
      {
        finalResponse: '建议您...',
        summary: '症状分析',
        actions: [{ type: 'book_appointment', label: '预约挂号' }],
        informationSources: ['web_search'],
        reliabilityNote: '以上信息来自网络搜索，建议咨询专业医生',
      },
      context
    );

    expect(metadataEvents.length).toBe(1);
    expect(metadataEvents[0].data.actions).toHaveLength(1);
    expect(metadataEvents[0].data.sources).toBeDefined();
    expect(metadataEvents[0].data.sources![0].snippet).toContain('以上信息来自网络搜索');
  });

  it('should have correct tool definition', () => {
    expect(finishTool.name).toBe('finish');
    expect(finishTool.description).toContain('结束对话');
    expect(finishTool.parameters.required).toContain('finalResponse');
    expect(finishTool.parameters.required).toContain('summary');
  });
});
