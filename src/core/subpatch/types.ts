import { ParameterType } from '@/core/base/ModuleBase';
import type { FlowNode } from '@/core/graph/types';
import { moduleDefinitionRegistry } from '@/core/graph/ModuleDefinitionRegistry';

export const SUBPATCH_DOCUMENT_VERSION = 1;
export const MAX_SUBPATCH_MACROS = 4;

export interface SubpatchMacroControl {
  id: string;
  label: string;
  moduleId: string;
  parameterKey: string;
  min: number;
  max: number;
  step?: number;
}

export interface SubpatchDocument {
  version: number;
  id: string;
  name: string;
  memberNodeIds: string[];
  macroControls: SubpatchMacroControl[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createAutomaticMacroControls(
  nodes: FlowNode[]
): SubpatchMacroControl[] {
  const controls: SubpatchMacroControl[] = [];

  for (const node of nodes) {
    const definition = moduleDefinitionRegistry.resolve(node.data.type);
    if (!definition) continue;

    for (const [parameterKey, meta] of Object.entries(
      definition.parameterMeta
    )) {
      const value = node.data.parameters[parameterKey];
      const hidden = meta.uiOptions?.hide === true;
      const readonly = meta.uiOptions?.readonly === true;
      if (
        meta.type !== ParameterType.NUMBER ||
        typeof value !== 'number' ||
        hidden ||
        readonly ||
        !Number.isFinite(meta.min) ||
        !Number.isFinite(meta.max) ||
        meta.min === meta.max
      ) {
        continue;
      }

      const parameterLabel =
        typeof meta.uiOptions?.label === 'string'
          ? meta.uiOptions.label
          : parameterKey;
      controls.push({
        id: `${node.id}:${parameterKey}`,
        label: `${node.data.label} · ${parameterLabel}`,
        moduleId: node.id,
        parameterKey,
        min: meta.min as number,
        max: meta.max as number,
        step: meta.step,
      });

      if (controls.length >= MAX_SUBPATCH_MACROS) return controls;
    }
  }

  return controls;
}

export function normalizeSubpatchDocuments(
  value: unknown,
  nodes: FlowNode[]
): SubpatchDocument[] {
  if (!Array.isArray(value)) return [];

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const occupiedNodeIds = new Set<string>();
  const seenIds = new Set<string>();
  const normalized: SubpatchDocument[] = [];

  value.forEach((candidate) => {
    if (!isRecord(candidate)) return;
    const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
    if (!id || seenIds.has(id)) return;

    const memberNodeIds = Array.isArray(candidate.memberNodeIds)
      ? candidate.memberNodeIds.filter(
          (nodeId): nodeId is string =>
            typeof nodeId === 'string' &&
            nodeMap.has(nodeId) &&
            !occupiedNodeIds.has(nodeId)
        )
      : [];
    if (memberNodeIds.length < 2) return;

    const macros = Array.isArray(candidate.macroControls)
      ? candidate.macroControls
      : [];
    const macroControls = macros
      .filter(isRecord)
      .flatMap((macro): SubpatchMacroControl[] => {
        const moduleId =
          typeof macro.moduleId === 'string' ? macro.moduleId : '';
        const parameterKey =
          typeof macro.parameterKey === 'string' ? macro.parameterKey : '';
        const node = nodeMap.get(moduleId);
        const definition = node
          ? moduleDefinitionRegistry.resolve(node.data.type)
          : undefined;
        const meta = definition?.parameterMeta[parameterKey];
        const min = typeof macro.min === 'number' ? macro.min : meta?.min;
        const max = typeof macro.max === 'number' ? macro.max : meta?.max;
        if (
          !memberNodeIds.includes(moduleId) ||
          meta?.type !== ParameterType.NUMBER ||
          !Number.isFinite(min) ||
          !Number.isFinite(max) ||
          min === max
        ) {
          return [];
        }
        return [
          {
            id:
              typeof macro.id === 'string' && macro.id
                ? macro.id
                : `${moduleId}:${parameterKey}`,
            label:
              typeof macro.label === 'string' && macro.label
                ? macro.label
                : parameterKey,
            moduleId,
            parameterKey,
            min: min as number,
            max: max as number,
            step: typeof macro.step === 'number' ? macro.step : meta?.step,
          },
        ];
      })
      .slice(0, MAX_SUBPATCH_MACROS);

    seenIds.add(id);
    memberNodeIds.forEach((nodeId) => occupiedNodeIds.add(nodeId));
    normalized.push({
      version: SUBPATCH_DOCUMENT_VERSION,
      id,
      name:
        typeof candidate.name === 'string' && candidate.name.trim()
          ? candidate.name.trim().slice(0, 80)
          : 'Subpatch',
      memberNodeIds,
      macroControls,
    });
  });

  return normalized;
}
