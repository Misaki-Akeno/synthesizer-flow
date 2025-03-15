import { nanoid } from 'nanoid';
import { ModuleBase } from '@/interfaces/module';
import { moduleFactory } from '../factory/ModuleFactory';
import { eventBus } from '../events/EventBus';
import { useModulesStore } from '../store/useModulesStore';
import { Position } from '@/interfaces/event';
import { errorHandler, ErrorCode } from '../events/ErrorHandler';
import { moduleLifecycleManager } from '../domain/ModuleLifecycle';
import { ModuleLifecycleState } from '@/interfaces/lifecycle';
import type { ConnectionService } from './ConnectionService';

/**
 * 模块服务
 * 负责模块的创建、初始化和管理
 * ModuleService (服务层)
 *  负责模块生命周期的高级管理
 *  处理事件和API调用
 *  维护模块的全局状态
 */
export class ModuleService {
  private connectionService: ConnectionService | null = null;

  constructor() {
    // 移除了之前对container的引用
  }

  /**
   * 设置连接服务引用
   */
  setConnectionService(connectionService: ConnectionService): void {
    this.connectionService = connectionService;
  }

  /**
   * 初始化模块服务
   */
  async initialize(): Promise<void> {
    // 监听模块创建请求
    eventBus.on(
      'MODULE.CREATE_REQUEST',
      this.handleModuleCreateRequest.bind(this)
    );

    // 监听模块销毁请求
    eventBus.on(
      'MODULE.DESTROY_REQUEST',
      this.handleModuleDestroyRequest.bind(this)
    );

    // 监听模块实例化请求
    eventBus.on(
      'MODULE.INSTANTIATE_REQUESTED',
      this.handleModuleInstantiateRequest.bind(this)
    );

    // 监听模块释放请求
    eventBus.on(
      'MODULE.DISPOSE_REQUESTED',
      this.handleModuleDisposeRequest.bind(this)
    );

    // 发出模块服务初始化完成事件
    eventBus.emit('MODULE_SERVICE.INITIALIZED', {
      time: new Date().toISOString(),
    });
  }

  /**
   * 处理模块创建请求
   */
  private async handleModuleCreateRequest(event: {
    typeId: string;
    instanceId?: string;
    position?: Position;
  }): Promise<void> {
    try {
      const { typeId, instanceId, position } = event;

      // 使用内部方法创建模块，避免重复代码
      await this._createAndInitializeModule(typeId, instanceId, position);
    } catch (error) {
      errorHandler.moduleError(
        event.instanceId || 'unknown',
        ErrorCode.MODULE_INIT_FAILED,
        `Failed to create module: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * 处理模块销毁请求
   */
  private async handleModuleDestroyRequest(event: {
    moduleId: string;
  }): Promise<void> {
    try {
      const { moduleId } = event;

      // 使用内部方法销毁模块，避免重复代码
      await this._disposeAndRemoveModule(moduleId);
    } catch (error) {
      errorHandler.moduleError(
        event.moduleId,
        ErrorCode.MODULE_DISPOSE_FAILED,
        `Failed to destroy module: ${(error as Error).message}`,
        error as Error
      );
    }
  }

  /**
   * 处理模块实例化请求
   */
  private async handleModuleInstantiateRequest(event: {
    moduleTypeId: string;
    position?: Position;
  }): Promise<void> {
    const { moduleTypeId, position } = event;
    const instanceId = nanoid();

    try {
      // 使用内部方法创建模块，避免重复代码
      const _moduleInstance = await this._createAndInitializeModule(
        moduleTypeId, 
        instanceId, 
        position
      );
      
      // 创建成功后发出实例化完成事件
      eventBus.emit('MODULE.INSTANTIATED', {
        moduleId: instanceId,
        moduleTypeId,
        position,
      });
    } catch (error) {
      console.error('Failed to instantiate module:', error);
      eventBus.emit('MODULE.INSTANTIATE_FAILED', {
        moduleTypeId,
        error: {
          code: 'MODULE_INSTANTIATE_ERROR',
          message: `Failed to instantiate module: ${(error as Error).message}`,
        },
      });
    }
  }

  /**
   * 处理模块释放请求
   */
  private async handleModuleDisposeRequest(event: {
    moduleId: string;
  }): Promise<void> {
    const { moduleId } = event;

    // 检查模块当前状态
    const currentState = moduleLifecycleManager.getState(moduleId);
    if (!currentState || currentState === ModuleLifecycleState.DISPOSED) {
      console.warn(
        `尝试释放不存在或已销毁的模块: ${moduleId}, 当前状态: ${currentState}`
      );
      return;
    }

    // 发出销毁请求
    eventBus.emit('MODULE.DESTROY_REQUEST', {
      moduleId,
    });
  }

  /**
   * 创建模块实例，简化实现
   */
  async createModule(typeId: string, position?: Position): Promise<ModuleBase> {
    try {
      const instanceId = nanoid();
      
      // 使用内部方法创建模块，避免重复代码
      const moduleInstance = await this._createAndInitializeModule(typeId, instanceId, position);
      
      // 发出已实例化事件
      eventBus.emit('MODULE.INSTANTIATED', {
        moduleId: instanceId,
        moduleTypeId: typeId,
        position,
      });
      
      return moduleInstance;
    } catch (error) {
      console.error('创建模块失败:', error);
      throw new Error(`创建模块失败: ${(error as Error).message}`);
    }
  }
  
  /**
   * 内部方法：创建并初始化模块
   * 抽取公共创建逻辑，减少重复代码
   */
  private async _createAndInitializeModule(
    typeId: string,
    instanceId?: string,
    position?: Position
  ): Promise<ModuleBase> {
    // 创建模块实例
    const moduleInstance = await moduleFactory.create(typeId, instanceId);

    // 将模块添加到状态存储
    useModulesStore.getState().addModule(moduleInstance, position);

    // 验证模块生命周期状态
    const moduleState = moduleLifecycleManager.getState(moduleInstance.id);
    if (moduleState !== ModuleLifecycleState.INITIALIZED) {
      console.warn(
        `模块 ${moduleInstance.id} 创建后状态异常: ${moduleState}`
      );
    }
    
    return moduleInstance;
  }
  
  /**
   * 内部方法：销毁并移除模块
   * 抽取公共销毁逻辑，减少重复代码
   */
  private async _disposeAndRemoveModule(moduleId: string): Promise<void> {
    // 检查模块当前状态
    const currentState = moduleLifecycleManager.getState(moduleId);
    if (!currentState || currentState === ModuleLifecycleState.DISPOSED) {
      console.warn(
        `尝试销毁不存在或已销毁的模块: ${moduleId}, 当前状态: ${currentState}`
      );
      return;
    }

    // 销毁模块实例
    await moduleFactory.destroy(moduleId);

    // 从状态中删除模块
    useModulesStore.getState().removeModule(moduleId);

    // 验证模块生命周期状态
    const finalState = moduleLifecycleManager.getState(moduleId);
    if (finalState !== ModuleLifecycleState.DISPOSED) {
      console.error(`模块 ${moduleId} 销毁后状态异常: ${finalState}`);
    }
  }

  /**
   * 获取模块当前生命周期状态
   */
  getModuleState(moduleId: string): ModuleLifecycleState | undefined {
    return moduleLifecycleManager.getState(moduleId);
  }

  /**
   * 检查模块是否已初始化
   */
  isModuleInitialized(moduleId: string): boolean {
    const state = this.getModuleState(moduleId);
    return state === ModuleLifecycleState.INITIALIZED;
  }

  /**
   * 检查模块是否已销毁
   */
  isModuleDisposed(moduleId: string): boolean {
    const state = this.getModuleState(moduleId);
    return state === ModuleLifecycleState.DISPOSED;
  }
}

// 不再导出单例实例，请通过容器获取
// 使用方法：container.get<ModuleService>('moduleService')
