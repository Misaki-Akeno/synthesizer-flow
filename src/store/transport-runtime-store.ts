'use client';

import { create } from 'zustand';
import { TRANSPORT_PPQ } from '@/core/transport/types';

interface AdvanceResult {
  positionTicks: number;
  ended: boolean;
  wrapped: boolean;
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
        };
      }

      const elapsedMs = Math.max(0, nowMs - state.lastFrameMs);
      const tickDelta = (elapsedMs / 60_000) * bpm * TRANSPORT_PPQ;
      const safeLength = Math.max(TRANSPORT_PPQ, lengthTicks);
      const safeLoopStart = Math.max(
        0,
        Math.min(loopStartTick, safeLength - TRANSPORT_PPQ)
      );
      const safeLoopEnd = Math.max(
        safeLoopStart + TRANSPORT_PPQ,
        Math.min(loopEndTick, safeLength)
      );
      let positionTicks = Number.isFinite(externalPositionTicks)
        ? (externalPositionTicks as number)
        : state.positionTicks + tickDelta;
      let ended = false;
      let wrapped = false;

      if (loopEnabled && positionTicks >= safeLoopEnd) {
        positionTicks =
          safeLoopStart +
          ((positionTicks - safeLoopStart) % (safeLoopEnd - safeLoopStart));
        wrapped = true;
      } else if (positionTicks >= safeLength) {
        if (loopEnabled) {
          positionTicks %= safeLength;
          wrapped = true;
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
      return { positionTicks, ended, wrapped };
    },
  })
);
