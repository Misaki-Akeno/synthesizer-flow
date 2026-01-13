/**
 * 工具执行器 - 执行工具调用
 * 修改为服务端运行，通过模拟状态变更并返回操作指令给客户端执行
 */

import { createModuleLogger } from '@/lib/logger';
import { searchDocuments } from '@/lib/rag/vectorStore';
import { ClientOperation, GraphStateSnapshot } from '../core/types';
import { moduleClassMap } from '../../core/modules/index';
import { ModuleBase } from '../../core/base/ModuleBase';

const logger = createModuleLogger('ToolExecutor');

// 定义基本类型 (保持与Store兼容)
interface FlowNode {
  id: string;
  type?: string;
  data: {
    label?: string;
    type?: string;
    parameters?: Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    module?: any; // 模拟时可能不包含完整模块实例
  };
  position: { x: number; y: number };
  selected?: boolean;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

/**
 * 工具执行器类
 */
export class ToolExecutor {
  private nodes: FlowNode[];
  private edges: FlowEdge[];
  private operations: ClientOperation[] = [];

  constructor(initialState: GraphStateSnapshot) {
    // 使用浅拷贝但保留 module 实例引用，同时复制 parameters 防止修改污染原始数据
    this.nodes = initialState.nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        parameters: { ...(node.data.parameters || {}) },
        // 保留 module 实例引用以便调用方法 (如 getValue)
        module: node.data.module
      },
      position: { ...node.position }
    }));
    this.edges = JSON.parse(JSON.stringify(initialState.edges));
  }

  public getOperations(): ClientOperation[] {
    return this.operations;
  }

  /**
   * 执行工具调用
   */
  async executeToolCall(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    logger.info(`执行工具: ${toolName}`, args);

    try {
      switch (toolName) {
        case 'get_canvas':
          return this.getCanvas();
        case 'get_module_details':
          return this.getModuleDetails(args.moduleId as string);
        case 'add_module':
          return this.addModule(
            args.type as string,
            args.label as string,
            args.position as { x: number; y: number }
          );
        case 'delete_module':
          return this.deleteModule(args.moduleId as string);
        case 'update_module_parameter':
          return this.updateModuleParameter(
            args.moduleId as string,
            args.paramKey as string,
            args.value
          );
        case 'connect_modules':
          return this.connectModules(
            args.sourceId as string,
            args.targetId as string,
            args.sourceHandle as string,
            args.targetHandle as string
          );
        case 'disconnect_modules':
          return this.disconnectModules(
            args.sourceId as string,
            args.targetId as string,
            args.sourceHandle as string,
            args.targetHandle as string
          );
        case 'rag_search':
          return await this.ragSearch(args.query as string, (args.topK as number) || 5);
        default:
          throw new Error(`未知的工具: ${toolName}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`工具执行失败: ${toolName}`, errorMessage);
      return { error: errorMessage };
    }
  }

  /**
   * 获取画布上的所有模块和连接 (合并视图)
   */
  public getCanvas() {
    const modules = this.nodes.map((node) => ({
      id: node.id,
      type: node.data?.type || node.type,
      label: node.data?.label,
      position: node.position,
      // parameters: node.data?.parameters || {},
      selected: node.selected || false,
    }));

    const connections = this.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    }));

    return {
      success: true,
      data: {
        totalModules: modules.length,
        totalConnections: connections.length,
        modules,
        connections,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * 获取画布上的所有模块 (Legacy: retained for internal use/tests if needed, but get_canvas is preferred)
   */
  public getCanvasModules() {
    const modules = this.nodes.map((node) => ({
      id: node.id,
      type: node.data?.type || node.type,
      label: node.data?.label,
      position: node.position,
      // parameters: node.data?.parameters || {},
      selected: node.selected || false,
    }));

    return {
      success: true,
      data: {
        totalModules: modules.length,
        modules,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Helper to resolve ports for a node
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getNodePorts(node: FlowNode): { inputs: Record<string, any>; outputs: Record<string, any> } {
    // 优先使用 snapshot 中传递过来的端口信息
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let ports = (node.data as any)?.ports;

    if (!ports && node.data?.module) {
      // 如果 snapshot 没有 ports 但有 module 实例 (e.g. 单元测试环境)，则从 module 获取
      ports = {
        inputs: node.data.module.inputPortTypes || {},
        outputs: node.data.module.outputPortTypes || {}
      };
    }

    if (!ports) {
      ports = { inputs: {}, outputs: {} };
    }

    return ports;
  }

  /**
   * 获取指定模块的详细信息
   */
  public getModuleDetails(moduleId: string) {
    const node = this.nodes.find((n) => n.id === moduleId);

    if (!node) {
      return {
        success: false,
        error: `未找到模块: ${moduleId}`,
      };
    }

    const incomingConnections = this.edges.filter((edge) => edge.target === moduleId);
    const outgoingConnections = this.edges.filter((edge) => edge.source === moduleId);

    // Extract parameters from the module instance if available (source of truth)
    const parameters: Record<string, unknown> = {};
    if (node.data?.module && node.data.module.parameters) {
      Object.entries(node.data.module.parameters).forEach(([key, param]) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (param && typeof (param as any).getValue === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          parameters[key] = (param as any).getValue();
        } else {
          parameters[key] = param;
        }
      });
    } else {
      // Fallback to static data parameters
      Object.assign(parameters, node.data?.parameters || {});
    }

    const ports = this.getNodePorts(node);

    return {
      success: true,
      data: {
        module: {
          id: node.id,
          type: node.data?.type || node.type,
          label: node.data?.label,
          position: node.position,
          parameters,
          selected: node.selected || false,
          ports,
        },
        connections: {
          incoming: incomingConnections.map((edge) => ({
            fromModule: edge.source,
            fromHandle: edge.sourceHandle,
            toHandle: edge.targetHandle,
          })),
          outgoing: outgoingConnections.map((edge) => ({
            toModule: edge.target,
            fromHandle: edge.sourceHandle,
            toHandle: edge.targetHandle,
          })),
        },
      },
    };
  }

  /**
   * 获取画布上的所有连接
   */
  public getCanvasConnections() {
    const connections = this.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    }));

    return {
      success: true,
      data: {
        totalConnections: connections.length,
        connections,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * 添加新模块
   */
  /**
   * 查找安全的不重叠位置
   * 防止新创建的模块与现有模块完全重叠
   */
  private findSafePosition(initialPos: { x: number; y: number }): { x: number; y: number } {
    let { x, y } = initialPos;
    const offset = 30; // 每次偏移量
    let attempts = 0;
    const maxAttempts = 100; // 防止死循环

    // 简单的碰撞检测，如果位置非常接近（视为重叠），则偏移
    // 这里的 20px 是一个简单的阈值，用于检测完全重叠的情况
    while (attempts < maxAttempts) {
      const isOverlapping = this.nodes.some((node) =>
        Math.abs(node.position.x - x) < 20 && Math.abs(node.position.y - y) < 20
      );

      if (!isOverlapping) {
        break;
      }

      x += offset;
      y += offset;
      attempts++;
    }

    return { x, y };
  }

  /**
   * 添加新模块
   */
  public addModule(type: string, label: string, position?: { x: number; y: number }) {
    // 如果没有提供位置，默认从 (100, 100) 开始
    // 使用 findSafePosition 确保不会与现有模块重叠
    const basePos = position || { x: 100, y: 100 };
    const pos = this.findSafePosition(basePos);

    const nodeId = `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`; // 生成临时ID

    // 尝试实例化真实模块以获取准确的端口和参数信息
    let moduleInstance: ModuleBase | undefined;
    try {
      const LowerType = type.toLowerCase();
      const ModuleClass = moduleClassMap[LowerType] || moduleClassMap['default'];
      if (ModuleClass) {
        // 实例化模块 (仅用于获取元数据，不需要 AudioContext)
        // 注意：在服务端/Agent环境，window undefined，AudioModuleBase 会跳过 Tone.js 初始化
        moduleInstance = new ModuleClass(nodeId, label);
      }
    } catch (e) {
      logger.warn(`Failed to instantiate module ${type} for metadata`, e);
    }

    const newNode: FlowNode = {
      id: nodeId,
      type: 'default',
      data: {
        label,
        type,
        parameters: {},
        module: moduleInstance // 存储实例以便 getModuleDetails 使用
      },
      position: pos
    };

    this.nodes.push(newNode);

    this.operations.push({
      type: 'ADD_MODULE',
      data: { id: nodeId, type, label, position: pos }
    });

    const details = this.getModuleDetails(nodeId);

    return {
      success: true,
      data: {
        moduleId: nodeId,
        message: `成功添加模块: ${label} (${type}) 在位置 (${pos.x}, ${pos.y})`,
        moduleDetails: details.data,
      },
    };
  }

  /**
   * 删除模块
   */
  public deleteModule(moduleId: string) {
    this.nodes = this.nodes.filter(n => n.id !== moduleId);
    this.edges = this.edges.filter(e => e.source !== moduleId && e.target !== moduleId);

    this.operations.push({
      type: 'DELETE_MODULE',
      data: { id: moduleId }
    });

    return {
      success: true,
      data: {
        message: `成功删除模块: ${moduleId}`,
      },
    };
  }

  /**
   * 更新模块参数
   */
  public updateModuleParameter(moduleId: string, paramKey: string, value: unknown) {
    const node = this.nodes.find((n) => n.id === moduleId);
    if (!node) {
      return { success: false, error: `未找到模块: ${moduleId}` };
    }

    if (!node.data) node.data = {};
    if (!node.data.parameters) node.data.parameters = {};
    node.data.parameters[paramKey] = value;

    this.operations.push({
      type: 'UPDATE_MODULE_PARAM',
      data: { id: moduleId, key: paramKey, value }
    });

    const details = this.getModuleDetails(moduleId);

    return {
      success: true,
      data: {
        message: `成功更新模块 ${moduleId} 的参数 ${paramKey} 为 ${value}`,
        moduleDetails: details.data,
      },
    };
  }

  /**
   * 连接模块
   */
  public connectModules(
    sourceId: string,
    targetId: string,
    sourceHandle?: string,
    targetHandle?: string
  ) {
    const sourceNode = this.nodes.find(n => n.id === sourceId);
    const targetNode = this.nodes.find(n => n.id === targetId);

    if (!sourceNode || !targetNode) {
      return {
        success: false,
        error: `找不到源模块 (${sourceId}) 或目标模块 (${targetId})`
      };
    }

    // 自动端口发现逻辑
    let finalSourceHandle = sourceHandle;
    let finalTargetHandle = targetHandle;

    if (!finalSourceHandle || !finalTargetHandle) {
      const sourcePorts = this.getNodePorts(sourceNode);
      const targetPorts = this.getNodePorts(targetNode);

      // 如果未指定 sourceHandle，尝试自动选择
      if (!finalSourceHandle) {
        const outputs = Object.keys(sourcePorts.outputs || {});
        // 优先找 "output" 或 "out"
        const defaultOut = outputs.find(k => k.toLowerCase().includes('output') || k.toLowerCase().includes('out'));
        // 如果没有明确的，且只有一个输出，就用那个
        if (defaultOut) {
          finalSourceHandle = defaultOut;
        } else if (outputs.length === 1) {
          finalSourceHandle = outputs[0];
        }
      }

      // 如果未指定 targetHandle，尝试自动选择
      if (!finalTargetHandle) {
        const inputs = Object.keys(targetPorts.inputs || {});
        // 优先找 "input" 或 "in"
        const defaultIn = inputs.find(k => k.toLowerCase().includes('input') || k.toLowerCase().includes('in'));
        // 如果没有明确的，且只有一个输入，就用那个
        if (defaultIn) {
          finalTargetHandle = defaultIn;
        } else if (inputs.length === 1) {
          finalTargetHandle = inputs[0];
        }
      }
    }

    const edgeId = `edge_${sourceId}_${targetId}_${Date.now()}`;
    const newEdge: FlowEdge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      sourceHandle: finalSourceHandle,
      targetHandle: finalTargetHandle
    };

    this.edges.push(newEdge);

    this.operations.push({
      type: 'CONNECT_MODULES',
      data: { source: sourceId, target: targetId, sourceHandle: finalSourceHandle, targetHandle: finalTargetHandle }
    });

    const sourceDetails = this.getModuleDetails(sourceId);
    const targetDetails = this.getModuleDetails(targetId);

    return {
      success: true,
      data: {
        message: `成功连接模块 ${sourceId} (${finalSourceHandle || 'default'}) 到 ${targetId} (${finalTargetHandle || 'default'})`,
        sourceModuleDetails: sourceDetails.data,
        targetModuleDetails: targetDetails.data,
      },
    };
  }

  /**
   * 断开模块连接
   */
  public disconnectModules(
    sourceId: string,
    targetId: string,
    sourceHandle?: string,
    targetHandle?: string
  ) {
    const initialLength = this.edges.length;
    this.edges = this.edges.filter(
      (e) =>
        !(
          e.source === sourceId &&
          e.target === targetId &&
          (!sourceHandle || e.sourceHandle === sourceHandle) &&
          (!targetHandle || e.targetHandle === targetHandle)
        )
    );

    if (this.edges.length < initialLength) {
      this.operations.push({
        type: 'DISCONNECT_MODULES',
        data: { source: sourceId, target: targetId, sourceHandle, targetHandle }
      });

      const sourceDetails = this.getModuleDetails(sourceId);
      const targetDetails = this.getModuleDetails(targetId);

      return {
        success: true,
        data: {
          message: `成功断开模块 ${sourceId} 和 ${targetId} 之间的连接`,
          sourceModuleDetails: sourceDetails.data,
          targetModuleDetails: targetDetails.data,
        },
      };
    }

    return {
      success: false,
      error: '未找到指定的连接',
    };
  }

  /**   
   * RAG: 本地向量检索
   * 直接调用 RAG Service 逻辑，避免 fetch 调用失败
   */
  public async ragSearch(query: string, topK: number) {
    if (!query || typeof query !== 'string') {
      return { success: false, error: 'query is required' };
    }

    try {
      const results = await searchDocuments(query, Math.max(1, Math.min(topK || 5, 20)));
      return { success: true, data: results };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'RAG 搜索失败';
      logger.error('RAG Search Failed', msg);
      return { success: false, error: `RAG 搜索失败: ${msg}` };
    }
  }
}
