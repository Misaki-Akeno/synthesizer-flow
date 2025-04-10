import { Node, Edge } from '@xyflow/react';
import { ModuleBase } from './ModuleBase';
import { OscillatorModule } from './Modules/OscillatorModule';
import { SpeakerModule } from './Modules/SpeakerModule';
import { ReverbModule } from './Modules/ReverbModule';
import { PresetNode, PresetEdge } from './PresetManager';
import { LFOModule } from './Modules/LFOModule';

// 节点数据接口
export interface NodeData {
  module: ModuleBase; // 设为必选项，确保每个节点都有模块
  [key: string]: unknown;
}

export type FlowNode = Node<NodeData>;

export class ModuleManager {
  // 模块类型映射表
  private moduleRegistry: Record<
    string,
    new (id: string, name: string) => ModuleBase
  > = {
    oscillator: OscillatorModule,
    speaker: SpeakerModule,
    reverb: ReverbModule,
    lfo: LFOModule,
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
  createNode(
    id: string,
    type: string,
    label: string,
    position: { x: number; y: number }
  ): FlowNode {
    const moduleInstance = this.createModuleInstance(type, id, label);
    return {
      id,
      position,
      type: 'default', // 节点的视觉类型，可以根据需要调整
      dragHandle: '.node-drag-handle', // 指定标题栏为拖动句柄
      data: {
        module: moduleInstance,
      },
    };
  }

  // 生成边ID
  generateEdgeId(
    source: string,
    target: string,
    _sourceHandle?: string,
    _targetHandle?: string
  ): string {
    return `e-${source}-${target}-${Math.random().toString(36).substring(2, 9)}`;
  }

  // 创建边
  createEdge(
    source: string,
    target: string,
    sourceHandle?: string,
    targetHandle?: string
  ): Edge {
    const id = this.generateEdgeId(source, target, sourceHandle, targetHandle);
    return {
      id,
      source,
      target,
      sourceHandle,
      targetHandle,
    };
  }

  // 创建边并建立模块间的绑定
  createEdgeWithBinding(
    source: string,
    target: string,
    sourceHandle?: string,
    targetHandle?: string
  ): Edge {
    const edge = this.createEdge(source, target, sourceHandle, targetHandle);

    // 将边绑定对应的两个节点
    this.bindModules(source, target, sourceHandle, targetHandle);

    return edge;
  }

  // 绑定两个模块
  bindModules(
    sourceId: string,
    targetId: string,
    sourceHandle?: string,
    targetHandle?: string
  ): void {
    const nodes = this.getNodes();
    const sourceNode = nodes.find((node) => node.id === sourceId);
    const targetNode = nodes.find((node) => node.id === targetId);

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
        targetNode.data.module.bindInputToOutput(
          targetPort,
          sourceNode.data.module,
          sourcePort
        );

        // 记录连接事件
        import('./ModuleInitManager').then(({ moduleInitManager }) => {
          moduleInitManager.recordConnection(sourceId, targetId);
        });
      } catch (error) {
        console.error(`Failed to bind modules: ${error}`);

        // 记录错误事件
        import('./ModuleInitManager').then(({ moduleInitManager }) => {
          moduleInitManager.recordError(sourceId, { error, targetId });
        });
      }
    } else {
      console.warn(
        `[ModuleManager] Could not find modules for binding: ${sourceId} -> ${targetId}`
      );
      if (!sourceNode)
        console.warn(`[ModuleManager] Source node ${sourceId} not found`);
      if (!targetNode)
        console.warn(`[ModuleManager] Target node ${targetId} not found`);
    }
  }

  // 移除边并解除绑定
  removeEdgeBinding(edge: Edge): void {
    const nodes = this.getNodes();
    const _sourceNode = nodes.find((node) => node.id === edge.source);
    const targetNode = nodes.find((node) => node.id === edge.target);

    if (targetNode?.data?.module) {
      // 解除输入绑定，现在可以指定源模块ID
      const targetPort = edge.targetHandle || 'input';
      const sourceId = edge.source;
      const sourcePort = edge.sourceHandle || 'output';

      targetNode.data.module.unbindInput(targetPort, sourceId, sourcePort);
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
  createFlowFromPreset(
    presetNodes: PresetNode[],
    presetEdges: PresetEdge[]
  ): { nodes: FlowNode[]; edges: Edge[] } {
    // 将预设节点转换为带有模块的流程节点
    const nodes = presetNodes.map((node) => {
      const { id, position, data } = node;
      const type = data.type;
      const label = data.label || id;

      const moduleInstance = this.createModuleInstance(type, id, label);

      // 应用预设中定义的参数
      if (data.parameters) {
        Object.entries(data.parameters).forEach(([key, value]) => {
          moduleInstance.updateParameter(key, value);
        });
      }

      return {
        id,
        position,
        type: 'default',
        dragHandle: '.node-drag-handle',
        data: {
          module: moduleInstance,
          label,
          type,
        },
      } as FlowNode;
    });

    // 为边生成ID
    const edges = presetEdges.map((edge) => ({
      id: this.generateEdgeId(
        edge.source,
        edge.target,
        edge.sourceHandle,
        edge.targetHandle
      ),
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    }));

    return { nodes, edges };
  }

  // 添加一个公共方法，专门用于建立所有边的绑定关系
  setupAllEdgeBindings(edges: Edge[]): void {
    const sortedEdges = this.sortEdgesByDependency(edges);

    sortedEdges.forEach((edge, _index) => {
      try {
        this.bindModules(
          edge.source,
          edge.target,
          edge.sourceHandle ?? undefined,
          edge.targetHandle ?? undefined
        );
      } catch (error) {
        console.error(
          `Failed to bind edge from ${edge.source} to ${edge.target}:`,
          error
        );
      }
    });
  }

  /**
   * 根据依赖关系对边进行排序，确保源节点先于目标节点
   */
  private sortEdgesByDependency(edges: Edge[]): Edge[] {
    // 创建一个依赖图
    const dependencyGraph: Record<string, string[]> = {};

    // 初始化图
    edges.forEach((edge) => {
      if (!dependencyGraph[edge.source]) {
        dependencyGraph[edge.source] = [];
      }
      if (!dependencyGraph[edge.target]) {
        dependencyGraph[edge.target] = [edge.source];
      } else {
        dependencyGraph[edge.target].push(edge.source);
      }
    });

    // 为所有节点分配处理顺序
    const processed: Record<string, number> = {};
    let order = 0;

    // 递归处理节点
    const processNode = (nodeId: string) => {
      if (processed[nodeId] !== undefined) return;
      // 处理所有依赖
      (dependencyGraph[nodeId] || []).forEach((depId) => {
        processNode(depId);
      });
      processed[nodeId] = order++;
    };

    // 处理所有节点
    Object.keys(dependencyGraph).forEach((nodeId) => {
      processNode(nodeId);
    });

    // 根据节点处理顺序对边进行排序
    return [...edges].sort((a, b) => {
      // 源节点顺序相同时，比较目标节点
      if (processed[a.source] === processed[b.source]) {
        return processed[a.target] - processed[b.target];
      }
      return processed[a.source] - processed[b.source];
    });
  }
}

export const moduleManager = new ModuleManager();
