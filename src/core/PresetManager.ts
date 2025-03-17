import { Node, Edge } from '@xyflow/react';
import { InputModule } from './Modules/InputModule';
import { OutputModule } from './Modules/OutputModule';
import { ModuleBase } from './ModuleBase';

export interface Preset {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
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

  // 添加预设
  addPreset(preset: Preset): void {
    this.presets.push(JSON.parse(JSON.stringify(preset)));
  }

  // 加载预设时注入模块实例
  loadPresetWithModules(presetId: string): { nodes: Node[]; edges: Edge[] } {
    const preset = this.getPreset(presetId) || this.presets[0];
    if (!preset) {
      throw new Error("No presets available");
    }

    // 深拷贝节点和边，避免修改原始预设
    const nodes: Node[] = JSON.parse(JSON.stringify(preset.nodes));
    const edges: Edge[] = JSON.parse(JSON.stringify(preset.edges));

    // 为每个节点注入对应模块实例
    nodes.forEach(node => {
      const moduleType = node.data?.type as string;
      if (moduleType) {
        node.data.module = this.createModuleInstance(moduleType, node.id, node.data.label as string);
      }
    });

    return { nodes, edges };
  }

  // 根据类型创建对应模块实例
  private createModuleInstance(type: string, id: string, name: string): ModuleBase {
    switch (type) {
      case 'input':
        return new InputModule(id, name);
      case 'output':
        return new OutputModule(id, name);
      default:
        throw new Error(`Unknown module type: ${type}`);
    }
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
      position: { x: 700, y: 500 },
      data: { type: 'output', label: '输出节点' },
    },
  ],
  edges: [{ id: 'e1-2', source: '1', target: '2' }],
};

// 创建并导出预设管理器实例
export const presetManager = new PresetManager([defaultPreset]);
