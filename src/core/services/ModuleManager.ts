import { Edge } from '@xyflow/react';
import { ModuleBase, PortType } from '../base/ModuleBase';
import { moduleClassMap } from '../modules/index';
import { createModuleLogger } from '@/lib/logger';
import { createModuleId } from '@/core/utils/nodeId';

// 创建模块管理器的专用日志记录器
const logger = createModuleLogger('ModuleManager');

export class ModuleManager {
  // 模块实例注册表
  private moduleInstances: Map<string, ModuleBase> = new Map();

  // 检查模块类型是否存在
  hasModuleType(type: string): boolean {
    return Boolean(moduleClassMap[type.toLowerCase()]);
  }

  // 创建模块实例
  createModuleInstance(
    type: string,
    id?: string,
    name: string = type
  ): ModuleBase {
    const ModuleClass = moduleClassMap[type.toLowerCase()];
    if (!ModuleClass) {
      throw new Error(`未知模块类型: ${type}`);
    }

    const moduleId = id ?? createModuleId(this.moduleInstances.keys());
    const existingModule = this.moduleInstances.get(moduleId);
    if (existingModule) {
      logger.warn(`模块ID已存在，将替换旧实例: ${moduleId}`);
      existingModule.dispose();
    }

    const moduleInstance = new ModuleClass(moduleId, name);
    this.moduleInstances.set(moduleId, moduleInstance);
    return moduleInstance;
  }

  // 获取模块实例
  getModule(id: string): ModuleBase | undefined {
    return this.moduleInstances.get(id);
  }

  // 释放并注销单个模块
  disposeModule(id: string): void {
    const moduleInstance = this.moduleInstances.get(id);
    if (!moduleInstance) {
      return;
    }

    moduleInstance.dispose();
    this.moduleInstances.delete(id);
  }

  // 注销模块实例（用于已由调用方释放资源的场景）
  unregisterModule(id: string): void {
    this.moduleInstances.delete(id);
  }

  // 释放所有模块实例，用于整张画布重载
  disposeAllModules(): void {
    this.moduleInstances.forEach((moduleInstance) => {
      moduleInstance.dispose();
    });
    this.moduleInstances.clear();
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
  ): Edge | null {
    const edge = this.createEdge(source, target, sourceHandle, targetHandle);
    return this.bindModules(source, target, sourceHandle, targetHandle)
      ? edge
      : null;
  }

  private validateBinding(
    sourceId: string,
    targetId: string,
    sourceHandle?: string,
    targetHandle?: string,
    logErrors = true
  ): boolean {
    const sourceModule = this.getModule(sourceId);
    const targetModule = this.getModule(targetId);

    if (!sourceModule || !targetModule) {
      if (logErrors) {
        logger.error('无法找到要绑定的模块', { sourceId, targetId });
      }
      return false;
    }

    const finalSourceHandle = sourceHandle || 'output';
    const finalTargetHandle = targetHandle || 'input';
    const sourceType = sourceModule.outputPortTypes[finalSourceHandle];
    const targetType = targetModule.inputPortTypes[finalTargetHandle];

    if (!sourceType || !targetType) {
      if (logErrors) {
        logger.error('端口不存在，无法绑定模块', {
          sourceId,
          targetId,
          sourceHandle: finalSourceHandle,
          targetHandle: finalTargetHandle,
        });
      }
      return false;
    }

    if (sourceType !== targetType) {
      if (logErrors) {
        logger.error('端口类型不匹配', {
          sourceType,
          targetType,
        });
      }
      return false;
    }

    return true;
  }

  // 只检查两个模块是否可以绑定，不产生订阅或音频连接副作用
  canBindModules(
    sourceId: string,
    targetId: string,
    sourceHandle?: string,
    targetHandle?: string
  ): boolean {
    return this.validateBinding(
      sourceId,
      targetId,
      sourceHandle,
      targetHandle,
      false
    );
  }

  private removeSingleInputConflicts(
    targetModule: ModuleBase,
    targetHandle: string
  ): void {
    const targetType = targetModule.inputPortTypes[targetHandle];
    if (targetType === PortType.AUDIO || targetType === PortType.ARRAY) {
      return;
    }

    this.moduleInstances.forEach((sourceModule) => {
      Object.keys(sourceModule.outputPortTypes).forEach((outputHandle) => {
        const hasConflict = sourceModule
          .getOutputConnections(outputHandle)
          .some(
            (connection) =>
              connection.targetModule.id === targetModule.id &&
              connection.targetPort === targetHandle
          );

        if (hasConflict) {
          sourceModule.disconnectOutput(
            outputHandle,
            targetModule,
            targetHandle
          );
        }
      });
    });
  }

  // 绑定两个模块
  bindModules(
    sourceId: string,
    targetId: string,
    sourceHandle?: string,
    targetHandle?: string
  ): boolean {
    if (!this.validateBinding(sourceId, targetId, sourceHandle, targetHandle)) {
      return false;
    }

    const sourceModule = this.getModule(sourceId);
    const targetModule = this.getModule(targetId);
    const finalSourceHandle = sourceHandle || 'output';
    const finalTargetHandle = targetHandle || 'input';

    try {
      this.removeSingleInputConflicts(targetModule!, finalTargetHandle);
      sourceModule!.connectOutput(
        finalSourceHandle,
        targetModule!,
        finalTargetHandle
      );
      return true;
    } catch (error) {
      logger.error('模块绑定失败', error);
      return false;
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
}

export const moduleManager = new ModuleManager();
