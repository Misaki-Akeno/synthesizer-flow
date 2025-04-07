/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ModuleBase,
  ModuleInterface,
  ParameterType,
  PortType,
} from '../ModuleBase';
import { AudioInputHandler } from '../AudioInputHandler';
import { moduleInitManager } from '../ModuleInitManager';

/**
 * 音频输出模块，接收音频信号并输出到扬声器
 */
export class SpeakerModule extends ModuleBase {
  // 存储最近的输入值，用于在level改变时重新计算
  private lastInputValue: number = 0;
  private gain: any = null;
  private Tone: any;
  private fadeTime = 0.01; // 爆破音
  private audioInputHandler: AudioInputHandler | null = null;
  private initialized: boolean = false;
  private pendingAudioInputs: Array<{
    sourceModuleId: string;
    sourcePortName: string;
    audioInput: ModuleInterface;
  }> = [];

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

    // 注册为待初始化模块
    moduleInitManager.registerPendingModule(this.id);

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

      // 创建音频输入处理器
      this.audioInputHandler = new AudioInputHandler(this.gain, this.Tone);

      // 设置启用状态
      if (this.getParameterValue('enabled') as boolean) {
        this.gain.gain.rampTo(gainValue, this.fadeTime);
      }

      // 标记初始化完成
      this.initialized = true;
      moduleInitManager.markModuleAsInitialized(this.id);

      // 处理待处理的音频输入
      this.processPendingInputs();
    } catch (error) {
      console.error(`[SpeakerModule ${this.id}] Failed to initialize Tone.js:`, error);
    }
  }

  /**
   * 处理初始化期间累积的待处理输入
   */
  private processPendingInputs(): void {
    if (!this.initialized || !this.audioInputHandler) return;

    // 处理所有待处理的输入
    this.pendingAudioInputs.forEach(({ sourceModuleId, sourcePortName, audioInput }) => {
      if (this.audioInputHandler) {
        this.audioInputHandler.handleInput(audioInput, sourceModuleId, sourcePortName);
      }
    });

    // 清空队列
    this.pendingAudioInputs = [];
  }

  /**
   * 重写处理音频输入的方法，使用AudioInputHandler
   */
  protected handleAudioInput(
    inputPortName: string,
    audioInput: ModuleInterface,
    sourceModuleId: string,
    sourcePortName: string
  ): void {
    if (inputPortName !== 'audioIn') {
      console.warn(`[SpeakerModule ${this.id}] Cannot handle audio input: Wrong port name`);
      return;
    }

    if (!this.initialized || !this.audioInputHandler) {
      this.pendingAudioInputs.push({
        sourceModuleId,
        sourcePortName,
        audioInput,
      });
      // 更新输入端口状态
      this.inputPorts[inputPortName].next(audioInput);
      return;
    }

    const result = this.audioInputHandler.handleInput(audioInput, sourceModuleId, sourcePortName);

    if (result) {
      // 如果模块已启用，确保音频上下文已启动
      const enabled = this.getParameterValue('enabled') as boolean;

      if (enabled) {
        this.startAudioContext();
      }
    }

    // 更新输入端口状态
    this.inputPorts[inputPortName].next(audioInput);
  }

  /**
   * 重写处理音频断开连接的方法
   */
  protected handleAudioDisconnect(
    inputPortName: string,
    sourceModuleId?: string,
    sourcePortName?: string
  ): void {
    if (inputPortName !== 'audioIn' || !this.audioInputHandler) {
      console.warn(`[SpeakerModule ${this.id}] Cannot handle audio disconnect: ${inputPortName !== 'audioIn' ? 'Wrong port name' : 'AudioInputHandler not initialized'}`);
      return;
    }

    // 使用音频输入处理器处理断开连接
    this.audioInputHandler.handleDisconnect(sourceModuleId, sourcePortName);
  }

  /**
   * 启动音频上下文
   */
  private startAudioContext(): void {
    if (this.Tone && this.Tone.context.state !== 'running') {
      try {
        this.Tone.start();
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
    if (this.audioInputHandler) {
      this.audioInputHandler.dispose();
      this.audioInputHandler = null;
    }

    if (this.gain) {
      try {
        this.gain.dispose();
      } catch (error) {
        console.warn('Error disposing gain node', error);
      }
    }

    super.dispose();
  }
}
