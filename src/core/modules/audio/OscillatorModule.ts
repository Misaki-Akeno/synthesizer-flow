/* eslint-disable @typescript-eslint/no-explicit-any */
import { AudioModuleBase } from '@/core/base/AudioModuleBase';
import {
  ModuleMetadata,
  ParameterType,
  PortType,
} from '@/core/base/ModuleBase';

/**
 * 振荡器模块，生成音频信号并根据参数调整输出
 */
export class SimpleOscillatorModule extends AudioModuleBase {
  // 模块元数据
  public static metadata: ModuleMetadata = {
    type: 'simpleoscillator',
    label: '简单振荡器',
    description: '生成基本波形的振荡器，提供频率和波形控制',
    category: '信号源',
    iconType: 'Waves',
  };

  private oscillator: any;
  private gainNode: any; // 用于渐变控制

  private currentFreqMod: number = 0;
  private currentGainMod: number = 0;

  constructor(id: string, name: string = '振荡器') {
    const moduleType = 'simpleoscillator';
    const parameters = {
      gain: {
        type: ParameterType.NUMBER,
        value: 1.0,
        min: 0,
        max: 2.0,
        step: 0.1,
        uiOptions: {
          group: '不常见参数',
          label: '音量',
          describe: '控制振荡器的输出音量大小',
        },
      },
      freq: {
        type: ParameterType.NUMBER,
        value: 440,
        min: 20,
        max: 2000,
        step: 10,
        uiOptions: {
          group: '不常见参数',
          label: '频率',
          describe: '控制振荡器的基础频率(Hz)',
        },
      },
      waveform: {
        type: ParameterType.LIST,
        value: 'sine',
        options: ['sine', 'square', 'sawtooth', 'triangle'],
        uiOptions: {
          label: '波形',
          describe: '选择振荡器的波形类型',
        },
      },
      freqModDepth: {
        type: ParameterType.NUMBER,
        value: 2,
        min: 0,
        max: 20,
        step: 1,
        uiOptions: {
          group: '不常见参数',
          label: '频率调制深度',
          describe: '控制频率调制的强度',
        },
      },
      gainModDepth: {
        type: ParameterType.NUMBER,
        value: 0.5,
        min: 0,
        max: 1,
        step: 0.05,
        uiOptions: {
          group: '不常见参数',
          label: '音量调制深度',
          describe: '控制音量调制的强度',
        },
      },
    };

    // 定义端口
    const inputPorts = {
      freqMod: {
        type: PortType.NUMBER,
        value: 0,
      },
      gainMod: {
        type: PortType.NUMBER,
        value: 0,
      },
    };

    const outputPorts = {
      output: {
        type: PortType.NUMBER,
        value: 0,
      },
      audioout: {
        type: PortType.AUDIO,
        value: null,
      },
    };

    super(moduleType, id, name, parameters, inputPorts, outputPorts, true);

    this.setCustomUI('XYPad', {
      xParam: {
        paramKey: 'freq',
        label: '频率',
        min: 20,
        max: 2000,
      },
      yParam: {
        paramKey: 'gain',
        label: '增益',
        min: 0,
        max: 2.0,
      },
      width: 180,
      height: 120,
    });
  }

  /**
   * 实现音频初始化
   */
  protected async initializeAudio(): Promise<void> {
    // 初始化Tone.js振荡器
    this.oscillator = new this.Tone.Oscillator({
      frequency: this.getParameterValue('freq') as number,
      volume: this.Tone.gainToDb(this.getParameterValue('gain') as number),
      type: this.getParameterValue('waveform') as string,
    });

    // 创建增益节点用于渐变控制
    this.gainNode = new this.Tone.Gain(0);
    // 将振荡器连接到增益节点
    this.oscillator.connect(this.gainNode);

    // 总是启动振荡器，但通过增益节点控制是否有声音输出
    this.oscillator.start();

    // 根据enabled参数决定是否有声音输出
    if (this.isEnabled()) {
      this.applyParameterRamp(this.gainNode.gain, 1);
    }

    // 更新输出端口
    this.outputPorts['audioout'].next(this.gainNode);

    // 设置参数变更监听
    this.setupOscillatorBindings();

    // 设置调制输入处理
    this.setupModulationHandling();
  }

  /**
   * 重写启用状态变化处理
   */
  protected onEnabledStateChanged(enabled: boolean): void {
    if (this.gainNode) {
      this.applyParameterRamp(this.gainNode.gain, enabled ? 1 : 0);
    }
  }

  /**
   * 设置振荡器参数绑定
   */
  private setupOscillatorBindings(): void {
    if (!this.oscillator) return;

    const freqSubscription = this.parameters['freq'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') {
          this.applyFrequencyWithModulation(value);
        }
      }
    );

    const gainSubscription = this.parameters['gain'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') {
          this.applyGainWithModulation(value);
        }
      }
    );

    const waveformSubscription = this.parameters['waveform'].subscribe(
      (value: number | boolean | string) => {
        if (this.oscillator && typeof value === 'string') {
          this.oscillator.type = value;
        }
      }
    );

    // 调制深度参数的订阅
    const freqModDepthSubscription = this.parameters['freqModDepth'].subscribe(
      () => {
        const baseFreq = this.getParameterValue('freq') as number;
        this.applyFrequencyWithModulation(baseFreq);
      }
    );

    const gainModDepthSubscription = this.parameters['gainModDepth'].subscribe(
      () => {
        const baseGain = this.getParameterValue('gain') as number;
        this.applyGainWithModulation(baseGain);
      }
    );

    this.addInternalSubscriptions([
      freqSubscription,
      gainSubscription,
      waveformSubscription,
      freqModDepthSubscription,
      gainModDepthSubscription,
    ]);
  }

  /**
   * 设置调制输入处理
   */
  private setupModulationHandling(): void {
    // 处理频率调制输入
    const freqModSubscription = this.inputPorts['freqMod'].subscribe(
      (value: any) => {
        if (typeof value === 'number') {
          this.currentFreqMod = value;
          const baseFreq = this.getParameterValue('freq') as number;
          this.applyFrequencyWithModulation(baseFreq);
        }
      }
    );

    // 处理增益调制输入
    const gainModSubscription = this.inputPorts['gainMod'].subscribe(
      (value: any) => {
        if (typeof value === 'number') {
          this.currentGainMod = value;
          const baseGain = this.getParameterValue('gain') as number;
          this.applyGainWithModulation(baseGain);
        }
      }
    );

    this.addInternalSubscriptions([freqModSubscription, gainModSubscription]);
  }

  /**
   * 应用频率调制
   */
  private applyFrequencyWithModulation(baseFrequency: number): void {
    if (!this.oscillator) return;

    const modDepth = this.getParameterValue('freqModDepth') as number;
    // 调制值范围0-1，映射到[-1, 1]范围用于双向调制
    const normalizedMod = this.currentFreqMod * 2 - 1;
    // 计算调制后的频率
    const modulatedFreq = baseFrequency + modDepth * normalizedMod;

    // 应用到振荡器 - 使用较短的渐变时间以保持响应性但避免爆音
    this.applyParameterRamp(this.oscillator.frequency, modulatedFreq, 0.01);
  }

  /**
   * 应用增益调制
   */
  private applyGainWithModulation(baseGain: number): void {
    if (!this.oscillator) return;

    const modDepth = this.getParameterValue('gainModDepth') as number;
    // 计算调制后的增益
    const modulatedGain = Math.max(
      0,
      Math.min(2, baseGain + modDepth * this.currentGainMod)
    );

    // 使用统一的参数渐变方法，而不是直接调用 rampTo
    const dbGain = this.Tone.gainToDb(modulatedGain);
    this.applyParameterRamp(this.oscillator.volume, dbGain, 0.02);
  }

  /**
   * 设置模块内部参数与输出之间的绑定关系
   */
  protected setupInternalBindings(): void {
    // 将gain参数直接绑定到output输出
    this.bindParameterToOutput('gain', 'output');
  }

  /**
   * 释放资源方法
   */
  public dispose(): void {
    this.disposeAudioNodes([this.oscillator, this.gainNode]);
    super.dispose();
  }
}
