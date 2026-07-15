import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ModuleBase } from '@/core/base/ModuleBase';
import DefaultNode from './DefaultNode';

const mockUpdateModuleParameter = vi.fn();

vi.mock('@/store/canvas-store', () => ({
  useFlowStore: (selector: (state: unknown) => unknown) =>
    selector({ updateModuleParameter: mockUpdateModuleParameter }),
}));

vi.mock('@/core/hooks/useModuleSubscription', () => ({
  useModuleSubscription: () => ({
    paramValues: {},
    inputPortValues: {},
    inputPortTypes: {},
    outputPortValues: {},
    outputPortTypes: {},
  }),
}));

describe('DefaultNode', () => {
  it('does not inject a throwing placeholder click handler into custom UI', () => {
    const moduleInstance = {
      name: 'Button Module',
      parameters: {},
      inputPorts: {},
      outputPorts: {},
      getCustomUI: () => ({
        type: 'CommonButton',
        props: {
          label: 'Trigger',
        },
      }),
    } as unknown as ModuleBase;

    render(
      <DefaultNode
        id="node-1"
        data={{
          label: 'Button Module',
          type: 'button',
          module: moduleInstance,
        }}
      />
    );

    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Trigger' }))
    ).not.toThrow();
  });
});
