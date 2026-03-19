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
import { SerializedModule } from '@/core/types/SerializationTypes';
import { createModuleLogger } from '@/lib/logger';

// 创建Store专用日志记录器
const logger = createModuleLogger('FlowStore');

// --------------------------------
//        Reactflow管理部分
// --------------------------------
interface FlowState {
  nodes: FlowNode[];
  edges: Edge[];
  currentProjectId: string; // 修改：预设ID改为项目ID
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
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
  importCanvasFromJson: (jsonString: string) => boolean;
  getModuleAsJson: (moduleId: string) => unknown | null;
  getModuleAsString: (moduleId: string) => string | null;
  importModuleFromData: (data: unknown) => string | null;
}

// 创建空的初始状态
const initialNodes: FlowNode[] = [];
const initialEdges: Edge[] = [];

export const useFlowStore = create<FlowState>((set, get) => {
  // 设置节点获取函数
  moduleManager.setNodesGetter(() => get().nodes);

  return {
    nodes: initialNodes,
    edges: initialEdges,
    currentProjectId: '', // 初始为空，由Canvas组件加载第一个项目

    onNodesChange: (changes) => {
      set({
        nodes: applyNodeChanges(changes, get().nodes) as FlowNode[],
      });
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
      const _edgeId = `edge_${connection.source}_${connection.target}_${Date.now()}`;

      // 添加边并建立绑定
      moduleManager.bindModules(
        connection.source || '',
        connection.target || '',
        connection.sourceHandle ?? undefined,
        connection.targetHandle ?? undefined
      );

      set({
        edges: addEdge(connection, get().edges),
      });
    },

    updateModuleParameter: (nodeId, paramKey, value) => {
      set({
        nodes: get().nodes.map((node) => {
          if (node.id === nodeId && node.data?.module) {
            node.data.module.updateParameter(paramKey, value);
            return { ...node }; // 触发React更新
          }
          return node;
        }),
      });
    },

    // 添加新节点
    addNode: (type: string, label: string, position: { x: number; y: number }, id?: string) => {
      const nodeId = id || `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newNode = moduleManager.createNode(nodeId, type, label, position);

      set({
        nodes: [...get().nodes, newNode],
      });

      return nodeId;
    },

    // 添加新边
    addEdge: (source, target) => {
      const edge = moduleManager.createEdgeWithBinding(source, target);
      if (edge) {
        set({
          edges: [...get().edges, edge],
        });
      }
    },

    // 删除节点及相连的边
    deleteNode: (nodeId) => {
      // 1. 找到与该节点相连的所有边
      const connectedEdges = get().edges.filter(
        (edge) => edge.source === nodeId || edge.target === nodeId
      );

      // 2. 解除这些边的绑定
      connectedEdges.forEach((edge) => {
        moduleManager.removeEdgeBinding(edge);
      });

      // 3. 释放节点资源
      const node = get().nodes.find((n) => n.id === nodeId);
      if (node?.data?.module) {
        node.data.module.dispose();

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
    importCanvasFromJson: (jsonString) => {
      try {
        const { nodes, edges } =
          serializationManager.deserializeCanvasFromJson(jsonString);

        // 重置初始化管理器
        moduleInitManager.reset();

        // 更新状态
        set({
          nodes,
          edges,
          currentProjectId: 'imported-project',
        });

        // 初始化连接
        moduleInitManager.onAllModulesReady(() => {
          moduleManager.setupAllEdgeBindings(edges);
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
        let moduleInstance;

        if (typeof data === 'string') {
          moduleInstance = serializationManager.deserializeModuleFromJson(data);
        } else {
          moduleInstance = serializationManager.deserializeModule(
            data as SerializedModule
          );
        }

        if (!moduleInstance) {
          return null;
        }

        // 创建节点
        const nodeId = `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
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
