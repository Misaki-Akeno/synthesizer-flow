import { nanoid } from 'nanoid';
import { ModuleBase, ParameterValue } from '@/interfaces/module';
import { moduleFactory } from '../factory/ModuleFactory';
import { eventBus } from '../events/EventBus';
import { useModulesStore } from '../store/useModulesStore';
import { Position } from '@/interfaces/event';
import type { EventBusError } from '@/interfaces/event';
import { container } from '../di/Container';
import { moduleLifecycleManager } from '../domain/ModuleLifecycle';
import { ModuleLifecycleState } from '@/interfaces/lifecycle';
// 修复错误导入
import { errorHandler, ErrorCode } from '../events/ErrorHandler';

/**
 * 模块服务
 * 负责模块的创建、初始化和管理
 */
export class ModuleService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private connectionService: any; // 类型会在构造函数中获取

  constructor() {
    // 通过容器获取connectionService
    setTimeout(() => {
      this.connectionService = container.get('connectionService');
    }, 0);
    
    // 将自身注册到容器
    container.register('moduleService', this);
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

    // 监听参数变更请求
    eventBus.on(
      'PARAMETER.CHANGE_REQUESTED',
      this.handleParameterChangeRequest.bind(this)
    );

    // 发出模块服务初始化完成事件
    eventBus.emit('MODULE_SERVICE.INITIALIZED', {
      time: new Date().toISOString(),
    });

    console.log('ModuleService initialized');
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

      // 创建模块实例
      const moduleInstance = await moduleFactory.create(typeId, instanceId);

      // 将模块添加到状态存储
      useModulesStore.getState().addModule(moduleInstance, position);
      
      // 验证模块生命周期状态
      const moduleState = moduleLifecycleManager.getState(moduleInstance.id);
      if (moduleState !== ModuleLifecycleState.INITIALIZED) {
        console.warn(`模块 ${moduleInstance.id} 创建后状态异常: ${moduleState}`);
      }
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

      // 检查模块当前状态
      const currentState = moduleLifecycleManager.getState(moduleId);
      if (!currentState || currentState === ModuleLifecycleState.DISPOSED) {
        console.warn(`尝试销毁不存在或已销毁的模块: ${moduleId}, 当前状态: ${currentState}`);
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
      // 直接调用模块创建逻辑，而不是发送事件
      // 创建模块实例
      const moduleInstance = await moduleFactory.create(
        moduleTypeId,
        instanceId
      );

      // 将模块添加到状态存储
      useModulesStore.getState().addModule(moduleInstance, position);
      
      // 验证模块生命周期状态
      const moduleState = moduleLifecycleManager.getState(instanceId);
      if (moduleState !== ModuleLifecycleState.INITIALIZED) {
        console.warn(`模块 ${instanceId} 实例化后状态异常: ${moduleState}`);
      }

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
      console.warn(`尝试释放不存在或已销毁的模块: ${moduleId}, 当前状态: ${currentState}`);
      return;
    }

    // 发出销毁请求
    eventBus.emit('MODULE.DESTROY_REQUEST', {
      moduleId,
    });
  }

  /**
   * 处理参数变更请求
   */
  private handleParameterChangeRequest(event: {
    moduleId: string;
    parameterId: string;
    value: unknown;
  }): void {
    const { moduleId, parameterId, value } = event;

    try {
      // 获取模块实例
      const moduleInstance = useModulesStore.getState().getModule(moduleId);

      if (!moduleInstance) {
        throw new Error(`Module ${moduleId} not found`);
      }

      // 设置参数值
      moduleInstance.setParameterValue(parameterId, value as ParameterValue);

      // 参数变更事件已经在模块setParameterValue方法中发出
    } catch (error) {
      console.error('Failed to change parameter:', error);
    }
  }

  /**
   * 创建模块实例
   */
  async createModule(typeId: string, position?: Position): Promise<ModuleBase> {
    return new Promise((resolve, reject) => {
      try {
        // 生成一个唯一的请求ID，用于关联创建请求和响应
        const requestId = nanoid();

        // 创建一次性事件监听器，等待模块实例化完成
        const onInstantiated = (event: {
          moduleId: string;
          moduleTypeId: string;
          position?: Position;
        }) => {
          if (event.moduleTypeId === typeId) {
            // 移除监听器
            eventBus.off('MODULE.INSTANTIATED', onInstantiated);
            eventBus.off('MODULE.INSTANTIATE_FAILED', onFailed);

            // 获取创建的模块实例
            const moduleInstance = useModulesStore
              .getState()
              .getModule(event.moduleId);
            if (moduleInstance) {
              resolve(moduleInstance);
            } else {
              reject(
                new Error(
                  `Module was instantiated but not found in store: ${event.moduleId}`
                )
              );
            }
          }
        };

        // 创建一次性事件监听器，处理模块实例化失败
        const onFailed = (event: {
          moduleTypeId: string;
          error: EventBusError;
        }) => {
          if (event.moduleTypeId === typeId) {
            // 移除监听器
            eventBus.off('MODULE.INSTANTIATED', onInstantiated);
            eventBus.off('MODULE.INSTANTIATE_FAILED', onFailed);

            reject(
              new Error(`Failed to instantiate module: ${event.error.message}`)
            );
          }
        };

        // 注册事件监听器
        eventBus.on('MODULE.INSTANTIATED', onInstantiated);
        eventBus.on('MODULE.INSTANTIATE_FAILED', onFailed);

        // 发出模块实例化请求事件
        eventBus.emit('MODULE.INSTANTIATE_REQUESTED', {
          moduleTypeId: typeId,
          position,
          requestId,
        });
      } catch (error) {
        reject(error);
      }
    });
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
