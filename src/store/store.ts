import { create } from 'zustand';
import {
  Node as ReactFlowNode,
  Edge,
  Connection,
  EdgeChange,
  NodeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import { presetManager } from '../core/PresetManager';
import { ModuleBase } from '../core/ModuleBase';

// 扩展 Node 类型，添加我们自定义的 module 属性
interface NodeData {
  module?: ModuleBase;
  type?: string;
  label?: string;
  [key: string]: unknown;
}

type Node = ReactFlowNode<NodeData>;

// --------------------------------
//        Reactflow管理部分
// --------------------------------
interface FlowState {
  nodes: Node[];
  edges: Edge[];
  currentPresetId: string;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  loadPreset: (presetId: string) => void;
  getPresets: () => typeof presetManager.getPresets;
  updateModuleParameter: (nodeId: string, paramKey: string, value: number) => void;
}

const defaultPreset = presetManager.getPreset('default');
const { nodes: initialNodes, edges: initialEdges } = defaultPreset ? 
  presetManager.loadPresetWithModules(defaultPreset.id) : 
  { nodes: [], edges: [] };

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  currentPresetId: defaultPreset?.id || '',

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },

  onEdgesChange: (changes) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },

  onConnect: (connection) => {
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
        if (node.id === nodeId && node.data?.module?.parameters) {
          const updatedModule = { ...node.data.module };
          updatedModule.parameters = { ...updatedModule.parameters, [paramKey]: value };
          
          return {
            ...node,
            data: {
              ...node.data,
              module: updatedModule
            }
          };
        }
        return node;
      })
    });
  }
}));
