/**
 * 工具执行器 - 执行工具调用
 * 修改为服务端运行，通过模拟状态变更并返回操作指令给客户端执行
 */

import { createModuleLogger } from '@/lib/logger';
import { ClientOperation, GraphStateSnapshot } from '../core/types';

const logger = createModuleLogger('ToolExecutor');

// 定义基本类型 (保持与Store兼容)
interface FlowNode {
  id: string;
  type?: string;
  data: {
    label?: string;
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
    this.nodes = JSON.parse(JSON.stringify(initialState.nodes));
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
        case 'get_canvas_modules':
          return this.getCanvasModules();
        case 'get_module_details':
          return this.getModuleDetails(args.moduleId as string);
        case 'get_canvas_connections':
          return this.getCanvasConnections();
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
   * 获取画布上的所有模块
   */
  public getCanvasModules() {
    const modules = this.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      label: node.data?.label,
      position: node.position,
      parameters: node.data?.parameters || {},
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

    // 服务端无法获取完整 module 实例的端口定义，只能返回基本信息
    // 如果需要详细端口信息，前端 snapshots 需要包含 module metadata，或者我们只能返回已知信息
    // 暂时返回空端口信息，或者基于 type 的默认信息（如果有）
    const ports = { inputs: {}, outputs: {} };
    // 如果 snapshot 中 data.module 被序列化了，可能包含一些信息，但通常不会包含方法

    return {
      success: true,
      data: {
        module: {
          id: node.id,
          type: node.type,
          label: node.data?.label,
          position: node.position,
          parameters: node.data?.parameters || {},
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
  public addModule(type: string, label: string, position?: { x: number; y: number }) {
    const pos = position || { x: 100, y: 100 };
    const nodeId = `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`; // 生成临时ID
    
    const newNode: FlowNode = {
      id: nodeId,
      type,
      data: { label, parameters: {} },
      position: pos
    };
    
    this.nodes.push(newNode);

    this.operations.push({
      type: 'ADD_MODULE',
      data: { id: nodeId, type, label, position: pos }
    });

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
  public connectModules(
    sourceId: string,
    targetId: string,
    sourceHandle?: string,
    targetHandle?: string
  ) {
    const edgeId = `edge_${sourceId}_${targetId}_${Date.now()}`;
    const newEdge: FlowEdge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      sourceHandle,
      targetHandle
    };
    
    this.edges.push(newEdge);

    this.operations.push({
      type: 'CONNECT_MODULES',
      data: { source: sourceId, target: targetId, sourceHandle, targetHandle }
    });

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

  /**   
   * RAG: 本地向量检索
   * 注意：服务端 fetch 可能需要完整的 Base URL。
   * 如果这里从 Server Action 调用，建议直接调用 RAG Service 逻辑，或者传入 Origin。
   * 暂时保持 fetch，但需确保 URL 可访问。或者通过环境变量获取 BASE_URL。
   */
  public async ragSearch(query: string, topK: number) {
    if (!query || typeof query !== 'string') {
      return { success: false, error: 'query is required' };
    }
    // TODO: Consider replacing with direct service call if feasible
    // For now, return a placeholder or try fetch (which might fail on server without absolute URL)
    
    // Fallback: 如果无法直接 fetch，返回一个提示，让 Agent 知道该功能受限
    try {
      // 假设我们有一个环境变量 NEXT_PUBLIC_APP_URL 或类似
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const resp = await fetch(`${baseUrl}/api/rag/search`, {
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
      logger.error('RAG Search Failed', msg);
      return { success: false, error: `RAG 搜索失败: ${msg}` };
    }
  }
}
