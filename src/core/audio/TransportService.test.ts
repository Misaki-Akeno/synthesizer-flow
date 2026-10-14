import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transportService } from './TransportService';

function createTone() {
  const transport = {
    state: 'stopped',
    position: 12 as number | string,
    ticks: 96,
    PPQ: 192,
    bpm: { value: 120 },
    start: vi.fn(() => {
      transport.state = 'started';
    }),
    stop: vi.fn(() => {
      transport.state = 'stopped';
    }),
    pause: vi.fn(() => {
      transport.state = 'paused';
    }),
  };

  return { Transport: transport };
}

describe('TransportService', () => {
  beforeEach(() => transportService.reset());

  it('keeps the shared transport running until the last client stops', () => {
    const tone = createTone();

    transportService.start('clip-a', tone);
    transportService.start('clip-b', tone);
    transportService.stop('clip-a', tone);

    expect(tone.Transport.start).toHaveBeenCalledTimes(1);
    expect(tone.Transport.stop).not.toHaveBeenCalled();

    transportService.stop('clip-b', tone);

    expect(tone.Transport.stop).toHaveBeenCalledTimes(1);
    expect(tone.Transport.position).toBe(0);
  });

  it('pauses, resumes, seeks and exposes the active Tone clock', () => {
    const tone = createTone();
    transportService.start('clip-a', tone);

    transportService.pause();
    expect(tone.Transport.pause).toHaveBeenCalledTimes(1);
    transportService.start('clip-a', tone);
    expect(tone.Transport.start).toHaveBeenCalledTimes(1);
    transportService.seekTicks(480);
    transportService.setBpm(98);
    expect(tone.Transport.ticks).toBe(192);
    expect(transportService.getPositionTicks()).toBe(480);
    expect(tone.Transport.bpm.value).toBe(98);

    transportService.resume();
    expect(tone.Transport.start).toHaveBeenCalledTimes(2);
  });

  it('loops on the Tone clock with tick loop points', () => {
    const tone = createTone();
    const transport = tone.Transport as typeof tone.Transport & {
      loop?: boolean;
      loopStart?: string;
      loopEnd?: string;
    };
    transport.loop = false;
    transportService.setLoop(true, 480, 1920);
    transportService.start('clip-a', tone);

    // TRANSPORT_PPQ 480 换算到 Tone PPQ 192
    expect(transport).toMatchObject({ loop: true, loopStart: '192i', loopEnd: '768i' });

    transportService.setLoop(false, 0, 1920);
    expect(transport.loop).toBe(false);
  });

  it('reports the audible position behind the look-ahead and output latency', () => {
    const tone = {
      ...createTone(),
      immediate: () => 10,
      getContext: () => ({ rawContext: { outputLatency: 0.04, baseLatency: 0.01 } }),
    };
    const getTicksAtTime = vi.fn(() => 192);
    Object.assign(tone.Transport, { getTicksAtTime });
    transportService.start('clip-a', tone);

    expect(transportService.getPositionTicks()).toBe(480);
    expect(getTicksAtTime).toHaveBeenCalledWith(expect.closeTo(9.95, 6));
  });

  it('keeps a BPM changed while stopped and applies it before the next part', () => {
    transportService.setBpm(80);
    const tone = createTone();
    expect(tone.Transport.bpm.value).toBe(120);

    transportService.syncTempo(tone);

    expect(tone.Transport.bpm.value).toBe(80);
  });
});
