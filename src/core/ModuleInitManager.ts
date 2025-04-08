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

  /**
   * 注册一个需要异步初始化的模块
   * @param moduleId 模块ID
   */
  public registerPendingModule(moduleId: string): void {
    this.pendingModules.add(moduleId);
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
   * 重置管理器状态（主要用于测试）
   */
  public reset(): void {
    this.pendingModules.clear();
    this.initializedModules.clear();
    this.initCallbacks.clear();
  }
}

// 导出单例实例
export const moduleInitManager = new ModuleInitManager();
