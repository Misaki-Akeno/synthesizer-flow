import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  resolveZoomDetailLevel,
  useCanvasLodStore,
  useNodeDetailLevel,
} from './canvas-lod-store';
import { DEFAULT_CANVAS_SETTINGS, useSettings } from './settings-store';

afterEach(() => {
  useCanvasLodStore.setState({ zoomLevel: 'full' });
  useSettings.setState({ canvas: { ...DEFAULT_CANVAS_SETTINGS } });
});

describe('resolveZoomDetailLevel', () => {
  it('maps zoom ranges to full, compact and minimal', () => {
    expect(resolveZoomDetailLevel(1, 'full')).toBe('full');
    expect(resolveZoomDetailLevel(0.45, 'full')).toBe('compact');
    expect(resolveZoomDetailLevel(0.2, 'full')).toBe('minimal');
    expect(resolveZoomDetailLevel(1, 'minimal')).toBe('full');
  });

  it('keeps the previous level inside the hysteresis band', () => {
    // 0.58 低于完整阈值 0.6，但还在滞回带内
    expect(resolveZoomDetailLevel(0.58, 'full')).toBe('full');
    expect(resolveZoomDetailLevel(0.55, 'full')).toBe('compact');
    // 从精简放大到 0.62 仍不足以切回完整档位
    expect(resolveZoomDetailLevel(0.62, 'compact')).toBe('compact');
    expect(resolveZoomDetailLevel(0.65, 'compact')).toBe('full');
    expect(resolveZoomDetailLevel(0.33, 'compact')).toBe('compact');
    expect(resolveZoomDetailLevel(0.3, 'compact')).toBe('minimal');
    expect(resolveZoomDetailLevel(0.37, 'minimal')).toBe('minimal');
  });

  it('ignores invalid zoom values', () => {
    expect(resolveZoomDetailLevel(Number.NaN, 'compact')).toBe('compact');
  });
});

describe('useCanvasLodStore', () => {
  it('only notifies subscribers when the level crosses a threshold', () => {
    const levels: string[] = [];
    const unsubscribe = useCanvasLodStore.subscribe((state) =>
      levels.push(state.zoomLevel)
    );

    [1, 0.9, 0.7, 0.61, 0.5, 0.45, 0.4, 0.2, 0.1].forEach((zoom) =>
      useCanvasLodStore.getState().setZoom(zoom)
    );
    unsubscribe();

    expect(levels).toEqual(['compact', 'minimal']);
  });
});

describe('useNodeDetailLevel', () => {
  it('follows zoom in auto mode and honours a fixed setting', () => {
    const { result } = renderHook(() => useNodeDetailLevel());
    expect(result.current).toBe('full');

    act(() => useCanvasLodStore.getState().setZoom(0.2));
    expect(result.current).toBe('minimal');

    act(() => useSettings.getState().updateCanvas({ nodeDetailMode: 'full' }));
    expect(result.current).toBe('full');

    act(() =>
      useSettings.getState().updateCanvas({ nodeDetailMode: 'compact' })
    );
    act(() => useCanvasLodStore.getState().setZoom(1));
    expect(result.current).toBe('compact');
  });
});
