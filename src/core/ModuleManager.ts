import { Node, Edge } from '@xyflow/react';
import { ModuleBase } from './ModuleBase';
import { InputModule } from './Modules/InputModule';
import { OutputModule } from './Modules/OutputModule';
import { PresetNode } from './PresetManager';

// 节点数据接口
export interface NodeData {
  module: ModuleBase; // 设为必选项，确保每个节点都有模块
  [key: string]: unknown;
}

export type FlowNode = Node<NodeData>;

export class ModuleManager {
  // 模块类型映射表
  private moduleRegistry: Record<string, new (id: string, name: string) => ModuleBase> = {
    'input': InputModule,
    'output': OutputModule,
  };

  // 创建模块实例
  createModuleInstance(type: string, id: string, name: string): ModuleBase {
    const ModuleClass = this.moduleRegistry[type];
    
    if (!ModuleClass) {
      throw new Error(`Unknown module type: ${type}`);
    }
    
    return new ModuleClass(id, name);
  }

  // 创建带有模块实例的节点
  createNode(id: string, type: string, label: string, position: { x: number, y: number }): FlowNode {
    const moduleInstance = this.createModuleInstance(type, id, label);
    return {
      id,
      position,
      type: 'default', // 节点的视觉类型，可以根据需要调整
      data: {
        module: moduleInstance,
      },
    };
  }

  // 创建边
  createEdge(id: string, source: string, target: string): Edge {
    return {
      id,
      source,
      target
    };
  }

  // 从预设数据创建流程图
  createFlowFromPreset(presetNodes: PresetNode[], presetEdges: Edge[]): { nodes: FlowNode[], edges: Edge[] } {
    // 将预设节点转换为带有模块的流程节点
    const nodes = presetNodes.map(node => {
      const { id, position, data } = node;
      const type = data.type;
      const label = data.label || id;
      
      const moduleInstance = this.createModuleInstance(type, id, label);
      
      return {
        id,
        position,
        type: 'default',
        data: {
          module: moduleInstance
        }
      } as FlowNode;
    });
    
    return { nodes, edges: presetEdges };
  }
}


export const moduleManager = new ModuleManager();
