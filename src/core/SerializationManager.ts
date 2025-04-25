'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { FlowNode, moduleManager } from './ModuleManager';
import { Edge } from '@xyflow/react';
import { ModuleBase } from './ModuleBase';
import {
  SerializedCanvas,
  SerializedModule,
  SerializedNode,
  SerializedEdge,
} from './types/SerializationTypes';
import {
  validateSerializedModule,
  validateSerializedCanvas,
  validateAndParseJson,
} from './types/SerializationValidator';
import { createModuleLogger } from '@/lib/logger';

// 创建日志记录器
const logger = createModuleLogger('SerializationManager');

/**
 * 序列化管理器，提供模块和画布序列化/反序列化功能
 */
export class SerializationManager {
  /**
   * 序列化单个模块为JSON格式
   * @param module 要序列化的模块实例
   * @returns 序列化后的模块数据
   */
  serializeModule(module: ModuleBase): SerializedModule {
    // 收集参数数据
    const parameters: Record<string, any> = {};
    Object.entries(module.parameters).forEach(([key, subject]) => {
      parameters[key] = subject.getValue();
    });

    // 收集端口类型
    const inputPortTypes: Record<string, string> = {};
    Object.entries(module.inputPortTypes).forEach(([key, type]) => {
      inputPortTypes[key] = type;
    });

    const outputPortTypes: Record<string, string> = {};
    Object.entries(module.outputPortTypes).forEach(([key, type]) => {
      outputPortTypes[key] = type;
    });

    // 获取自定义UI配置
    const customUI = module.getCustomUI();

    // 构建序列化数据
    return {
      moduleType: module.moduleType,
      id: module.id,
      name: module.name,
      parameters,
      inputPortTypes,
      outputPortTypes,
      customUI: customUI
        ? {
            type: customUI.type,
            props: customUI.props || {},
          }
        : undefined,
      enabled:
        module instanceof ModuleBase ? (module as any).isEnabled?.() : true,
    };
  }

  /**
   * 序列化模块为JSON字符串
   * @param module 要序列化的模块实例
   * @returns JSON字符串形式的序列化数据
   */
  serializeModuleToJson(module: ModuleBase): string {
    try {
      const data = this.serializeModule(module);
      const json = JSON.stringify(data);
      logger.debug(`模块"${module.name}"(${module.id})序列化成功`);
      return json;
    } catch (error) {
      logger.error(`模块"${module.name}"(${module.id})序列化失败`, error);
      throw new Error(`模块序列化失败: ${error}`);
    }
  }

  /**
   * 从JSON数据反序列化模块
   * @param data 序列化的模块数据
   * @returns 反序列化后的模块实例，或null如果无法创建
   */
  deserializeModule(data: SerializedModule): ModuleBase | null {
    try {
      // 验证数据结构
      const validationResult = validateSerializedModule(data);
      if (!validationResult.success) {
        logger.error('模块数据验证失败，无法反序列化', validationResult.error);
        return null;
      }

      // 创建模块实例
      const moduleInstance = moduleManager.createModuleInstance(
        data.moduleType,
        data.id,
        data.name
      );

      // 恢复参数值
      if (data.parameters) {
        Object.entries(data.parameters).forEach(([key, value]) => {
          if (moduleInstance.parameters[key]) {
            moduleInstance.updateParameter(key, value);
          } else {
            logger.warn(`模块参数"${key}"不存在，已跳过`);
          }
        });
      }

      // 设置启用状态（如果支持）
      if (
        data.enabled !== undefined &&
        typeof (moduleInstance as any).setEnabled === 'function'
      ) {
        (moduleInstance as any).setEnabled(data.enabled);
      }

      logger.debug(`成功反序列化模块"${data.name}"(${data.id})`);
      return moduleInstance;
    } catch (error) {
      logger.error('反序列化模块失败', error);
      return null;
    }
  }

  /**
   * 从JSON字符串反序列化模块
   * @param jsonString JSON格式的模块数据
   * @returns 反序列化后的模块实例，或null如果无法创建
   */
  deserializeModuleFromJson(jsonString: string): ModuleBase | null {
    try {
      const result = validateAndParseJson<SerializedModule>(
        jsonString,
        validateSerializedModule
      );

      if (!result.success || !result.data) {
        logger.error('模块JSON验证失败，无法反序列化', result.error);
        return null;
      }

      return this.deserializeModule(result.data);
    } catch (error) {
      logger.error('从JSON反序列化模块失败', error);
      return null;
    }
  }

  /**
   * 序列化整个画布（节点和边）为JSON格式
   * @param nodes 画布节点列表
   * @param edges 画布边列表
   * @returns JSON对象的序列化数据
   */
  serializeCanvas(nodes: FlowNode[], edges: Edge[]): SerializedCanvas {
    try {
      // 转换节点为可序列化格式
      const serializedNodes: SerializedNode[] = nodes.map((node) => {
        // 序列化模块
        const activemodule = node.data?.module;
        const parameters: Record<string, any> = {};

        if (activemodule) {
          // 提取参数值
          Object.entries(activemodule.parameters).forEach(([key, subject]) => {
            parameters[key] = subject.getValue();
          });
        }

        return {
          id: node.id,
          position: { x: node.position.x, y: node.position.y },
          data: {
            type: activemodule?.moduleType || 'unknown',
            label: (node.data?.label ||
              activemodule?.name ||
              node.id) as string,
            parameters,
          },
        };
      });

      // 转换边为可序列化格式
      const serializedEdges: SerializedEdge[] = edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle || undefined,
        targetHandle: edge.targetHandle || undefined,
      }));

      // 构建画布数据
      const canvasData = {
        version: '1.0',
        timestamp: Date.now(),
        nodes: serializedNodes,
        edges: serializedEdges,
      };

      logger.debug(
        `画布序列化成功: ${nodes.length}个节点, ${edges.length}个连接`
      );
      return canvasData;
    } catch (error) {
      logger.error('画布序列化失败', error);
      throw new Error(`画布序列化失败: ${error}`);
    }
  }

  /**
   * 序列化整个画布为JSON字符串
   * @param nodes 画布节点列表
   * @param edges 画布边列表
   * @returns JSON字符串形式的序列化数据
   */
  serializeCanvasToJson(nodes: FlowNode[], edges: Edge[]): string {
    try {
      const canvasData = this.serializeCanvas(nodes, edges);
      const json = JSON.stringify(canvasData);
      return json;
    } catch (error) {
      logger.error('画布序列化为JSON失败', error);
      throw new Error(`画布序列化为JSON失败: ${error}`);
    }
  }

  /**
   * 从JSON数据反序列化画布
   * @param canvasData 序列化的画布数据
   * @returns 反序列化后的节点和边
   */
  deserializeCanvas(canvasData: SerializedCanvas): {
    nodes: FlowNode[];
    edges: Edge[];
  } {
    try {
      // 验证数据结构
      const validationResult = validateSerializedCanvas(canvasData);
      if (!validationResult.success) {
        logger.error('画布数据验证失败，无法反序列化', validationResult.error);
        return { nodes: [], edges: [] };
      }

      // 使用ModuleManager创建节点和边
      const result = moduleManager.createFlowFromSerializedData(
        canvasData.nodes,
        canvasData.edges
      );

      logger.success(
        `画布反序列化成功: ${result.nodes.length}个节点, ${result.edges.length}个连接`
      );
      return result;
    } catch (error) {
      logger.error('画布反序列化失败', error);
      return { nodes: [], edges: [] };
    }
  }

  /**
   * 从JSON字符串反序列化画布
   * @param jsonString JSON字符串形式的画布数据
   * @returns 反序列化后的节点和边
   */
  deserializeCanvasFromJson(jsonString: string): {
    nodes: FlowNode[];
    edges: Edge[];
  } {
    try {
      const result = validateAndParseJson<SerializedCanvas>(
        jsonString,
        validateSerializedCanvas
      );

      if (!result.success || !result.data) {
        logger.error('画布JSON验证失败，无法反序列化', result.error);
        return { nodes: [], edges: [] };
      }

      return this.deserializeCanvas(result.data);
    } catch (error) {
      logger.error('从JSON反序列化画布失败', error);
      return { nodes: [], edges: [] };
    }
  }
}

// 导出单例
export const serializationManager = new SerializationManager();
