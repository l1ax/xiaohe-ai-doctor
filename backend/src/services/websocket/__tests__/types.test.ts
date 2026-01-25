import { describe, it, expect } from 'vitest';
import { WSMessageType } from '../types';

describe('WebSocket Message Types', () => {
  it('should have join message type', () => {
    expect(WSMessageType.JOIN).toBe('join');
  });

  it('should have leave message type', () => {
    expect(WSMessageType.LEAVE).toBe('leave');
  });
});
