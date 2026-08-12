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
  isRecording: boolean;
  positionTicks: number;
  lastFrameMs: number | null;
  play: () => void;
  stop: () => void;
  setRecording: (recording: boolean) => void;
  seek: (positionTicks: number) => void;
  advance: (
    nowMs: number,
    bpm: number,
    lengthTicks: number,
    loopEnabled: boolean
  ) => AdvanceResult;
}

export const useTransportRuntimeStore = create<TransportRuntimeState>(
  (set, get) => ({
    isPlaying: false,
    isRecording: false,
    positionTicks: 0,
    lastFrameMs: null,

    play: () => set({ isPlaying: true, lastFrameMs: null }),

    stop: () =>
      set({
        isPlaying: false,
        isRecording: false,
        positionTicks: 0,
        lastFrameMs: null,
      }),

    setRecording: (isRecording) => set({ isRecording }),

    seek: (positionTicks) =>
      set({ positionTicks: Math.max(0, positionTicks), lastFrameMs: null }),

    advance: (nowMs, bpm, lengthTicks, loopEnabled) => {
      const state = get();
      if (!state.isPlaying) {
        return {
          positionTicks: state.positionTicks,
          ended: false,
          wrapped: false,
        };
      }
      if (state.lastFrameMs === null) {
        set({ lastFrameMs: nowMs });
        return {
          positionTicks: state.positionTicks,
          ended: false,
          wrapped: false,
        };
      }

      const elapsedMs = Math.max(0, nowMs - state.lastFrameMs);
      const tickDelta = (elapsedMs / 60_000) * bpm * TRANSPORT_PPQ;
      const safeLength = Math.max(TRANSPORT_PPQ, lengthTicks);
      let positionTicks = state.positionTicks + tickDelta;
      let ended = false;
      let wrapped = false;

      if (positionTicks >= safeLength) {
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
        isRecording: ended ? false : state.isRecording,
      });
      return { positionTicks, ended, wrapped };
    },
  })
);
