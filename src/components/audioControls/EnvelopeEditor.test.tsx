import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import EnvelopeEditor from './EnvelopeEditor';

const DEFAULT_VALUES = {
  attack: 0.2,
  decay: 0.5,
  sustain: 0.7,
  sustainTime: 0,
  release: 0.8,
};

describe('EnvelopeEditor', () => {
  it('renders the current ADSR values as an accessible curve editor', () => {
    render(
      <EnvelopeEditor paramValues={DEFAULT_VALUES} onParamChange={vi.fn()} />
    );

    expect(screen.getByLabelText('ADSR 包络曲线编辑器')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: '起音时间' })).toHaveAttribute(
      'aria-valuenow',
      '0.2'
    );
    expect(screen.getByText('S 70%')).toBeInTheDocument();
  });

  it('supports keyboard editing as a single history transaction', () => {
    const onParamChange = vi.fn();
    const onEditStart = vi.fn();
    const onEditEnd = vi.fn();

    render(
      <EnvelopeEditor
        paramValues={DEFAULT_VALUES}
        onParamChange={onParamChange}
        onEditStart={onEditStart}
        onEditEnd={onEditEnd}
      />
    );

    fireEvent.keyDown(screen.getByRole('slider', { name: '持续音量' }), {
      key: 'ArrowUp',
    });

    expect(onEditStart).toHaveBeenCalledTimes(1);
    expect(onParamChange).toHaveBeenCalledWith('sustain', 0.71);
    expect(onEditEnd).toHaveBeenCalledTimes(1);
  });

  it('shows sustain fade separately from the release phase', () => {
    render(
      <EnvelopeEditor
        paramValues={{ ...DEFAULT_VALUES, sustainTime: 2.5 }}
        onParamChange={vi.fn()}
      />
    );

    expect(screen.getByText('延音渐弱 2.50s')).toBeInTheDocument();
  });
});
