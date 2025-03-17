import { create } from 'zustand';
import {
  Node,
  Edge,
  Connection,
  EdgeChange,
  NodeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import { presetManager } from '../core/PresetManager';

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
}));
