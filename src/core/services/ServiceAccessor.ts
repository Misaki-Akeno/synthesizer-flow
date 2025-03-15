import { ModuleService } from './ModuleService';
import { ConnectionService } from './ConnectionService';
import { FlowService } from './FlowService';
import { ParametersService } from './ParametersService';
import { ContextMenuService } from './ContextMenuService';
import { errorHandler } from '../events/ErrorHandler';
import { eventBus } from '../events/EventBus';
import { moduleLifecycleManager } from '../domain/ModuleLifecycle';
import { moduleRegistry, discoverAndRegisterModules } from '../factory/ModuleRegistry';
import type { ModuleBase } from '@/interfaces/module';
import type { ModuleLifecycleState } from '@/interfaces/lifecycle';
import type { Position } from '@/interfaces/event';

/**
 * 服务管理器
 * 提供全局服务访问点和应用初始化功能
 * 
 * 这个类取代了之前的bootstrap和container系统，
 * 提供了更简洁直接的服务访问方式
 */
class ServiceManager {
  // 服务实例
  private _moduleService: ModuleService | null = null;
  private _connectionService: ConnectionService | null = null;
  private _flowService: FlowService | null = null;
  private _parameterService: ParametersService | null = null;
  private _contextMenuService: ContextMenuService | null = null;
  
  // 系统初始化状态
  private _initialized = false;

  /**
   * 初始化整个应用
   * 创建并连接所有核心服务
   */
  async bootstrap(): Promise<void> {
    if (this._initialized) {
      console.warn('应用已经初始化过，跳过重复初始化');
      return;
    }

    console.log('🚀 开始初始化应用...');

    try {
      // 1. 创建所有服务实例
      this._moduleService = new ModuleService();
      this._connectionService = new ConnectionService();
      this._flowService = new FlowService();
      this._parameterService = new ParametersService();
      
      // 注册核心实例，确保所有服务都能互相访问到
      this.registerCoreServices();

      // 2. 设置服务之间的引用关系
      
      if (this._moduleService.setConnectionService) {
        this._moduleService.setConnectionService(this._connectionService);
      }
      // 设置FlowService与ConnectionService的关联
      this._flowService.setConnectionService(this._connectionService);

      // 3. 初始化各服务
      await this._moduleService.initialize();
      await this._connectionService.initialize();
      await this._flowService.initialize();


      // 4. 发现并注册所有可用的模块
      await discoverAndRegisterModules();

      this._initialized = true;
      console.log('✅ 应用初始化完成');

      // 5. 发布系统初始化完成事件
      eventBus.emit('SYSTEM.INITIALIZED', {});
    } catch (error) {
      console.error('应用初始化失败:', error);
      throw new Error(`应用初始化失败: ${(error as Error).message}`);
    }
  }
  
  /**
   * 注册核心服务供内部使用
   * 这替代了之前的容器注册方式
   */
  private registerCoreServices(): void {
    // 可以在这里添加其他需要共享的核心服务
    // 未来如果有任何服务需要全局单例，可以在这里注册
  }

  /**
   * 获取模块服务
   */
  get moduleService(): ModuleService {
    if (!this._moduleService) {
      throw new Error('ModuleService未初始化，请先调用bootstrap()');
    }
    return this._moduleService;
  }

  /**
   * 获取连接服务
   */
  get connectionService(): ConnectionService {
    if (!this._connectionService) {
      throw new Error('ConnectionService未初始化，请先调用bootstrap()');
    }
    return this._connectionService;
  }

  /**
   * 获取流程服务
   */
  get flowService(): FlowService {
    if (!this._flowService) {
      throw new Error('FlowService未初始化，请先调用bootstrap()');
    }
    return this._flowService;
  }

  /**
   * 获取参数服务
   */
  get parameterService(): ParametersService {
    if (!this._parameterService) {
      throw new Error('ParametersService未初始化，请先调用bootstrap()');
    }
    return this._parameterService;
  }

  /**
   * 获取上下文菜单服务
   */
  get contextMenuService(): ContextMenuService {
    if (!this._contextMenuService) {
      this._contextMenuService = new ContextMenuService();
    }
    return this._contextMenuService;
  }

  /**
   * 获取事件总线
   */
  get eventBus() {
    return eventBus;
  }

  /**
   * 获取错误处理器
   */
  get errorHandler() {
    return errorHandler;
  }
  
  /**
   * 获取模块生命周期管理器
   */
  get moduleLifecycleManager() {
    return moduleLifecycleManager;
  }
  
  /**
   * 获取模块注册表
   */
  get moduleRegistry() {
    return moduleRegistry;
  }
  
  /**
   * 便捷方法：创建新模块
   */
  async createModule(typeId: string, position?: Position): Promise<ModuleBase> {
    return this.moduleService.createModule(typeId, position);
  }
  
  /**
   * 便捷方法：获取模块状态
   */
  getModuleState(moduleId: string): ModuleLifecycleState | undefined {
    return this.moduleService.getModuleState(moduleId);
  }
}

// 创建单例
export const services = new ServiceManager();

// 添加一个简写引用，让代码更简洁
export const Services = services;

// 导出一个便捷的初始化函数，可以用于替代之前的bootstrapApplication
export async function initializeApplication(): Promise<void> {
  await services.bootstrap();
}

/**
 * 使用示例:
 *
 * import { Services, initializeApplication } from '../services/ServiceAccessor';
 *
 * // 初始化应用
 * await initializeApplication();
 *
 * // 或者直接调用
 * await Services.bootstrap();
 *
 * // 使用服务
 * const module = await Services.createModule('oscillator');
 */
