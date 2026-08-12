import { Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';
import { AudioModuleBase } from '@/core/base/AudioModuleBase';
import {
  ModuleBase,
  type ModuleInterface,
  PortType,
} from '@/core/base/ModuleBase';
import { moduleManager } from '@/core/services/ModuleManager';
import type {
  AudioConnectionSpec,
  AudioModuleSpec,
  GraphPatch,
  RuntimeCommitResult,
  RuntimeCustomUI,
  RuntimeModuleSnapshot,
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

/**
 * 音频运行时是 ModuleBase/Tone 实例的唯一所有者。
 * 对 UI 只发布可序列化快照与显式动作入口。
 */
export class AudioGraphRuntime {
  private snapshots = new Map<string, RuntimeModuleSnapshot>();
  private subscriptions = new Map<string, Subscription[]>();
  private listeners = new Map<string, Set<RuntimeListener>>();
  private actions = new Map<string, Map<string, RuntimeAction>>();

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

  subscribeModule(moduleId: string, listener: RuntimeListener): () => void {
    const listeners =
      this.listeners.get(moduleId) ?? new Set<RuntimeListener>();
    listeners.add(listener);
    this.listeners.set(moduleId, listeners);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(moduleId);
      }
    };
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
    if (result && typeof (result as Promise<unknown>).finally === 'function') {
      void (result as Promise<unknown>).finally(() => {
        this.refreshSnapshot(moduleId);
      });
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
    this.listeners.forEach((listeners) => {
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
    this.subscribeToModule(moduleInstance);
  }

  private disposeModule(moduleId: string): void {
    this.releaseModuleSubscriptions(moduleId);
    moduleManager.disposeModule(moduleId);
    this.snapshots.delete(moduleId);
    this.actions.delete(moduleId);
    this.emit(moduleId);
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

    Object.values(moduleInstance.inputPorts).forEach((subject) => {
      subscriptions.push(
        subject
          .pipe(
            throttleTime(TELEMETRY_THROTTLE_MS, undefined, {
              leading: true,
              trailing: true,
            })
          )
          .subscribe(() => {
            this.refreshSnapshot(moduleInstance.id);
          })
      );
    });

    Object.values(moduleInstance.outputPorts).forEach((subject) => {
      subscriptions.push(
        subject
          .pipe(
            throttleTime(TELEMETRY_THROTTLE_MS, undefined, {
              leading: true,
              trailing: true,
            })
          )
          .subscribe(() => {
            this.refreshSnapshot(moduleInstance.id);
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

  private refreshSnapshot(moduleId: string): void {
    const moduleInstance = moduleManager.getModule(moduleId);
    if (!moduleInstance || moduleInstance.isDisposed()) {
      return;
    }
    this.captureSnapshot(moduleInstance);
    this.emit(moduleId);
  }

  private captureSnapshot(moduleInstance: ModuleBase): void {
    const parameterMeta = Object.fromEntries(
      Object.keys(moduleInstance.parameters).map((key) => [
        key,
        moduleInstance.getParameterMeta(key),
      ])
    );
    const parameters = Object.fromEntries(
      Object.entries(moduleInstance.parameters).map(([key, subject]) => [
        key,
        subject.getValue(),
      ])
    );
    const inputValues = Object.fromEntries(
      Object.entries(moduleInstance.inputPorts).map(([key, subject]) => [
        key,
        toSerializableValue(
          subject.getValue(),
          moduleInstance.inputPortTypes[key]
        ),
      ])
    );
    const outputValues = Object.fromEntries(
      Object.entries(moduleInstance.outputPorts).map(([key, subject]) => [
        key,
        toSerializableValue(
          subject.getValue(),
          moduleInstance.outputPortTypes[key]
        ),
      ])
    );

    const actionMap = new Map<string, RuntimeAction>();
    const customUI = moduleInstance.getCustomUI();
    const sanitizedCustomUI: RuntimeCustomUI | undefined = customUI
      ? {
          type: customUI.type,
          props: (sanitizeProps(customUI.props ?? {}, actionMap) ??
            {}) as Record<string, unknown>,
          actions: Array.from(actionMap.keys()),
        }
      : undefined;

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
      inputPortTypes: { ...moduleInstance.inputPortTypes },
      outputPortTypes: { ...moduleInstance.outputPortTypes },
      inputValues,
      outputValues,
      customUI: sanitizedCustomUI,
    };
    this.snapshots.set(moduleInstance.id, snapshot);
    moduleDefinitionRegistry.registerSnapshot(snapshot);
  }

  private emit(moduleId: string): void {
    this.listeners.get(moduleId)?.forEach((listener) => listener());
  }
}

export const audioGraphRuntime = new AudioGraphRuntime();
