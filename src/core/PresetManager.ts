import { Edge } from '@xyflow/react';
import { moduleManager, FlowNode } from './ModuleManager';

export interface Preset {
  id: string;
  name: string;
  nodes: PresetNode[];
  edges: Edge[];
}

export interface PresetNode {
  id: string;
  position: { x: number; y: number };
  data: {
    type: string;
    label?: string;
    [key: string]: unknown;
  };
}

export class PresetManager {
  private presets: Preset[];
  
  constructor(initialPresets: Preset[] = []) {
    // 深拷贝预设，避免引用问题
    this.presets = JSON.parse(JSON.stringify(initialPresets));
  }

  // 获取所有预设
  getPresets(): Preset[] {
    return this.presets;
  }

  // 获取单个预设
  getPreset(presetId: string): Preset | undefined {
    return this.presets.find((p) => p.id === presetId);
  }

  // 加载预设
  loadPresetWithModules(presetId: string): { nodes: FlowNode[]; edges: Edge[] } {
    const preset = this.getPreset(presetId) || this.presets[0];
    if (!preset) {
      throw new Error("No presets available");
    }
    const presetNodes = JSON.parse(JSON.stringify(preset.nodes));
    const presetEdges = JSON.parse(JSON.stringify(preset.edges));

    // 使用 ModuleManager 创建带有模块实例的完整流程
    return moduleManager.createFlowFromPreset(presetNodes, presetEdges);
  }
}

// 预设数据
const defaultPreset: Preset = {
  id: 'default',
  name: '默认预设',
  nodes: [
    {
      id: '1',
      position: { x: 300, y: 500 },
      data: { type: 'oscillator', label: '振荡器' },
    },
    {
      id: '2',
      position: { x: 600, y: 500 },
      data: { type: 'reverb', label: '混响效果器' },
    },
    {
      id: '3',
      position: { x: 900, y: 500 },
      data: { type: 'speaker', label: '音响' },
    },
    {
      id: '4',
      position: { x: 300, y: 300 },
      data: { type: 'lfo', label: 'LFO' },
    },
  ],
  edges: [
    {
      id: 'e1-2',
      source: '1',
      target: '2',
      sourceHandle: 'audioout',
      targetHandle: 'input',
    },
    {
      id: 'e2-3',
      source: '2',
      target: '3',
      sourceHandle: 'output',
      targetHandle: 'audioIn',
    },
    {
      id: 'e4-1',
      source: '4',
      target: '1',
      sourceHandle: 'signal',
      targetHandle: 'freqMod',
    },
  ],
};

// 创建并导出预设管理器实例
export const presetManager = new PresetManager([defaultPreset]);


