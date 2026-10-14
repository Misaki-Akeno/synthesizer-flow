import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SequenceEditor from './SequenceEditor';
import { useTransportRuntimeStore } from '@/store/transport-runtime-store';
import { getClipLengthTicks, parseMidiClipJson } from '@/core/midi/utils';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/store/canvas-store', () => {
  const state = {
    transport: { bpm: 120 },
    setTransportBpm: vi.fn(),
    setSequencersRunning: vi.fn(),
  };
  return {
    useFlowStore: (selector: (value: typeof state) => unknown) =>
      selector(state),
  };
});

afterEach(() => {
  useTransportRuntimeStore.getState().stop();
});

describe('SequenceEditor', () => {
  it('moves the playhead without re-rendering the note grid', () => {
    const clip = parseMidiClipJson('');
    const lengthTicks = getClipLengthTicks(clip);
    render(
      <SequenceEditor
        moduleId="seq"
        paramValues={{ clip: '' }}
        onParamChange={vi.fn()}
      />
    );
    const playhead = screen.getByTestId('sequence-playhead');
    const grid = playhead.parentElement as HTMLElement;
    const gridChildren = Array.from(grid.children);

    act(() => {
      useTransportRuntimeStore.setState({ positionTicks: lengthTicks / 2 });
    });

    expect(playhead.style.transform).toBe('translateX(50%)');
    // 播放位置变化不应重建音符节点
    expect(Array.from(grid.children)).toEqual(gridChildren);

    act(() => {
      useTransportRuntimeStore.setState({
        positionTicks: lengthTicks + lengthTicks / 4,
      });
    });
    expect(playhead.style.transform).toBe('translateX(25%)');
  });
});
