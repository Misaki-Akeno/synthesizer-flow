/* eslint-disable @typescript-eslint/no-explicit-any */
import { AudioInputHandler } from '@/core/audio/AudioInputHandler';
import { AudioModuleBase } from '@/core/base/AudioModuleBase';
import {
  ModuleMetadata,
  ParameterType,
  PortType,
} from '@/core/base/ModuleBase';

/** 主总线安全限幅器，放在 Speaker 前保护监听余量。 */
export class MasterLimiterModule extends AudioModuleBase {
  public static metadata: ModuleMetadata = {
    type: 'masterlimiter',
    label: '主限幅器',
    description: '控制输入增益并限制最终峰值，保护输出和监听设备',
    category: '输出',
    iconType: 'Speaker',
  };

  private inputGain: any = null;
  private limiter: any = null;

  constructor(id: string, name = '主限幅器') {
    super(
      'masterlimiter',
      id,
      name,
      {
        inputGain: {
          type: ParameterType.NUMBER,
          value: 0,
          min: -24,
          max: 12,
          step: 0.1,
          uiOptions: { label: '输入增益', unit: 'dB' },
        },
        ceiling: {
          type: ParameterType.NUMBER,
          value: -1,
          min: -18,
          max: 0,
          step: 0.1,
          uiOptions: { label: '峰值上限', unit: 'dB' },
        },
      },
      { input: { type: PortType.AUDIO, value: null } },
      { output: { type: PortType.AUDIO, value: null } },
      true
    );
  }

  protected async initializeAudio(): Promise<void> {
    this.inputGain = new this.Tone.Gain(
      this.dbToLinear(this.getParameterValue('inputGain') as number)
    );
    this.limiter = new this.Tone.Limiter(
      this.getParameterValue('ceiling') as number
    );
    this.inputGain.connect(this.limiter);
    this.audioInputHandler = new AudioInputHandler(this.inputGain, this.Tone);
    this.updateOutput();

    this.addInternalSubscriptions([
      this.parameters.inputGain.subscribe((value) => {
        if (typeof value === 'number') {
          this.applyParameterRamp(
            this.inputGain.gain,
            this.dbToLinear(value),
            this.smoothTime
          );
        }
      }),
      this.parameters.ceiling.subscribe((value) => {
        if (typeof value === 'number') {
          this.applyParameterRamp(
            this.limiter.threshold,
            value,
            this.smoothTime
          );
        }
      }),
    ]);
  }

  private updateOutput(): void {
    if (!this.audioInputHandler || !this.limiter) return;
    this.outputPorts.output.next(
      this.isEnabled() ? this.limiter : this.audioInputHandler.getMixerOutput()
    );
  }

  protected onEnabledStateChanged(): void {
    this.updateOutput();
  }

  public dispose(): void {
    this.disposeAudioNodes([this.inputGain, this.limiter]);
    super.dispose();
  }
}
