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
      position: { x: 500, y: 500 },
      data: { type: 'input', label: '输入节点' },
    },
    {
      id: '2',
      position: { x: 800, y: 500 },
      data: { type: 'output', label: '输出节点' },
    },
  ],
  edges: [{ id: 'e1-2', source: '1', target: '2' }],
};

// 创建并导出预设管理器实例
export const presetManager = new PresetManager([defaultPreset]);// 预设节点接口


