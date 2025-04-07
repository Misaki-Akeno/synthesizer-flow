/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ModuleBase,
  ModuleInterface,
  ParameterType,
  PortType,
} from '../ModuleBase';

/**
 * 音频输出模块，接收音频信号并输出到扬声器
 */
export class SpeakerModule extends ModuleBase {
  // 存储最近的输入值，用于在level改变时重新计算
  private lastInputValue: number = 0;
  private lastAudioInput: any = null;
  private gain: any = null;
  private Tone: any;
  private fadeTime = 0.01; // 爆破音

  constructor(id: string, name: string = '扬声器') {
    // 初始化基本参数，使用新的参数定义格式
    const moduleType = 'speaker';
    const parameters = {
      level: {
        type: ParameterType.NUMBER,
        value: -12,
        min: -60,
        max: 0,
        step: 0.1,
      },
      enabled: {
        type: ParameterType.BOOLEAN,
        value: false,
      },
    };

    // 使用新的端口定义格式
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

    super(moduleType, id, name, parameters, inputPorts, outputPorts);

    // 初始化音频处理
    if (typeof window !== 'undefined') {
      this.initializeAudio();
    }
  }

  /**
   * 初始化音频处理组件
   */
  private async initializeAudio(): Promise<void> {
    try {
      const ToneModule = await import('tone');
      this.Tone = ToneModule;

      // 创建增益节点用于音量控制，将dB值转换为线性值
      const levelDB = this.getParameterValue('level') as number;
      const gainValue = this.dbToLinear(levelDB);

      // 初始时设置为0，稍后根据enabled参数决定是否渐变到目标音量
      this.gain = new this.Tone.Gain(0).toDestination();

      // 设置启用状态
      if (this.getParameterValue('enabled') as boolean) {
        this.gain.gain.rampTo(gainValue, this.fadeTime);
      }
    } catch (error) {
      console.error('Failed to initialize Tone.js:', error);
    }
  }

  /**
   * 启动音频上下文
   */
  private startAudioContext(): void {
    if (this.Tone && this.Tone.context.state !== 'running') {
      try {
        this.Tone.start();
        console.debug(`[SpeakerModule ${this.id}] Audio context started`);
      } catch (error) {
        console.warn(
          `[SpeakerModule ${this.id}] Error starting audio context:`,
          error
        );
      }
    }
  }

  /**
   * 将分贝值转换为线性增益值
   */
  private dbToLinear(dbValue: number): number {
    return Math.pow(10, dbValue / 20);
  }

  /**
   * 设置模块内部绑定，处理输入信号
   */
  protected setupInternalBindings(): void {
    console.debug(`[SpeakerModule ${this.id}] Setting up internal bindings`);

    // 监听数字输入端口
    const inputSubscription = this.inputPorts.input.subscribe(
      (inputValue: ModuleInterface) => {
        if (typeof inputValue === 'number') {
          this.lastInputValue = inputValue;
          // 不需要在这里调用processInput，避免干扰音频增益设置
        }
      }
    );
    this.addInternalSubscription(inputSubscription);

    // 监听音频输入端口
    const audioSubscription = this.inputPorts.audioIn.subscribe(
      (audioInput: ModuleInterface) => {
        // 先断开上一个音频连接
        if (this.lastAudioInput && this.gain) {
          try {
            this.lastAudioInput.disconnect(this.gain);
            console.debug(
              `[SpeakerModule ${this.id}] Disconnected previous audio input`
            );
          } catch (error) {
            console.warn(
              `[SpeakerModule ${this.id}] Error disconnecting previous audio:`,
              error
            );
          }
        }

        // 如果有新的音频输入，则进行连接
        if (audioInput && this.gain) {
          try {
            audioInput.connect(this.gain);
            this.lastAudioInput = audioInput;

            // 如果模块已启用，确保音频上下文已启动
            if (this.getParameterValue('enabled') as boolean) {
              this.startAudioContext();
            }

            console.debug(
              `[SpeakerModule ${this.id}] Connected new audio input`
            );
          } catch (error) {
            console.error(
              `[SpeakerModule ${this.id}] Error connecting audio:`,
              error
            );
          }
        } else {
          // 如果输入为null，清空lastAudioInput
          this.lastAudioInput = null;
          console.debug(`[SpeakerModule ${this.id}] Audio input removed`);
        }
      }
    );
    this.addInternalSubscription(audioSubscription);

    // 监听level参数变化
    const levelSubscription = this.parameters.level.subscribe(
      (levelValue: number | boolean | string) => {
        if (typeof levelValue === 'number' && this.gain) {
          // 只有在模块启用时才应用音量变化
          if (this.getParameterValue('enabled') as boolean) {
            const gainValue = this.dbToLinear(levelValue);
            // 使用渐变来平滑过渡
            this.gain.gain.cancelScheduledValues(this.Tone.now());
            this.gain.gain.rampTo(gainValue, this.fadeTime);
          }
        }
      }
    );
    this.addInternalSubscription(levelSubscription);

    // 监听enabled参数变化
    const enabledSubscription = this.parameters.enabled.subscribe(
      (enabledValue: number | boolean | string) => {
        if (typeof enabledValue === 'boolean' && this.gain) {
          const levelDB = this.getParameterValue('level') as number;
          const gainValue = this.dbToLinear(levelDB);

          if (enabledValue) {
            // 当启用时，尝试启动音频上下文
            this.startAudioContext();

            // 渐入: 音量从0到目标值
            this.gain.gain.cancelScheduledValues(this.Tone.now());
            this.gain.gain.rampTo(gainValue, this.fadeTime);
          } else {
            // 渐出: 音量从当前值到0
            this.gain.gain.cancelScheduledValues(this.Tone.now());
            this.gain.gain.rampTo(0, this.fadeTime);
          }
        }
      }
    );
    this.addInternalSubscription(enabledSubscription);
  }

  /**
   * 释放资源
   */
  public dispose(): void {
    if (this.gain) {
      try {
        this.gain.dispose();
      } catch (error) {
        console.warn('Error disposing gain node', error);
      }
    }

    // 断开音频连接
    if (this.lastAudioInput) {
      try {
        this.lastAudioInput.disconnect();
      } catch (error) {
        console.warn('Error disconnecting audio input', error);
      }
    }

    super.dispose();
  }
}
