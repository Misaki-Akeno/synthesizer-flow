import { describe, expect, it, vi } from 'vitest';
import { cancelPendingAttack } from './envelope';

describe('cancelPendingAttack', () => {
  it('cancels a future attack while the envelope is still silent', () => {
    const envelope = { getValueAtTime: () => 0, cancel: vi.fn() };
    cancelPendingAttack(envelope, 2);
    expect(envelope.cancel).toHaveBeenCalledWith(2);
  });

  it('keeps in-progress ramps so triggerRelease can hold the current level', () => {
    // attack 或延音渐弱进行中：cancelScheduledValues 会删掉 ramp 终点导致电平跳变
    const envelope = { getValueAtTime: () => 0.4, cancel: vi.fn() };
    cancelPendingAttack(envelope, 2);
    expect(envelope.cancel).not.toHaveBeenCalled();
  });
});
