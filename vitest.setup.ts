import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// 模拟 Tone.js
vi.mock('tone', () => {
  return {
    // 在此添加 Tone.js 的模拟实现
    start: vi.fn(),
    Transport: {
      start: vi.fn(),
      stop: vi.fn(),
      bpm: { value: 120 },
    },
    Oscillator: vi.fn().mockImplementation(() => ({
      set: vi.fn(),
      start: vi.fn(),
      connect: vi.fn(),
      frequency: { value: 440 },
      detune: { value: 0 },
      type: 'sine',
      stop: vi.fn(),
      dispose: vi.fn(),
    })),
    Gain: vi.fn().mockImplementation(() => ({
      gain: { value: 0.8 },
      connect: vi.fn(),
      dispose: vi.fn(),
    })),
  };
});

// 模拟 Web Audio API
window.AudioContext = vi.fn().mockImplementation(() => ({
  createOscillator: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    start: vi.fn(),
  })),
  createGain: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    gain: { value: 0 },
  })),
  destination: {},
}));
