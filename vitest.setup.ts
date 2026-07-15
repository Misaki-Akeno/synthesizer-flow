import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    clear: vi.fn(() => {
      store = {};
    }),
    getItem: vi.fn((key: string) => store[key] ?? null),
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    get length() {
      return Object.keys(store).length;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});

// 模拟 Tone.js
vi.mock('tone', () => {
  return {
    // 在此添加 Tone.js 的模拟实现
    start: vi.fn(),
    context: {
      state: 'running',
      dispose: vi.fn(),
    },
    Transport: {
      start: vi.fn(),
      stop: vi.fn(),
      bpm: { value: 120 },
      state: 'started',
    },
    Draw: {
      schedule: vi.fn((callback: () => void) => callback()),
    },
    Time: vi.fn().mockImplementation((value: number | string) => ({
      toSeconds: () => {
        if (typeof value === 'number') return value;
        if (value === '4n') return 0.5;
        if (value === '8n') return 0.25;
        return 0.5;
      },
    })),
    Part: vi.fn().mockImplementation(() => ({
      start: vi.fn().mockReturnThis(),
      dispose: vi.fn(),
      loop: false,
      loopEnd: 0,
    })),
    Frequency: vi.fn().mockImplementation((value: number | string) => ({
      toMidi: () => (typeof value === 'number' ? value : 60),
      toFrequency: () =>
        typeof value === 'number'
          ? 440 * Math.pow(2, (value - 69) / 12)
          : 261.63,
    })),
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
