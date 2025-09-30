import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { render } from '@testing-library/react';
import { ModulePropertiesPanel } from './ModulePropertiesPanel';
import { ParameterType, ModuleBase } from '@/core/base/ModuleBase';
import type { FlowNode } from '@/core/services/ModuleManager';
import { useFlowStore } from '@/store/store';

type ParameterControlMockProps = {
  paramKey: string;
  paramType: ParameterType;
  value: number | boolean | string;
  meta: {
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
  };
  updateParameter: (key: string, value: number | boolean | string) => void;
  label: string;
  description?: string;
};

const parameterControlProps: ParameterControlMockProps[] = [];

vi.mock('@/components/ui/reusableUI', () => ({
  ParameterControl: (props: ParameterControlMockProps) => {
    parameterControlProps.push(props);
    return null;
  },
}));

vi.mock('@/hooks/useModuleSubscription', () => ({
  useModuleSubscription: () => ({
    paramValues: { toggle: false },
  }),
}));

class TestModule extends ModuleBase {
  constructor() {
    super('test', 'node-1', 'Test Module', {
      toggle: {
        type: ParameterType.BOOLEAN,
        value: false,
        uiOptions: {
          label: 'Toggle',
        },
      },
    });
  }
}

type FlowStoreState = ReturnType<typeof useFlowStore.getState>;

describe('ModulePropertiesPanel', () => {
  let originalUpdate: FlowStoreState['updateModuleParameter'];
  let updateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    parameterControlProps.length = 0;

    const testModule = new TestModule();
    const node: FlowNode = {
      id: 'node-1',
      type: 'default',
      position: { x: 0, y: 0 },
      data: {
        module: testModule,
        label: 'Test Node',
        type: 'test',
      },
      selected: true,
    };

    act(() => {
      useFlowStore.setState({
        nodes: [node],
        edges: [],
      });
    });

    originalUpdate = useFlowStore.getState().updateModuleParameter;
    updateMock = vi.fn();
    act(() => {
      useFlowStore.setState({
        updateModuleParameter: updateMock as unknown as typeof originalUpdate,
      });
    });
  });

  afterEach(() => {
    act(() => {
      useFlowStore.setState({
        nodes: [],
        edges: [],
        updateModuleParameter: originalUpdate,
      });
    });
    vi.restoreAllMocks();
  });

  it('calls updateModuleParameter when toggling boolean parameter', async () => {
    render(<ModulePropertiesPanel />);

    expect(parameterControlProps).toHaveLength(1);
    const props = parameterControlProps[0];

    await act(async () => {
      props.updateParameter(props.paramKey, true);
      await Promise.resolve();
    });

    expect(updateMock).toHaveBeenCalledWith('node-1', 'toggle', true);
  });
});
