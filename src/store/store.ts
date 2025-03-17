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

// --------------------------------
//              预设部分
// --------------------------------
export interface Preset {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
}

const defaultPreset: Preset = {
  id: 'default',
  name: '默认预设',
  nodes: [
    { id: '1', position: { x: 500, y: 500 }, data: { label: '节点 1' } },
    { id: '2', position: { x: 700, y: 500 }, data: { label: '节点 2' } },
  ],
  edges: [{ id: 'e1-2', source: '1', target: '2' }],
};

const myPreset: Preset = {
  id: 'myPreset',
  name: '我的预设',
  nodes: [
    { id: '1', position: { x: 500, y: 500 }, data: { label: '节点 1' } },
    { id: '2', position: { x: 500, y: 600 }, data: { label: '节点 2' } },
    { id: '3', position: { x: 500, y: 700 }, data: { label: '节点 3' } },
  ],
  edges: [
    { id: 'e1-2', source: '1', target: '2' },
    { id: 'e2-3', source: '2', target: '3' },
  ],
};

const presets: Preset[] = [defaultPreset, myPreset];

// --------------------------------
//        Reactflow管理部分
// --------------------------------
interface FlowState {
  nodes: Node[];
  edges: Edge[];
  presets: Preset[];
  currentPresetId: string;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  loadPreset: (presetId: string) => void;
}

export const useFlowStore = create<FlowState>((set, get) => ({
  nodes: defaultPreset.nodes,
  edges: defaultPreset.edges,
  presets: presets,
  currentPresetId: defaultPreset.id,

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
    const preset = presets.find((p) => p.id === presetId) || defaultPreset;
    set({
      nodes: preset.nodes,
      edges: preset.edges,
      currentPresetId: preset.id,
    });
  },
}));
