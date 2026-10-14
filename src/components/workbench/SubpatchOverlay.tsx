'use client';

import { useMemo } from 'react';
import { Layers3, Unlink } from 'lucide-react';
import { ViewportPortal } from '@xyflow/react';
import { Slider } from '@/components/ui/shadcn/slider';
import { Button } from '@/components/ui/shadcn/button';
import type { FlowNode } from '@/core/graph/types';
import type { SubpatchDocument } from '@/core/subpatch/types';
import { useFlowStore } from '@/store/canvas-store';
import { useShallow } from 'zustand/react/shallow';

const GROUP_PADDING = 26;
const HEADER_HEIGHT = 40;
const FALLBACK_NODE_WIDTH = 220;
const FALLBACK_NODE_HEIGHT = 180;

interface SubpatchBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getSubpatchBounds(
  subpatch: SubpatchDocument,
  nodes: FlowNode[]
): SubpatchBounds | null {
  const members = nodes.filter((node) =>
    subpatch.memberNodeIds.includes(node.id)
  );
  if (members.length < 2) return null;

  const left = Math.min(...members.map((node) => node.position.x));
  const top = Math.min(...members.map((node) => node.position.y));
  const right = Math.max(
    ...members.map(
      (node) => node.position.x + (node.measured?.width ?? FALLBACK_NODE_WIDTH)
    )
  );
  const bottom = Math.max(
    ...members.map(
      (node) =>
        node.position.y + (node.measured?.height ?? FALLBACK_NODE_HEIGHT)
    )
  );

  return {
    x: left - GROUP_PADDING,
    y: top - GROUP_PADDING - HEADER_HEIGHT,
    width: right - left + GROUP_PADDING * 2,
    height: bottom - top + GROUP_PADDING * 2 + HEADER_HEIGHT,
  };
}

function SubpatchFrame({
  subpatch,
  nodes,
}: {
  subpatch: SubpatchDocument;
  nodes: FlowNode[];
}) {
  const bounds = useMemo(
    () => getSubpatchBounds(subpatch, nodes),
    [subpatch, nodes]
  );
  const removeSubpatch = useFlowStore((state) => state.removeSubpatch);
  const renameSubpatch = useFlowStore((state) => state.renameSubpatch);
  const updateModuleParameter = useFlowStore(
    (state) => state.updateModuleParameter
  );
  const beginHistoryTransaction = useFlowStore(
    (state) => state.beginHistoryTransaction
  );
  const commitHistoryTransaction = useFlowStore(
    (state) => state.commitHistoryTransaction
  );

  if (!bounds) return null;

  return (
    <div
      className="pointer-events-none absolute rounded-2xl border border-dashed border-violet-400/70 bg-violet-500/[0.025] shadow-[inset_0_0_60px_rgba(139,92,246,0.04)]"
      style={bounds}
      data-testid={`subpatch-${subpatch.id}`}
    >
      <div className="pointer-events-auto absolute top-0 left-0 flex h-10 max-w-full items-center gap-2 rounded-br-xl border-r border-b border-violet-300/60 bg-white/95 px-2.5 shadow-sm backdrop-blur dark:bg-zinc-950/95">
        <Layers3 className="size-3.5 shrink-0 text-violet-600" />
        <input
          key={`${subpatch.id}:${subpatch.name}`}
          defaultValue={subpatch.name}
          onBlur={(event) =>
            renameSubpatch(subpatch.id, event.currentTarget.value)
          }
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          aria-label="Subpatch 名称"
          className="nodrag nowheel w-32 bg-transparent text-xs font-semibold tracking-wide outline-none"
        />
        <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
          {subpatch.memberNodeIds.length}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="nodrag size-6 text-muted-foreground hover:text-foreground"
          onClick={() => removeSubpatch(subpatch.id)}
          aria-label="解除 Subpatch 分组"
          title="解除分组"
        >
          <Unlink className="size-3.5" />
        </Button>
      </div>

      {subpatch.macroControls.length > 0 && (
        <div className="pointer-events-auto absolute top-[calc(100%+8px)] right-0 grid w-64 gap-2 rounded-xl border border-violet-200/80 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-violet-900 dark:bg-zinc-950/95">
          <div className="flex items-center justify-between text-[10px] font-semibold tracking-[0.16em] text-violet-700 uppercase dark:text-violet-300">
            <span>Macro controls</span>
            <span>{subpatch.macroControls.length}</span>
          </div>
          {subpatch.macroControls.map((macro) => {
            const node = nodes.find((item) => item.id === macro.moduleId);
            const rawValue = node?.data.parameters[macro.parameterKey];
            const value =
              typeof rawValue === 'number'
                ? Math.min(macro.max, Math.max(macro.min, rawValue))
                : macro.min;
            return (
              <label key={macro.id} className="grid gap-1.5">
                <span className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                  <span className="truncate">{macro.label}</span>
                  <span className="font-mono text-[10px] text-foreground">
                    {Number.isInteger(value) ? value : value.toFixed(2)}
                  </span>
                </span>
                <Slider
                  className="nodrag nowheel"
                  min={macro.min}
                  max={macro.max}
                  step={macro.step ?? (macro.max - macro.min) / 200}
                  value={[value]}
                  onPointerDown={beginHistoryTransaction}
                  onValueChange={([nextValue]) =>
                    updateModuleParameter(
                      macro.moduleId,
                      macro.parameterKey,
                      nextValue
                    )
                  }
                  onValueCommit={commitHistoryTransaction}
                  onPointerCancel={commitHistoryTransaction}
                  aria-label={macro.label}
                />
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SubpatchOverlay() {
  const { nodes, subpatches } = useFlowStore(
    useShallow((state) => ({
      nodes: state.nodes,
      subpatches: state.subpatches,
    }))
  );

  if (subpatches.length === 0) return null;

  return (
    <ViewportPortal>
      {subpatches.map((subpatch) => (
        <SubpatchFrame key={subpatch.id} subpatch={subpatch} nodes={nodes} />
      ))}
    </ViewportPortal>
  );
}
