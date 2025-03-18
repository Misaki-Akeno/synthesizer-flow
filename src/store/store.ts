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
  updateModuleParameter: (nodeId: string, paramKey: string, value: number) => void;
  addNode: (type: string, label: string, position: { x: number, y: number }) => void;
  addEdge: (source: string, target: string) => void;
}

const defaultPreset = presetManager.getPreset('default');
const { nodes: initialNodes, edges: initialEdges } = defaultPreset ? 
  presetManager.loadPresetWithModules(defaultPreset.id) : 
  { nodes: [], edges: [] };

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
      // 处理边的删除，解除相应的绑定
      const edgesToRemove = changes
        .filter(change => change.type === 'remove')
        .map(change => get().edges.find(edge => edge.id === change.id))
        .filter((edge): edge is Edge => edge !== undefined);
      
      // 解除绑定
      edgesToRemove.forEach(edge => {
        moduleManager.removeEdgeBinding(edge);
      });
      
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
      set({
        nodes,
        edges,
        currentPresetId: presetId,
      });
    },
  
    getPresets: () => presetManager.getPresets,
  
    updateModuleParameter: (nodeId, paramKey, value) => {
      set({
        nodes: get().nodes.map(node => {
          if (node.id === nodeId && node.data?.module) {
            // 使用RxJS方式更新参数
            node.data.module.updateParameter(paramKey, value);
            return { ...node }; // 触发React更新
          }
          return node;
        })
      });
    },
  
    // 添加新节点
    addNode: (type, label, position) => {
      const nodeId = `node_${Date.now()}`;
      const newNode = moduleManager.createNode(nodeId, type, label, position);
      
      set({
        nodes: [...get().nodes, newNode]
      });
  
      return nodeId;
    },
  
    // 添加新边
    addEdge: (source, target) => {
      const edgeId = `edge_${source}_${target}_${Date.now()}`;
      const newEdge = moduleManager.createEdge(edgeId, source, target);
      
      set({
        edges: [...get().edges, newEdge]
      });
    }
  };
});
