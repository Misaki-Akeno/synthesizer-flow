import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DefaultNode from './DefaultNode';
import { useCanvasLodStore } from '@/store/canvas-lod-store';
import { DEFAULT_CANVAS_SETTINGS, useSettings } from '@/store/settings-store';

const store = {
  updateModuleParameter: vi.fn(),
  toggleModuleEnabled: vi.fn(),
  invokeModuleAction: vi.fn(),
  beginHistoryTransaction: vi.fn(),
  commitHistoryTransaction: vi.fn(),
};

vi.mock('@/store/canvas-store', () => ({
  useFlowStore: (selector: (state: typeof store) => unknown) => selector(store),
}));

const useRuntimeModule = vi.hoisted(() =>
  vi.fn(() => ({
    id: 'node-1',
    type: 'button',
    name: 'Button Module',
    enabled: true,
    canEnable: false,
    parameters: {},
    parameterMeta: {},
    inputPortTypes: {},
    outputPortTypes: {},
    customUI: {
      type: 'CommonButton',
      props: { label: 'Trigger' },
      actions: [],
    },
  }))
);

vi.mock('@/core/hooks/useRuntimeModule', () => ({
  useRuntimeModule,
  useRuntimeModuleTelemetry: () => undefined,
}));

const nodeData = {
  label: 'Button Module',
  type: 'button',
  parameters: {},
  enabled: true,
};

beforeEach(() => {
  useRuntimeModule.mockClear();
});

afterEach(() => {
  useCanvasLodStore.setState({ zoomLevel: 'full' });
  useSettings.setState({ canvas: { ...DEFAULT_CANVAS_SETTINGS } });
});

describe('DefaultNode', () => {
  it('does not inject a throwing placeholder click handler into custom UI', () => {
    render(<DefaultNode id="node-1" data={nodeData} />);

    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Trigger' }))
    ).not.toThrow();
  });

  it('renders a read-only card without runtime subscriptions when zoomed out', () => {
    useCanvasLodStore.setState({ zoomLevel: 'minimal' });

    render(<DefaultNode id="node-1" data={nodeData} />);

    const card = screen.getByTestId('module-node-node-1');
    expect(card).toHaveAttribute('data-detail-level', 'minimal');
    expect(card).toHaveAttribute('data-module-type', 'button');
    expect(screen.getByText('Button Module')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Trigger' })).toBeNull();
    expect(useRuntimeModule).not.toHaveBeenCalled();
  });

  it('uses the fixed detail level from settings instead of the zoom level', () => {
    useSettings.getState().updateCanvas({ nodeDetailMode: 'compact' });

    render(<DefaultNode id="node-1" data={nodeData} />);

    expect(screen.getByTestId('module-node-node-1')).toHaveAttribute(
      'data-detail-level',
      'compact'
    );
    expect(useRuntimeModule).not.toHaveBeenCalled();
  });
});
