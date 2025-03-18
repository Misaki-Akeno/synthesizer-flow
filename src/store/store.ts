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

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  currentPresetId: defaultPreset?.id || '',

  onNodesChange: (changes) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes) as FlowNode[],
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
}));
