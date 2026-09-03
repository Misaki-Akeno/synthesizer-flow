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
});
