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
    // 根据项目需要继续添加更多模拟
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
