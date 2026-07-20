import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DefaultNode from './DefaultNode';

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

vi.mock('@/core/hooks/useRuntimeModule', () => ({
  useRuntimeModule: () => ({
    id: 'node-1',
    type: 'button',
    name: 'Button Module',
    enabled: true,
    canEnable: false,
    parameters: {},
    parameterMeta: {},
    inputPortTypes: {},
    outputPortTypes: {},
    inputValues: {},
    outputValues: {},
    customUI: {
      type: 'CommonButton',
      props: { label: 'Trigger' },
      actions: [],
    },
  }),
}));

describe('DefaultNode', () => {
  it('does not inject a throwing placeholder click handler into custom UI', () => {
    render(
      <DefaultNode
        id="node-1"
        data={{
          label: 'Button Module',
          type: 'button',
          parameters: {},
          enabled: true,
        }}
      />
    );

    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Trigger' }))
    ).not.toThrow();
  });
});
