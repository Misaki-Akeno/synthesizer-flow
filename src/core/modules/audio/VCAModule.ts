/* eslint-disable @typescript-eslint/no-explicit-any */
import { AudioInputHandler } from '@/core/audio/AudioInputHandler';
import { AudioModuleBase } from '@/core/base/AudioModuleBase';
import {
  ModuleMetadata,
  ParameterType,
  PortType,
} from '@/core/base/ModuleBase';

/** 电压控制放大器：把音频振幅与 0..1 控制信号相乘。 */
export class VCAModule extends AudioModuleBase {
  public static metadata: ModuleMetadata = {
    type: 'vca',
    label: 'VCA 放大器',
    description: '使用包络或控制信号塑造音频振幅',
    category: '音频处理',
    iconType: 'Sliders',
  };

  private gainNode: any = null;

  constructor(id: string, name = 'VCA 放大器') {
    super(
      'vca',
      id,
      name,
      {
        gain: {
          type: ParameterType.NUMBER,
          value: 1,
          min: 0,
          max: 1,
          step: 0.01,
          uiOptions: { label: '增益', describe: '基础线性增益' },
        },
        cvAmount: {
          type: ParameterType.NUMBER,
          value: 1,
          min: 0,
          max: 1,
          step: 0.01,
          uiOptions: { label: 'CV 深度', describe: '控制信号影响强度' },
        },
      },
      {
        input: { type: PortType.AUDIO, value: null },
        cv: { type: PortType.NUMBER, value: 1 },
      },
      { output: { type: PortType.AUDIO, value: null } },
      true
    );
  }

  protected async initializeAudio(): Promise<void> {
    this.gainNode = new this.Tone.Gain(1);
    this.audioInputHandler = new AudioInputHandler(this.gainNode, this.Tone);
    this.outputPorts.output.next(this.gainNode);

    const updateGain = () => this.updateGain();

    this.addInternalSubscriptions([
      this.parameters.gain.subscribe(updateGain),
      this.parameters.cvAmount.subscribe(updateGain),
      this.inputPorts.cv.subscribe(updateGain),
    ]);
    updateGain();
  }

  protected onEnabledStateChanged(): void {
    if (!this.gainNode) return;
    this.updateGain();
  }

  private updateGain(): void {
    if (!this.gainNode) return;
    const gain = this.getParameterValue('gain') as number;
    const amount = this.getParameterValue('cvAmount') as number;
    const cvValue = this.inputPorts.cv.getValue();
    const cv =
      typeof cvValue === 'number' ? Math.max(0, Math.min(1, cvValue)) : 1;
    const value = this.isEnabled() ? gain * (1 - amount + amount * cv) : 0;
    this.applyParameterRamp(this.gainNode.gain, value, this.smoothTime);
  }

  public dispose(): void {
    this.disposeAudioNodes([this.gainNode]);
    super.dispose();
  }
}
