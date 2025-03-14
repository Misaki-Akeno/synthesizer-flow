import { ModuleBase } from './module';

/**
 * 模块生命周期状态
 */
export enum ModuleLifecycleState {
  CREATED = 'created',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  ERROR = 'error',
  DISPOSING = 'disposing',
  DISPOSED = 'disposed',
}

/**
 * 模块生命周期管理接口
 */
export interface ModuleLifecycleManager {
  /**
   * 获取模块当前状态
   */
  getState(moduleId: string): ModuleLifecycleState | undefined;

  /**
   * 更新模块状态
   */
  setState(moduleId: string, state: ModuleLifecycleState): void;

  /**
   * 注册模块
   */
  registerModule(moduleId: string, instance: ModuleBase): void;

  /**
   * 获取模块实例
   */
  getModule(moduleId: string): ModuleBase | undefined;

  /**
   * 获取所有模块
   */
  getAllModules(): Record<string, ModuleBase>;

  /**
   * 监听模块状态变化
   */
  onStateChange(
    callback: (moduleId: string, state: ModuleLifecycleState) => void
  ): () => void;

  /**
   * 更新模块位置
   */
  updateModulePosition(
    moduleId: string,
    position: { x: number; y: number }
  ): void;

  /**
   * 获取模块位置
   */
  getModulePosition(moduleId: string): { x: number; y: number } | undefined;

  /**
   * 检查模块是否已初始化完成
   */
  isModuleInitialized(moduleId: string): boolean;
}

export * from './lifecycle';
