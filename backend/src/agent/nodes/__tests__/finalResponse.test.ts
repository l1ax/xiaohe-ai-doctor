import { describe, it, expect, beforeEach, vi } from 'vitest';
import { finalResponse } from '../finalResponse';
import { AgentEventEmitter } from '../../events/AgentEventEmitter';
import type { AgentStateType } from '../../state';

describe('finalResponse', () => {
  let mockEmitter: AgentEventEmitter;

  beforeEach(() => {
    mockEmitter = new AgentEventEmitter();
    vi.spyOn(mockEmitter, 'emit');
  });

  it('should emit conversation:end event with correct duration', async () => {
    const state: Partial<AgentStateType> = {
      conversationId: 'conv123',
      messageId: 'msg456',
      startTime: Date.now() - 5000, // 5秒前
      eventEmitter: mockEmitter,
      isFinished: true,
      fallbackResponse: null,
      messages: [
        { role: 'user', content: '测试消息' } as any,
      ],
    };

    await finalResponse(state as AgentStateType);

    expect(mockEmitter.emit).toHaveBeenCalledWith(
      'conversation:end',
      expect.objectContaining({
        type: 'conversation:end',
        data: expect.objectContaining({
          conversationId: 'conv123',
          messageId: 'msg456',
        }),
      })
    );
  });

  it('should handle fallback response when present', async () => {
    const state: Partial<AgentStateType> = {
      conversationId: 'conv123',
      messageId: 'msg456',
      startTime: Date.now(),
      eventEmitter: mockEmitter,
      isFinished: true,
      fallbackResponse: '抱歉，我遇到了一些困难。',
      messages: [],
    };

    const result = await finalResponse(state as AgentStateType);

    expect(result).toEqual({
      fallbackResponse: '抱歉，我遇到了一些困难。',
    });
  });

  it('should return empty object when no fallback response', async () => {
    const state: Partial<AgentStateType> = {
      conversationId: 'conv123',
      messageId: 'msg456',
      startTime: Date.now(),
      eventEmitter: mockEmitter,
      isFinished: true,
      fallbackResponse: null,
      messages: [],
    };

    const result = await finalResponse(state as AgentStateType);

    expect(result).toEqual({});
  });
});
