import { describe, expect, it, vi } from 'vitest';
import { createThreadId } from './threadId';

describe('createThreadId', () => {
  it('uses randomUUID when available', () => {
    expect(
      createThreadId({
        randomUUID: () => 'uuid-from-browser',
      })
    ).toBe('uuid-from-browser');
  });

  it('builds an RFC4122-shaped id from getRandomValues when randomUUID is missing', () => {
    const id = createThreadId({
      getRandomValues: (array) => {
        array.set([
          0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa,
          0xbb, 0xcc, 0xdd, 0xee, 0xff,
        ]);
        return array;
      },
    });

    expect(id).toBe('00112233-4455-4677-8899-aabbccddeeff');
  });

  it('falls back to a time-based id without Math.random', () => {
    vi.spyOn(Date, 'now').mockReturnValue(123456789);

    expect(createThreadId()).toBe(`thread_${(123456789).toString(36)}`);
  });
});
