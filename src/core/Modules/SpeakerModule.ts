/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ParameterType,
  PortType,
  ModuleInterface,
  ModuleMetadata,
} from '../ModuleBase';
import { AudioModuleBase } from '../AudioModuleBase';
import { AudioInputHandler } from '../AudioInputHandler';

/**
 * 音频输出模块，接收音频信号并输出到扬声器
 */
export class SpeakerModule extends AudioModuleBase {
  // 模块元数据
  public static metadata: ModuleMetadata = {
    type: 'speaker',
    label: '扬声器',
    description: '音频输出模块，接收音频信号并输出到系统扬声器',
    category: '输出',
    iconType: 'Speaker',
  };

  private lastInputValue: number = 0;
  private gain: any = null;

  constructor(id: string, name: string = '扬声器') {
    const moduleType = 'speaker';
    const parameters = {
      level: {
        type: ParameterType.NUMBER,
        value: -12,
        min: -60,
        max: 0,
        step: 0.1,
        uiOptions: {
          label: '音量',
          describe: '控制输出音频的音量大小(dB)',
        },
      },
    };

    // 定义端口
    const inputPorts = {
      input: {
        type: PortType.NUMBER,
        value: 0,
      },
      audioIn: {
        type: PortType.AUDIO,
        value: null,
      },
    };

    const outputPorts = {}; // 输出模块没有输出接口

    // 默认禁用状态
    super(moduleType, id, name, parameters, inputPorts, outputPorts, false);
  }

  /**
   * 实现音频初始化
   */
  protected async initializeAudio(): Promise<void> {
    // 创建增益节点用于音量控制，将dB值转换为线性值
    const levelDB = this.getParameterValue('level') as number;
    const gainValue = this.dbToLinear(levelDB);

    // 初始时设置为0，稍后根据enabled参数决定是否渐变到目标音量
    this.gain = new this.Tone.Gain(0).toDestination();

    // 创建音频输入处理器
    this.audioInputHandler = new AudioInputHandler(this.gain, this.Tone);

    // 设置启用状态
    if (this.isEnabled()) {
      this.applyParameterRamp(this.gain.gain, gainValue);
    }
  }

  /**
   * 重写启用状态变化处理
   */
  protected onEnabledStateChanged(enabled: boolean): void {
    if (this.gain) {
      // 启用时应用当前音量，禁用时设为0
      if (enabled) {
        // 当启用时，尝试启动音频上下文
        this.startAudioContext();

        // 渐入到目标音量
        const levelDB = this.getParameterValue('level') as number;
        const gainValue = this.dbToLinear(levelDB);
        this.applyParameterRamp(this.gain.gain, gainValue);
      } else {
        // 渐出到静音
        this.applyParameterRamp(this.gain.gain, 0);
      }
    }
  }

  /**
   * 设置模块内部绑定，处理输入信号
   */
  protected setupInternalBindings(): void {
    // 监听数字输入端口
    const inputSubscription = this.inputPorts.input.subscribe(
      (inputValue: ModuleInterface) => {
        if (typeof inputValue === 'number') {
          this.lastInputValue = inputValue;
        }
      }
    );
    this.addInternalSubscription(inputSubscription);

    // 监听level参数变化
    const levelSubscription = this.parameters.level.subscribe(
      (levelValue: number | boolean | string) => {
        if (typeof levelValue === 'number' && this.gain) {
          // 只有在模块启用时才应用音量变化
          if (this.isEnabled()) {
            const gainValue = this.dbToLinear(levelValue);
            this.applyParameterRamp(this.gain.gain, gainValue);
          }
        }
      }
    );
    this.addInternalSubscription(levelSubscription);
  }

  /**
   * 释放资源
   */
  public dispose(): void {
    this.disposeAudioNodes([this.gain]);
    super.dispose();
  }
}
