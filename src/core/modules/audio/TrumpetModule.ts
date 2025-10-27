/* eslint-disable @typescript-eslint/no-explicit-any */
import { AudioModuleBase } from '@/core/base/AudioModuleBase';
import {
  ModuleMetadata,
  ParameterType,
  PortType,
} from '@/core/base/ModuleBase';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function midiToFrequency(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

export class TrumpetModule extends AudioModuleBase {
  public static metadata: ModuleMetadata = {
    type: 'trumpet',
    label: '小号合成器',
    description: '模拟小号音色的单音合成模块，带有滑音和表现力控制',
    category: '信号源',
    iconType: 'Music',
  };

  private monoSynth: any = null;
  private brightnessFilter: any = null;
  private vibrato: any = null;
  private toneShaper: any = null;
  private expressionGain: any = null;
  private outputGain: any = null;
  private dynamicsCompressor: any = null;
  private levelLinear: number = 0.5;
  private currentNote: number | null = null;
  private currentVelocity: number = 0.8;

  constructor(id: string, name: string = '小号合成器') {
    const moduleType = 'trumpet';
    const parameters = {
      level: {
        type: ParameterType.NUMBER,
        value: -10,
        min: -48,
        max: 0,
        step: 0.5,
        uiOptions: {
          label: '输出电平',
          describe: '控制整体输出音量，单位为分贝(dB)',
        },
      },
      attack: {
        type: ParameterType.NUMBER,
        value: 0.04,
        min: 0.005,
        max: 1,
        step: 0.001,
        uiOptions: {
          label: '起音时间',
          describe: '控制音符的起音速度，较大的值会得到更柔和的起音',
          group: '包络',
          log: true,
        },
      },
      sustain: {
        type: ParameterType.NUMBER,
        value: 0.65,
        min: 0.1,
        max: 1,
        step: 0.01,
        uiOptions: {
          label: '持续音量',
          describe: '控制音符在按下期间的音量水平',
          group: '包络',
        },
      },
      release: {
        type: ParameterType.NUMBER,
        value: 0.45,
        min: 0.05,
        max: 2.5,
        step: 0.01,
        uiOptions: {
          label: '释音时间',
          describe: '控制松键后声音的衰减时间',
          group: '包络',
          log: true,
        },
      },
      brightness: {
        type: ParameterType.NUMBER,
        value: 0.6,
        min: 0,
        max: 1,
        step: 0.01,
        uiOptions: {
          label: '明亮度',
          describe: '控制音色的明亮程度，相当于调整小号的口型',
          group: '音色',
        },
      },
      vibratoRate: {
        type: ParameterType.NUMBER,
        value: 5.5,
        min: 0.1,
        max: 10,
        step: 0.1,
        uiOptions: {
          label: '颤音速率',
          describe: '控制颤音的速度',
          group: '表现力',
        },
      },
      vibratoDepth: {
        type: ParameterType.NUMBER,
        value: 0.08,
        min: 0,
        max: 0.5,
        step: 0.01,
        uiOptions: {
          label: '颤音深度',
          describe: '控制颤音的幅度',
          group: '表现力',
        },
      },
      portamento: {
        type: ParameterType.NUMBER,
        value: 0.08,
        min: 0,
        max: 0.6,
        step: 0.01,
        uiOptions: {
          group: '表现力',
          label: '滑音时间',
          describe: '控制从一个音符滑向下一个音符所需的时间',
        },
      },
    };

    const inputPorts = {
      notes: {
        type: PortType.ARRAY,
        value: [],
      },
      velocities: {
        type: PortType.ARRAY,
        value: [],
      },
      expression: {
        type: PortType.NUMBER,
        value: 1,
      },
    };

    const outputPorts = {
      audioout: {
        type: PortType.AUDIO,
        value: null,
      },
    };

    super(moduleType, id, name, parameters, inputPorts, outputPorts, true);

    this.setCustomUI('ModuleCard', {
      title: '小号合成器',
      description: '提供具有铜管质感的虚拟小号音色',
    });
  }

  protected async initializeAudio(): Promise<void> {
    this.levelLinear = this.dbToLinear(this.getParameterValue('level') as number);

    this.monoSynth = new this.Tone.MonoSynth({
      oscillator: {
        type: 'custom',
        partials: [1, 0.65, 0.35, 0.22, 0.12, 0.08],
        phase: 20,
      },
      envelope: {
        attack: this.getParameterValue('attack') as number,
        decay: 0.25,
        sustain: this.getParameterValue('sustain') as number,
        release: this.getParameterValue('release') as number,
      },
      filter: {
        type: 'lowpass',
        Q: 1.2,
        rolloff: -24,
      },
      filterEnvelope: {
        attack: 0.005,
        decay: 0.35,
        sustain: 0.2,
        release: 1.4,
        baseFrequency: 260,
        octaves: 4.5,
      },
      portamento: this.getParameterValue('portamento') as number,
    });

    this.vibrato = new this.Tone.Vibrato(
      this.getParameterValue('vibratoRate') as number,
      this.getParameterValue('vibratoDepth') as number
    );

    this.toneShaper = new this.Tone.WaveShaper((value: number) => {
      return Math.tanh(value * 1.6);
    });

    this.brightnessFilter = new this.Tone.Filter(
      this.getBrightnessFrequency(this.getParameterValue('brightness') as number),
      'lowpass',
      -12
    );
    this.brightnessFilter.Q.value = 1.4;

    this.dynamicsCompressor = new this.Tone.Compressor({
      threshold: -18,
      ratio: 3,
      attack: 0.01,
      release: 0.2,
    });

    this.expressionGain = new this.Tone.Gain(1);
    this.outputGain = new this.Tone.Gain(this.levelLinear);

    this.monoSynth.chain(
      this.vibrato,
      this.toneShaper,
      this.brightnessFilter,
      this.dynamicsCompressor,
      this.expressionGain,
      this.outputGain
    );

    this.outputPorts['audioout'].next(this.outputGain);

    this.setupInputBindings();
    this.setupParameterBindings();
  }

  protected onEnabledStateChanged(enabled: boolean): void {
    if (!this.outputGain) return;

    const target = enabled ? this.levelLinear : 0;
    this.applyParameterRamp(this.outputGain.gain, target, 0.05);

    if (!enabled) {
      this.releaseAllNotes();
    }
  }

  private setupInputBindings(): void {
    const notesSubscription = this.inputPorts['notes'].subscribe((value: any) => {
      if (Array.isArray(value)) {
        const velocities = this.inputPorts['velocities'].getValue();
        this.handleNoteInput(value, Array.isArray(velocities) ? velocities : []);
      }
    });

    const velocitySubscription = this.inputPorts['velocities'].subscribe(
      (value: any) => {
        if (Array.isArray(value)) {
          const notes = this.inputPorts['notes'].getValue();
          if (Array.isArray(notes)) {
            this.handleNoteInput(notes, value);
          }
        }
      }
    );

    const expressionSubscription = this.inputPorts['expression'].subscribe(
      (value: any) => {
        if (typeof value === 'number' && this.expressionGain) {
          const clamped = clamp(value, 0, 2);
          this.applyParameterRamp(this.expressionGain.gain, clamped, 0.05);
        }
      }
    );

    this.addInternalSubscriptions([
      notesSubscription,
      velocitySubscription,
      expressionSubscription,
    ]);
  }

  private setupParameterBindings(): void {
    const levelSubscription = this.parameters['level'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') {
          this.levelLinear = this.dbToLinear(value);
          if (this.outputGain) {
            const target = this.isEnabled() ? this.levelLinear : 0;
            this.applyParameterRamp(this.outputGain.gain, target, 0.05);
          }
        }
      }
    );

    const attackSubscription = this.parameters['attack'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') {
          this.updateEnvelope();
        }
      }
    );

    const sustainSubscription = this.parameters['sustain'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') {
          this.updateEnvelope();
        }
      }
    );

    const releaseSubscription = this.parameters['release'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') {
          this.updateEnvelope();
        }
      }
    );

    const brightnessSubscription = this.parameters['brightness'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number' && this.brightnessFilter) {
          const freq = this.getBrightnessFrequency(value);
          this.applyParameterRamp(this.brightnessFilter.frequency, freq, 0.1);
          if (this.monoSynth) {
            this.monoSynth.set({
              filterEnvelope: {
                baseFrequency: Math.max(180, freq * 0.55),
              },
            });
          }
        }
      }
    );

    const vibratoRateSubscription = this.parameters['vibratoRate'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number' && this.vibrato) {
          this.vibrato.frequency.value = value;
        }
      }
    );

    const vibratoDepthSubscription = this.parameters['vibratoDepth'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number' && this.vibrato) {
          if (this.vibrato.depth && this.vibrato.depth.value !== undefined) {
            this.vibrato.depth.value = value;
          }
        }
      }
    );

    const portamentoSubscription = this.parameters['portamento'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number' && this.monoSynth) {
          this.monoSynth.portamento = Math.max(0, value);
        }
      }
    );

    this.addInternalSubscriptions([
      levelSubscription,
      attackSubscription,
      sustainSubscription,
      releaseSubscription,
      brightnessSubscription,
      vibratoRateSubscription,
      vibratoDepthSubscription,
      portamentoSubscription,
    ]);
  }

  private handleNoteInput(notes: any[], velocities: any[]): void {
    if (!this.monoSynth) return;

    let targetNote: number | null = null;
    let velocity = 0.85;

    for (let index = notes.length - 1; index >= 0; index -= 1) {
      const noteValue = notes[index];
      if (typeof noteValue === 'number') {
        targetNote = noteValue;
        const velocityRaw = velocities[index];
        velocity =
          typeof velocityRaw === 'number' ? clamp(velocityRaw, 0, 1) : 0.85;
        break;
      }
    }

    if (targetNote === null) {
      this.releaseAllNotes();
      return;
    }

    this.triggerAttack(targetNote, velocity);
  }

  private triggerAttack(note: number, velocity: number): void {
    if (!this.monoSynth) return;

    const frequency = midiToFrequency(note);

    if (this.currentNote === note) {
      if (Math.abs(this.currentVelocity - velocity) > 0.02) {
        this.monoSynth.envelope.triggerAttack(undefined, velocity);
      }
      this.currentVelocity = velocity;
      return;
    }

    if (this.currentNote === null) {
      this.monoSynth.triggerAttack(frequency, undefined, velocity);
    } else {
      const now = this.Tone.now();
      const portamentoTime = Math.max(this.monoSynth.portamento ?? 0, 0);
      if (portamentoTime > 0) {
        this.monoSynth.frequency.rampTo(frequency, portamentoTime);
      } else {
        this.monoSynth.frequency.setValueAtTime(frequency, now);
      }
      this.monoSynth.envelope.triggerAttack(now, velocity);
    }

    this.currentNote = note;
    this.currentVelocity = velocity;
  }

  private triggerRelease(note: number): void {
    if (!this.monoSynth) return;

    if (this.currentNote === note) {
      this.monoSynth.triggerRelease(this.Tone.now());
      this.currentNote = null;
      this.currentVelocity = 0.8;
    }
  }

  private releaseAllNotes(): void {
    if (!this.monoSynth) return;

    this.monoSynth.triggerRelease(this.Tone.now());
    this.currentNote = null;
    this.currentVelocity = 0.8;
  }

  private updateEnvelope(): void {
    if (!this.monoSynth) return;

    this.monoSynth.set({
      envelope: {
        attack: this.getParameterValue('attack') as number,
        decay: 0.22,
        sustain: this.getParameterValue('sustain') as number,
        release: this.getParameterValue('release') as number,
      },
    });
  }

  private getBrightnessFrequency(amount: number): number {
    const min = 450;
    const max = 4200;
    return min + (max - min) * clamp(amount, 0, 1);
  }
}
