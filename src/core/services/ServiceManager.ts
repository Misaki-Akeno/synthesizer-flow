import { ModuleService } from './ModuleService';
import { ConnectionService } from './ConnectionService';
import { FlowService } from './FlowService';
import { ParametersServicePre } from './ParametersServicePre';
import { ContextMenuService } from './ContextMenuService';
import { errorHandler } from '../events/ErrorHandler';
import { eventBus } from '../events/EventBus';
import { moduleLifecycleManager } from '../domain/ModuleLifecycle';
import { moduleRegistry, discoverAndRegisterModules } from '../factory/ModuleRegistry';
// 导入新的参数系统
import { parameterStream, initializeParameterSystem } from './parameters';
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
  private _parameterServicePre: ParametersServicePre | null = null;
  private _contextMenuService: ContextMenuService | null = null;
  // 新增参数系统实例
  private _parameterSystem: typeof parameterStream | null = null;
  
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
      this._parameterServicePre = new ParametersServicePre();
      
      // 初始化新的参数系统
      initializeParameterSystem();
      this._parameterSystem = parameterStream;
      
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
  get parameterServicePre(): ParametersServicePre {
    if (!this._parameterServicePre) {
      throw new Error('ParametersService未初始化，请先调用bootstrap()');
    }
    return this._parameterServicePre;
  }

  /**
   * 获取新的参数系统
   * 基于RxJS的响应式参数管理
   */
  get parameterSystem() {
    if (!this._parameterSystem) {
      throw new Error('参数系统未初始化，请先调用bootstrap()');
    }
    return this._parameterSystem;
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

/**
 * =====================================================
 * 新参数系统文档 (RxJS-based Parameter System)
 * =====================================================
 * 
 * 概述：
 * 新的参数系统采用了响应式编程模型，基于RxJS构建。相比旧系统，新系统提供了更强大的参数状态管理、
 * 订阅机制和自动化能力，同时降低了系统各部分之间的耦合度。
 * 
 * 主要组件：
 * 
 * 1. ParameterSubject - 单个参数的响应式封装
 *    - 维护参数状态（值、可见性、禁用状态等）
 *    - 提供参数值变化的Observable流
 *    - 处理参数验证和值调整
 * 
 * 2. ParameterStream - 全局参数管理器
 *    - 注册和管理所有模块的参数
 *    - 提供参数变更事件的全局流
 *    - 实现参数自动化（一个参数控制另一个）
 *    - 处理模块销毁时的参数清理
 * 
 * 使用示例：
 * 
 * 1. 获取参数值并订阅变化
 *    ```typescript
 *    // 获取单个参数值的流
 *    Services.parameterSystem.getParameterValue$<number>('moduleId', 'frequency')
 *      .subscribe(value => {
 *        console.log(`频率变更为: ${value}Hz`);
 *      });
 *    ```
 * 
 * 2. 监听所有参数变更
 *    ```typescript
 *    Services.parameterSystem.getParameterChanges$()
 *      .subscribe(change => {
 *        console.log(`参数 ${change.moduleId}.${change.parameterId} 变更为 ${change.value}`);
 *      });
 *    ```
 * 
 * 3. 更新参数值
 *    ```typescript
 *    Services.parameterSystem.updateParameterValue(
 *      'moduleId',
 *      'frequency',
 *      440,
 *      'ui' // 指定更新来源（ui, automation, preset, api, internal）
 *    );
 *    ```
 * 
 * 4. 创建参数自动化（例如LFO控制滤波器截止频率）
 *    ```typescript
 *    Services.parameterSystem.createParameterAutomation({
 *      sourceModuleId: 'lfo1',
 *      sourceParameterId: 'output',
 *      targetModuleId: 'filter1',
 *      targetParameterId: 'cutoff',
 *      amount: 0.5, // 影响程度（0-1）
 *    });
 *    ```
 * 
 * 5. 注册模块参数
 *    ```typescript
 *    Services.parameterSystem.registerModuleParameters('oscillator1', {
 *      frequency: {
 *        id: 'frequency',
 *        type: 'number',
 *        label: '频率',
 *        value: 440,
 *        defaultValue: 440,
 *        min: 20,
 *        max: 20000,
 *        unit: 'Hz'
 *      },
 *      // 更多参数...
 *    });
 *    ```
 * 
 * 与旧系统兼容性：
 * - 新参数系统与旧系统可以并行运行
 * - 模块可以逐步从旧系统迁移到新系统
 * - 提供兼容层以便旧代码可以与新参数系统交互
 * 
 * 未来改进计划：
 * - 参数历史记录和撤销功能
 * - 参数分组和层次结构
 * - UI组件与参数系统的直接集成
 * - 参数预设保存与加载
 * - 序列器和时间轴控制集成
 * 
 * 开发状态：
 * [✅] 核心参数流设计
 * [✅] 参数状态管理
 * [✅] 参数自动化
 * [  ] UI组件集成
 * [  ] 预设系统
 * [  ] 持久化存储
 */
