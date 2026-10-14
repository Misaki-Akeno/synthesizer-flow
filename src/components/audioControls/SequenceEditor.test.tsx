import { Profiler } from 'react';
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
  it('moves the playhead without re-rendering the editor', () => {
    const clip = parseMidiClipJson('');
    const lengthTicks = getClipLengthTicks(clip);
    const onRender = vi.fn();
    render(
      <Profiler id="sequence-editor" onRender={onRender}>
        <SequenceEditor
          moduleId="seq"
          paramValues={{ clip: '' }}
          onParamChange={vi.fn()}
        />
      </Profiler>
    );
    const playhead = screen.getByTestId('sequence-playhead');
    const commitsAfterMount = onRender.mock.calls.length;

    act(() => {
      useTransportRuntimeStore.setState({ positionTicks: lengthTicks / 2 });
    });
    expect(playhead.style.transform).toBe('translateX(50%)');

    act(() => {
      useTransportRuntimeStore.setState({
        positionTicks: lengthTicks + lengthTicks / 4,
      });
    });
    expect(playhead.style.transform).toBe('translateX(25%)');
    // 播放位置变化只写 DOM，不触发任何 React 提交
    expect(onRender).toHaveBeenCalledTimes(commitsAfterMount);
  });
});
