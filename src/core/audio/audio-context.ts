'use client';

import * as Tone from 'tone';

let pendingStart: Promise<boolean> | null = null;

/**
 * 在用户手势内解锁浏览器音频上下文。
 * 多个按钮可以安全地重复调用；同一轮启动只会执行一次 Tone.start()。
 */
export function ensureAudioContextReady(): Promise<boolean> {
  if (Tone.context.state === 'running') return Promise.resolve(true);
  if (pendingStart) return pendingStart;

  pendingStart = Promise.resolve(Tone.start())
    .then(() => Tone.context.state === 'running')
    .catch(() => false)
    .finally(() => {
      pendingStart = null;
    });
  return pendingStart;
}
