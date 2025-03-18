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

  // 创建边并建立模块间的绑定
  createEdgeWithBinding(id: string, source: string, target: string, sourceHandle?: string, targetHandle?: string): Edge {
    const edge = this.createEdge(id, source, target);
    
    // 将边绑定对应的两个节点
    this.bindModules(source, target, sourceHandle, targetHandle);
    
    return edge;
  }
  
  // 绑定两个模块
  bindModules(sourceId: string, targetId: string, sourceHandle?: string, targetHandle?: string): void {
    // 查找源节点和目标节点
    const nodes = this.getNodes();
    const sourceNode = nodes.find(node => node.id === sourceId);
    const targetNode = nodes.find(node => node.id === targetId);
    
    if (sourceNode?.data?.module && targetNode?.data?.module) {
      // 默认使用主要端口
      const sourcePort = sourceHandle || 'output';
      const targetPort = targetHandle || 'input';
      
      try {
        // 检查端口类型并建立绑定
        const sourceModule = sourceNode.data.module;
        const targetModule = targetNode.data.module;
        
        // 获取端口类型
        const sourceType = sourceModule.getOutputPortType(sourcePort);
        const targetType = targetModule.getInputPortType(targetPort);
        
        // 检查类型兼容性
        if (sourceType !== targetType) {
          console.error(
            `Type mismatch: Cannot connect ${sourceType} output to ${targetType} input`
          );
          return; // 阻止连接
        }
        
        // 建立绑定
        targetNode.data.module.bindInputToOutput(targetPort, sourceNode.data.module, sourcePort);
      } catch (error) {
        console.error(`Failed to bind modules: ${error}`);
      }
    }
  }
  
  // 移除边并解除绑定
  removeEdgeBinding(edge: Edge): void {
    const nodes = this.getNodes();
    const targetNode = nodes.find(node => node.id === edge.target);
    
    if (targetNode?.data?.module) {
      // 解除输入绑定
      const targetPort = edge.targetHandle || 'input';
      targetNode.data.module.unbindInput(targetPort);
    }
  }
  
  // 通过节点存储，用于查找节点
  private nodesGetter: (() => FlowNode[]) | null = null;
  
  setNodesGetter(getter: () => FlowNode[]): void {
    this.nodesGetter = getter;
  }
  
  private getNodes(): FlowNode[] {
    return this.nodesGetter ? this.nodesGetter() : [];
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
          module: moduleInstance,
          label,
          type
        }
      } as FlowNode;
    });
    
    // 注意：边的绑定应该在所有节点创建完毕后进行
    
    return { nodes, edges: presetEdges };
  }
  
  // 添加一个公共方法，专门用于建立所有边的绑定关系
  setupAllEdgeBindings(edges: Edge[]): void {
    edges.forEach(edge => {
      try {
        this.bindModules(
          edge.source,
          edge.target,
          edge.sourceHandle ?? undefined,
          edge.targetHandle ?? undefined
        );
      } catch (error) {
        console.error(`Failed to bind edge from ${edge.source} to ${edge.target}:`, error);
      }
    });
  }
}

export const moduleManager = new ModuleManager();
