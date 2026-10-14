/* eslint-disable @typescript-eslint/no-explicit-any */
import { AudioInputHandler } from '@/core/audio/AudioInputHandler';
import { AudioModuleBase } from '@/core/base/AudioModuleBase';
import {
  ModuleMetadata,
  ParameterType,
  PortType,
} from '@/core/base/ModuleBase';

/**
 * 混响效果器模块，处理音频信号并添加混响效果
 */
export class ReverbModule extends AudioModuleBase {
  // 模块元数据
  public static metadata: ModuleMetadata = {
    type: 'reverb',
    label: '混响效果',
    description: '添加空间混响效果到输入的音频信号',
    category: '效果',
    iconType: 'Sliders',
  };

  private reverb: any;

  constructor(id: string, name: string = '混响效果器') {
    // 初始化基本参数
    const moduleType = 'reverb';
    const parameters = {
      decay: {
        type: ParameterType.NUMBER,
        value: 2.0,
        min: 0.1,
        max: 10.0,
        step: 0.1,
        uiOptions: {
          group: '不常见参数',
          label: '衰减时间',
          describe: '控制混响效果的衰减时间长度',
        },
      },
      wet: {
        type: ParameterType.NUMBER,
        value: 0.5,
        min: 0,
        max: 1.0,
        step: 0.01,
        uiOptions: {
          group: '不常见参数',
          label: '湿度',
          describe: '调节原始信号与混响效果的混合比例',
        },
      },
      preDelay: {
        type: ParameterType.NUMBER,
        value: 0.01,
        min: 0,
        max: 0.5,
        step: 0.01,
        uiOptions: {
          group: '不常见参数',
          label: '预延迟',
          describe: '设置直接声音与混响开始之间的延迟时间',
        },
      },
    };

    // 定义输入和输出端口
    const inputPorts = {
      input: {
        type: PortType.AUDIO,
        value: null,
      },
    };

    const outputPorts = {
      output: {
        type: PortType.AUDIO,
        value: null,
      },
    };

    super(moduleType, id, name, parameters, inputPorts, outputPorts, true);

    this.setCustomUI('XYPad', {
      xParam: {
        paramKey: 'decay',
        label: 'Decay',
        min: 0.1,
        max: 10,
      },
      yParam: {
        paramKey: 'wet',
        label: 'Wet',
        min: 0,
        max: 1.0,
      },
      width: 180,
      height: 120,
    });
  }

  /**
   * 实现音频初始化
   */
  protected async initializeAudio(): Promise<void> {
    // 初始化混响效果器
    this.reverb = new this.Tone.Reverb({
      decay: this.getParameterValue('decay') as number,
      preDelay: this.getParameterValue('preDelay') as number,
      wet: this.getParameterValue('wet') as number,
    });

    // 生成混响卷积响应
    const reverb = this.reverb;
    await reverb.generate();
    if (this.isDisposed() || this.reverb !== reverb) return;

    // 创建音频输入处理器
    this.audioInputHandler = new AudioInputHandler(this.reverb, this.Tone);

    // 设置音频输出
    this.updateOutputConnection();

    // 设置参数变更监听
    this.setupReverbBindings();
  }

  /**
   * 更新输出连接，根据启用状态设置选择直通或混响输出
   */
  private updateOutputConnection(): void {
    if (!this.audioInputHandler || !this.reverb) return;

    if (!this.isEnabled()) {
      // 在禁用模式下，直接输出混合器
      this.outputPorts['output'].next(this.audioInputHandler.getMixerOutput());
    } else {
      // 启用模式下，输出混响效果
      this.outputPorts['output'].next(this.reverb);
    }
  }

  /**
   * 重写启用状态变化处理
   */
  protected onEnabledStateChanged(_enabled: boolean): void {
    this.updateOutputConnection();
  }

  /**
   * 设置混响参数绑定
   */
  private setupReverbBindings(): void {
    if (!this.reverb) return;

    const decaySubscription = this.parameters['decay'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') void this.regenerateReverb('decay', value);
      }
    );

    const wetSubscription = this.parameters['wet'].subscribe(
      (value: number | boolean | string) => {
        if (this.reverb && typeof value === 'number') {
          // 使用较长的渐变时间，使混响变化更平滑
          this.applyParameterRamp(this.reverb.wet, value, this.smoothTime);
        }
      }
    );

    const preDelaySubscription = this.parameters['preDelay'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') void this.regenerateReverb('preDelay', value);
      }
    );

    this.addInternalSubscriptions([
      decaySubscription,
      wetSubscription,
      preDelaySubscription,
    ]);
  }

  private async regenerateReverb(parameter: 'decay' | 'preDelay', value: number): Promise<void> {
    const reverb = this.reverb;
    if (!reverb || this.isDisposed()) return;
    const currentWet = reverb.wet.value;
    try {
      this.applyParameterRamp(reverb.wet, 0, this.smoothTime);
      await new Promise((resolve) => setTimeout(resolve, this.smoothTime * 1000));
      if (this.isDisposed() || this.reverb !== reverb) return;
      reverb[parameter] = value;
      await reverb.generate();
      if (this.isDisposed() || this.reverb !== reverb) return;
      this.applyParameterRamp(reverb.wet, currentWet, this.smoothTime);
    } catch (error) {
      if (!this.isDisposed() && this.reverb === reverb) {
        console.warn(`[ReverbModule ${this.id}] Failed to regenerate reverb`, error);
      }
    }
  }

  /**
   * 释放资源方法
   */
  public dispose(): void {
    if (this.reverb) {
      try {
        this.reverb.dispose();
      } catch (error) {
        console.warn(
          `[${this.moduleType}Module ${this.id}] Error disposing reverb`,
          error
        );
      }
    }
    super.dispose();
  }

  protected cleanupFailedAudioInitialization(): void {
    this.disposeAudioNodes([this.reverb]);
    this.reverb = undefined;
    super.cleanupFailedAudioInitialization();
  }
}
