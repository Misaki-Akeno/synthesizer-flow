import type {
  GraphStateParameterValue,
  GraphStateSnapshot,
  GraphStateSnapshotEdge,
} from '@/agent';

type ParameterValueReader = {
  getValue: () => unknown;
};

type RuntimeModuleShape = {
  parameters?: unknown;
  inputPortTypes?: unknown;
  outputPortTypes?: unknown;
};

type NodeWithRuntimeModule = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: {
    type: string;
    label?: string;
    module?: RuntimeModuleShape;
    parameters?: unknown;
  };
  selected?: boolean;
};

function hasParameterValueReader(
  value: unknown
): value is ParameterValueReader {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getValue' in value &&
    typeof value.getValue === 'function'
  );
}

export function readRuntimeParameters(
  moduleParameters: unknown,
  fallback: Record<string, GraphStateParameterValue> = {}
): Record<string, GraphStateParameterValue> {
  const parameters = toParameterRecord(fallback);

  if (
    typeof moduleParameters !== 'object' ||
    moduleParameters === null ||
    Array.isArray(moduleParameters)
  ) {
    return parameters;
  }

  Object.entries(moduleParameters).forEach(([key, param]) => {
    const value = hasParameterValueReader(param) ? param.getValue() : param;
    if (isGraphStateParameterValue(value)) {
      parameters[key] = value;
    }
  });

  return parameters;
}

function isGraphStateParameterValue(
  value: unknown
): value is GraphStateParameterValue {
  return (
    (typeof value === 'number' && Number.isFinite(value)) ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  );
}

function toParameterRecord(
  value: unknown
): Record<string, GraphStateParameterValue> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, GraphStateParameterValue] =>
        isGraphStateParameterValue(entry[1])
    )
  );
}

function toPortRecord(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  );
}

export function createSerializableCanvasSnapshot<
  TNode extends NodeWithRuntimeModule,
  TEdge extends GraphStateSnapshotEdge,
>(nodes: readonly TNode[], edges: readonly TEdge[]): GraphStateSnapshot {
  return {
    nodes: nodes.map((node) => {
      const parameters = readRuntimeParameters(
        node.data.module?.parameters,
        toParameterRecord(node.data.parameters)
      );
      const ports = {
        inputs: toPortRecord(node.data.module?.inputPortTypes),
        outputs: toPortRecord(node.data.module?.outputPortTypes),
      };

      return {
        id: node.id,
        type: node.type,
        position: node.position,
        selected: node.selected,
        data: {
          type: node.data.type,
          label: node.data.label,
          parameters,
          ports,
          module: undefined,
        },
      };
    }),
    edges: edges.map((edge) => ({ ...edge })),
  };
}
