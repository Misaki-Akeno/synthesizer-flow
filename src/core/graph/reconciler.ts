import type {
  AudioConnectionSpec,
  AudioGraphDocument,
  AudioModuleSpec,
  GraphPatch,
} from './types';

function connectionKey(connection: AudioConnectionSpec): string {
  return [
    connection.source,
    connection.sourcePort,
    connection.target,
    connection.targetPort,
  ].join('\u0000');
}

function moduleMap(document: AudioGraphDocument): Map<string, AudioModuleSpec> {
  return new Map(document.modules.map((module) => [module.id, module]));
}

/**
 * 生成从上一份声明图到下一份声明图的最小有序 Patch。
 * 顺序保证先断开和销毁旧资源，再创建、更新并连接新资源。
 */
export function reconcileAudioGraph(
  previous: AudioGraphDocument,
  next: AudioGraphDocument
): GraphPatch[] {
  const patches: GraphPatch[] = [];
  const previousModules = moduleMap(previous);
  const nextModules = moduleMap(next);
  const replacedModuleIds = new Set<string>();
  previousModules.forEach((module, id) => {
    const nextModule = nextModules.get(id);
    if (!nextModule || nextModule.type !== module.type) {
      replacedModuleIds.add(id);
    }
  });
  nextModules.forEach((module, id) => {
    const previousModule = previousModules.get(id);
    if (!previousModule || previousModule.type !== module.type) {
      replacedModuleIds.add(id);
    }
  });
  const previousConnections = new Map(
    previous.connections.map((connection) => [
      connectionKey(connection),
      connection,
    ])
  );
  const nextConnections = new Map(
    next.connections.map((connection) => [
      connectionKey(connection),
      connection,
    ])
  );

  previousConnections.forEach((connection, key) => {
    if (
      !nextConnections.has(key) ||
      replacedModuleIds.has(connection.source) ||
      replacedModuleIds.has(connection.target)
    ) {
      patches.push({ type: 'disconnect', connection });
    }
  });

  previousModules.forEach((module, id) => {
    const nextModule = nextModules.get(id);
    if (!nextModule || nextModule.type !== module.type) {
      patches.push({ type: 'disposeModule', moduleId: id });
    }
  });

  nextModules.forEach((module, id) => {
    const previousModule = previousModules.get(id);
    if (!previousModule || previousModule.type !== module.type) {
      patches.push({ type: 'createModule', module });
      return;
    }

    if (previousModule.name !== module.name) {
      patches.push({ type: 'renameModule', moduleId: id, name: module.name });
    }

    if (previousModule.enabled !== module.enabled) {
      patches.push({
        type: 'setEnabled',
        moduleId: id,
        enabled: module.enabled,
      });
    }

    Object.entries(module.parameters).forEach(([key, value]) => {
      if (previousModule.parameters[key] !== value) {
        patches.push({ type: 'setParameter', moduleId: id, key, value });
      }
    });
  });

  nextConnections.forEach((connection, key) => {
    if (
      !previousConnections.has(key) ||
      replacedModuleIds.has(connection.source) ||
      replacedModuleIds.has(connection.target)
    ) {
      patches.push({ type: 'connect', connection });
    }
  });

  return patches;
}

export function getAudioConnectionKey(connection: AudioConnectionSpec): string {
  return connectionKey(connection);
}
