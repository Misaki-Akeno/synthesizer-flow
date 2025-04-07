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
import { presetManager } from '../core/PresetManager';
import { moduleManager, FlowNode } from '../core/ModuleManager';
import { moduleInitManager } from '../core/ModuleInitManager';

// --------------------------------
//        Reactflow管理部分
// --------------------------------
interface FlowState {
  nodes: FlowNode[];
  edges: Edge[];
  currentPresetId: string;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  loadPreset: (presetId: string) => void;
  getPresets: () => typeof presetManager.getPresets;
  updateModuleParameter: (
    nodeId: string,
    paramKey: string,
    value: number | boolean | string
  ) => void;
  addNode: (
    type: string,
    label: string,
    position: { x: number; y: number }
  ) => void;
  addEdge: (source: string, target: string) => void;
}

const defaultPreset = presetManager.getPreset('major-chord');
const { nodes: initialNodes, edges: initialEdges } = defaultPreset
  ? presetManager.loadPresetWithModules(defaultPreset.id)
  : { nodes: [], edges: [] };

export const useFlowStore = create<FlowState>((set, get) => {
  // 设置节点获取函数
  moduleManager.setNodesGetter(() => get().nodes);

  return {
    nodes: initialNodes,
    edges: initialEdges,
    currentPresetId: defaultPreset?.id || '',

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

    loadPreset: (presetId) => {
      const { nodes, edges } = presetManager.loadPresetWithModules(presetId);
      
      // 在加载新预设前重置初始化管理器
      moduleInitManager.reset();
      
      // 设置状态
      set({
        nodes,
        edges,
        currentPresetId: presetId,
      });
      
      // 等待所有模块初始化完成后再设置边绑定
      moduleInitManager.onAllModulesReady(() => {
        moduleManager.setupAllEdgeBindings(edges);
      });
      
      // 为了向后兼容，仍保留setTimeout方式，但延长时间确保异步初始化有足够时间
      setTimeout(() => {
        // 只有当模块尚未全部初始化时才执行这个备份绑定
        moduleInitManager.onAllModulesReady(() => {
        });
      }, 1000);
    },

    getPresets: () => presetManager.getPresets,

    updateModuleParameter: (nodeId, paramKey, value) => {
      set({
        nodes: get().nodes.map((node) => {
          if (node.id === nodeId && node.data?.module) {
            // 使用修改后的 updateParameter 方法，它可以处理所有类型的参数
            node.data.module.updateParameter(paramKey, value);
            return { ...node }; // 触发React更新
          }
          return node;
        }),
      });
    },

    // 添加新节点
    addNode: (type, label, position) => {
      const nodeId = `node_${Date.now()}`;
      const newNode = moduleManager.createNode(nodeId, type, label, position);

      set({
        nodes: [...get().nodes, newNode],
      });

      return nodeId;
    },

    // 添加新边
    addEdge: (source, target) => {
      const edgeId = `edge_${source}_${target}_${Date.now()}`;
      const newEdge = moduleManager.createEdge(edgeId, source, target);

      set({
        edges: [...get().edges, newEdge],
      });
    },
  };
});
