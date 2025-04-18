/* eslint-disable @typescript-eslint/no-explicit-any */
import { FlowNode, moduleManager } from './ModuleManager';
import { Edge } from '@xyflow/react';
import { ModuleBase } from './ModuleBase';
import { PresetNode, PresetEdge } from './PresetManager';
import { ModuleSerializationFormat, SerializedCanvas, SerializedModule } from './types/SerializationTypes';

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
      customUI: customUI ? {
        type: customUI.type,
        props: customUI.props || {}
      } : undefined,
      enabled: module instanceof ModuleBase ? (module as any).isEnabled?.() : true
    };
  }

  /**
   * 序列化模块为JSON字符串
   * @param module 要序列化的模块实例
   * @returns JSON字符串形式的序列化数据
   */
  serializeModuleToJson(module: ModuleBase): string {
    const data = this.serializeModule(module);
    return JSON.stringify(data);
  }

  /**
   * 从JSON数据反序列化模块
   * @param data 序列化的模块数据
   * @returns 反序列化后的模块实例，或null如果无法创建
   */
  deserializeModule(data: SerializedModule): ModuleBase | null {
    try {
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
          }
        });
      }

      // 设置启用状态（如果支持）
      if (data.enabled !== undefined && typeof (moduleInstance as any).setEnabled === 'function') {
        (moduleInstance as any).setEnabled(data.enabled);
      }

      return moduleInstance;
    } catch (error) {
      console.error('Error deserializing module:', error);
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
      const data = JSON.parse(jsonString) as SerializedModule;
      return this.deserializeModule(data);
    } catch (error) {
      console.error('Error deserializing module from JSON:', error);
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
    // 转换节点为可序列化格式
    const serializedNodes: PresetNode[] = nodes.map(node => {
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
          label: (node.data?.label || activemodule?.name || node.id) as string,
          parameters
        }
      };
    });

    // 转换边为可序列化格式
    const serializedEdges: PresetEdge[] = edges.map(edge => ({
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || undefined,
      targetHandle: edge.targetHandle || undefined
    }));

    // 构建画布数据
    return {
      version: "1.0",
      timestamp: Date.now(),
      nodes: serializedNodes,
      edges: serializedEdges
    };
  }
  
  /**
   * 序列化整个画布为JSON字符串
   * @param nodes 画布节点列表
   * @param edges 画布边列表
   * @returns JSON字符串形式的序列化数据
   */
  serializeCanvasToJson(nodes: FlowNode[], edges: Edge[]): string {
    const canvasData = this.serializeCanvas(nodes, edges);
    return JSON.stringify(canvasData);
  }

  /**
   * 从JSON数据反序列化画布
   * @param canvasData 序列化的画布数据
   * @returns 反序列化后的节点和边
   */
  deserializeCanvas(canvasData: SerializedCanvas): { nodes: FlowNode[], edges: Edge[] } {
    try {
      // 使用ModuleManager创建节点和边
      return moduleManager.createFlowFromPreset(canvasData.nodes, canvasData.edges);
    } catch (error) {
      console.error('Error deserializing canvas:', error);
      return { nodes: [], edges: [] };
    }
  }
  
  /**
   * 从JSON字符串反序列化画布
   * @param jsonString JSON字符串形式的画布数据
   * @returns 反序列化后的节点和边
   */
  deserializeCanvasFromJson(jsonString: string): { nodes: FlowNode[], edges: Edge[] } {
    try {
      const canvasData = JSON.parse(jsonString) as SerializedCanvas;
      return this.deserializeCanvas(canvasData);
    } catch (error) {
      console.error('Error deserializing canvas from JSON:', error);
      return { nodes: [], edges: [] };
    }
  }

  /**
   * 获取模块的序列化格式
   * @param format 序列化格式，'json'或'object'
   * @param module 要序列化的模块
   * @returns 序列化后的模块数据
   */
  getModuleData(format: ModuleSerializationFormat, module: ModuleBase): string | SerializedModule {
    if (format === 'json') {
      return this.serializeModuleToJson(module);
    } else {
      return this.serializeModule(module);
    }
  }

  /**
   * 兼容性方法：从Base64字符串反序列化画布（用于处理旧格式数据）
   * @param base64String Base64编码的画布数据
   * @returns 反序列化后的节点和边
   * @deprecated 使用 deserializeCanvasFromJson 代替
   */
  deserializeCanvasFromBase64(base64String: string): { nodes: FlowNode[], edges: Edge[] } {
    try {
      // 尝试转换Base64到字符串（保留兼容性）
      const jsonString = this.legacyBase64ToString(base64String);
      return this.deserializeCanvasFromJson(jsonString);
    } catch (error) {
      console.error('Error deserializing canvas from Base64:', error);
      return { nodes: [], edges: [] };
    }
  }
  
  /**
   * 兼容性方法：将Base64字符串转换回普通字符串
   * @param base64 Base64编码的字符串
   * @returns 解码后的字符串
   * @private
   * @deprecated 内部使用，仅用于向后兼容
   */
  private legacyBase64ToString(base64: string): string {
    try {
      // 在浏览器中使用标准方法
      if (typeof atob === 'function') {
        const binaryStr = atob(base64);
        
        // 将二进制字符串转换回UTF-8字节数组
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        
        // 将UTF-8字节数组解码为字符串
        const decoder = new TextDecoder();
        return decoder.decode(bytes);
      }
      // Node.js环境下使用Buffer
      else if (typeof Buffer !== 'undefined') {
        return Buffer.from(base64, 'base64').toString();
      }
      
      throw new Error('No Base64 decoding method available');
    } catch (e) {
      console.error('Base64 decoding error:', e);
      // 备用方法：解码后使用decodeURIComponent处理Unicode字符
      return decodeURIComponent(Array.prototype.map.call(atob(base64), 
        c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    }
  }
}

// 导出单例
export const serializationManager = new SerializationManager();