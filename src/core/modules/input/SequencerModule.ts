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
import { combineLatest } from 'rxjs';
import { transportService } from '@/core/audio/TransportService';

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
  // Invalidates callbacks that Tone's look-ahead scheduler already handed to us.
  private playbackGeneration = 0;
  private legacyTimers = new Set<ReturnType<typeof setTimeout>>();
  private detachLoopListener: (() => void) | null = null;

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
      loop: {
        type: ParameterType.BOOLEAN,
        value: true,
        uiOptions: {
          label: '循环',
          describe: '片段播放到末尾后重新开始',
          hide: true,
        },
      },
      recordArmed: {
        type: ParameterType.BOOLEAN,
        value: false,
        uiOptions: {
          label: '录音待命',
          describe: '全局录音开启时，将外部 MIDI 写入此片段',
          group: '录音',
        },
      },
      quantizeStrength: {
        type: ParameterType.NUMBER,
        value: 0.75,
        min: 0,
        max: 1,
        step: 0.05,
        uiOptions: {
          label: '量化强度',
          describe: '0 保留演奏时值，1 完全吸附网格',
          group: '录音',
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
    this.bindInputToParameter('bpm', 'bpm');

    // combineLatest 只执行一次初始调度，避免四个 BehaviorSubject 在初始化时
    // 连续销毁/重建同一个 Tone.Part。
    const schedulingSubscription = combineLatest([
      this.parameters['bpm'],
      this.parameters['running'],
      this.parameters['loop'],
      this.parameters['clip'],
      this.parameters['transpose'],
    ]).subscribe(() => this.recreateSequence());

    this.addInternalSubscription(schedulingSubscription);
  }

  private getClip(): MidiClip {
    return parseMidiClipJson(this.getParameterValue('clip') as string);
  }

  private recreateSequence(): void {
    if (!isBrowser || !this.Tone) return;
    const playbackGeneration = ++this.playbackGeneration;
    this.detachLoopListener?.();
    this.detachLoopListener = null;

    if (this.sequencePart) {
      this.sequencePart.cancel?.(0);
      this.sequencePart.dispose();
      this.sequencePart = null;
    }

    this.allNotesOff();

    const running = this.getParameterValue('running') as boolean;
    if (!running) {
      transportService.stop(this.id, this.Tone);
      return;
    }

    const clip = this.getClip();
    const scheduledEvents = this.buildScheduledEvents(clip);
    if (scheduledEvents.length === 0) {
      transportService.stop(this.id, this.Tone);
      return;
    }

    this.sequencePart = new this.Tone.Part(
      (time: number, frame: ScheduledMidiFrame) => {
        if (this.isCurrentPlayback(playbackGeneration)) {
          this.scheduleFrame(frame, time);
        }
      },
      scheduledEvents.map((frame) => [frame.timeSeconds, frame])
    );

    this.sequencePart.loop = this.getParameterValue('loop') as boolean;
    this.sequencePart.loopEnd = this.ticksToSeconds(
      getClipLengthTicks(clip),
      clip
    );
    this.sequencePart.start(0);

    // 全局循环跳回起点时，在同一音频时间释放仍在发声的音符；起点上的
    // note-on 随后照常触发。跨越循环点的音符不会挂住。
    const onTransportLoop = (time: number) => {
      if (!this.isCurrentPlayback(playbackGeneration)) return;
      if (this.activeNotes.size === 0) return;
      this.applyMidiEvents([{ type: 'allNotesOff' }], time);
    };
    const transport = this.Tone.Transport;
    transport.on?.('loop', onTransportLoop);
    this.detachLoopListener = () => transport.off?.('loop', onTransportLoop);

    transportService.start(this.id, this.Tone);
  }

  /** 禁用的片段保持与 Transport 同步运行，但不输出任何 MIDI。 */
  private isCurrentPlayback(playbackGeneration: number): boolean {
    return (
      playbackGeneration === this.playbackGeneration &&
      !this.isDisposed() &&
      this.isEnabled()
    );
  }

  protected onEnabledStateChanged(enabled: boolean): void {
    // 基类构造期间就会回调，此时子类字段尚未初始化
    if (enabled || !this.activeNotes) return;
    // 释放正在发声以及预调度窗口内即将发声的音符
    this.allNotesOff();
  }

  private buildScheduledEvents(clip: MidiClip): ScheduledMidiFrame[] {
    const events: MidiEvent[] = [];
    const transpose = this.getParameterValue('transpose') as number;
    const loop = this.getParameterValue('loop') as boolean;
    const clipLengthTicks = getClipLengthTicks(clip);
    if (clipLengthTicks <= 0) return [];

    clip.notes.forEach((note) => {
      // 片段外的内容不播放：起点在末尾之后的音符跳过，跨越末尾的音符在末尾截断，
      // 保证每个 note-on 都有同一轮内的 note-off。
      if (note.startTick >= clipLengthTicks) return;
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
        tick: Math.min(note.startTick + note.durationTicks, clipLengthTicks),
      });
    });

    events.push(...clip.events);

    const eventsByTick = new Map<number, MidiEvent[]>();

    events
      .filter((event) => typeof event.tick === 'number')
      // 不循环时 Part 只播放一遍：末尾的 note-off 必须留在末尾，不能折回开头
      .filter((event) => loop || (event.tick ?? 0) <= clipLengthTicks)
      .forEach((event) => {
        const tick = loop
          ? this.getLoopedEventTick(event.tick ?? 0, clipLengthTicks)
          : Math.max(0, Math.round(event.tick ?? 0));
        const normalizedEvent = { ...event, tick };
        const tickEvents = eventsByTick.get(tick) ?? [];
        tickEvents.push(normalizedEvent);
        eventsByTick.set(tick, tickEvents);
      });

    return Array.from(eventsByTick.entries())
      .map(([tick, tickEvents]) => ({
        tick,
        timeSeconds: this.ticksToSeconds(tick, clip),
        events: tickEvents.sort(
          (a, b) => this.getEventPriority(a) - this.getEventPriority(b)
        ),
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
    // Part callbacks run on Tone's look-ahead scheduler. Audio consumers receive the
    // AudioContext timestamp and must schedule their envelopes with it; Draw is only
    // appropriate for DOM work and would add a frame of MIDI jitter here.
    this.applyMidiEvents(frame.events, time);
  }

  private applyMidiEvents(events: MidiEvent[], scheduledTime?: number): void {
    events.forEach((event) => this.applyMidiEvent(event));
    this.updateOutputPorts(events, scheduledTime);
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

    if (event.type === 'controlChange') return;

    this.applyExpressionEvent(event);
  }

  private applyExpressionEvent(
    event: Extract<MidiEvent, { type: 'pitchBend' | 'pressure' | 'timbre' }>
  ): void {
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
    this.legacyTimers.forEach((timer) => clearTimeout(timer));
    this.legacyTimers.clear();
    this.activeNotes.clear();
    this.updateOutputPorts([{ type: 'allNotesOff' }]);
  }

  private updateOutputPorts(events: MidiEvent[] = [], scheduledTime?: number): void {
    const frame = createMidiFrame(
      Array.from(this.activeNotes.values()),
      events,
      scheduledTime
    );
    this.setOutputValueAtTime('midi', frame, scheduledTime);

    // MIDI 消费者可使用音频时间戳提前调度。旧版 NUMBER/ARRAY 消费者可能
    // 忽略时间戳，因此必须到实际播放时间再发布旧端口值。
    if (scheduledTime === undefined) {
      this.updateLegacyOutputPorts(frame);
      return;
    }
    const generation = this.playbackGeneration;
    const publish = () => {
      if (generation !== this.playbackGeneration || this.isDisposed()) return;
      const now = this.Tone.immediate?.() ?? this.Tone.now?.() ?? 0;
      const remaining = scheduledTime - now;
      if (remaining <= 0) {
        this.updateLegacyOutputPorts(frame);
        return;
      }
      const timer = setTimeout(() => {
        this.legacyTimers.delete(timer);
        publish();
      }, Math.max(1, Math.ceil(remaining * 1000)));
      this.legacyTimers.add(timer);
    };
    publish();
  }

  private updateLegacyOutputPorts(frame: ReturnType<typeof createMidiFrame>): void {
    const legacy = midiFrameToLegacyArrays(frame);
    this.setOutputValueAtTime('activeNotes', legacy.notes, frame.scheduledTime);
    this.setOutputValueAtTime(
      'activeVelocities',
      legacy.velocities,
      frame.scheduledTime
    );

    if (legacy.notes.length > 0) {
      const lastNoteMidi = legacy.notes[legacy.notes.length - 1];
      if (this.outputPorts['frequency']) {
        this.setOutputValueAtTime(
          'frequency',
          this.Tone.Frequency(lastNoteMidi, 'midi').toFrequency(),
          frame.scheduledTime
        );
      }
      if (this.outputPorts['gate']) {
        this.setOutputValueAtTime('gate', 1, frame.scheduledTime);
      }
    } else if (this.outputPorts['gate']) {
      this.setOutputValueAtTime('gate', 0, frame.scheduledTime);
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
    this.playbackGeneration += 1;
    this.detachLoopListener?.();
    this.detachLoopListener = null;
    this.allNotesOff();
    if (this.sequencePart) {
      this.sequencePart.cancel?.(0);
      this.sequencePart.dispose();
      this.sequencePart = null;
    }
    transportService.stop(this.id, this.Tone);
    super.dispose();
  }

  protected cleanupFailedAudioInitialization(): void {
    this.playbackGeneration += 1;
    this.detachLoopListener?.();
    this.detachLoopListener = null;
    this.legacyTimers.forEach((timer) => clearTimeout(timer));
    this.legacyTimers.clear();
    this.sequencePart?.cancel?.(0);
    this.sequencePart?.dispose?.();
    this.sequencePart = null;
    this.activeNotes.clear();
    transportService.stop(this.id, this.Tone);
    super.cleanupFailedAudioInitialization();
  }
}
