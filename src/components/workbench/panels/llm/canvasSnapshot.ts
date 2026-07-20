import type {
  GraphStateParameterValue,
  GraphStateSnapshot,
  GraphStateSnapshotEdge,
} from '@/agent/core/types';
import { audioGraphRuntime } from '@/core/runtime/AudioGraphRuntime';

interface SerializableNodeShape {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: {
    type: string;
    label?: string;
    parameters: Record<string, GraphStateParameterValue>;
  };
  selected?: boolean;
}

export function createSerializableCanvasSnapshot<
  TNode extends SerializableNodeShape,
  TEdge extends GraphStateSnapshotEdge,
>(nodes: readonly TNode[], edges: readonly TEdge[]): GraphStateSnapshot {
  return {
    nodes: nodes.map((node) => {
      const runtime = audioGraphRuntime.getModuleSnapshot(node.id);
      return {
        id: node.id,
        type: node.type,
        position: node.position,
        selected: node.selected,
        data: {
          type: node.data.type,
          label: node.data.label,
          parameters: runtime?.parameters ?? node.data.parameters,
          ports: {
            inputs: runtime?.inputPortTypes ?? {},
            outputs: runtime?.outputPortTypes ?? {},
          },
          module: undefined,
        },
      };
    }),
    edges: edges.map((edge) => ({ ...edge })),
  };
}
