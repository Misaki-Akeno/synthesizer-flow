/* eslint-disable @typescript-eslint/no-explicit-any */
import { AudioInputHandler } from '@/core/audio/AudioInputHandler';
import { AudioModuleBase } from '@/core/base/AudioModuleBase';
import {
  ModuleInterface,
  ModuleMetadata,
  ParameterType,
  PortType,
} from '@/core/base/ModuleBase';

const CHANNEL_COUNT = 4;

/** 四通道音频混音器，每个输入拥有独立增益。 */
export class MixerModule extends AudioModuleBase {
  public static metadata: ModuleMetadata = {
    type: 'mixer',
    label: '四通道混音器',
    description: '汇总四路音频并分别控制通道与主输出电平',
    category: '音频处理',
    iconType: 'Sliders',
  };

  private channelGains: any[] = [];
  private channelHandlers = new Map<string, AudioInputHandler>();
  private masterGain: any = null;

  constructor(id: string, name = '四通道混音器') {
    const channelParameters = Object.fromEntries(
      Array.from({ length: CHANNEL_COUNT }, (_, index) => [
        `channel${index + 1}`,
        {
          type: ParameterType.NUMBER,
          value: 0.8,
          min: 0,
          max: 1.5,
          step: 0.01,
          uiOptions: { group: '通道', label: `通道 ${index + 1}` },
        },
      ])
    );
    const inputPorts = Object.fromEntries(
      Array.from({ length: CHANNEL_COUNT }, (_, index) => [
        `input${index + 1}`,
        { type: PortType.AUDIO, value: null },
      ])
    );
    super(
      'mixer',
      id,
      name,
      {
        ...channelParameters,
        master: {
          type: ParameterType.NUMBER,
          value: 0.8,
          min: 0,
          max: 1.5,
          step: 0.01,
          uiOptions: { group: '主输出', label: 'Master' },
        },
      },
      inputPorts,
      { output: { type: PortType.AUDIO, value: null } },
      true
    );
  }

  protected async initializeAudio(): Promise<void> {
    this.masterGain = new this.Tone.Gain(
      this.getParameterValue('master') as number
    );
    for (let index = 0; index < CHANNEL_COUNT; index += 1) {
      const port = `input${index + 1}`;
      const channel = new this.Tone.Gain(
        this.getParameterValue(`channel${index + 1}`) as number
      );
      channel.connect(this.masterGain);
      this.channelGains.push(channel);
      this.channelHandlers.set(port, new AudioInputHandler(channel, this.Tone));

      this.addInternalSubscription(
        this.parameters[`channel${index + 1}`].subscribe((value) => {
          if (typeof value === 'number') {
            this.applyParameterRamp(channel.gain, value, this.smoothTime);
          }
        })
      );
    }
    this.addInternalSubscription(
      this.parameters.master.subscribe((value) => {
        if (typeof value === 'number') {
          this.applyParameterRamp(
            this.masterGain.gain,
            this.isEnabled() ? value : 0,
            this.smoothTime
          );
        }
      })
    );
    this.outputPorts.output.next(this.masterGain);
  }

  protected handleAudioInput(
    inputPortName: string,
    audioInput: ModuleInterface,
    sourceModuleId: string,
    sourcePortName: string
  ): void {
    if (!this.initialized) {
      this.pendingAudioInputs.push({
        inputPortName,
        sourceModuleId,
        sourcePortName,
        audioInput,
      });
      this.inputPorts[inputPortName].next(audioInput);
      return;
    }
    this.channelHandlers
      .get(inputPortName)
      ?.handleInput(audioInput, sourceModuleId, sourcePortName);
    this.inputPorts[inputPortName].next(audioInput);
  }

  protected handleAudioDisconnect(
    inputPortName: string,
    sourceModuleId?: string,
    sourcePortName?: string
  ): void {
    this.channelHandlers
      .get(inputPortName)
      ?.handleDisconnect(sourceModuleId, sourcePortName);
  }

  protected onEnabledStateChanged(enabled: boolean): void {
    if (!this.masterGain) return;
    const level = enabled ? (this.getParameterValue('master') as number) : 0;
    this.applyParameterRamp(this.masterGain.gain, level, this.fadeTime);
  }

  public dispose(): void {
    this.channelHandlers.forEach((handler) => handler.dispose());
    this.channelHandlers.clear();
    this.disposeAudioNodes([...this.channelGains, this.masterGain]);
    this.channelGains = [];
    super.dispose();
  }
}
