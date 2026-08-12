import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Tone from 'tone';
import { ensureAudioContextReady } from './audio-context';

describe('audio context unlock', () => {
  beforeEach(() => {
    vi.mocked(Tone.start).mockReset();
  });

  it('starts a suspended Tone context and reports readiness', async () => {
    const context = Tone.context as unknown as { state: string };
    context.state = 'suspended';
    vi.mocked(Tone.start).mockImplementationOnce(async () => {
      context.state = 'running';
    });

    await expect(ensureAudioContextReady()).resolves.toBe(true);
    expect(Tone.start).toHaveBeenCalledTimes(1);
  });

  it('does not restart an already running context', async () => {
    (Tone.context as unknown as { state: string }).state = 'running';

    await expect(ensureAudioContextReady()).resolves.toBe(true);
    expect(Tone.start).not.toHaveBeenCalled();
  });
});
