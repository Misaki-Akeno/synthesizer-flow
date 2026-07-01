'use client';

import { create } from 'zustand';
import {
  Connection,
  EdgeChange,
  NodeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Edge,
} from '@xyflow/react';
import { moduleManager, FlowNode } from '../core/services/ModuleManager';
import { moduleInitManager } from '../core/services/ModuleInitManager';
import { serializationManager } from '../core/services/SerializationManager';
import {
  SerializedCanvas,
  SerializedModule,
} from '@/core/types/SerializationTypes';
import {
  validateAndParseJson,
  validateSerializedCanvas,
  validateSerializedModule,
} from '@/core/types/SerializationValidator';
import { createModuleLogger } from '@/lib/logger';
import { PortType } from '@/core/base/ModuleBase';
import { createNodeId } from '@/core/utils/nodeId';

// 创建Store专用日志记录器
const logger = createModuleLogger('FlowStore');
const MAX_HISTORY_SIZE = 100;

// --------------------------------
//        Reactflow管理部分
// --------------------------------
interface FlowState {
  nodes: FlowNode[];
  edges: Edge[];
  currentProjectId: string; // 修改：预设ID改为项目ID
  canUndo: boolean;
  canRedo: boolean;
  history: {
    past: SerializedCanvas[];
    future: SerializedCanvas[];
  };
  setCurrentProjectId: (projectId: string) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  undo: () => void;
  redo: () => void;
  updateModuleParameter: (
    nodeId: string,
    paramKey: string,
    value: number | boolean | string
  ) => void;
  addNode: (
    type: string,
    label: string,
    position: { x: number; y: number },
    id?: string
  ) => string;
  addEdge: (source: string, target: string) => void;
  deleteNode: (nodeId: string) => void;
  renameNode: (nodeId: string, newLabel: string) => void;

  // 序列化相关方法
  exportCanvasToJson: () => string;
  importCanvasFromJson: (jsonString: string, projectId?: string) => boolean;
  getModuleAsJson: (moduleId: string) => unknown | null;
  getModuleAsString: (moduleId: string) => string | null;
  importModuleFromData: (data: unknown) => string | null;
}

// 创建空的初始状态
const initialNodes: FlowNode[] = [];
const initialEdges: Edge[] = [];

function validateImportableNodes(nodes: SerializedCanvas['nodes']): boolean {
  const seenIds = new Set<string>();

  for (const node of nodes) {
    if (seenIds.has(node.id)) {
      logger.error('导入画布包含重复节点ID，已拒绝', { nodeId: node.id });
      return false;
    }

    seenIds.add(node.id);

    if (!moduleManager.hasModuleType(node.data.type)) {
      logger.error('导入画布包含未知模块类型，已拒绝', {
        nodeId: node.id,
        type: node.data.type,
      });
      return false;
    }
  }

  return true;
}

function filterBindableEdges(nodes: FlowNode[], edges: Edge[]): Edge[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const occupiedSingleInputs = new Set<string>();

  return edges.filter((edge) => {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      logger.warn('导入画布跳过端点不存在的连接', {
        source: edge.source,
        target: edge.target,
      });
      return false;
    }

    const isBindable = moduleManager.canBindModules(
      edge.source,
      edge.target,
      edge.sourceHandle ?? undefined,
      edge.targetHandle ?? undefined
    );

    if (!isBindable) {
      logger.warn('导入画布跳过无法绑定的连接', {
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
      });
      return false;
    }

    const targetHandle = edge.targetHandle ?? 'input';
    const targetModule = moduleManager.getModule(edge.target);
    const targetType = targetModule?.inputPortTypes[targetHandle];
    const inputKey = `${edge.target}:${targetHandle}`;

    if (
      targetType !== PortType.AUDIO &&
      targetType !== PortType.ARRAY &&
      occupiedSingleInputs.has(inputKey)
    ) {
      logger.warn('导入画布跳过同一单输入端口上的重复连接', {
        target: edge.target,
        targetHandle,
      });
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
  if (!connection.target) {
    return [];
  }

  const targetHandle = connection.targetHandle ?? 'input';
  const targetModule = moduleManager.getModule(connection.target);
  const targetType = targetModule?.inputPortTypes[targetHandle];

  if (targetType === PortType.AUDIO || targetType === PortType.ARRAY) {
    return [];
  }

  return edges.filter(
    (edge) =>
      edge.target === connection.target &&
      (edge.targetHandle ?? 'input') === targetHandle
  );
}

function restoreEdgeBindings(edges: Edge[]): void {
  edges.forEach((edge) => {
    moduleManager.bindModules(
      edge.source,
      edge.target,
      edge.sourceHandle ?? undefined,
      edge.targetHandle ?? undefined
    );
  });
}

function createCanvasSnapshot(nodes: FlowNode[], edges: Edge[]): SerializedCanvas {
  return serializationManager.serializeCanvas(nodes, edges);
}

function cloneCanvasSnapshot(snapshot: SerializedCanvas): SerializedCanvas {
  return JSON.parse(JSON.stringify(snapshot)) as SerializedCanvas;
}

function getComparableSnapshot(snapshot: SerializedCanvas): string {
  return JSON.stringify({
    nodes: snapshot.nodes,
    edges: snapshot.edges,
  });
}

function areCanvasSnapshotsEqual(
  left: SerializedCanvas,
  right: SerializedCanvas
): boolean {
  return getComparableSnapshot(left) === getComparableSnapshot(right);
}

function getHistoryState(past: SerializedCanvas[], future: SerializedCanvas[]) {
  return {
    history: { past, future },
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}

export const useFlowStore = create<FlowState>((set, get) => {
  // 设置节点获取函数
  moduleManager.setNodesGetter(() => get().nodes);
  const draggingNodeIds = new Set<string>();

  const applyCanvasSnapshot = (snapshot: SerializedCanvas) => {
    // 撤销/重做会完整重建模块实例，确保模块注册表、参数和连接状态一致。
    moduleManager.disposeAllModules();
    moduleInitManager.reset();

    const { nodes, edges } = serializationManager.deserializeCanvas(snapshot);
    const bindableEdges = filterBindableEdges(nodes, edges);

    set({
      nodes,
      edges: bindableEdges,
    });

    moduleInitManager.onAllModulesReady(() => {
      moduleManager.setupAllEdgeBindings(bindableEdges);
    });
  };

  const recordHistory = () => {
    const currentSnapshot = createCanvasSnapshot(get().nodes, get().edges);
    const { past } = get().history;
    const lastSnapshot = past[past.length - 1];

    if (lastSnapshot && areCanvasSnapshotsEqual(lastSnapshot, currentSnapshot)) {
      set(getHistoryState(past, []));
      return;
    }

    const nextPast = [...past, cloneCanvasSnapshot(currentSnapshot)].slice(
      -MAX_HISTORY_SIZE
    );

    set(getHistoryState(nextPast, []));
  };

  const shouldRecordNodeChanges = (changes: NodeChange[]) => {
    return changes.some((change) => {
      if (change.type === 'select' || change.type === 'dimensions') {
        return false;
      }

      if (change.type !== 'position') {
        return true;
      }

      if ('dragging' in change && change.dragging) {
        if (draggingNodeIds.has(change.id)) {
          return false;
        }

        draggingNodeIds.add(change.id);
        return true;
      }

      return !('dragging' in change);
    });
  };

  const finishNodeDragTracking = (changes: NodeChange[]) => {
    changes.forEach((change) => {
      if (
        change.type === 'position' &&
        'dragging' in change &&
        change.dragging === false
      ) {
        draggingNodeIds.delete(change.id);
      }
    });
  };

  return {
    nodes: initialNodes,
    edges: initialEdges,
    currentProjectId: '', // 初始为空，由Canvas组件加载第一个项目
    canUndo: false,
    canRedo: false,
    history: {
      past: [],
      future: [],
    },

    setCurrentProjectId: (projectId) => {
      set({ currentProjectId: projectId });
    },

    onNodesChange: (changes) => {
      if (shouldRecordNodeChanges(changes)) {
        recordHistory();
      }

      set({
        nodes: applyNodeChanges(changes, get().nodes) as FlowNode[],
      });

      finishNodeDragTracking(changes);
    },

    onEdgesChange: (changes) => {
      changes.forEach((change) => {
        if (change.type === 'select') {
          const edge = get().edges.find((e) => e.id === change.id);
          if (edge) {
            // 只为调试输出边的详细信息，不触发重新绑定
          }
        }
      });

      // 只处理 'remove' 类型的变更，忽略 'select' 等其他类型
      const edgesToRemove = changes
        .filter((change) => change.type === 'remove')
        .map((change) => get().edges.find((edge) => edge.id === change.id))
        .filter((edge): edge is Edge => edge !== undefined);

      if (edgesToRemove.length > 0) {
        recordHistory();
      }

      // 只对要删除的边解除绑定
      edgesToRemove.forEach((edge) => {
        moduleManager.removeEdgeBinding(edge);
      });

      // 正常应用所有边变更（包括select）以保持视觉状态
      set({
        edges: applyEdgeChanges(changes, get().edges),
      });
    },

    onConnect: (connection) => {
      if (!connection.source || !connection.target) {
        logger.warn('连接缺少源节点或目标节点，已忽略', connection);
        return;
      }

      const canBind = moduleManager.canBindModules(
        connection.source,
        connection.target,
        connection.sourceHandle ?? undefined,
        connection.targetHandle ?? undefined
      );

      if (!canBind) {
        return;
      }

      const existingEdges = get().edges;
      const conflictingEdges = getSingleInputConflicts(
        existingEdges,
        connection
      );

      conflictingEdges.forEach((edge) => {
        moduleManager.removeEdgeBinding(edge);
      });

      // 只有底层绑定成功时才添加视觉边，避免 UI 与音频图状态分裂
      const isBound = moduleManager.bindModules(
        connection.source,
        connection.target,
        connection.sourceHandle ?? undefined,
        connection.targetHandle ?? undefined
      );

      if (!isBound) {
        restoreEdgeBindings(conflictingEdges);
        return;
      }

      recordHistory();

      set({
        edges: addEdge(
          connection,
          existingEdges.filter(
            (edge) =>
              !conflictingEdges.some((conflict) => conflict.id === edge.id)
          )
        ),
      });
    },

    undo: () => {
      const { past, future } = get().history;
      const previousSnapshot = past[past.length - 1];

      if (!previousSnapshot) {
        return;
      }

      const currentSnapshot = createCanvasSnapshot(get().nodes, get().edges);
      const nextPast = past.slice(0, -1);
      const nextFuture = [
        cloneCanvasSnapshot(currentSnapshot),
        ...future,
      ].slice(0, MAX_HISTORY_SIZE);

      applyCanvasSnapshot(previousSnapshot);
      set(getHistoryState(nextPast, nextFuture));
    },

    redo: () => {
      const { past, future } = get().history;
      const nextSnapshot = future[0];

      if (!nextSnapshot) {
        return;
      }

      const currentSnapshot = createCanvasSnapshot(get().nodes, get().edges);
      const nextPast = [...past, cloneCanvasSnapshot(currentSnapshot)].slice(
        -MAX_HISTORY_SIZE
      );
      const nextFuture = future.slice(1);

      applyCanvasSnapshot(nextSnapshot);
      set(getHistoryState(nextPast, nextFuture));
    },

    updateModuleParameter: (nodeId, paramKey, value) => {
      const node = get().nodes.find((n) => n.id === nodeId);
      if (node?.data?.module) {
        const parameter = node.data.module.parameters[paramKey];
        if (!parameter) {
          node.data.module.updateParameter(paramKey, value);
          return;
        }

        const previousValue = parameter.getValue();
        if (previousValue === value) {
          return;
        }

        recordHistory();
        node.data.module.updateParameter(paramKey, value);
      }
    },

    // 添加新节点
    addNode: (
      type: string,
      label: string,
      position: { x: number; y: number },
      id?: string
    ) => {
      const nodeId = id || createNodeId(get().nodes.map((node) => node.id));
      const newNode = moduleManager.createNode(nodeId, type, label, position);

      recordHistory();

      set({
        nodes: [...get().nodes, newNode],
      });

      return nodeId;
    },

    // 添加新边
    addEdge: (source, target) => {
      if (!moduleManager.canBindModules(source, target)) {
        return;
      }

      const connection: Connection = {
        source,
        target,
        sourceHandle: null,
        targetHandle: null,
      };
      const existingEdges = get().edges;
      const conflictingEdges = getSingleInputConflicts(
        existingEdges,
        connection
      );

      conflictingEdges.forEach((edge) => {
        moduleManager.removeEdgeBinding(edge);
      });

      const edge = moduleManager.createEdge(source, target);
      const isBound = moduleManager.bindModules(source, target);

      if (!isBound) {
        restoreEdgeBindings(conflictingEdges);
        return;
      }

      recordHistory();

      set({
        edges: [
          ...existingEdges.filter(
            (existingEdge) =>
              !conflictingEdges.some(
                (conflict) => conflict.id === existingEdge.id
              )
          ),
          edge,
        ],
      });
    },

    // 删除节点及相连的边
    deleteNode: (nodeId) => {
      const node = get().nodes.find((n) => n.id === nodeId);
      if (!node) {
        return;
      }

      recordHistory();

      // 1. 找到与该节点相连的所有边
      const connectedEdges = get().edges.filter(
        (edge) => edge.source === nodeId || edge.target === nodeId
      );

      // 2. 解除这些边的绑定
      connectedEdges.forEach((edge) => {
        moduleManager.removeEdgeBinding(edge);
      });

      // 3. 释放节点资源
      if (node?.data?.module) {
        moduleManager.disposeModule(nodeId);

        // 记录模块销毁事件
        moduleInitManager.recordDisposal(nodeId);
      }

      // 4. 从状态中移除节点和相连的边
      set({
        nodes: get().nodes.filter((n) => n.id !== nodeId),
        edges: get().edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId
        ),
      });
    },

    renameNode: (nodeId, newLabel) => {
      const trimmedLabel = newLabel.trim();
      if (!trimmedLabel) {
        return;
      }

      const node = get().nodes.find((currentNode) => currentNode.id === nodeId);
      if (!node || node.data?.label === trimmedLabel) {
        return;
      }

      recordHistory();

      set({
        nodes: get().nodes.map((node) => {
          if (node.id !== nodeId) {
            return node;
          }

          const moduleInstance = node.data?.module;
          if (moduleInstance && typeof moduleInstance.setName === 'function') {
            moduleInstance.setName(trimmedLabel);
          }

          return {
            ...node,
            data: {
              ...node.data,
              label: trimmedLabel,
            },
          };
        }),
      });
    },

    // 序列化整个画布到JSON格式
    exportCanvasToJson: () => {
      return serializationManager.serializeCanvasToJson(
        get().nodes,
        get().edges
      );
    },

    // 从JSON格式导入画布
    importCanvasFromJson: (jsonString, projectId = 'imported-project') => {
      try {
        const parseResult = validateAndParseJson<SerializedCanvas>(
          jsonString,
          validateSerializedCanvas
        );

        if (!parseResult.success || !parseResult.data) {
          logger.error('导入画布数据验证失败:', parseResult.error);
          return false;
        }

        if (!validateImportableNodes(parseResult.data.nodes)) {
          return false;
        }

        // 先清理旧画布的模块实例，再重建新图，避免全局注册表残留
        moduleManager.disposeAllModules();
        moduleInitManager.reset();

        const { nodes, edges } = serializationManager.deserializeCanvas(
          parseResult.data
        );

        if (parseResult.data.nodes.length > 0 && nodes.length === 0) {
          logger.error('导入画布反序列化后没有生成节点');
          return false;
        }

        const bindableEdges = filterBindableEdges(nodes, edges);

        // 更新状态
        set({
          nodes,
          edges: bindableEdges,
          currentProjectId: projectId,
          ...getHistoryState([], []),
        });

        // 初始化连接
        moduleInitManager.onAllModulesReady(() => {
          moduleManager.setupAllEdgeBindings(bindableEdges);
        });

        return true;
      } catch (error) {
        logger.error('导入画布数据失败:', error);
        return false;
      }
    },

    // 获取模块的JSON表示
    getModuleAsJson: (moduleId) => {
      const node = get().nodes.find((n) => n.id === moduleId);
      if (!node || !node.data?.module) return null;

      return serializationManager.serializeModule(node.data.module);
    },

    // 获取模块的JSON字符串表示
    getModuleAsString: (moduleId) => {
      const node = get().nodes.find((n) => n.id === moduleId);
      if (!node || !node.data?.module) return null;

      return serializationManager.serializeModuleToJson(node.data.module);
    },

    // 从序列化数据导入模块（可以是JSON字符串或JSON对象）
    importModuleFromData: (data) => {
      try {
        let serializedModule: SerializedModule;

        if (typeof data === 'string') {
          const parseResult = validateAndParseJson<SerializedModule>(
            data,
            validateSerializedModule
          );
          if (!parseResult.success || !parseResult.data) {
            logger.error('模块JSON验证失败，无法导入', parseResult.error);
            return null;
          }
          serializedModule = parseResult.data;
        } else {
          const validationResult = validateSerializedModule(data);
          if (!validationResult.success) {
            logger.error('模块数据验证失败，无法导入', validationResult.error);
            return null;
          }
          serializedModule = data as SerializedModule;
        }

        const nodeId = get().nodes.some(
          (node) => node.id === serializedModule.id
        )
          ? createNodeId(get().nodes.map((node) => node.id))
          : serializedModule.id;

        const moduleInstance = serializationManager.deserializeModule({
          ...serializedModule,
          id: nodeId,
        });

        if (!moduleInstance) {
          return null;
        }

        // 创建节点
        const node: FlowNode = {
          id: nodeId,
          type: 'default',
          position: { x: 100, y: 100 }, // 默认位置，可以进一步优化
          data: {
            module: moduleInstance,
            label: moduleInstance.name,
            type: moduleInstance.moduleType,
          },
        };

        // 添加节点到画布
        recordHistory();

        set({
          nodes: [...get().nodes, node],
        });

        return nodeId;
      } catch (error) {
        logger.error('从数据导入模块失败:', error);
        return null;
      }
    },
  };
});
