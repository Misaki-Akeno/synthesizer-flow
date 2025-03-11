import { nanoid } from 'nanoid';
import { ModuleBase, ParameterValue } from '@/types/module';
// import { moduleRegistry } from './ModuleRegistry';
import { moduleFactory } from '../factory/ModuleFactory';
import { eventBus } from '../events/EventBus';
import { useModulesStore } from '../store/useModulesStore';
import { Position } from '@/types/event';

/**
 * 模块服务
 * 负责模块的创建、初始化和管理
 */
export class ModuleService {
  /**
   * 初始化模块服务
   */
  async initialize(): Promise<void> {
    // 监听模块创建请求
    eventBus.on('MODULE.CREATE_REQUEST', this.handleModuleCreateRequest.bind(this));
    
    // 监听模块销毁请求
    eventBus.on('MODULE.DESTROY_REQUEST', this.handleModuleDestroyRequest.bind(this));
    
    // 监听模块实例化请求
    eventBus.on('MODULE.INSTANTIATE_REQUESTED', this.handleModuleInstantiateRequest.bind(this));
    
    // 监听模块释放请求
    eventBus.on('MODULE.DISPOSE_REQUESTED', this.handleModuleDisposeRequest.bind(this));
    
    // 监听连接请求
    eventBus.on('CONNECTION.REQUESTED', this.handleConnectionRequest.bind(this));
    
    // 监听参数变更请求
    eventBus.on('PARAMETER.CHANGE_REQUESTED', this.handleParameterChangeRequest.bind(this));
    
    // 发出模块服务初始化完成事件
    eventBus.emit('MODULE_SERVICE.INITIALIZED', {
      time: new Date().toISOString()
    });
    
    console.log('ModuleService initialized');
  }
  
  /**
   * 处理模块创建请求
   */
  private async handleModuleCreateRequest(event: { 
    typeId: string; 
    instanceId?: string; 
    position?: Position 
  }): Promise<void> {
    try {
      const { typeId, instanceId, position } = event;
      
      // 创建模块实例
      const moduleInstance = await moduleFactory.create(typeId, instanceId);
      
      // 将模块添加到状态存储
      useModulesStore.getState().addModule(moduleInstance, position);
      
    } catch (error) {
      console.error('Failed to create module:', error);
      // 错误已在moduleFactory.create中处理
    }
  }
  
  /**
   * 处理模块销毁请求
   */
  private async handleModuleDestroyRequest(event: { moduleId: string }): Promise<void> {
    try {
      const { moduleId } = event;
      
      // 销毁模块实例
      await moduleFactory.destroy(moduleId);
      
      // 从状态中删除模块(这里没有真正实现删除，只是作为示例)
      // 删除逻辑需要在useModulesStore中实现
      
    } catch (error) {
      console.error('Failed to destroy module:', error);
      // 错误已在moduleFactory.destroy中处理
    }
  }
  
  /**
   * 处理模块实例化请求
   */
  private async handleModuleInstantiateRequest(event: { 
    moduleTypeId: string; 
    position?: Position 
  }): Promise<void> {
    const { moduleTypeId, position } = event;
    const instanceId = nanoid();
    
    try {
      // 发出创建请求
      eventBus.emit('MODULE.CREATE_REQUEST', {
        typeId: moduleTypeId,
        instanceId,
        position
      });
      
      // 创建成功后发出实例化完成事件
      eventBus.emit('MODULE.INSTANTIATED', {
        moduleId: instanceId,
        moduleTypeId,
        position
      });
      
    } catch (error) {
      console.error('Failed to instantiate module:', error);
      eventBus.emit('MODULE.INSTANTIATE_FAILED', {
        moduleTypeId,
        error: {
          code: 'MODULE_INSTANTIATE_ERROR',
          message: `Failed to instantiate module: ${(error as Error).message}`
        }
      });
    }
  }
  
  /**
   * 处理模块释放请求
   */
  private async handleModuleDisposeRequest(event: { moduleId: string }): Promise<void> {
    const { moduleId } = event;
    
    // 发出销毁请求
    eventBus.emit('MODULE.DESTROY_REQUEST', {
      moduleId
    });
  }
  
  /**
   * 处理连接请求
   */
  private handleConnectionRequest(event: { 
    source: string; 
    target: string; 
    sourceHandle?: string; 
    targetHandle?: string 
  }): void {
    const { source, target, sourceHandle, targetHandle } = event;
    
    try {
      // 获取模块实例
      const sourceModule = useModulesStore.getState().getModule(source);
      const targetModule = useModulesStore.getState().getModule(target);
      
      if (!sourceModule || !targetModule) {
        throw new Error('Source or target module not found');
      }
      
      // 建立连接
      sourceModule.connect(targetModule, sourceHandle, targetHandle);
      
      // 连接事件已经在模块connect方法中发出
      
    } catch (error) {
      console.error('Failed to establish connection:', error);
    }
  }
  
  /**
   * 处理参数变更请求
   */
  private handleParameterChangeRequest(event: { 
    moduleId: string; 
    parameterId: string; 
    value: unknown 
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
    // 生成实例ID
    const instanceId = nanoid();
    
    // 发出创建请求
    eventBus.emit('MODULE.CREATE_REQUEST', {
      typeId,
      instanceId,
      position
    });
    
    // 等待模块创建完成
    const moduleInstance = await moduleFactory.create(typeId, instanceId);
    
    // 添加到状态存储
    useModulesStore.getState().addModule(moduleInstance, position);
    
    return moduleInstance;
  }
}

// 导出模块服务单例
export const moduleService = new ModuleService();
