interface CancellableEnvelope {
  getValueAtTime?: (time: number) => number;
  cancel?: (after: number) => unknown;
}

/**
 * 在 time 释放包络前调用。Tone 的 triggerRelease 在当前电平为 0 时什么也不做，
 * 提前调度、尚未开始的 attack 会照常发声，因此电平为 0 时先取消之后的调度。
 * 有电平时不能 cancel：cancelScheduledValues 不保持当前值，会删掉进行中的
 * attack/渐弱 ramp 导致电平跳变；此时 triggerRelease 会先保持当前值再释放，
 * 同时清除之后的调度。
 */
export function cancelPendingAttack(
  envelope: CancellableEnvelope,
  time: number
): void {
  if ((envelope.getValueAtTime?.(time) ?? 0) > 0) return;
  envelope.cancel?.(time);
}
