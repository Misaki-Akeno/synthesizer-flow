'use client';

import { create } from 'zustand';
import { TRANSPORT_PPQ } from '@/core/transport/types';

interface AdvanceResult {
  positionTicks: number;
  ended: boolean;
  /** 播放位置回到了循环起点，需要重新应用自动化。 */
  wrapped: boolean;
  /** 位置由界面帧折回，音频 Transport 尚未跟随，需要 seek。 */
  requiresSeek: boolean;
}

interface TransportRuntimeState {
  isPlaying: boolean;
  hasStarted: boolean;
  isRecording: boolean;
  positionTicks: number;
  lastFrameMs: number | null;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setRecording: (recording: boolean) => void;
  seek: (positionTicks: number) => void;
  advance: (
    nowMs: number,
    bpm: number,
    lengthTicks: number,
    loopEnabled: boolean,
    loopStartTick?: number,
    loopEndTick?: number,
    externalPositionTicks?: number
  ) => AdvanceResult;
}

/** 把循环区间限制在项目长度内且至少一拍；界面折回与 Tone 循环共用。 */
export function resolveLoopRange(
  lengthTicks: number,
  loopStartTick = 0,
  loopEndTick = lengthTicks
): { startTick: number; endTick: number } {
  const safeLength = Math.max(TRANSPORT_PPQ, lengthTicks);
  const startTick = Math.max(
    0,
    Math.min(loopStartTick, safeLength - TRANSPORT_PPQ)
  );
  const endTick = Math.max(
    startTick + TRANSPORT_PPQ,
    Math.min(loopEndTick, safeLength)
  );
  return { startTick, endTick };
}

export const useTransportRuntimeStore = create<TransportRuntimeState>(
  (set, get) => ({
    isPlaying: false,
    hasStarted: false,
    isRecording: false,
    positionTicks: 0,
    lastFrameMs: null,

    play: () => set({ isPlaying: true, hasStarted: true, lastFrameMs: null }),

    pause: () =>
      set({ isPlaying: false, isRecording: false, lastFrameMs: null }),

    stop: () =>
      set({
        isPlaying: false,
        hasStarted: false,
        isRecording: false,
        positionTicks: 0,
        lastFrameMs: null,
      }),

    setRecording: (isRecording) => set({ isRecording }),

    seek: (positionTicks) =>
      set({ positionTicks: Math.max(0, positionTicks), lastFrameMs: null }),

    advance: (
      nowMs,
      bpm,
      lengthTicks,
      loopEnabled,
      loopStartTick = 0,
      loopEndTick = lengthTicks,
      externalPositionTicks
    ) => {
      const state = get();
      if (!state.isPlaying) {
        return {
          positionTicks: state.positionTicks,
          ended: false,
          wrapped: false,
          requiresSeek: false,
        };
      }
      if (state.lastFrameMs === null) {
        const positionTicks = Number.isFinite(externalPositionTicks)
          ? Math.max(0, externalPositionTicks as number)
          : state.positionTicks;
        set({ lastFrameMs: nowMs, positionTicks });
        return {
          positionTicks,
          ended: false,
          wrapped: false,
          requiresSeek: false,
        };
      }

      const elapsedMs = Math.max(0, nowMs - state.lastFrameMs);
      const tickDelta = (elapsedMs / 60_000) * bpm * TRANSPORT_PPQ;
      const safeLength = Math.max(TRANSPORT_PPQ, lengthTicks);
      const { startTick: safeLoopStart, endTick: safeLoopEnd } =
        resolveLoopRange(lengthTicks, loopStartTick, loopEndTick);
      let positionTicks = Number.isFinite(externalPositionTicks)
        ? (externalPositionTicks as number)
        : state.positionTicks + tickDelta;
      let ended = false;
      let wrapped = false;
      let requiresSeek = false;

      if (
        Number.isFinite(externalPositionTicks) &&
        positionTicks < state.positionTicks
      ) {
        if (state.positionTicks - positionTicks < TRANSPORT_PPQ / 8) {
          // 输出延迟估计的微小抖动，不让播放头往回跳
          positionTicks = state.positionTicks;
        } else {
          // Tone Transport 已在音频时钟上完成循环
          wrapped = true;
        }
      }

      if (loopEnabled && positionTicks >= safeLoopEnd) {
        positionTicks =
          safeLoopStart +
          ((positionTicks - safeLoopStart) % (safeLoopEnd - safeLoopStart));
        wrapped = true;
        requiresSeek = true;
      } else if (positionTicks >= safeLength) {
        if (loopEnabled) {
          positionTicks %= safeLength;
          wrapped = true;
          requiresSeek = true;
        } else {
          positionTicks = safeLength;
          ended = true;
        }
      }

      set({
        positionTicks,
        lastFrameMs: ended ? null : nowMs,
        isPlaying: ended ? false : state.isPlaying,
        hasStarted: ended ? false : state.hasStarted,
        isRecording: ended ? false : state.isRecording,
      });
      return { positionTicks, ended, wrapped, requiresSeek };
    },
  })
);
