import { beforeEach, describe, expect, it } from 'vitest';
import { useTransportRuntimeStore } from './transport-runtime-store';

describe('transport runtime store', () => {
  beforeEach(() => {
    useTransportRuntimeStore.setState({
      isPlaying: false,
      hasStarted: false,
      isRecording: false,
      positionTicks: 0,
      lastFrameMs: null,
    });
  });

  it('pauses without losing position and stop returns to the start', () => {
    useTransportRuntimeStore.getState().play();
    useTransportRuntimeStore.getState().seek(240);
    useTransportRuntimeStore.getState().pause();

    expect(useTransportRuntimeStore.getState()).toMatchObject({
      isPlaying: false,
      hasStarted: true,
      positionTicks: 240,
    });

    useTransportRuntimeStore.getState().stop();
    expect(useTransportRuntimeStore.getState()).toMatchObject({
      hasStarted: false,
      positionTicks: 0,
    });
  });

  it('uses an external audio clock and wraps inside the loop range', () => {
    useTransportRuntimeStore.getState().play();
    useTransportRuntimeStore
      .getState()
      .advance(0, 120, 3840, true, 480, 1440, 1200);
    const result = useTransportRuntimeStore
      .getState()
      .advance(16, 120, 3840, true, 480, 1440, 1680);

    expect(result).toMatchObject({
      positionTicks: 720,
      wrapped: true,
      requiresSeek: true,
    });
  });

  it('follows a Tone-native loop without seeking and ignores latency jitter', () => {
    useTransportRuntimeStore.getState().play();
    const advance = (now: number, external: number) =>
      useTransportRuntimeStore
        .getState()
        .advance(now, 120, 3840, true, 0, 1920, external);
    advance(0, 1800);

    // 输出延迟估计略有回退时，播放头保持不动
    expect(advance(16, 1790)).toMatchObject({ positionTicks: 1800, wrapped: false });
    // Transport 已在音频时钟上跳回起点：重新应用自动化，但不能再 seek
    expect(advance(32, 40)).toMatchObject({
      positionTicks: 40,
      wrapped: true,
      requiresSeek: false,
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
