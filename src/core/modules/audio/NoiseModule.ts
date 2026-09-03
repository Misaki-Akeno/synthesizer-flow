/* eslint-disable @typescript-eslint/no-explicit-any */
import { AudioModuleBase } from '@/core/base/AudioModuleBase';
import {
  ModuleMetadata,
  ParameterType,
  PortType,
} from '@/core/base/ModuleBase';

export class NoiseModule extends AudioModuleBase {
  public static metadata: ModuleMetadata = {
    type: 'noise',
    label: '噪声发生器',
    description: '生成白、粉红或棕色噪声，用于打击乐、风声和纹理',
    category: '信号源',
    iconType: 'Waves',
  };

  private noise: any = null;
  private outputGain: any = null;

  constructor(id: string, name = '噪声发生器') {
    super(
      'noise',
      id,
      name,
      {
        type: {
          type: ParameterType.LIST,
          value: 'pink',
          options: ['white', 'pink', 'brown'],
          uiOptions: { label: '噪声颜色' },
        },
        level: {
          type: ParameterType.NUMBER,
          value: -24,
          min: -60,
          max: 0,
          step: 0.1,
          uiOptions: { label: '电平', unit: 'dB' },
        },
        playbackRate: {
          type: ParameterType.NUMBER,
          value: 1,
          min: 0.1,
          max: 4,
          step: 0.01,
          uiOptions: { label: '播放速率' },
        },
      },
      {},
      { output: { type: PortType.AUDIO, value: null } },
      true
    );
  }

  protected async initializeAudio(): Promise<void> {
    this.noise = new this.Tone.Noise({
      type: this.getParameterValue('type'),
      playbackRate: this.getParameterValue('playbackRate'),
    });
    this.outputGain = new this.Tone.Gain(
      this.dbToLinear(this.getParameterValue('level') as number)
    );
    this.noise.connect(this.outputGain);
    this.outputPorts.output.next(this.outputGain);
    if (this.isEnabled()) this.noise.start();

    this.addInternalSubscriptions([
      this.parameters.type.subscribe((value) => {
        if (typeof value === 'string' && this.noise) this.noise.type = value;
      }),
      this.parameters.level.subscribe((value) => {
        if (typeof value === 'number' && this.outputGain) {
          this.applyParameterRamp(
            this.outputGain.gain,
            this.dbToLinear(value),
            this.smoothTime
          );
        }
      }),
      this.parameters.playbackRate.subscribe((value) => {
        if (typeof value === 'number' && this.noise) {
          this.noise.playbackRate = value;
        }
      }),
    ]);
  }

  protected onEnabledStateChanged(enabled: boolean): void {
    if (!this.noise) return;
    if (enabled && this.noise.state !== 'started') this.noise.start();
    if (!enabled && this.noise.state === 'started') this.noise.stop();
  }

  public dispose(): void {
    this.disposeAudioNodes([this.noise, this.outputGain]);
    super.dispose();
  }
}
