'use client';

import { create } from 'zustand';

export interface MidiLearnTarget {
  moduleId: string;
  parameterKey: string;
  min: number;
  max: number;
  label: string;
}

interface MidiLearnState {
  target: MidiLearnTarget | null;
  start: (target: MidiLearnTarget) => void;
  cancel: () => void;
}

export const useMidiLearnStore = create<MidiLearnState>((set) => ({
  target: null,
  start: (target) => set({ target }),
  cancel: () => set({ target: null }),
}));
