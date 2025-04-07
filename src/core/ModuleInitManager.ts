type InitCallback = () => void;

/**
 * 模块初始化管理器 - 跟踪和管理所有异步初始化的模块
 */
class ModuleInitManager {
  private pendingModules: Map<string, boolean> = new Map();
  private readyCallbacks: InitCallback[] = [];
  private isReady: boolean = false;
  
  /**
   * 注册一个模块为待初始化状态
   * @param moduleId 模块ID
   */
  registerPendingModule(moduleId: string): void {
    this.pendingModules.set(moduleId, false);
    this.isReady = false;
  }
  
  /**
   * 将一个模块标记为已初始化
   * @param moduleId 模块ID 
   */
  markModuleAsInitialized(moduleId: string): void {
    if (this.pendingModules.has(moduleId)) {
      this.pendingModules.set(moduleId, true);
      this.checkAllInitialized();
    }
  }
  
  /**
   * 检查是否所有模块都已初始化
   */
  private checkAllInitialized(): void {
    let allReady = true;
    this.pendingModules.forEach((initialized) => {
      if (!initialized) allReady = false;
    });
    
    if (allReady && !this.isReady && this.pendingModules.size > 0) {
      this.isReady = true;
      this.readyCallbacks.forEach(callback => callback());
      this.readyCallbacks = [];
    }
  }
  
  /**
   * 注册一个在所有模块初始化完成后执行的回调
   * @param callback 回调函数
   */
  onAllModulesReady(callback: InitCallback): void {
    if (this.isReady) {
      callback();
    } else {
      this.readyCallbacks.push(callback);
    }
  }
  
  /**
   * 重置初始化状态
   */
  reset(): void {
    this.pendingModules.clear();
    this.readyCallbacks = [];
    this.isReady = false;
  }
}

export const moduleInitManager = new ModuleInitManager();
