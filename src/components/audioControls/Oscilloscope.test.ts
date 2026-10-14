import { describe, expect, it } from 'vitest';
import { RingBuffer } from './Oscilloscope';

describe('RingBuffer', () => {
  it('keeps the latest values in insertion order once full', () => {
    const buffer = new RingBuffer(3);
    expect(buffer.last()).toBeUndefined();

    [1, 2, 3, 4, 5].forEach((value) => buffer.push(value));

    expect(buffer.length).toBe(3);
    expect([0, 1, 2].map((index) => buffer.at(index))).toEqual([3, 4, 5]);
    expect(buffer.last()).toBe(5);
  });
});
