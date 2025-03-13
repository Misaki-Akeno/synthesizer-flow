import { ModuleBase } from '@/interfaces/module';
import {
  ModuleLifecycleManager,
  ModuleLifecycleState,
} from '@/interfaces/lifecycle';

/**
 * 模块生命周期管理实现
 */
class ModuleLifecycleManagerImpl implements ModuleLifecycleManager {
  private modules: Record<string, ModuleBase> = {};
  private states: Record<string, ModuleLifecycleState> = {};
  private listeners: Array<
    (moduleId: string, state: ModuleLifecycleState) => void
  > = [];
  private positions: Record<string, { x: number; y: number }> = {};

  getState(moduleId: string): ModuleLifecycleState | undefined {
    return this.states[moduleId];
  }

  setState(moduleId: string, state: ModuleLifecycleState): void {
    this.states[moduleId] = state;
    this.notifyListeners(moduleId, state);
  }

  registerModule(moduleId: string, instance: ModuleBase): void {
    this.modules[moduleId] = instance;
    this.states[moduleId] = ModuleLifecycleState.CREATED;
    this.notifyListeners(moduleId, ModuleLifecycleState.CREATED);
  }

  getModule(moduleId: string): ModuleBase | undefined {
    return this.modules[moduleId];
  }

  getAllModules(): Record<string, ModuleBase> {
    return { ...this.modules };
  }

  onStateChange(
    callback: (moduleId: string, state: ModuleLifecycleState) => void
  ): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(
        (listener) => listener !== callback
      );
    };
  }

  updateModulePosition(moduleId: string, position: { x: number; y: number }): void {
    this.positions[moduleId] = position;
  }

  getModulePosition(moduleId: string): { x: number; y: number } | undefined {
    return this.positions[moduleId];
  }

  isModuleInitialized(moduleId: string): boolean {
    const state = this.states[moduleId];
    return state === ModuleLifecycleState.INITIALIZED;
  }

  private notifyListeners(moduleId: string, state: ModuleLifecycleState): void {
    for (const listener of this.listeners) {
      listener(moduleId, state);
    }
  }
}

// 导出单例实例
export const moduleLifecycleManager = new ModuleLifecycleManagerImpl();
