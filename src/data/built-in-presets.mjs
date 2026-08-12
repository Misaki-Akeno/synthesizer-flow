/**
 * 随应用发布的官方示例。
 *
 * 数据库种子脚本和未登录用户看到的回退预设共用这一份定义，避免环境分支
 * 尚未 seed 时出现空白示例页，也避免两份示例工程逐渐漂移。
 */
export const BUILT_IN_PRESET_SEED = 'official-examples';
export const BUILT_IN_PRESET_SEED_VERSION = 1;
const SEED_TIMESTAMP = Date.UTC(2026, 6, 15, 0, 0, 0);

export const BUILT_IN_PRESETS = [
  {
    id: 'preset-signal-math-lab-v1',
    name: '信号数学实验室',
    description: '用两个数字输入、计算器和示波器理解 NUMBER 信号的连接与运算。',
    metadata: {
      seed: BUILT_IN_PRESET_SEED,
      seedVersion: BUILT_IN_PRESET_SEED_VERSION,
      difficulty: 'beginner',
      tags: ['logic', 'number', 'tutorial'],
    },
    data: {
      version: '1.0',
      timestamp: SEED_TIMESTAMP,
      nodes: [
        {
          id: 'math-input-a',
          position: { x: 80, y: 100 },
          data: {
            type: 'numberinput',
            label: '输入 A',
            parameters: { value: 120 },
          },
        },
        {
          id: 'math-input-b',
          position: { x: 80, y: 330 },
          data: {
            type: 'numberinput',
            label: '输入 B',
            parameters: { value: 24 },
          },
        },
        {
          id: 'math-calculator',
          position: { x: 390, y: 200 },
          data: {
            type: 'calculator',
            label: '加法器',
            parameters: { operation: '+', status: 'Ready' },
          },
        },
        {
          id: 'math-scope',
          position: { x: 700, y: 200 },
          data: {
            type: 'oscilloscope',
            label: '结果示波器',
            parameters: {},
          },
        },
      ],
      edges: [
        {
          source: 'math-input-a',
          target: 'math-calculator',
          sourceHandle: 'output',
          targetHandle: 'a',
        },
        {
          source: 'math-input-b',
          target: 'math-calculator',
          sourceHandle: 'output',
          targetHandle: 'b',
        },
        {
          source: 'math-calculator',
          target: 'math-scope',
          sourceHandle: 'output',
          targetHandle: 'input',
        },
      ],
      metadata: { example: true, seed: BUILT_IN_PRESET_SEED },
    },
  },
  {
    id: 'preset-space-oscillator-v1',
    name: '空间振荡器',
    description: '从振荡器出发，依次经过延迟和混响后连接到立体声输出。',
    metadata: {
      seed: BUILT_IN_PRESET_SEED,
      seedVersion: BUILT_IN_PRESET_SEED_VERSION,
      difficulty: 'beginner',
      tags: ['audio', 'effects', 'tutorial'],
    },
    data: {
      version: '1.0',
      timestamp: SEED_TIMESTAMP,
      nodes: [
        {
          id: 'space-oscillator',
          position: { x: 70, y: 170 },
          data: {
            type: 'simpleoscillator',
            label: '温暖振荡器',
            parameters: {
              gain: 0.35,
              freq: 220,
              waveform: 'triangle',
              freqModDepth: 2,
              gainModDepth: 0.5,
            },
          },
        },
        {
          id: 'space-delay',
          position: { x: 390, y: 120 },
          data: {
            type: 'delay',
            label: '短回声',
            parameters: { delayTime: 0.28, feedback: 0.36, wet: 0.35 },
          },
        },
        {
          id: 'space-reverb',
          position: { x: 700, y: 120 },
          data: {
            type: 'reverb',
            label: '空间混响',
            parameters: { decay: 3.2, wet: 0.42, preDelay: 0.04 },
          },
        },
        {
          id: 'space-speaker',
          position: { x: 1010, y: 170 },
          data: {
            type: 'speaker',
            label: '立体声输出',
            parameters: { level: -18, balance: 0 },
          },
        },
      ],
      edges: [
        {
          source: 'space-oscillator',
          target: 'space-delay',
          sourceHandle: 'audioout',
          targetHandle: 'input',
        },
        {
          source: 'space-delay',
          target: 'space-reverb',
          sourceHandle: 'output',
          targetHandle: 'input',
        },
        {
          source: 'space-reverb',
          target: 'space-speaker',
          sourceHandle: 'output',
          targetHandle: 'audioInLeft',
        },
        {
          source: 'space-reverb',
          target: 'space-speaker',
          sourceHandle: 'output',
          targetHandle: 'audioInRight',
        },
      ],
      metadata: { example: true, seed: BUILT_IN_PRESET_SEED },
    },
  },
];

export function getBuiltInPresetById(projectId) {
  return BUILT_IN_PRESETS.find((project) => project.id === projectId);
}
