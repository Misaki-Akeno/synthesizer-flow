import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { afterEach, describe, expect, it } from 'vitest';
import LowDetailNode from './LowDetailNode';
import { pruneNodeViewCache, rememberNodeSize } from './nodeViewCache';
import { moduleDefinitionRegistry } from '@/core/graph/ModuleDefinitionRegistry';

const data = {
  label: 'Number',
  type: 'numberinput',
  parameters: { value: 440 },
  enabled: true,
};

function renderNode(
  props: Partial<Parameters<typeof LowDetailNode>[0]> = {}
): HTMLElement {
  render(
    <ReactFlowProvider>
      <LowDetailNode
        id="number-1"
        data={data}
        level="compact"
        selected={false}
        {...props}
      />
    </ReactFlowProvider>
  );
  return screen.getByTestId('module-node-number-1');
}

afterEach(() => {
  pruneNodeViewCache(new Set());
});

describe('LowDetailNode', () => {
  it('keeps the same port handles as the full card', () => {
    const card = renderNode();
    const definition = moduleDefinitionRegistry.resolve('numberinput')!;

    const handleIds = Array.from(
      card.querySelectorAll('[data-handleid]'),
      (handle) => handle.getAttribute('data-handleid')
    );
    expect(handleIds).toEqual([
      ...Object.keys(definition.inputPortTypes),
      ...Object.keys(definition.outputPortTypes),
    ]);
    expect(handleIds.length).toBeGreaterThan(0);
  });

  it('reuses the size measured at full detail', () => {
    rememberNodeSize('number-1', { width: 312, height: 408 });

    const card = renderNode({ level: 'minimal' });

    expect(card.style.width).toBe('312px');
    expect(card.style.height).toBe('408px');
  });

  it('falls back to an estimated size before the card was ever measured', () => {
    const card = renderNode();

    expect(card.style.width).toBe('220px');
    expect(Number.parseFloat(card.style.height)).toBeGreaterThanOrEqual(96);
  });

  it('shows document parameter values and a selection highlight', () => {
    const card = renderNode({ selected: true });

    expect(screen.getByText('440')).toBeInTheDocument();
    expect(card.className).toContain('ring-sky-500');
  });

  it('drops cached sizes of nodes that left the canvas', () => {
    rememberNodeSize('number-1', { width: 312, height: 408 });
    pruneNodeViewCache(new Set(['other']));

    expect(renderNode().style.width).toBe('220px');
  });
});
