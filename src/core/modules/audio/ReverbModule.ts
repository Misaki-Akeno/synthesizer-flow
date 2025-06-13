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
    await this.reverb.generate();

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
      async (value: number | boolean | string) => {
        if (this.reverb && typeof value === 'number') {
          // 缓存当前 wet 值，因为生成新卷积响应后需要重新应用
          const currentWet = this.reverb.wet.value;

          // 将 wet 渐变到 0，避免在重新生成卷积响应时产生爆破音
          this.applyParameterRamp(this.reverb.wet, 0, this.smoothTime);

          // 等待一小段时间让渐变生效
          await new Promise((resolve) =>
            setTimeout(resolve, this.smoothTime * 1000)
          );

          // 更新 decay 参数并重新生成卷积响应
          this.reverb.decay = value;
          await this.reverb.generate();

          // 将 wet 渐变回原始值
          this.applyParameterRamp(this.reverb.wet, currentWet, this.smoothTime);
        }
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
      async (value: number | boolean | string) => {
        if (this.reverb && typeof value === 'number') {
          // 与 decay 参数相同的平滑处理
          const currentWet = this.reverb.wet.value;

          this.applyParameterRamp(this.reverb.wet, 0, this.smoothTime);
          await new Promise((resolve) =>
            setTimeout(resolve, this.smoothTime * 1000)
          );

          this.reverb.preDelay = value;
          await this.reverb.generate();

          this.applyParameterRamp(this.reverb.wet, currentWet, this.smoothTime);
        }
      }
    );

    this.addInternalSubscriptions([
      decaySubscription,
      wetSubscription,
      preDelaySubscription,
    ]);
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
}
