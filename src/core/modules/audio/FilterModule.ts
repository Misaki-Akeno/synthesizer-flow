/* eslint-disable @typescript-eslint/no-explicit-any */
import { AudioInputHandler } from '@/core/audio/AudioInputHandler';
import { AudioModuleBase } from '@/core/base/AudioModuleBase';
import {
  ModuleMetadata,
  ParameterType,
  PortType,
} from '@/core/base/ModuleBase';

export class FilterModule extends AudioModuleBase {
  public static metadata: ModuleMetadata = {
    type: 'filter',
    label: '多模式滤波器',
    description: '带截止频率调制的低通、高通、带通与陷波滤波器',
    category: '音频处理',
    iconType: 'Sliders',
  };

  private filter: any = null;

  constructor(id: string, name = '多模式滤波器') {
    super(
      'filter',
      id,
      name,
      {
        cutoff: {
          type: ParameterType.NUMBER,
          value: 1200,
          min: 20,
          max: 20000,
          step: 1,
          uiOptions: { label: '截止频率', unit: 'Hz' },
        },
        resonance: {
          type: ParameterType.NUMBER,
          value: 1,
          min: 0,
          max: 20,
          step: 0.1,
          uiOptions: { label: '共振', describe: '截止频率附近的峰值' },
        },
        type: {
          type: ParameterType.LIST,
          value: 'lowpass',
          options: ['lowpass', 'highpass', 'bandpass', 'notch'],
          uiOptions: { label: '模式' },
        },
        modulationOctaves: {
          type: ParameterType.NUMBER,
          value: 2,
          min: -6,
          max: 6,
          step: 0.1,
          uiOptions: { label: '调制八度', describe: 'cutoffMod 的频率跨度' },
        },
      },
      {
        input: { type: PortType.AUDIO, value: null },
        cutoffMod: { type: PortType.NUMBER, value: 0.5 },
      },
      { output: { type: PortType.AUDIO, value: null } },
      true
    );
  }

  protected async initializeAudio(): Promise<void> {
    this.filter = new this.Tone.Filter({
      frequency: this.getParameterValue('cutoff'),
      Q: this.getParameterValue('resonance'),
      type: this.getParameterValue('type'),
      rolloff: -24,
    });
    this.audioInputHandler = new AudioInputHandler(this.filter, this.Tone);
    this.updateOutput();

    const updateFrequency = () => {
      const base = this.getParameterValue('cutoff') as number;
      const octaves = this.getParameterValue('modulationOctaves') as number;
      const raw = this.inputPorts.cutoffMod.getValue();
      const modulation = typeof raw === 'number' ? raw * 2 - 1 : 0;
      const frequency = Math.max(
        20,
        Math.min(20000, base * 2 ** (modulation * octaves))
      );
      this.applyParameterRamp(
        this.filter.frequency,
        frequency,
        this.smoothTime
      );
    };
    const updateQ = (value: number | boolean | string) => {
      if (typeof value === 'number')
        this.applyParameterRamp(this.filter.Q, value, this.smoothTime);
    };
    const updateType = (value: number | boolean | string) => {
      if (typeof value === 'string') this.filter.type = value;
    };
    this.addInternalSubscriptions([
      this.parameters.cutoff.subscribe(updateFrequency),
      this.parameters.modulationOctaves.subscribe(updateFrequency),
      this.inputPorts.cutoffMod.subscribe(updateFrequency),
      this.parameters.resonance.subscribe(updateQ),
      this.parameters.type.subscribe(updateType),
    ]);
  }

  private updateOutput(): void {
    if (!this.audioInputHandler || !this.filter) return;
    this.outputPorts.output.next(
      this.isEnabled() ? this.filter : this.audioInputHandler.getMixerOutput()
    );
  }

  protected onEnabledStateChanged(): void {
    this.updateOutput();
  }

  public dispose(): void {
    this.disposeAudioNodes([this.filter]);
    super.dispose();
  }
}
