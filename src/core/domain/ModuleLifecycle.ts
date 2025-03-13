import { ModuleBase } from '@/interfaces/module';
import { ModuleLifecycleManager, ModuleLifecycleState } from '@/interfaces/lifecycle';

/**
 * 模块生命周期管理实现
 */
class ModuleLifecycleManagerImpl implements ModuleLifecycleManager {
  private modules: Record<string, ModuleBase> = {};
  private states: Record<string, ModuleLifecycleState> = {};
  private listeners: Array<(moduleId: string, state: ModuleLifecycleState) => void> = [];

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

  onStateChange(callback: (moduleId: string, state: ModuleLifecycleState) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  private notifyListeners(moduleId: string, state: ModuleLifecycleState): void {
    for (const listener of this.listeners) {
      listener(moduleId, state);
    }
  }
}

// 导出单例实例
export const moduleLifecycleManager = new ModuleLifecycleManagerImpl();
