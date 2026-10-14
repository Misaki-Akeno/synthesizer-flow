import { Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { AudioModuleBase } from '@/core/base/AudioModuleBase';
import {
  ModuleBase,
  type ModuleInterface,
  PortType,
} from '@/core/base/ModuleBase';
import { moduleManager } from '@/core/services/ModuleManager';
import { moduleInitManager } from '@/core/services/ModuleInitManager';
import type {
  AudioConnectionSpec,
  AudioModuleSpec,
  GraphPatch,
  RuntimeCommitResult,
  RuntimeCustomUI,
  RuntimeModuleSnapshot,
  RuntimeModuleTelemetry,
} from '@/core/graph/types';
import { moduleDefinitionRegistry } from '@/core/graph/ModuleDefinitionRegistry';
import { transportService } from '@/core/audio/TransportService';

const TELEMETRY_THROTTLE_MS = 100;

type RuntimeListener = () => void;
type RuntimeAction = (...args: unknown[]) => unknown;

function toSerializableValue(
  value: ModuleInterface,
  portType: PortType
): ModuleInterface {
  if (portType === PortType.AUDIO) {
    return value ? 1 : 0;
  }

  if (
    value === null ||
    typeof value === 'number' ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value as ModuleInterface;
  }

  if (Array.isArray(value)) {
    return value;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as ModuleInterface;
  } catch {
    return 0;
  }
}

function sanitizeProps(
  value: unknown,
  actions: Map<string, RuntimeAction>,
  path = ''
): unknown {
  if (typeof value === 'function') {
    actions.set(path, value as RuntimeAction);
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) =>
      sanitizeProps(item, actions, `${path}.${index}`)
    );
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => {
          const childPath = path ? `${path}.${key}` : key;
          return [key, sanitizeProps(item, actions, childPath)] as const;
        })
        .filter(([, item]) => item !== undefined)
    );
  }

  return value;
}

function isSameJson(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 逐键复用内容未变的旧值，让 memo 组件能靠引用判断跳过重渲染。
 * 所有键都未变化时直接返回旧对象。
 */
function reuseStableRecord<T>(
  previous: Record<string, T> | undefined,
  next: Record<string, T>
): Record<string, T> {
  if (!previous) return next;
  const nextKeys = Object.keys(next);
  let unchanged = nextKeys.length === Object.keys(previous).length;
  const merged = Object.fromEntries(
    nextKeys.map((key) => {
      if (key in previous && isSameJson(previous[key], next[key])) {
        return [key, previous[key]];
      }
      unchanged = false;
      return [key, next[key]];
    })
  );
  return unchanged ? previous : merged;
}

/**
 * 音频运行时是 ModuleBase/Tone 实例的唯一所有者。
 * 对 UI 只发布可序列化快照与显式动作入口。
 */
export class AudioGraphRuntime {
  private snapshots = new Map<string, RuntimeModuleSnapshot>();
  private subscriptions = new Map<string, Subscription[]>();
  private listeners = new Map<string, Set<RuntimeListener>>();
  private actions = new Map<string, Map<string, RuntimeAction>>();
  private telemetry = new Map<string, RuntimeModuleTelemetry>();
  private dirtyTelemetry = new Set<string>();
  private telemetryListeners = new Map<string, Set<RuntimeListener>>();

  /** 返回音频调度器的权威播放位置，不向 UI 暴露 Tone 对象。 */
  getTransportPositionTicks(): number | undefined {
    return transportService.getPositionTicks();
  }

  pauseTransport(): void {
    transportService.pause();
  }

  resumeTransport(): void {
    transportService.resume();
  }

  seekTransport(ticks: number): void {
    transportService.seekTicks(ticks);
  }

  setTransportBpm(bpm: number): void {
    transportService.setBpm(bpm);
  }

  /** AudioContext 解锁后立即刷新输出模块，无需再点节点内的启动按钮。 */
  activateOutputModules(): void {
    this.snapshots.forEach((snapshot) => {
      if (snapshot.type !== 'speaker') return;
      this.invokeAction(snapshot.id, 'onClick');
    });
  }

  getModuleSnapshot(moduleId: string): RuntimeModuleSnapshot | undefined {
    return this.snapshots.get(moduleId);
  }

  getModuleSnapshots(): RuntimeModuleSnapshot[] {
    return Array.from(this.snapshots.values());
  }

  /** 订阅结构快照：参数、启用状态、端口类型与自定义 UI。端口值变化不会触发。 */
  subscribeModule(moduleId: string, listener: RuntimeListener): () => void {
    return addListener(this.listeners, moduleId, listener);
  }

  /**
   * 端口值按需读取：端口事件只标记脏位，真正读取时才序列化，
   * 没有订阅者的模块不会产生任何遥测开销。
   */
  getModuleTelemetry(moduleId: string): RuntimeModuleTelemetry | undefined {
    if (this.dirtyTelemetry.has(moduleId) || !this.telemetry.has(moduleId)) {
      const moduleInstance = moduleManager.getModule(moduleId);
      if (moduleInstance && !moduleInstance.isDisposed()) {
        this.captureTelemetry(moduleInstance);
      }
    }
    return this.telemetry.get(moduleId);
  }

  /** 订阅端口遥测，通知按 TELEMETRY_THROTTLE_MS 节流。 */
  subscribeModuleTelemetry(
    moduleId: string,
    listener: RuntimeListener
  ): () => void {
    return addListener(this.telemetryListeners, moduleId, listener);
  }

  /**
   * 重新初始化音频装配失败的模块。连接仍由 ModuleBase 订阅维持，
   * 重试成功后待处理的音频输入会在 AudioModuleBase 内部重新接入。
   */
  async retryModuleInitialization(moduleId: string): Promise<boolean> {
    const moduleInstance = moduleManager.getModule(moduleId);
    if (!(moduleInstance instanceof AudioModuleBase)) return false;
    try {
      await moduleInstance.retryModuleInitialization();
    } finally {
      this.refreshSnapshot(moduleId);
    }
    return (
      moduleManager.getModule(moduleId) === moduleInstance &&
      moduleInitManager.isModuleInitialized(moduleId)
    );
  }

  canConnect(connection: AudioConnectionSpec): boolean {
    return moduleManager.canBindModules(
      connection.source,
      connection.target,
      connection.sourcePort,
      connection.targetPort
    );
  }

  invokeAction(moduleId: string, action: string, ...args: unknown[]): unknown {
    const callback = this.actions.get(moduleId)?.get(action);
    if (!callback) {
      return undefined;
    }

    const result = callback(...args);
    this.refreshSnapshot(moduleId);
    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      // 同时处理 fulfilled/rejected，既保证异步动作结束后刷新快照，也避免
      // `finally()` 派生出一个无人接收的 rejected Promise。
      void (result as PromiseLike<unknown>).then(
        () => this.refreshSnapshot(moduleId),
        () => this.refreshSnapshot(moduleId)
      );
    }
    return result;
  }

  applyPatches(patches: GraphPatch[]): RuntimeCommitResult {
    const appliedPatches: GraphPatch[] = [];
    const failedConnections: AudioConnectionSpec[] = [];

    patches.forEach((patch) => {
      if (patch.type === 'connect') {
        const connected = moduleManager.bindModules(
          patch.connection.source,
          patch.connection.target,
          patch.connection.sourcePort,
          patch.connection.targetPort
        );
        if (!connected) {
          failedConnections.push(patch.connection);
          return;
        }
        appliedPatches.push(patch);
        return;
      }

      this.applyPatch(patch);
      appliedPatches.push(patch);
    });

    return { appliedPatches, failedConnections };
  }

  dispose(): void {
    Array.from(this.subscriptions.keys()).forEach((moduleId) => {
      this.releaseModuleSubscriptions(moduleId);
    });
    moduleManager.disposeAllModules();
    transportService.reset();
    this.snapshots.clear();
    this.actions.clear();
    this.telemetry.clear();
    this.dirtyTelemetry.clear();
    this.listeners.forEach((listeners) => {
      listeners.forEach((listener) => listener());
    });
    this.telemetryListeners.forEach((listeners) => {
      listeners.forEach((listener) => listener());
    });
  }

  private applyPatch(patch: Exclude<GraphPatch, { type: 'connect' }>): void {
    switch (patch.type) {
      case 'createModule':
        this.createModule(patch.module);
        break;
      case 'disposeModule':
        this.disposeModule(patch.moduleId);
        break;
      case 'renameModule': {
        const moduleInstance = moduleManager.getModule(patch.moduleId);
        moduleInstance?.setName(patch.name);
        this.refreshSnapshot(patch.moduleId);
        break;
      }
      case 'setParameter': {
        const moduleInstance = moduleManager.getModule(patch.moduleId);
        moduleInstance?.updateParameter(patch.key, patch.value);
        break;
      }
      case 'setEnabled': {
        const moduleInstance = moduleManager.getModule(patch.moduleId);
        if (moduleInstance instanceof AudioModuleBase) {
          moduleInstance.setEnabled(patch.enabled);
        }
        break;
      }
      case 'disconnect': {
        const source = moduleManager.getModule(patch.connection.source);
        const target = moduleManager.getModule(patch.connection.target);
        source?.disconnectOutput(
          patch.connection.sourcePort,
          target as ModuleBase,
          patch.connection.targetPort
        );
        break;
      }
    }
  }

  private createModule(spec: AudioModuleSpec): void {
    this.releaseModuleSubscriptions(spec.id);
    const moduleInstance = moduleManager.createModuleInstance(
      spec.type,
      spec.id,
      spec.name
    );

    Object.entries(spec.parameters).forEach(([key, value]) => {
      moduleInstance.updateParameter(key, value);
    });
    if (moduleInstance instanceof AudioModuleBase) {
      moduleInstance.setEnabled(spec.enabled);
    }

    this.captureSnapshot(moduleInstance);
    this.dirtyTelemetry.add(moduleInstance.id);
    this.subscribeToModule(moduleInstance);
  }

  private disposeModule(moduleId: string): void {
    this.releaseModuleSubscriptions(moduleId);
    moduleManager.disposeModule(moduleId);
    this.snapshots.delete(moduleId);
    this.actions.delete(moduleId);
    this.telemetry.delete(moduleId);
    this.dirtyTelemetry.delete(moduleId);
    this.emit(moduleId);
    this.emitTelemetry(moduleId);
  }

  private subscribeToModule(moduleInstance: ModuleBase): void {
    const subscriptions: Subscription[] = [];

    Object.values(moduleInstance.parameters).forEach((subject) => {
      subscriptions.push(
        subject.subscribe(() => {
          this.refreshSnapshot(moduleInstance.id);
        })
      );
    });

    [
      ...Object.values(moduleInstance.inputPorts),
      ...Object.values(moduleInstance.outputPorts),
    ].forEach((subject) => {
      subscriptions.push(
        subject
          .pipe(
            throttleTime(TELEMETRY_THROTTLE_MS, undefined, {
              leading: true,
              trailing: true,
            })
          )
          .subscribe(() => {
            this.handlePortActivity(moduleInstance);
          })
      );
    });

    if (moduleInstance instanceof AudioModuleBase) {
      subscriptions.push(
        moduleInstance.enabled.subscribe(() => {
          this.refreshSnapshot(moduleInstance.id);
        })
      );
    }

    this.subscriptions.set(moduleInstance.id, subscriptions);
  }

  private releaseModuleSubscriptions(moduleId: string): void {
    this.subscriptions.get(moduleId)?.forEach((subscription) => {
      subscription.unsubscribe();
    });
    this.subscriptions.delete(moduleId);
  }

  private handlePortActivity(moduleInstance: ModuleBase): void {
    if (moduleInstance.isDisposed()) return;
    this.dirtyTelemetry.add(moduleInstance.id);
    this.emitTelemetry(moduleInstance.id);

    // 少数自定义 UI 的 props 由端口事件驱动（例如钢琴键盘的按下状态），
    // 只有其内容确实变化时才刷新结构快照，避免整张卡片跟着端口值重渲染。
    const current = this.snapshots.get(moduleInstance.id)?.customUI;
    const { customUI } = this.buildCustomUI(moduleInstance);
    if (!isSameJson(current, customUI)) {
      this.refreshSnapshot(moduleInstance.id);
    }
  }

  private refreshSnapshot(moduleId: string): void {
    const moduleInstance = moduleManager.getModule(moduleId);
    if (!moduleInstance || moduleInstance.isDisposed()) {
      return;
    }
    this.captureSnapshot(moduleInstance);
    this.emit(moduleId);
  }

  private captureSnapshot(moduleInstance: ModuleBase): void {
    const previous = this.snapshots.get(moduleInstance.id);
    const parameterMeta = reuseStableRecord(
      previous?.parameterMeta,
      Object.fromEntries(
        Object.keys(moduleInstance.parameters).map((key) => [
          key,
          moduleInstance.getParameterMeta(key),
        ])
      )
    );
    const parameters = Object.fromEntries(
      Object.entries(moduleInstance.parameters).map(([key, subject]) => [
        key,
        subject.getValue(),
      ])
    );

    const { customUI, actionMap } = this.buildCustomUI(moduleInstance);
    this.actions.set(moduleInstance.id, actionMap);
    const snapshot: RuntimeModuleSnapshot = {
      id: moduleInstance.id,
      type: moduleInstance.moduleType,
      name: moduleInstance.name,
      enabled:
        moduleInstance instanceof AudioModuleBase
          ? moduleInstance.isEnabled()
          : true,
      canEnable: moduleInstance instanceof AudioModuleBase,
      parameters,
      parameterMeta,
      inputPortTypes: reuseStableRecord(previous?.inputPortTypes, {
        ...moduleInstance.inputPortTypes,
      }),
      outputPortTypes: reuseStableRecord(previous?.outputPortTypes, {
        ...moduleInstance.outputPortTypes,
      }),
      customUI: isSameJson(previous?.customUI, customUI)
        ? previous?.customUI
        : customUI,
    };
    this.snapshots.set(moduleInstance.id, snapshot);
    moduleDefinitionRegistry.registerSnapshot(snapshot);
  }

  private buildCustomUI(moduleInstance: ModuleBase): {
    customUI: RuntimeCustomUI | undefined;
    actionMap: Map<string, RuntimeAction>;
  } {
    const actionMap = new Map<string, RuntimeAction>();
    const customUI = moduleInstance.getCustomUI();
    return {
      actionMap,
      customUI: customUI
        ? {
            type: customUI.type,
            props: (sanitizeProps(customUI.props ?? {}, actionMap) ??
              {}) as Record<string, unknown>,
            actions: Array.from(actionMap.keys()),
          }
        : undefined,
    };
  }

  private captureTelemetry(moduleInstance: ModuleBase): void {
    const readValues = (
      ports: Record<string, { getValue: () => ModuleInterface }>,
      types: Record<string, PortType>
    ) =>
      Object.fromEntries(
        Object.entries(ports).map(([key, subject]) => [
          key,
          toSerializableValue(subject.getValue(), types[key]),
        ])
      );
    this.telemetry.set(moduleInstance.id, {
      inputValues: readValues(
        moduleInstance.inputPorts,
        moduleInstance.inputPortTypes
      ),
      outputValues: readValues(
        moduleInstance.outputPorts,
        moduleInstance.outputPortTypes
      ),
    });
    this.dirtyTelemetry.delete(moduleInstance.id);
  }

  private emit(moduleId: string): void {
    this.listeners.get(moduleId)?.forEach((listener) => listener());
  }

  private emitTelemetry(moduleId: string): void {
    this.telemetryListeners.get(moduleId)?.forEach((listener) => listener());
  }
}

function addListener(
  registry: Map<string, Set<RuntimeListener>>,
  moduleId: string,
  listener: RuntimeListener
): () => void {
  const listeners = registry.get(moduleId) ?? new Set<RuntimeListener>();
  listeners.add(listener);
  registry.set(moduleId, listeners);

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      registry.delete(moduleId);
    }
  };
}

export const audioGraphRuntime = new AudioGraphRuntime();
