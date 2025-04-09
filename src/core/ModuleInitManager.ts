/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 模块生命周期事件类型
 */
export enum ModuleLifecycleEvent {
  REGISTERED = 'registered',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  DISPOSED = 'disposed',
  ERROR = 'error'
}

/**
 * 生命周期事件回调类型
 */
export type ModuleLifecycleCallback = (moduleId: string, data?: any) => void;

/**
 * 模块初始化管理器
 * 用于管理音频模块的异步初始化过程
 */
class ModuleInitManager {
  // 存储待初始化的模块ID
  private pendingModules: Set<string> = new Set();
  // 存储已初始化完成的模块ID
  private initializedModules: Set<string> = new Set();
  // 初始化完成的回调函数
  private initCallbacks: Map<string, (() => void)[]> = new Map();
  // 生命周期事件订阅
  private lifecycleSubscribers: Map<ModuleLifecycleEvent, ModuleLifecycleCallback[]> = new Map();

  /**
   * 注册一个需要异步初始化的模块
   * @param moduleId 模块ID
   */
  public registerPendingModule(moduleId: string): void {
    this.pendingModules.add(moduleId);
    this.emitLifecycleEvent(ModuleLifecycleEvent.REGISTERED, moduleId);
  }

  /**
   * 标记一个模块已完成初始化
   * @param moduleId 模块ID
   */
  public markModuleAsInitialized(moduleId: string): void {
    if (!this.pendingModules.has(moduleId)) {
      console.warn(`Module ${moduleId} was not registered as pending`);
    }

    this.pendingModules.delete(moduleId);
    this.initializedModules.add(moduleId);
    this.emitLifecycleEvent(ModuleLifecycleEvent.INITIALIZED, moduleId);
    
    // 触发该模块的初始化完成回调
    if (this.initCallbacks.has(moduleId)) {
      const callbacks = this.initCallbacks.get(moduleId) || [];
      callbacks.forEach(callback => callback());
      this.initCallbacks.delete(moduleId);
    }
  }

  /**
   * 检查模块是否已初始化
   * @param moduleId 模块ID
   */
  public isModuleInitialized(moduleId: string): boolean {
    return this.initializedModules.has(moduleId);
  }

  /**
   * 检查模块是否在初始化中
   * @param moduleId 模块ID
   */
  public isModulePending(moduleId: string): boolean {
    return this.pendingModules.has(moduleId);
  }

  /**
   * 等待模块初始化完成
   * @param moduleId 模块ID
   * @returns Promise，在模块初始化完成时解析
   */
  public waitForModuleInit(moduleId: string): Promise<void> {
    // 如果模块已初始化，立即解析
    if (this.isModuleInitialized(moduleId)) {
      return Promise.resolve();
    }
    
    // 如果模块不在等待列表中也不在已完成列表中，返回错误
    if (!this.isModulePending(moduleId)) {
      return Promise.reject(new Error(`Module ${moduleId} is not registered`));
    }
    
    // 否则返回一个Promise，当模块初始化完成时解析
    return new Promise(resolve => {
      if (!this.initCallbacks.has(moduleId)) {
        this.initCallbacks.set(moduleId, []);
      }
      this.initCallbacks.get(moduleId)?.push(resolve);
    });
  }

  /**
   * 获取所有待初始化的模块ID
   */
  public getPendingModules(): string[] {
    return Array.from(this.pendingModules);
  }

  /**
   * 获取所有已初始化的模块ID
   */
  public getInitializedModules(): string[] {
    return Array.from(this.initializedModules);
  }

  /**
   * 订阅模块生命周期事件
   * @param event 生命周期事件类型
   * @param callback 回调函数
   * @returns 取消订阅的函数
   */
  public subscribeToLifecycle(event: ModuleLifecycleEvent, callback: ModuleLifecycleCallback): () => void {
    if (!this.lifecycleSubscribers.has(event)) {
      this.lifecycleSubscribers.set(event, []);
    }
    
    const callbacks = this.lifecycleSubscribers.get(event)!;
    callbacks.push(callback);
    
    return () => {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    };
  }

  /**
   * 触发生命周期事件
   * @param event 事件类型
   * @param moduleId 模块ID
   * @param data 附加数据
   */
  public emitLifecycleEvent(event: ModuleLifecycleEvent, moduleId: string, data?: any): void {
    const callbacks = this.lifecycleSubscribers.get(event) || [];
    callbacks.forEach(callback => callback(moduleId, data));
  }

  /**
   * 记录模块连接事件
   * @param sourceId 源模块ID
   * @param targetId 目标模块ID
   */
  public recordConnection(sourceId: string, targetId: string): void {
    this.emitLifecycleEvent(ModuleLifecycleEvent.CONNECTED, sourceId, { targetId });
  }

  /**
   * 记录模块断开连接事件
   * @param sourceId 源模块ID
   * @param targetId 目标模块ID
   */
  public recordDisconnection(sourceId: string, targetId: string): void {
    this.emitLifecycleEvent(ModuleLifecycleEvent.DISCONNECTED, sourceId, { targetId });
  }

  /**
   * 记录模块销毁事件
   * @param moduleId 模块ID
   */
  public recordDisposal(moduleId: string): void {
    this.initializedModules.delete(moduleId);
    this.pendingModules.delete(moduleId);
    this.emitLifecycleEvent(ModuleLifecycleEvent.DISPOSED, moduleId);
  }

  /**
   * 记录模块错误事件
   * @param moduleId 模块ID
   * @param error 错误信息
   */
  public recordError(moduleId: string, error: any): void {
    this.emitLifecycleEvent(ModuleLifecycleEvent.ERROR, moduleId, { error });
  }

  /**
   * 重置管理器状态（主要用于测试）
   */
  public reset(): void {
    this.pendingModules.clear();
    this.initializedModules.clear();
    this.initCallbacks.clear();
    this.lifecycleSubscribers.clear();
  }
}

// 导出单例实例
export const moduleInitManager = new ModuleInitManager();
