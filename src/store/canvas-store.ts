'use client';

import { create } from 'zustand';
import {
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
  addEdge as addReactFlowEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from '@xyflow/react';
import { PortType } from '@/core/base/ModuleBase';
import { createAudioGraphDocument } from '@/core/graph/document';
import { getAudioConnectionKey } from '@/core/graph/reconciler';
import {
  connectionSpecFromEdge,
  type FlowNode,
  type ParameterValue,
} from '@/core/graph/types';
import { moduleDefinitionRegistry } from '@/core/graph/ModuleDefinitionRegistry';
import { audioGraphController } from '@/core/runtime/AudioGraphController';
import { audioGraphRuntime } from '@/core/runtime/AudioGraphRuntime';
import { serializationManager } from '@/core/services/SerializationManager';
import type {
  SerializedCanvas,
  SerializedModule,
} from '@/core/types/SerializationTypes';
import {
  validateAndParseJson,
  validateSerializedCanvas,
  validateSerializedModule,
} from '@/core/types/SerializationValidator';
import { createModuleLogger } from '@/lib/logger';
import { createNodeId } from '@/core/utils/nodeId';
import {
  automationLaneId,
  getAutomationValueAtTick,
  normalizeTransportDocument,
  removeAutomationLane,
  simplifyAutomationDocument,
  upsertAutomationPoint,
} from '@/core/transport/automation';
import {
  createDefaultTransportDocument,
  TRANSPORT_PPQ,
  type AutomationMode,
  type TransportDocument,
} from '@/core/transport/types';
import { useTransportRuntimeStore } from '@/store/transport-runtime-store';

const logger = createModuleLogger('FlowStore');
const MAX_HISTORY_SIZE = 100;
const AUTOMATION_IGNORED_PARAMETERS = new Set([
  'bpm',
  'clip',
  'loop',
  'running',
]);

interface FlowState {
  nodes: FlowNode[];
  edges: Edge[];
  currentProjectId: string;
  transport: TransportDocument;
  canUndo: boolean;
  canRedo: boolean;
  history: {
    past: SerializedCanvas[];
    future: SerializedCanvas[];
  };
  setCurrentProjectId: (projectId: string) => void;
  setTransportBpm: (bpm: number) => void;
  setTransportLoopEnabled: (enabled: boolean) => void;
  setTransportLoopRange: (startTick: number, endTick: number) => void;
  setAutomationMode: (mode: AutomationMode) => void;
  beginAutomationRecording: () => void;
  finishAutomationRecording: () => void;
  setSequencersRunning: (running: boolean) => void;
  applyAutomationAtTick: (tick: number) => void;
  clearAutomationLane: (laneId: string) => void;
  clearAllAutomation: () => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  beginHistoryTransaction: () => void;
  commitHistoryTransaction: () => void;
  cancelHistoryTransaction: () => void;
  undo: () => void;
  redo: () => void;
  updateModuleParameter: (
    nodeId: string,
    paramKey: string,
    value: number | boolean | string
  ) => void;
  toggleModuleEnabled: (nodeId: string) => void;
  invokeModuleAction: (
    nodeId: string,
    action: string,
    ...args: unknown[]
  ) => unknown;
  addNode: (
    type: string,
    label: string,
    position: { x: number; y: number },
    id?: string
  ) => string;
  addEdge: (source: string, target: string) => void;
  deleteNode: (nodeId: string) => void;
  renameNode: (nodeId: string, newLabel: string) => void;
  exportCanvasToJson: () => string;
  importCanvasFromJson: (jsonString: string, projectId?: string) => boolean;
  getModuleAsJson: (moduleId: string) => unknown | null;
  getModuleAsString: (moduleId: string) => string | null;
  importModuleFromData: (data: unknown) => string | null;
}

function validateImportableNodes(nodes: SerializedCanvas['nodes']): boolean {
  const seenIds = new Set<string>();

  for (const node of nodes) {
    if (seenIds.has(node.id)) {
      logger.error('导入画布包含重复节点ID，已拒绝', { nodeId: node.id });
      return false;
    }
    seenIds.add(node.id);

    if (!moduleDefinitionRegistry.has(node.data.type)) {
      logger.error('导入画布包含未知模块类型，已拒绝', {
        nodeId: node.id,
        type: node.data.type,
      });
      return false;
    }
  }

  return true;
}

function edgeId(
  source: string,
  target: string,
  sourceHandle?: string | null,
  targetHandle?: string | null
): string {
  const sourceKey = sourceHandle ? `${source}-${sourceHandle}` : source;
  const targetKey = targetHandle ? `${target}-${targetHandle}` : target;
  return `edge_${sourceKey}_to_${targetKey}`;
}

function filterBindableEdges(nodes: FlowNode[], edges: Edge[]): Edge[] {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const occupiedSingleInputs = new Set<string>();

  return edges.filter((edge) => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    if (!sourceNode || !targetNode) {
      return false;
    }

    const sourceDefinition = moduleDefinitionRegistry.get(sourceNode.data.type);
    const targetDefinition = moduleDefinitionRegistry.get(targetNode.data.type);
    const sourcePort = edge.sourceHandle ?? 'output';
    const targetPort = edge.targetHandle ?? 'input';
    const sourceType = sourceDefinition?.outputPortTypes[sourcePort];
    const targetType = targetDefinition?.inputPortTypes[targetPort];

    if (!sourceType || !targetType || sourceType !== targetType) {
      return false;
    }

    const inputKey = `${edge.target}:${targetPort}`;
    if (
      targetType !== PortType.AUDIO &&
      targetType !== PortType.ARRAY &&
      occupiedSingleInputs.has(inputKey)
    ) {
      return false;
    }
    if (targetType !== PortType.AUDIO && targetType !== PortType.ARRAY) {
      occupiedSingleInputs.add(inputKey);
    }
    return true;
  });
}

function getSingleInputConflicts(
  edges: Edge[],
  connection: Connection
): Edge[] {
  if (!connection.target) return [];
  const targetPort = connection.targetHandle ?? 'input';
  const snapshot = audioGraphRuntime.getModuleSnapshot(connection.target);
  const targetType = snapshot?.inputPortTypes[targetPort];
  if (targetType === PortType.AUDIO || targetType === PortType.ARRAY) {
    return [];
  }

  return edges.filter(
    (edge) =>
      edge.target === connection.target &&
      (edge.targetHandle ?? 'input') === targetPort
  );
}

function createCanvasSnapshot(
  nodes: FlowNode[],
  edges: Edge[],
  transport: TransportDocument
): SerializedCanvas {
  return serializationManager.serializeCanvas(nodes, edges, { transport });
}

function cloneCanvasSnapshot(snapshot: SerializedCanvas): SerializedCanvas {
  return JSON.parse(JSON.stringify(snapshot)) as SerializedCanvas;
}

function comparableSnapshot(snapshot: SerializedCanvas): string {
  return JSON.stringify({
    nodes: snapshot.nodes,
    edges: snapshot.edges,
    transport: normalizeTransportDocument(snapshot.metadata?.transport),
  });
}

function historyState(past: SerializedCanvas[], future: SerializedCanvas[]) {
  return {
    history: { past, future },
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}

function hydrateNodesFromRuntime(nodes: FlowNode[]): FlowNode[] {
  return nodes.map((node) => {
    const snapshot = audioGraphRuntime.getModuleSnapshot(node.id);
    if (!snapshot) return node;
    return {
      ...node,
      data: {
        ...node.data,
        label: snapshot.name,
        parameters: {
          ...snapshot.parameters,
          ...node.data.parameters,
        },
        enabled: snapshot.enabled,
      },
    };
  });
}

function pruneTransportAutomation(
  transport: TransportDocument,
  nodes: FlowNode[]
): TransportDocument {
  const moduleIds = new Set(nodes.map((node) => node.id));
  return {
    ...transport,
    automationLanes: transport.automationLanes.filter((lane) =>
      moduleIds.has(lane.moduleId)
    ),
  };
}

export const useFlowStore = create<FlowState>((set, get) => {
  const draggingNodeIds = new Set<string>();
  const automationWriteLanes = new Set<string>();
  const automationTouchUntil = new Map<string, number>();
  let graphRevision = 0;
  let historyTransaction: { snapshot: SerializedCanvas; depth: number } | null =
    null;

  const nextDocument = (nodes: FlowNode[], edges: Edge[]) =>
    createAudioGraphDocument(nodes, edges, ++graphRevision);

  const commitGraph = (nodes: FlowNode[], edges: Edge[]) => {
    const result = audioGraphController.commit(nextDocument(nodes, edges));
    const acceptedConnectionKeys = new Set(
      result.document.connections.map(getAudioConnectionKey)
    );
    return {
      nodes,
      edges: edges.filter((edge) =>
        acceptedConnectionKeys.has(
          getAudioConnectionKey(connectionSpecFromEdge(edge))
        )
      ),
      result,
    };
  };

  const adoptGraph = (nodes: FlowNode[], edges: Edge[]) => {
    audioGraphController.adoptDocument(nextDocument(nodes, edges));
  };

  const ensureDefinitions = (nodes: FlowNode[]) => {
    if (nodes.some((node) => !moduleDefinitionRegistry.get(node.data.type))) {
      commitGraph(nodes, []);
    }
  };

  const applyCanvasSnapshot = (snapshot: SerializedCanvas) => {
    const deserialized = serializationManager.deserializeCanvas(snapshot);
    ensureDefinitions(deserialized.nodes);
    const candidateEdges = filterBindableEdges(
      deserialized.nodes,
      deserialized.edges
    );
    const committed = commitGraph(deserialized.nodes, candidateEdges);
    const hydratedNodes = hydrateNodesFromRuntime(committed.nodes);
    adoptGraph(hydratedNodes, committed.edges);
    set({
      nodes: hydratedNodes,
      edges: committed.edges,
      transport: pruneTransportAutomation(
        normalizeTransportDocument(snapshot.metadata?.transport),
        hydratedNodes
      ),
    });
  };

  const recordHistory = () => {
    if (historyTransaction) return;
    const snapshot = createCanvasSnapshot(
      get().nodes,
      get().edges,
      get().transport
    );
    const { past } = get().history;
    if (
      past[past.length - 1] &&
      comparableSnapshot(past[past.length - 1]) === comparableSnapshot(snapshot)
    ) {
      set(historyState(past, []));
      return;
    }
    set(
      historyState(
        [...past, cloneCanvasSnapshot(snapshot)].slice(-MAX_HISTORY_SIZE),
        []
      )
    );
  };

  const shouldRecordNodeChanges = (changes: NodeChange[]) =>
    changes.some((change) => {
      if (change.type === 'select' || change.type === 'dimensions')
        return false;
      if (change.type !== 'position') return true;
      if ('dragging' in change && change.dragging) {
        if (draggingNodeIds.has(change.id)) return false;
        draggingNodeIds.add(change.id);
        return true;
      }
      return !('dragging' in change);
    });

  return {
    nodes: [],
    edges: [],
    currentProjectId: '',
    transport: createDefaultTransportDocument(),
    canUndo: false,
    canRedo: false,
    history: { past: [], future: [] },

    setCurrentProjectId: (currentProjectId) => set({ currentProjectId }),

    setTransportBpm: (bpm) => {
      const nextBpm = Math.min(320, Math.max(20, Math.round(bpm)));
      if (get().transport.bpm === nextBpm) return;
      recordHistory();
      const nodes = get().nodes.map((node) =>
        node.data.type === 'sequencer'
          ? {
              ...node,
              data: {
                ...node.data,
                parameters: {
                  ...node.data.parameters,
                  bpm: nextBpm,
                },
              },
            }
          : node
      );
      const committed = commitGraph(nodes, get().edges);
      set({
        nodes,
        edges: committed.edges,
        transport: { ...get().transport, bpm: nextBpm },
      });
      audioGraphRuntime.setTransportBpm(nextBpm);
    },

    setTransportLoopEnabled: (loopEnabled) => {
      if (get().transport.loopEnabled === loopEnabled) return;
      recordHistory();
      const nodes = get().nodes.map((node) =>
        node.data.type === 'sequencer'
          ? {
              ...node,
              data: {
                ...node.data,
                parameters: {
                  ...node.data.parameters,
                  loop: loopEnabled,
                },
              },
            }
          : node
      );
      const committed = commitGraph(nodes, get().edges);
      set({
        nodes,
        edges: committed.edges,
        transport: { ...get().transport, loopEnabled },
      });
    },

    setTransportLoopRange: (startTick, endTick) => {
      const nextStart = Math.max(0, Math.round(startTick));
      const nextEnd = Math.max(nextStart + TRANSPORT_PPQ, Math.round(endTick));
      const current = get().transport.loopRange;
      if (current.startTick === nextStart && current.endTick === nextEnd)
        return;
      recordHistory();
      set({
        transport: {
          ...get().transport,
          loopRange: { startTick: nextStart, endTick: nextEnd },
        },
      });
    },

    setAutomationMode: (automationMode) => {
      if (get().transport.automationMode === automationMode) return;
      recordHistory();
      set({ transport: { ...get().transport, automationMode } });
    },

    beginAutomationRecording: () => {
      automationWriteLanes.clear();
      automationTouchUntil.clear();
    },

    finishAutomationRecording: () => {
      automationWriteLanes.clear();
      automationTouchUntil.clear();
      set({ transport: simplifyAutomationDocument(get().transport) });
    },

    setSequencersRunning: (running) => {
      let changed = false;
      const { bpm, loopEnabled } = get().transport;
      const nodes = get().nodes.map((node) => {
        if (node.data.type !== 'sequencer') return node;
        const parameters = node.data.parameters;
        if (
          parameters.running === running &&
          parameters.bpm === bpm &&
          parameters.loop === loopEnabled
        ) {
          return node;
        }
        changed = true;
        return {
          ...node,
          data: {
            ...node.data,
            parameters: {
              ...parameters,
              running,
              bpm,
              loop: loopEnabled,
            },
          },
        };
      });
      if (!changed) return;
      const committed = commitGraph(nodes, get().edges);
      set({ nodes, edges: committed.edges });
    },

    applyAutomationAtTick: (tick) => {
      const { automationLanes } = get().transport;
      if (automationLanes.length === 0) return;
      const updates = new Map<string, Map<string, ParameterValue>>();
      automationLanes.forEach((lane) => {
        const touchUntil = automationTouchUntil.get(lane.id) ?? 0;
        if (touchUntil > Date.now()) return;
        const value = getAutomationValueAtTick(lane, tick);
        if (value === undefined) return;
        const snapshot = audioGraphRuntime.getModuleSnapshot(lane.moduleId);
        const meta = snapshot?.parameterMeta[lane.parameterKey];
        if (!meta) return;
        let nextValue = value;
        if (typeof value === 'number') {
          nextValue = Math.min(
            meta.max ?? Number.POSITIVE_INFINITY,
            Math.max(meta.min ?? Number.NEGATIVE_INFINITY, value)
          );
        }
        const moduleUpdates = updates.get(lane.moduleId) ?? new Map();
        moduleUpdates.set(lane.parameterKey, nextValue);
        updates.set(lane.moduleId, moduleUpdates);
      });
      if (updates.size === 0) return;

      let changed = false;
      const nodes = get().nodes.map((node) => {
        const moduleUpdates = updates.get(node.id);
        if (!moduleUpdates) return node;
        const parameters = { ...node.data.parameters };
        moduleUpdates.forEach((value, key) => {
          if (parameters[key] === value) return;
          parameters[key] = value;
          changed = true;
        });
        return parameters === node.data.parameters
          ? node
          : { ...node, data: { ...node.data, parameters } };
      });
      if (!changed) return;
      const committed = commitGraph(nodes, get().edges);
      set({ nodes, edges: committed.edges });
    },

    clearAutomationLane: (laneId) => {
      if (!get().transport.automationLanes.some((lane) => lane.id === laneId)) {
        return;
      }
      recordHistory();
      set({ transport: removeAutomationLane(get().transport, laneId) });
    },

    clearAllAutomation: () => {
      if (get().transport.automationLanes.length === 0) return;
      recordHistory();
      set({
        transport: { ...get().transport, automationLanes: [] },
      });
    },

    onNodesChange: (changes) => {
      if (shouldRecordNodeChanges(changes)) recordHistory();
      const nodes = applyNodeChanges(changes, get().nodes) as FlowNode[];
      const removedIds = new Set(
        changes
          .filter((change) => change.type === 'remove')
          .map((change) => change.id)
      );
      const edges = removedIds.size
        ? get().edges.filter(
            (edge) =>
              !removedIds.has(edge.source) && !removedIds.has(edge.target)
          )
        : get().edges;

      if (removedIds.size) {
        const committed = commitGraph(nodes, edges);
        set({
          nodes,
          edges: committed.edges,
          transport: pruneTransportAutomation(get().transport, nodes),
        });
      } else {
        set({ nodes });
      }

      changes.forEach((change) => {
        if (
          change.type === 'position' &&
          'dragging' in change &&
          change.dragging === false
        ) {
          draggingNodeIds.delete(change.id);
        }
      });
    },

    onEdgesChange: (changes) => {
      const removedExistingEdge = changes.some(
        (change) =>
          change.type === 'remove' &&
          get().edges.some((edge) => edge.id === change.id)
      );
      if (removedExistingEdge) recordHistory();
      const edges = applyEdgeChanges(changes, get().edges);
      const committed = commitGraph(get().nodes, edges);
      set({ edges: committed.edges });
    },

    onConnect: (connection) => {
      if (!connection.source || !connection.target) return;
      const sourcePort = connection.sourceHandle ?? 'output';
      const targetPort = connection.targetHandle ?? 'input';
      if (
        !audioGraphRuntime.canConnect({
          source: connection.source,
          target: connection.target,
          sourcePort,
          targetPort,
        })
      ) {
        return;
      }

      const previousEdges = get().edges;
      const conflicts = getSingleInputConflicts(previousEdges, connection);
      const candidateEdges = addReactFlowEdge(
        {
          ...connection,
          id: edgeId(
            connection.source,
            connection.target,
            connection.sourceHandle,
            connection.targetHandle
          ),
        },
        previousEdges.filter(
          (edge) => !conflicts.some((conflict) => conflict.id === edge.id)
        )
      );
      const committed = commitGraph(get().nodes, candidateEdges);
      const candidateKey = getAudioConnectionKey({
        source: connection.source,
        target: connection.target,
        sourcePort,
        targetPort,
      });
      const connected = committed.result.document.connections.some(
        (item) => getAudioConnectionKey(item) === candidateKey
      );

      if (!connected) {
        commitGraph(get().nodes, previousEdges);
        return;
      }
      recordHistory();
      set({ edges: committed.edges });
    },

    beginHistoryTransaction: () => {
      if (historyTransaction) {
        historyTransaction.depth += 1;
        return;
      }
      historyTransaction = {
        snapshot: cloneCanvasSnapshot(
          createCanvasSnapshot(get().nodes, get().edges, get().transport)
        ),
        depth: 1,
      };
    },

    commitHistoryTransaction: () => {
      if (!historyTransaction) return;
      historyTransaction.depth -= 1;
      if (historyTransaction.depth > 0) return;
      const initial = historyTransaction.snapshot;
      historyTransaction = null;
      const current = createCanvasSnapshot(
        get().nodes,
        get().edges,
        get().transport
      );
      if (comparableSnapshot(initial) === comparableSnapshot(current)) return;
      set(
        historyState(
          [...get().history.past, cloneCanvasSnapshot(initial)].slice(
            -MAX_HISTORY_SIZE
          ),
          []
        )
      );
    },

    cancelHistoryTransaction: () => {
      if (!historyTransaction) return;
      const initial = historyTransaction.snapshot;
      historyTransaction = null;
      applyCanvasSnapshot(initial);
    },

    undo: () => {
      historyTransaction = null;
      const { past, future } = get().history;
      const previous = past[past.length - 1];
      if (!previous) return;
      const current = createCanvasSnapshot(
        get().nodes,
        get().edges,
        get().transport
      );
      applyCanvasSnapshot(previous);
      set(
        historyState(
          past.slice(0, -1),
          [cloneCanvasSnapshot(current), ...future].slice(0, MAX_HISTORY_SIZE)
        )
      );
    },

    redo: () => {
      historyTransaction = null;
      const { past, future } = get().history;
      const next = future[0];
      if (!next) return;
      const current = createCanvasSnapshot(
        get().nodes,
        get().edges,
        get().transport
      );
      applyCanvasSnapshot(next);
      set(
        historyState(
          [...past, cloneCanvasSnapshot(current)].slice(-MAX_HISTORY_SIZE),
          future.slice(1)
        )
      );
    },

    updateModuleParameter: (nodeId, paramKey, value) => {
      const node = get().nodes.find((item) => item.id === nodeId);
      const snapshot = audioGraphRuntime.getModuleSnapshot(nodeId);
      if (!node || !snapshot?.parameterMeta[paramKey]) return;
      const previousValue = node.data.parameters[paramKey];
      if (previousValue === value) return;
      recordHistory();

      let nodes = get().nodes.map((item) =>
        item.id === nodeId
          ? {
              ...item,
              data: {
                ...item.data,
                parameters: { ...item.data.parameters, [paramKey]: value },
              },
            }
          : item
      );
      const committed = commitGraph(nodes, get().edges);
      const runtimeValue =
        audioGraphRuntime.getModuleSnapshot(nodeId)?.parameters[paramKey];
      if (runtimeValue !== undefined && runtimeValue !== value) {
        nodes = nodes.map((item) =>
          item.id === nodeId
            ? {
                ...item,
                data: {
                  ...item.data,
                  parameters: {
                    ...item.data.parameters,
                    [paramKey]: runtimeValue,
                  },
                },
              }
            : item
        );
        adoptGraph(nodes, committed.edges);
      }
      let transport = get().transport;
      if (
        useTransportRuntimeStore.getState().isRecording &&
        transport.automationMode !== 'read' &&
        !AUTOMATION_IGNORED_PARAMETERS.has(paramKey)
      ) {
        const laneId = automationLaneId(nodeId, paramKey);
        automationTouchUntil.set(
          laneId,
          transport.automationMode === 'touch'
            ? Date.now() + 500
            : Number.POSITIVE_INFINITY
        );
        if (
          transport.automationMode === 'write' &&
          !automationWriteLanes.has(laneId)
        ) {
          transport = removeAutomationLane(transport, laneId);
          automationWriteLanes.add(laneId);
        }
        transport = upsertAutomationPoint(
          transport,
          nodeId,
          paramKey,
          (runtimeValue ?? value) as ParameterValue,
          useTransportRuntimeStore.getState().positionTicks
        );
      }
      set({ nodes, edges: committed.edges, transport });
    },

    toggleModuleEnabled: (nodeId) => {
      const node = get().nodes.find((item) => item.id === nodeId);
      if (!node) return;
      recordHistory();
      const nodes = get().nodes.map((item) =>
        item.id === nodeId
          ? { ...item, data: { ...item.data, enabled: !item.data.enabled } }
          : item
      );
      const committed = commitGraph(nodes, get().edges);
      set({ nodes, edges: committed.edges });
    },

    invokeModuleAction: (nodeId, action, ...args) =>
      audioGraphRuntime.invokeAction(nodeId, action, ...args),

    addNode: (type, label, position, id) => {
      if (!moduleDefinitionRegistry.has(type)) {
        throw new Error(`未知模块类型: ${type}`);
      }
      const nodeId = id || createNodeId(get().nodes.map((node) => node.id));
      recordHistory();
      let nodes: FlowNode[] = [
        ...get().nodes,
        {
          id: nodeId,
          type: 'default',
          position,
          dragHandle: '.node-drag-handle',
          data: {
            type,
            label: label || nodeId,
            parameters: {},
            enabled: true,
          },
        },
      ];
      const committed = commitGraph(nodes, get().edges);
      nodes = hydrateNodesFromRuntime(nodes);
      adoptGraph(nodes, committed.edges);
      set({ nodes, edges: committed.edges });
      return nodeId;
    },

    addEdge: (source, target) => {
      get().onConnect({
        source,
        target,
        sourceHandle: null,
        targetHandle: null,
      });
    },

    deleteNode: (nodeId) => {
      if (!get().nodes.some((node) => node.id === nodeId)) return;
      recordHistory();
      const nodes = get().nodes.filter((node) => node.id !== nodeId);
      const edges = get().edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      );
      const committed = commitGraph(nodes, edges);
      set({
        nodes,
        edges: committed.edges,
        transport: pruneTransportAutomation(get().transport, nodes),
      });
    },

    renameNode: (nodeId, newLabel) => {
      const label = newLabel.trim();
      const node = get().nodes.find((item) => item.id === nodeId);
      if (!label || !node || node.data.label === label) return;
      recordHistory();
      const nodes = get().nodes.map((item) =>
        item.id === nodeId ? { ...item, data: { ...item.data, label } } : item
      );
      const committed = commitGraph(nodes, get().edges);
      set({ nodes, edges: committed.edges });
    },

    exportCanvasToJson: () =>
      serializationManager.serializeCanvasToJson(get().nodes, get().edges, {
        transport: get().transport,
      }),

    importCanvasFromJson: (jsonString, projectId = 'imported-project') => {
      const result = validateAndParseJson<SerializedCanvas>(
        jsonString,
        validateSerializedCanvas
      );
      if (!result.success || !result.data) return false;
      if (!validateImportableNodes(result.data.nodes)) return false;

      historyTransaction = null;
      useTransportRuntimeStore.getState().stop();
      const deserialized = serializationManager.deserializeCanvas(result.data);
      ensureDefinitions(deserialized.nodes);
      const edges = filterBindableEdges(deserialized.nodes, deserialized.edges);
      const committed = commitGraph(deserialized.nodes, edges);
      const nodes = hydrateNodesFromRuntime(committed.nodes);
      adoptGraph(nodes, committed.edges);
      set({
        nodes,
        edges: committed.edges,
        transport: pruneTransportAutomation(
          normalizeTransportDocument(result.data.metadata?.transport),
          nodes
        ),
        currentProjectId: projectId,
        ...historyState([], []),
      });
      return true;
    },

    getModuleAsJson: (moduleId) => {
      const node = get().nodes.find((item) => item.id === moduleId);
      return node
        ? serializationManager.serializeModule(
            node,
            audioGraphRuntime.getModuleSnapshot(moduleId)
          )
        : null;
    },

    getModuleAsString: (moduleId) => {
      const node = get().nodes.find((item) => item.id === moduleId);
      return node
        ? serializationManager.serializeModuleToJson(
            node,
            audioGraphRuntime.getModuleSnapshot(moduleId)
          )
        : null;
    },

    importModuleFromData: (data) => {
      let serialized: SerializedModule;
      if (typeof data === 'string') {
        const result = validateAndParseJson<SerializedModule>(
          data,
          validateSerializedModule
        );
        if (!result.success || !result.data) return null;
        serialized = result.data;
      } else {
        const result = validateSerializedModule(data);
        if (!result.success) return null;
        serialized = data as SerializedModule;
      }

      const imported = serializationManager.deserializeModule(serialized);
      if (!imported) return null;
      const nodeId = get().nodes.some((node) => node.id === imported.id)
        ? createNodeId(get().nodes.map((node) => node.id))
        : imported.id;
      recordHistory();
      let nodes = [...get().nodes, { ...imported, id: nodeId }];
      const committed = commitGraph(nodes, get().edges);
      nodes = hydrateNodesFromRuntime(nodes);
      adoptGraph(nodes, committed.edges);
      set({ nodes, edges: committed.edges });
      return nodeId;
    },
  };
});
