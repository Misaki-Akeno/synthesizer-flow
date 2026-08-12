import { beforeEach, describe, expect, it } from 'vitest';
import { useTransportRuntimeStore } from './transport-runtime-store';

describe('transport runtime store', () => {
  beforeEach(() => {
    useTransportRuntimeStore.setState({
      isPlaying: false,
      isRecording: false,
      positionTicks: 0,
      lastFrameMs: null,
    });
  });

  it('advances in musical ticks and wraps while loop is enabled', () => {
    const runtime = useTransportRuntimeStore.getState();
    runtime.play();
    useTransportRuntimeStore.getState().advance(0, 120, 480, true);
    const result = useTransportRuntimeStore
      .getState()
      .advance(500, 120, 480, true);

    expect(result.positionTicks).toBe(0);
    expect(result.wrapped).toBe(true);
    expect(useTransportRuntimeStore.getState().isPlaying).toBe(true);
  });

  it('stops at the end when looping is disabled', () => {
    useTransportRuntimeStore.getState().play();
    useTransportRuntimeStore.getState().advance(0, 120, 480, false);
    const result = useTransportRuntimeStore
      .getState()
      .advance(500, 120, 480, false);

    expect(result.ended).toBe(true);
    expect(useTransportRuntimeStore.getState().isPlaying).toBe(false);
  });
});
