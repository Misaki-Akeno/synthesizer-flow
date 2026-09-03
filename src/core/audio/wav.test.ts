import { describe, expect, it } from 'vitest';
import { encodeAudioBufferToWav } from './wav';

describe('WAV encoder', () => {
  it('writes an interleaved stereo PCM header and clips samples', () => {
    const wav = encodeAudioBufferToWav({
      length: 2,
      numberOfChannels: 2,
      sampleRate: 48000,
      getChannelData: (channel) =>
        channel === 0
          ? new Float32Array([1.5, -1.5])
          : new Float32Array([0.5, -0.5]),
    });
    const view = new DataView(wav);
    const ascii = (start: number, length: number) =>
      String.fromCharCode(
        ...Array.from({ length }, (_, index) => view.getUint8(start + index))
      );

    expect(ascii(0, 4)).toBe('RIFF');
    expect(ascii(8, 4)).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint32(40, true)).toBe(8);
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(48, true)).toBe(-32768);
  });
});
