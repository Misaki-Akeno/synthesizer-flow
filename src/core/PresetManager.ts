import { Edge } from '@xyflow/react';
import { moduleManager, FlowNode } from './ModuleManager';

export interface Preset {
  id: string;
  name: string;
  nodes: PresetNode[];
  edges: PresetEdge[];
}

export interface PresetNode {
  id: string;
  position: { x: number; y: number };
  data: {
    type: string;
    label?: string;
    parameters?: { [key: string]: number | boolean | string }; // 新增参数配置
    [key: string]: unknown;
  };
}

// 简化的边定义，不再需要手动指定ID
export interface PresetEdge {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export class PresetManager {
  private presets: Preset[];
  private defaultPresetId: string;

  constructor(initialPresets: Preset[] = [], defaultPresetId?: string) {
    // 深拷贝预设，避免引用问题
    this.presets = JSON.parse(JSON.stringify(initialPresets));
    // 设置默认预设ID，如果未指定则使用第一个预设
    this.defaultPresetId = defaultPresetId || (this.presets.length > 0 ? this.presets[0].id : '');
  }

  // 获取所有预设
  getPresets(): Preset[] {
    return this.presets;
  }

  // 获取单个预设
  getPreset(presetId: string): Preset | undefined {
    return this.presets.find((p) => p.id === presetId);
  }

  // 获取默认预设ID
  getDefaultPresetId(): string {
    return this.defaultPresetId;
  }

  // 设置默认预设
  setDefaultPresetId(presetId: string): void {
    if (this.getPreset(presetId)) {
      this.defaultPresetId = presetId;
    }
  }

  // 加载预设
  loadPresetWithModules(presetId: string): {
    nodes: FlowNode[];
    edges: Edge[];
  } {
    // 如果未指定预设ID或者预设不存在，使用默认预设
    const preset = this.getPreset(presetId) || this.getPreset(this.defaultPresetId) || this.presets[0];
    if (!preset) {
      throw new Error('No presets available');
    }
    const presetNodes = JSON.parse(JSON.stringify(preset.nodes));
    const presetEdges = JSON.parse(JSON.stringify(preset.edges));

    // 使用 ModuleManager 创建带有模块实例的完整流程
    return moduleManager.createFlowFromPreset(presetNodes, presetEdges);
  }
}

// 预设数据
const majorChordPreset: Preset = {
  id: 'major-chord',
  name: '大三和弦预设',
  nodes: [
    {
      id: 'mainOscillator',
      position: { x: 300, y: 200 },
      data: {
        type: 'simpleoscillator',
        label: '主振荡器(C4)',
        parameters: {
          freq: 523,
        },
      },
    },
    {
      id: 'reverbEffect',
      position: { x: 600, y: 200 },
      data: {
        type: 'reverb',
        label: '混响效果器',
        parameters: {
          decay: 2.5,
          wet: 0.8,
        },
      },
    },
    {
      id: 'mainSpeaker',
      position: { x: 900, y: 200 },
      data: { type: 'speaker', label: '扬声器' },
    },
    {
      id: 'modulationLFO',
      position: { x: 0, y: 200 },
      data: {
        type: 'lfo',
        label: '低频调制器',
      },
    },
    {
      id: 'thirdHarmonicOsc',
      position: { x: 300, y: 550 },
      data: {
        type: 'simpleoscillator',
        label: '三度音(E4)',
        parameters: {
          freq: 659,
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
          freq: 784,
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
          freq: 262,
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
      target: 'mainSpeaker',
      sourceHandle: 'output',
      targetHandle: 'audioIn',
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
};


// MIDI输入测试预设
const midiInputTestPreset: Preset = {
  id: 'midi-input-test',
  name: 'MIDI控制器输入测试',
  nodes: [
    {
      id: 'midiInput',
      position: { x: 200, y: 200 },
      data: {
        type: 'midiinput',
        label: 'MIDI控制器输入',
        parameters: {
          channel: 0, // 所有通道
          transpose: 0,
          velocitySensitivity: 1.0,
        },
      },
    },
    {
      id: 'advancedOsc',
      position: { x: 500, y: 200 },
      data: {
        type: 'advancedoscillator',
        label: '高级振荡器',
      },
    },
    {
      id: 'reverbEffect',
      position: { x: 800, y: 200 },
      data: {
        type: 'reverb',
        label: '混响效果器',
        parameters: {
          decay: 1.5,
          wet: 0.4,
        },
      },
    },
    {
      id: 'speaker',
      position: { x: 1100, y: 200 },
      data: { 
        type: 'speaker', 
        label: '扬声器',
        parameters: {
          level: -12,
        },
      },
    },
  ],
  edges: [
    {
      source: 'midiInput',
      target: 'advancedOsc',
      sourceHandle: 'note',
      targetHandle: 'note',
    },
    {
      source: 'midiInput',
      target: 'advancedOsc',
      sourceHandle: 'velocity',
      targetHandle: 'velocity',
    },
    {
      source: 'advancedOsc',
      target: 'reverbEffect',
      sourceHandle: 'audioout',
      targetHandle: 'input',
    },
    {
      source: 'reverbEffect',
      target: 'speaker',
      sourceHandle: 'output',
      targetHandle: 'audioIn',
    },
  ],
};

// 创建并导出预设管理器实例，设置'midi-input-test'为默认预设
export const presetManager = new PresetManager([majorChordPreset, midiInputTestPreset], 'midi-input-test');
