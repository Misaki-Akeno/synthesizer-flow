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
  private static async getCanvasModules() {
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
  private static async getModuleDetails(moduleId: string) {
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

    return {
      success: true,
      data: {
        module: {
          id: node.id,
          type: node.type,
          label: node.data.label,
          position: node.position,
          parameters: node.data.parameters || {},
          selected: node.selected || false,
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
  private static async getCanvasConnections() {
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
}
