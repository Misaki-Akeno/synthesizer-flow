//这是一个临时方法，暂时存储预设项目

import { ProjectConfig } from '../store/persist-store';

// 工具函数：将JSON字符串转换为URL安全格式
function makeJsonUrlSafe(jsonStr: string): string {
  return encodeURIComponent(jsonStr);
}

// 预设项目数据（直接使用ProjectConfig格式）
const presets: ProjectConfig[] = [
  {
    id: 'preset-midi', // 使用更简短的ID
    name: 'MIDI控制复音合成器',
    description: '使用MIDI输入控制复音振荡器，带有混响效果',
    created: '2025-04-15T10:00:00.000Z',
    lastModified: '2025-04-15T10:00:00.000Z',
    data: makeJsonUrlSafe(
      JSON.stringify({
        version: '1.0',
        timestamp: 1745825505607,
        nodes: [
          {
            id: 'midiInput',
            position: { x: 200, y: 200 },
            data: {
              type: 'midiinput',
              label: 'MIDI控制器输入',
              parameters: {
                channel: 0,
                inputDevice: '',
                transpose: 0,
                velocitySensitivity: 1,
              },
            },
          },
          {
            id: 'polyOsc',
            position: { x: 500, y: 200 },
            data: {
              type: 'advancedoscillator',
              label: '复音振荡器',
              parameters: {
                detune: 0,
                octave: 0,
                semi: 0,
                gainDb: 0,
                waveform: 'triangle',
                voiceCount: 8,
                attackVelSens: 0.8,
                attack: 0.2,
                decay: 0.5,
                sustain: 0.7,
                sustainTime: 0,
                release: 0.8,
              },
            },
          },
          {
            id: 'reverbEffect',
            position: { x: 700, y: 200 },
            data: {
              type: 'reverb',
              label: '混响效果器',
              parameters: { decay: 1.8, wet: 0.35, preDelay: 0.01 },
            },
          },
          {
            id: 'speaker',
            position: { x: 950, y: 200 },
            data: {
              type: 'speaker',
              label: '扬声器',
              parameters: { level: -12 },
            },
          },
          {
            id: 'node_1745825426684',
            position: { x: 72.9033784231475, y: 515.2614902237319 },
            data: {
              type: 'keyboardinput',
              label: '键盘输入器',
              parameters: {
                transpose: 0,
                velocitySensitivity: 1,
                startNote: 60,
                noteCount: 24,
                keyboardEnabled: true,
              },
            },
          },
        ],
        edges: [
          {
            source: 'midiInput',
            target: 'polyOsc',
            sourceHandle: 'activeNotes',
            targetHandle: 'notes',
          },
          {
            source: 'midiInput',
            target: 'polyOsc',
            sourceHandle: 'activeVelocities',
            targetHandle: 'velocities',
          },
          {
            source: 'polyOsc',
            target: 'reverbEffect',
            sourceHandle: 'audioout',
            targetHandle: 'input',
          },
          {
            source: 'reverbEffect',
            target: 'speaker',
            sourceHandle: 'output',
            targetHandle: 'audioInLeft',
          },
          {
            source: 'reverbEffect',
            target: 'speaker',
            sourceHandle: 'output',
            targetHandle: 'audioInRight',
          },
          {
            source: 'node_1745825426684',
            target: 'polyOsc',
            sourceHandle: 'activeNotes',
            targetHandle: 'notes',
          },
          {
            source: 'node_1745825426684',
            target: 'polyOsc',
            sourceHandle: 'activeVelocities',
            targetHandle: 'velocities',
          },
        ],
      })
    ),
    isBuiltIn: true,
  },
  {
    id: 'preset-chord', // 使用更简短的ID
    name: '多振荡器和声',
    description:
      '由一个主振荡器、三度音、五度音和低八度组成的和声，带有LFO调制和混响效果',
    created: '2025-04-15T10:00:00.000Z',
    lastModified: '2025-04-15T10:00:00.000Z',
    data: makeJsonUrlSafe(
      JSON.stringify({
        version: '1.0',
        timestamp: 1744964783560,
        nodes: [
          {
            id: 'mainOscillator',
            position: { x: 300, y: 200 },
            data: {
              type: 'simpleoscillator',
              label: '主振荡器(C4)',
              parameters: {
                gain: 1,
                freq: 523,
                waveform: 'sine',
                freqModDepth: 2,
                gainModDepth: 0.5,
              },
            },
          },
          {
            id: 'reverbEffect',
            position: { x: 600, y: 200 },
            data: {
              type: 'reverb',
              label: '混响效果器',
              parameters: { decay: 2.5, wet: 0.8, preDelay: 0.01 },
            },
          },
          {
            id: 'mainSpeaker',
            position: { x: 900, y: 200 },
            data: {
              type: 'speaker',
              label: '扬声器',
              parameters: { level: -12 },
            },
          },
          {
            id: 'modulationLFO',
            position: { x: 0, y: 200 },
            data: {
              type: 'lfo',
              label: '低频调制器',
              parameters: { rate: 1, depth: 0.5, waveform: 'sine' },
            },
          },
          {
            id: 'thirdHarmonicOsc',
            position: { x: 300, y: 550 },
            data: {
              type: 'simpleoscillator',
              label: '三度音(E4)',
              parameters: {
                gain: 1,
                freq: 659,
                waveform: 'sine',
                freqModDepth: 2,
                gainModDepth: 0.5,
              },
            },
          },
          {
            id: 'fifthHarmonicOsc',
            position: { x: 300, y: 900 },
            data: {
              type: 'simpleoscillator',
              label: '五度音(G4)',
              parameters: {
                gain: 1,
                freq: 784,
                waveform: 'sine',
                freqModDepth: 2,
                gainModDepth: 0.5,
              },
            },
          },
          {
            id: 'bassOscillator',
            position: { x: 300, y: 1250 },
            data: {
              type: 'simpleoscillator',
              label: '低八度(C3)',
              parameters: {
                gain: 1,
                freq: 262,
                waveform: 'sine',
                freqModDepth: 2,
                gainModDepth: 0.5,
              },
            },
          },
        ],
        edges: [
          {
            source: 'mainOscillator',
            target: 'reverbEffect',
            sourceHandle: 'audioout',
            targetHandle: 'input',
          },
          {
            source: 'reverbEffect',
            target: 'speaker',
            sourceHandle: 'output',
            targetHandle: 'audioInLeft',
          },
          {
            source: 'reverbEffect',
            target: 'speaker',
            sourceHandle: 'output',
            targetHandle: 'audioInRight',
          },
          {
            source: 'modulationLFO',
            target: 'mainOscillator',
            sourceHandle: 'signal',
            targetHandle: 'freqMod',
          },
          {
            source: 'modulationLFO',
            target: 'thirdHarmonicOsc',
            sourceHandle: 'signal',
            targetHandle: 'freqMod',
          },
          {
            source: 'thirdHarmonicOsc',
            target: 'reverbEffect',
            sourceHandle: 'audioout',
            targetHandle: 'input',
          },
          {
            source: 'modulationLFO',
            target: 'fifthHarmonicOsc',
            sourceHandle: 'signal',
            targetHandle: 'freqMod',
          },
          {
            source: 'fifthHarmonicOsc',
            target: 'reverbEffect',
            sourceHandle: 'audioout',
            targetHandle: 'input',
          },
          {
            source: 'modulationLFO',
            target: 'bassOscillator',
            sourceHandle: 'signal',
            targetHandle: 'freqMod',
          },
          {
            source: 'bassOscillator',
            target: 'reverbEffect',
            sourceHandle: 'audioout',
            targetHandle: 'input',
          },
        ],
      })
    ),
    isBuiltIn: true,
  },
];

/**
 * 根据索引获取特定预设
 * @param index 预设索引
 * @returns 预设数据或null
 */
export function getPresetByIndex(index: number): ProjectConfig | null {
  if (index >= 0 && index < presets.length) {
    return presets[index];
  }
  return null;
}

/**
 * 获取所有预设
 * @returns 所有预设数据
 */
export function getAllPresets(): ProjectConfig[] {
  return presets;
}

/**
 * 获取指定ID的内置预设
 * @param id 预设ID
 * @returns 预设数据或null
 */
export function getPresetById(id: string): ProjectConfig | null {
  return presets.find((preset) => preset.id === id) || null;
}

/**
 * 按名称获取预设
 * @param name 预设名称
 * @returns 预设数据或null
 */
export function getPresetByName(name: string): ProjectConfig | null {
  return presets.find((preset) => preset.name === name) || null;
}
