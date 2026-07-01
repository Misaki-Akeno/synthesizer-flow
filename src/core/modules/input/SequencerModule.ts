'use client';

import { AudioModuleBase } from '@/core/base/AudioModuleBase';
import {
  ModuleMetadata,
  ParameterType,
  PortType,
} from '@/core/base/ModuleBase';
import {
  createMidiFrame,
  getClipLengthTicks,
  midiFrameToLegacyArrays,
  normalizeMidiClip,
  parseMidiClipJson,
} from '@/core/midi/utils';
import { MidiActiveNote, MidiClip, MidiEvent } from '@/core/midi/types';

const isBrowser = typeof window !== 'undefined';

type ScheduledMidiFrame = {
  tick: number;
  timeSeconds: number;
  events: MidiEvent[];
};

export class SequencerModule extends AudioModuleBase {
  public static metadata: ModuleMetadata = {
    type: 'sequencer',
    label: 'MIDI Clip',
    description: '播放可编辑的MIDI/MPE片段，支持复音与表达控制',
    category: '输入',
    iconType: 'ListMusic',
  };

  private activeNotes: Map<string, MidiActiveNote> = new Map();
  private sequencePart: any = null;

  constructor(id: string, name: string = 'MIDI Clip') {
    const moduleType = 'sequencer';
    const parameters = {
      bpm: {
        type: ParameterType.NUMBER,
        value: 120,
        min: 40,
        max: 240,
        step: 1,
        uiOptions: {
          label: 'BPM',
          describe: '播放速度 (每分钟拍数)',
        },
      },
      running: {
        type: ParameterType.BOOLEAN,
        value: false,
        uiOptions: {
          label: '播放中',
          describe: '开始或停止片段播放',
          hide: true,
        },
      },
      clip: {
        type: ParameterType.STRING,
        value: JSON.stringify(normalizeMidiClip(undefined)),
        uiOptions: {
          label: 'MIDI Clip',
          hide: true,
        },
      },
      transpose: {
        type: ParameterType.NUMBER,
        value: 0,
        min: -24,
        max: 24,
        step: 1,
        uiOptions: {
          label: '全局转置',
          describe: '调整输出音高',
        },
      },
    };

    const outputPorts = {
      midi: {
        type: PortType.MIDI,
        value: createMidiFrame(),
      },
      activeNotes: {
        type: PortType.ARRAY,
        value: [],
      },
      activeVelocities: {
        type: PortType.ARRAY,
        value: [],
      },
      frequency: {
        type: PortType.NUMBER,
        value: 0,
      },
      gate: {
        type: PortType.NUMBER,
        value: 0,
      },
    };

    const inputPorts = {
      bpm: {
        type: PortType.NUMBER,
        value: 120,
      },
    };

    super(moduleType, id, name, parameters, inputPorts, outputPorts, true);
  }

  protected async initializeAudio(): Promise<void> {
    if (!isBrowser) return;

    this.setupParameterBindings();
    this.recreateSequence();
  }

  private setupParameterBindings(): void {
    const bpmSubscription = this.parameters['bpm'].subscribe((value) => {
      if (typeof value === 'number') {
        this.Tone.Transport.bpm.value = value;
        this.recreateSequence();
      }
    });

    this.bindInputToParameter('bpm', 'bpm');

    const runningSubscription = this.parameters['running'].subscribe((value) => {
      if (typeof value !== 'boolean') return;

      if (value && this.Tone.Transport.state !== 'started') {
        this.Tone.Transport.start();
      }

      if (!value) {
        this.allNotesOff();
      }

      this.recreateSequence();
    });

    const clipSubscription = this.parameters['clip'].subscribe(() => {
      this.recreateSequence();
    });

    const transposeSubscription = this.parameters['transpose'].subscribe(() => {
      this.recreateSequence();
    });

    this.addInternalSubscriptions([
      bpmSubscription,
      runningSubscription,
      clipSubscription,
      transposeSubscription,
    ]);
  }

  private getClip(): MidiClip {
    return parseMidiClipJson(this.getParameterValue('clip') as string);
  }

  private recreateSequence(): void {
    if (!isBrowser || !this.Tone) return;

    if (this.sequencePart) {
      this.sequencePart.dispose();
      this.sequencePart = null;
    }

    this.allNotesOff();

    const running = this.getParameterValue('running') as boolean;
    if (!running) return;

    const clip = this.getClip();
    const scheduledEvents = this.buildScheduledEvents(clip);
    if (scheduledEvents.length === 0) return;

    this.sequencePart = new this.Tone.Part((time: number, frame: ScheduledMidiFrame) => {
      this.scheduleFrame(frame, time);
    }, scheduledEvents.map((frame) => [frame.timeSeconds, frame]));

    this.sequencePart.loop = true;
    this.sequencePart.loopEnd = this.ticksToSeconds(getClipLengthTicks(clip), clip);
    this.sequencePart.start(0);

    if (this.Tone.Transport.state !== 'started') {
      this.Tone.Transport.start();
    }
  }

  private buildScheduledEvents(clip: MidiClip): ScheduledMidiFrame[] {
    const events: MidiEvent[] = [];
    const transpose = this.getParameterValue('transpose') as number;
    const clipLengthTicks = getClipLengthTicks(clip);

    clip.notes.forEach((note) => {
      const midi = Math.max(0, Math.min(127, note.midi + transpose));
      events.push({
        type: 'noteOn',
        noteId: note.id,
        midi,
        velocity: note.velocity,
        channel: note.channel,
        pitchBend: note.pitchBend,
        pressure: note.pressure,
        timbre: note.timbre,
        tick: note.startTick,
      });
      events.push({
        type: 'noteOff',
        noteId: note.id,
        midi,
        channel: note.channel,
        tick: note.startTick + note.durationTicks,
      });
    });

    events.push(...clip.events);

    const eventsByTick = new Map<number, MidiEvent[]>();

    events
      .filter((event) => typeof event.tick === 'number')
      .forEach((event) => {
        const tick = this.getLoopedEventTick(event.tick ?? 0, clipLengthTicks);
        const normalizedEvent = { ...event, tick };
        const tickEvents = eventsByTick.get(tick) ?? [];
        tickEvents.push(normalizedEvent);
        eventsByTick.set(tick, tickEvents);
      });

    return Array.from(eventsByTick.entries())
      .map(([tick, tickEvents]) => ({
        tick,
        timeSeconds: this.ticksToSeconds(tick, clip),
        events: tickEvents.sort((a, b) => this.getEventPriority(a) - this.getEventPriority(b)),
      }))
      .sort((a, b) => a.timeSeconds - b.timeSeconds);
  }

  private getLoopedEventTick(tick: number, clipLengthTicks: number): number {
    if (clipLengthTicks <= 0) return 0;
    const roundedTick = Math.max(0, Math.round(tick));
    return roundedTick % clipLengthTicks;
  }

  private getEventPriority(event: MidiEvent): number {
    if (event.type === 'allNotesOff') return 0;
    if (event.type === 'noteOff') return 1;
    if (event.type === 'noteOn') return 2;
    return 3;
  }

  private ticksToSeconds(ticks: number, clip: MidiClip): number {
    const bpm = this.getParameterValue('bpm') as number;
    return (ticks / clip.ppq) * (60 / bpm);
  }

  private scheduleFrame(frame: ScheduledMidiFrame, time: number): void {
    this.Tone.Draw.schedule(() => {
      this.applyMidiEvents(frame.events);
    }, time);
  }

  private applyMidiEvents(events: MidiEvent[]): void {
    events.forEach((event) => this.applyMidiEvent(event));
    this.updateOutputPorts(events);
  }

  private applyMidiEvent(event: MidiEvent): void {
    if (event.type === 'noteOn') {
      this.activeNotes.set(event.noteId, {
        id: event.noteId,
        midi: event.midi,
        velocity: event.velocity,
        channel: event.channel,
        pitchBend: event.pitchBend ?? 0,
        pressure: event.pressure ?? 0,
        timbre: event.timbre ?? 0,
        source: this.id,
      });
      return;
    }

    if (event.type === 'noteOff') {
      this.activeNotes.delete(event.noteId);
      return;
    }

    if (event.type === 'allNotesOff') {
      this.activeNotes.clear();
      return;
    }

    this.applyExpressionEvent(event);
  }

  private applyExpressionEvent(event: Extract<MidiEvent, { type: 'pitchBend' | 'pressure' | 'timbre' }>): void {
    this.activeNotes.forEach((note) => {
      const matchesNote = event.noteId && note.id === event.noteId;
      const matchesChannel = event.channel && note.channel === event.channel;
      if (!matchesNote && !matchesChannel) return;

      if (event.type === 'pitchBend') {
        note.pitchBend = event.value;
      } else if (event.type === 'pressure') {
        note.pressure = event.value;
      } else {
        note.timbre = event.value;
      }
    });
  }

  private allNotesOff(): void {
    this.activeNotes.clear();
    this.updateOutputPorts([{ type: 'allNotesOff' }]);
  }

  private updateOutputPorts(events: MidiEvent[] = []): void {
    const frame = createMidiFrame(Array.from(this.activeNotes.values()), events);
    this.outputPorts['midi'].next(frame);

    const legacy = midiFrameToLegacyArrays(frame);
    this.outputPorts['activeNotes'].next(legacy.notes);
    this.outputPorts['activeVelocities'].next(legacy.velocities);

    if (legacy.notes.length > 0) {
      const lastNoteMidi = legacy.notes[legacy.notes.length - 1];
      if (this.outputPorts['frequency']) {
        this.outputPorts['frequency'].next(this.Tone.Frequency(lastNoteMidi, 'midi').toFrequency());
      }
      if (this.outputPorts['gate']) this.outputPorts['gate'].next(1);
    } else if (this.outputPorts['gate']) {
      this.outputPorts['gate'].next(0);
    }
  }

  public getCustomUI() {
    return {
      type: 'SequenceEditor',
      props: {
        clipParam: 'clip',
        bpmParam: 'bpm',
        runningParam: 'running',
      },
    };
  }

  public dispose(): void {
    if (this.sequencePart) {
      this.sequencePart.dispose();
    }
    super.dispose();
  }
}
