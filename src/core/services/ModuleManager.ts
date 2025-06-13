import { Node, Edge } from '@xyflow/react';
import { ModuleBase } from '../base/ModuleBase';
import { moduleClassMap } from '../modules/index';
import { SerializedNode, SerializedEdge } from '../types/SerializationTypes';
import { createModuleLogger } from '@/lib/logger';

// 创建模块管理器的专用日志记录器
const logger = createModuleLogger('ModuleManager');

// 节点数据接口，添加索引签名兼容 Record<string, unknown>
export interface NodeData {
  module: ModuleBase;
  label: string;
  type: string;
  [key: string]: unknown; // 添加索引签名
}

export type FlowNode = Node<NodeData>;

export class ModuleManager {
  // 模块实例注册表
  private moduleInstances: Map<string, ModuleBase> = new Map();

  // 创建模块实例
  createModuleInstance(
    type: string,
    id: string = `module_${Date.now()}`,
    name: string = type
  ): ModuleBase {
    const ModuleClass = moduleClassMap[type.toLowerCase()];
    if (!ModuleClass) {
      logger.error(`未知模块类型: ${type}`);
      // 使用 SpeakerModule 作为默认后备选择
      return new moduleClassMap.speaker(id, name);
    }

    const moduleInstance = new ModuleClass(id, name);
    this.moduleInstances.set(id, moduleInstance);
    return moduleInstance;
  }

  // 获取模块实例
  getModule(id: string): ModuleBase | undefined {
    return this.moduleInstances.get(id);
  }

  // 创建流程节点
  createNode(
    id: string,
    type: string,
    label: string,
    position: { x: number; y: number }
  ): FlowNode {
    // 创建模块实例
    const moduleInstance = this.createModuleInstance(type, id, label);

    return {
      id,
      type: 'default',
      position,
      dragHandle: '.node-drag-handle',
      data: {
        module: moduleInstance,
        label: label || id,
        type,
      },
    };
  }

  // 生成边ID
  generateEdgeId(
    source: string,
    target: string,
    sourceHandle?: string,
    targetHandle?: string
  ): string {
    const sourceStr = sourceHandle ? `${source}-${sourceHandle}` : source;
    const targetStr = targetHandle ? `${target}-${targetHandle}` : target;
    return `edge_${sourceStr}_to_${targetStr}`;
  }

  // 创建边
  createEdge(
    source: string,
    target: string,
    sourceHandle?: string,
    targetHandle?: string
  ): Edge {
    return {
      id: this.generateEdgeId(source, target, sourceHandle, targetHandle),
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
    const sourceModule = this.getModule(sourceId);
    const targetModule = this.getModule(targetId);

    if (!sourceModule || !targetModule) {
      logger.error('无法找到要绑定的模块', { sourceId, targetId });
      return;
    }

    // 将源模块的输出连接到目标模块的输入
    if (sourceHandle && targetHandle) {
      // 带端口的连接
      if (
        sourceModule.outputPortTypes[sourceHandle] ===
        targetModule.inputPortTypes[targetHandle]
      ) {
        sourceModule.connectOutput(sourceHandle, targetModule, targetHandle);
      } else {
        logger.error('端口类型不匹配', {
          sourceType: sourceModule.outputPortTypes[sourceHandle],
          targetType: targetModule.inputPortTypes[targetHandle],
        });
      }
    } else {
      // 直接连接（通常用于简单模块，如没有多输入端口的情况）
      sourceModule.connectOutput('output', targetModule, 'input');
    }
  }

  // 移除边并解除绑定
  removeEdgeBinding(edge: Edge): void {
    const sourceModule = this.getModule(edge.source);
    const targetModule = this.getModule(edge.target);

    if (!sourceModule || !targetModule) {
      logger.warn('无法找到要解除绑定的模块', {
        sourceId: edge.source,
        targetId: edge.target,
      });
      return;
    }

    // 解除源模块与目标模块的连接
    const sourceHandle = edge.sourceHandle || 'output';
    const targetHandle = edge.targetHandle || 'input';
    sourceModule.disconnectOutput(sourceHandle, targetModule, targetHandle);
  }

  // 通过节点存储，用于查找节点
  private nodesGetter: (() => FlowNode[]) | null = null;

  // 设置节点获取函数
  setNodesGetter(getter: () => FlowNode[]): void {
    this.nodesGetter = getter;
  }

  // 获取当前节点列表
  private getNodes(): FlowNode[] {
    if (!this.nodesGetter) {
      logger.warn('节点获取器未设置');
      return [];
    }
    return this.nodesGetter();
  }

  // 从序列化数据创建流程图
  createFlowFromSerializedData(
    serializedNodes: SerializedNode[],
    serializedEdges: SerializedEdge[]
  ): { nodes: FlowNode[]; edges: Edge[] } {
    // 将序列化节点转换为带有模块的流程节点
    const nodes = serializedNodes.map((node) => {
      const { id, position, data } = node;
      const type = data.type;
      const label = data.label || id;

      const moduleInstance = this.createModuleInstance(type, id, label);

      // 应用序列化中定义的参数
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
    const edges = serializedEdges.map((edge) => ({
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
    // 对边进行排序，确保正确的初始化顺序
    const sortedEdges = this.sortEdgesByDependency(edges);

    // 建立所有绑定关系
    sortedEdges.forEach((edge) => {
      this.bindModules(
        edge.source,
        edge.target,
        edge.sourceHandle ?? undefined,
        edge.targetHandle ?? undefined
      );
    });
  }

  /**
   * 根据依赖关系对边进行排序，确保源节点先于目标节点
   */
  private sortEdgesByDependency(edges: Edge[]): Edge[] {
    // 简单实现，返回复制的数组
    return [...edges];
  }
}

export const moduleManager = new ModuleManager();
