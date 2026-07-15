import { beforeEach, describe, expect, it, vi } from 'vitest';
import { transportService } from './TransportService';

function createTone() {
  const transport = {
    state: 'stopped',
    position: 12 as number | string,
    start: vi.fn(() => {
      transport.state = 'started';
    }),
    stop: vi.fn(() => {
      transport.state = 'stopped';
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
});
