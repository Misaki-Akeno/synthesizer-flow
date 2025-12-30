/**
 * MCP工具执行器 - 执行MCP工具调用
 */

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('MCPExecutor');

// 定义基本类型
interface FlowNode {
  id: string;
  type?: string;
  data: {
    label?: string;
    parameters?: Record<string, unknown>;
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
export class MCPToolExecutor {  /**
   * 执行工具调用
   */
  static async executeToolCall(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    logger.info(`执行MCP工具: ${toolName}`, args);

    try {
      switch (toolName) {
        case 'get_canvas_modules':
          return await this.getCanvasModules();
        case 'get_module_details':
          return await this.getModuleDetails(args.moduleId as string);
        case 'get_canvas_connections':
          return await this.getCanvasConnections();
        case 'add_module':
          return await this.addModule(
            args.type as string,
            args.label as string,
            args.position as { x: number; y: number }
          );
        case 'delete_module':
          return await this.deleteModule(args.moduleId as string);
        case 'update_module_parameter':
          return await this.updateModuleParameter(
            args.moduleId as string,
            args.paramKey as string,
            args.value
          );
        case 'connect_modules':
          return await this.connectModules(
            args.sourceId as string,
            args.targetId as string,
            args.sourceHandle as string,
            args.targetHandle as string
          );
        case 'disconnect_modules':
          return await this.disconnectModules(
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
   * 获取store实例
   */
  private static async getStore() {
    // 使用动态导入避免循环依赖问题
    try {
      const storeModule = await import('@/store/store');
      return storeModule.useFlowStore.getState();
    } catch (error) {
      logger.error('无法获取store实例', error);
      throw new Error('无法访问canvas状态');
    }
  }

  /**
   * 获取画布上的所有模块
   */
  public static async getCanvasModules() {
    const store = await this.getStore();
    const modules = (store.nodes as FlowNode[]).map((node) => ({
      id: node.id,
      type: node.type,
      label: node.data.label,
      position: node.position,
      parameters: node.data.parameters || {},
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
   * 获取指定模块的详细信息
   */
  public static async getModuleDetails(moduleId: string) {
    const store = await this.getStore();
    const node = (store.nodes as FlowNode[]).find((n) => n.id === moduleId);

    if (!node) {
      return {
        success: false,
        error: `未找到模块: ${moduleId}`,
      };
    }

    // 获取连接到此模块的连接
    const incomingConnections = (store.edges as FlowEdge[]).filter((edge) => edge.target === moduleId);
    const outgoingConnections = (store.edges as FlowEdge[]).filter((edge) => edge.source === moduleId);

    // 获取模块实例以读取端口信息
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const moduleInstance = (node.data as any).module;
    let ports = { inputs: {}, outputs: {} };
    let parameterDefinitions = {};

    if (moduleInstance) {
      ports = {
        inputs: moduleInstance.inputPortTypes || {},
        outputs: moduleInstance.outputPortTypes || {},
      };
      parameterDefinitions = moduleInstance.parameterMeta || {};
    }

    return {
      success: true,
      data: {
        module: {
          id: node.id,
          type: node.type,
          label: node.data.label,
          position: node.position,
          parameters: node.data.parameters || {},
          parameterDefinitions, // 添加参数定义信息
          selected: node.selected || false,
          ports, // 添加端口信息
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
  public static async getCanvasConnections() {
    const store = await this.getStore();
    const connections = (store.edges as FlowEdge[]).map((edge) => ({
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

  /**   * 添加新模块
   */
  public static async addModule(type: string, label: string, position?: { x: number; y: number }) {
    const store = await this.getStore();
    // 默认位置
    const pos = position || { x: 100, y: 100 };
    const nodeId = store.addNode(type, label, pos);
    return {
      success: true,
      data: {
        moduleId: nodeId,
        message: `成功添加模块: ${label} (${type})`,
      },
    };
  }

  /**
   * 删除模块
   */
  public static async deleteModule(moduleId: string) {
    const store = await this.getStore();
    store.deleteNode(moduleId);
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
  public static async updateModuleParameter(moduleId: string, paramKey: string, value: unknown) {
    const store = await this.getStore();
    
    // 验证模块和参数是否存在
    const node = (store.nodes as FlowNode[]).find((n) => n.id === moduleId);
    if (!node) {
      return {
        success: false,
        error: `未找到模块: ${moduleId}`,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const moduleInstance = (node.data as any).module;
    if (!moduleInstance) {
      return {
        success: false,
        error: `模块实例未初始化: ${moduleId}`,
      };
    }

    if (!moduleInstance.parameterMeta || !moduleInstance.parameterMeta[paramKey]) {
      const availableParams = Object.keys(moduleInstance.parameterMeta || {}).join(', ');
      return {
        success: false,
        error: `参数 '${paramKey}' 不存在于模块 ${moduleId}。可用参数: ${availableParams}`,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    store.updateModuleParameter(moduleId, paramKey, value as any);
    return {
      success: true,
      data: {
        message: `成功更新模块 ${moduleId} 的参数 ${paramKey} 为 ${value}`,
      },
    };
  }

  /**
   * 连接模块
   */
  public static async connectModules(
    sourceId: string,
    targetId: string,
    sourceHandle?: string,
    targetHandle?: string
  ) {
    const store = await this.getStore();
    const connection = {
      source: sourceId,
      target: targetId,
      sourceHandle: sourceHandle || null,
      targetHandle: targetHandle || null,
    };
    store.onConnect(connection);
    return {
      success: true,
      data: {
        message: `成功连接模块 ${sourceId} 到 ${targetId}`,
      },
    };
  }

  /**
   * 断开模块连接
   */
  public static async disconnectModules(
    sourceId: string,
    targetId: string,
    sourceHandle?: string,
    targetHandle?: string
  ) {
    const store = await this.getStore();
    const edges = store.edges;
    const edgeToDelete = edges.find(
      (e) =>
        e.source === sourceId &&
        e.target === targetId &&
        (!sourceHandle || e.sourceHandle === sourceHandle) &&
        (!targetHandle || e.targetHandle === targetHandle)
    );

    if (edgeToDelete) {
      store.onEdgesChange([{ type: 'remove', id: edgeToDelete.id }]);
      return {
        success: true,
        data: {
          message: `成功断开模块 ${sourceId} 和 ${targetId} 之间的连接`,
        },
      };
    }

    return {
      success: false,
      error: '未找到指定的连接',
    };
  }

  /**   * RAG: 本地向量检索
   */
  public static async ragSearch(query: string, topK: number) {
    if (!query || typeof query !== 'string') {
      return { success: false, error: 'query is required' };
    }
    try {
      const resp = await fetch('/api/rag/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, topK: Math.max(1, Math.min(topK || 5, 20)) }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        return { success: false, error: json?.error || 'RAG 搜索失败' };
      }
      return { success: true, data: json };
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'RAG 搜索失败';
      return { success: false, error: msg };
    }
  }
}
