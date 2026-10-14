'use client';

import { create } from 'zustand';
import { useSettings } from './settings-store';

/** 节点卡片的渲染细节档位。 */
export type NodeDetailLevel = 'full' | 'compact' | 'minimal';

/** 缩放不低于该值时显示完整卡片。 */
export const FULL_DETAIL_MIN_ZOOM = 0.6;
/** 缩放不低于该值时显示精简卡片，更小则显示极简色块。 */
export const COMPACT_DETAIL_MIN_ZOOM = 0.35;
/** 阈值附近的滞回宽度，避免缩放停在边界时档位来回闪烁。 */
export const DETAIL_ZOOM_HYSTERESIS = 0.04;

const LEVEL_RANK: Record<NodeDetailLevel, number> = {
  minimal: 0,
  compact: 1,
  full: 2,
};

function levelForZoom(zoom: number, offset: number): NodeDetailLevel {
  if (zoom >= FULL_DETAIL_MIN_ZOOM + offset) return 'full';
  if (zoom >= COMPACT_DETAIL_MIN_ZOOM + offset) return 'compact';
  return 'minimal';
}

/**
 * 根据缩放比例和上一档位计算新档位：放大需越过阈值 + 滞回，
 * 缩小需越过阈值 - 滞回，二者之间保持原档位。
 */
export function resolveZoomDetailLevel(
  zoom: number,
  previous: NodeDetailLevel
): NodeDetailLevel {
  if (!Number.isFinite(zoom)) return previous;
  const zoomingIn = levelForZoom(zoom, DETAIL_ZOOM_HYSTERESIS);
  if (LEVEL_RANK[zoomingIn] > LEVEL_RANK[previous]) return zoomingIn;
  const zoomingOut = levelForZoom(zoom, -DETAIL_ZOOM_HYSTERESIS);
  if (LEVEL_RANK[zoomingOut] < LEVEL_RANK[previous]) return zoomingOut;
  return previous;
}

interface CanvasLodState {
  /** 由视口缩放推导出的档位；只在跨越阈值时变化。 */
  zoomLevel: NodeDetailLevel;
  setZoom: (zoom: number) => void;
}

/**
 * 画布 LOD 状态。缩放每帧都会写入，但档位不变时不会通知订阅者，
 * 因此节点只在跨档时重渲染一次。
 */
export const useCanvasLodStore = create<CanvasLodState>((set, get) => ({
  zoomLevel: 'full',
  setZoom: (zoom) => {
    const next = resolveZoomDetailLevel(zoom, get().zoomLevel);
    if (next !== get().zoomLevel) set({ zoomLevel: next });
  },
}));

/** 节点实际使用的细节档位：设置为 auto 时跟随缩放，否则固定。 */
export function useNodeDetailLevel(): NodeDetailLevel {
  const mode = useSettings((state) => state.canvas.nodeDetailMode);
  const zoomLevel = useCanvasLodStore((state) => state.zoomLevel);
  return mode === 'auto' || !mode ? zoomLevel : mode;
}
