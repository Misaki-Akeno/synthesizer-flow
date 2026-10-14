/* eslint-disable @typescript-eslint/no-explicit-any */
/** 模块初始化的可观察状态。失败和销毁都是已结算状态，不会阻塞其他模块。 */
export type ModuleInitStatus = 'pending' | 'initialized' | 'failed' | 'disposed';

export enum ModuleLifecycleEvent {
  REGISTERED = 'registered',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  DISPOSED = 'disposed',
  ERROR = 'error',
}

export type ModuleLifecycleCallback = (moduleId: string, data?: any) => void;

interface ModuleInitWaiter {
  resolve: () => void;
  reject: (reason: Error) => void;
  generation: number;
  timeout?: ReturnType<typeof setTimeout>;
}

export interface WaitForModuleInitOptions {
  /** 0 means no timer. The default prevents accidental indefinite waits. */
  timeoutMs?: number;
}

const DEFAULT_INITIALIZATION_TIMEOUT_MS = 15_000;

/**
 * Coordinates asynchronous audio-module construction. Registrations are versioned, so
 * an old async constructor sharing an id cannot settle a newer module's registration.
 */
class ModuleInitManager {
  private pendingModules = new Set<string>();
  private initializedModules = new Set<string>();
  private statuses = new Map<string, ModuleInitStatus>();
  private failures = new Map<string, Error>();
  private generations = new Map<string, number>();
  // Never reset this counter: an async instance from before reset must not become current.
  private nextGeneration = 0;
  private initializationTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private initCallbacks = new Map<string, ModuleInitWaiter[]>();
  private lifecycleSubscribers = new Map<ModuleLifecycleEvent, ModuleLifecycleCallback[]>();

  public registerPendingModule(moduleId: string): number {
    const generation = ++this.nextGeneration;
    this.generations.set(moduleId, generation);
    this.clearInitializationTimeout(moduleId);
    this.settleWaiters(moduleId, new Error(`Module ${moduleId} initialization was replaced`));
    this.pendingModules.add(moduleId);
    this.initializedModules.delete(moduleId);
    this.statuses.set(moduleId, 'pending');
    this.failures.delete(moduleId);
    this.initializationTimeouts.set(
      moduleId,
      setTimeout(() => {
        this.markModuleAsFailed(
          moduleId,
          new Error(`Timed out initializing module ${moduleId}`),
          generation
        );
      }, DEFAULT_INITIALIZATION_TIMEOUT_MS)
    );
    this.emitLifecycleEvent(ModuleLifecycleEvent.REGISTERED, moduleId, { generation });
    this.emitLifecycleEvent(ModuleLifecycleEvent.INITIALIZING, moduleId, { generation });
    return generation;
  }

  public isCurrentRegistration(moduleId: string, generation: number): boolean {
    return this.generations.get(moduleId) === generation;
  }

  public markModuleAsInitialized(moduleId: string, generation?: number): void {
    if (generation !== undefined && !this.isCurrentRegistration(moduleId, generation)) return;
    if (!this.pendingModules.has(moduleId)) return;
    this.clearInitializationTimeout(moduleId);
    this.pendingModules.delete(moduleId);
    this.initializedModules.add(moduleId);
    this.statuses.set(moduleId, 'initialized');
    this.failures.delete(moduleId);
    this.emitLifecycleEvent(ModuleLifecycleEvent.INITIALIZED, moduleId, { generation });
    this.settleWaiters(moduleId);
  }

  public markModuleAsFailed(moduleId: string, error: unknown, generation?: number): void {
    if (generation !== undefined && !this.isCurrentRegistration(moduleId, generation)) return;
    if (!this.pendingModules.has(moduleId)) return;
    const failure = error instanceof Error ? error : new Error(String(error));
    this.clearInitializationTimeout(moduleId);
    this.pendingModules.delete(moduleId);
    this.initializedModules.delete(moduleId);
    this.statuses.set(moduleId, 'failed');
    this.failures.set(moduleId, failure);
    this.emitLifecycleEvent(ModuleLifecycleEvent.ERROR, moduleId, { error: failure, generation });
    this.settleWaiters(moduleId, failure);
  }

  public getModuleStatus(moduleId: string): ModuleInitStatus | undefined {
    return this.statuses.get(moduleId);
  }

  public getModuleFailure(moduleId: string): Error | undefined {
    return this.failures.get(moduleId);
  }

  public isModuleInitialized(moduleId: string): boolean {
    return this.statuses.get(moduleId) === 'initialized';
  }

  public isModulePending(moduleId: string): boolean {
    return this.statuses.get(moduleId) === 'pending';
  }

  public waitForModuleInit(
    moduleId: string,
    { timeoutMs = 10_000 }: WaitForModuleInitOptions = {}
  ): Promise<void> {
    const status = this.statuses.get(moduleId);
    if (status === 'initialized') return Promise.resolve();
    if (status === 'failed') return Promise.reject(this.failures.get(moduleId));
    if (status === 'disposed') return Promise.reject(new Error(`Module ${moduleId} was disposed`));
    if (status !== 'pending') return Promise.reject(new Error(`Module ${moduleId} is not registered`));
    return new Promise((resolve, reject) => {
      const waiter: ModuleInitWaiter = {
        resolve,
        reject,
        generation: this.generations.get(moduleId)!,
      };
      if (timeoutMs > 0) {
        waiter.timeout = setTimeout(() => {
          this.removeWaiter(moduleId, waiter);
          const error = new Error(`Timed out waiting for module ${moduleId} to initialize`);
          // A timeout is terminal for this registration, so it cannot hold the rest
          // of the graph behind a promise whose owner has already stopped responding.
          this.markModuleAsFailed(moduleId, error, waiter.generation);
          reject(error);
        }, timeoutMs);
      }
      const waiters = this.initCallbacks.get(moduleId) ?? [];
      waiters.push(waiter);
      this.initCallbacks.set(moduleId, waiters);
    });
  }

  public getPendingModules(): string[] {
    return Array.from(this.pendingModules);
  }

  public getInitializedModules(): string[] {
    return Array.from(this.initializedModules);
  }

  public subscribeToLifecycle(event: ModuleLifecycleEvent, callback: ModuleLifecycleCallback): () => void {
    const callbacks = this.lifecycleSubscribers.get(event) ?? [];
    callbacks.push(callback);
    this.lifecycleSubscribers.set(event, callbacks);
    return () => {
      const index = callbacks.indexOf(callback);
      if (index !== -1) callbacks.splice(index, 1);
    };
  }

  public emitLifecycleEvent(event: ModuleLifecycleEvent, moduleId: string, data?: any): void {
    (this.lifecycleSubscribers.get(event) ?? []).slice().forEach((callback) => callback(moduleId, data));
  }

  public recordConnection(sourceId: string, targetId: string): void {
    this.emitLifecycleEvent(ModuleLifecycleEvent.CONNECTED, sourceId, { targetId });
  }

  public recordDisconnection(sourceId: string, targetId: string): void {
    this.emitLifecycleEvent(ModuleLifecycleEvent.DISCONNECTED, sourceId, { targetId });
  }

  public recordDisposal(moduleId: string, generation?: number, preserveFailure = false): void {
    if (generation !== undefined && !this.isCurrentRegistration(moduleId, generation)) return;
    this.clearInitializationTimeout(moduleId);
    this.pendingModules.delete(moduleId);
    this.initializedModules.delete(moduleId);
    if (!preserveFailure) {
      this.statuses.set(moduleId, 'disposed');
      this.failures.delete(moduleId);
    }
    this.settleWaiters(moduleId, new Error(`Module ${moduleId} was disposed`));
    this.emitLifecycleEvent(ModuleLifecycleEvent.DISPOSED, moduleId, { generation });
  }

  public recordError(moduleId: string, error: unknown): void {
    this.markModuleAsFailed(moduleId, error);
  }

  /** Runs after all current registrations reach any terminal state. */
  public onAllModulesReady(callback: () => void): () => void {
    if (this.pendingModules.size === 0) {
      callback();
      return () => undefined;
    }
    const checkAndExecute = () => {
      if (this.pendingModules.size === 0) {
        unsubscribe();
        callback();
      }
    };
    const unsubscribeInitialized = this.subscribeToLifecycle(ModuleLifecycleEvent.INITIALIZED, checkAndExecute);
    const unsubscribeError = this.subscribeToLifecycle(ModuleLifecycleEvent.ERROR, checkAndExecute);
    const unsubscribeDisposed = this.subscribeToLifecycle(ModuleLifecycleEvent.DISPOSED, checkAndExecute);
    const unsubscribe = () => {
      unsubscribeInitialized();
      unsubscribeError();
      unsubscribeDisposed();
    };
    return unsubscribe;
  }

  public reset(): void {
    Array.from(this.initCallbacks.keys()).forEach((moduleId) => {
      this.settleWaiters(moduleId, new Error('Module initialization manager was reset'));
    });
    this.pendingModules.clear();
    this.initializedModules.clear();
    this.statuses.clear();
    this.failures.clear();
    this.initializationTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.initializationTimeouts.clear();
    this.lifecycleSubscribers.clear();
  }

  private removeWaiter(moduleId: string, waiter: ModuleInitWaiter): void {
    const waiters = this.initCallbacks.get(moduleId);
    if (!waiters) return;
    const index = waiters.indexOf(waiter);
    if (index !== -1) waiters.splice(index, 1);
    if (waiters.length === 0) this.initCallbacks.delete(moduleId);
  }

  private settleWaiters(moduleId: string, error?: Error): void {
    const waiters = this.initCallbacks.get(moduleId) ?? [];
    this.initCallbacks.delete(moduleId);
    waiters.forEach((waiter) => {
      if (waiter.timeout) clearTimeout(waiter.timeout);
      if (error) waiter.reject(error);
      else waiter.resolve();
    });
  }

  private clearInitializationTimeout(moduleId: string): void {
    const timeout = this.initializationTimeouts.get(moduleId);
    if (timeout) clearTimeout(timeout);
    this.initializationTimeouts.delete(moduleId);
  }
}

export const moduleInitManager = new ModuleInitManager();
