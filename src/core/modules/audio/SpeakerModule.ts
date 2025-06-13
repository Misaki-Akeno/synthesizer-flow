/* eslint-disable @typescript-eslint/no-explicit-any */
import { AudioInputHandler } from '@/core/audio/AudioInputHandler';
import { AudioModuleBase } from '@/core/base/AudioModuleBase';
import {
  ModuleMetadata,
  ParameterType,
  PortType,
} from '@/core/base/ModuleBase';

/**
 * 音频输出模块，接收音频信号并输出到扬声器
 * 支持双声道输入和音频上下文状态检测
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

  private gainLeft: any = null;
  private gainRight: any = null;
  private merger: any = null;
  // 音频上下文状态
  private contextReady: boolean = false;
  // 状态检查定时器
  private contextCheckInterval: any = null;
  // 按钮可见性
  private buttonVisible: boolean = true;

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
      balance: {
        type: ParameterType.NUMBER,
        value: 0,
        min: -1,
        max: 1,
        step: 0.01,
        uiOptions: {
          label: '平衡',
          describe: '控制左右声道平衡(-1为全左，0为居中，1为全右)',
        },
      },
    };

    // 双声道音频输入
    const inputPorts = {
      audioInLeft: {
        type: PortType.AUDIO,
        value: null,
      },
      audioInRight: {
        type: PortType.AUDIO,
        value: null,
      },
    };

    const outputPorts = {}; // 输出模块没有输出接口

    // 默认禁用状态
    super(moduleType, id, name, parameters, inputPorts, outputPorts, false);

    // 设置自定义UI组件 - 音频启动按钮
    this.setCustomUI('CommonButton', {
      label: '启动音频',
      variant: 'default',
      size: 'default',
      onClick: () => this.startAudioEngine(),
      className: '',
      disabled: false,
    });
  }

  /**
   * 启动音频引擎
   */
  public startAudioEngine(): void {
    this.startAudioContext();
    this.checkAudioContextState();
  }

  /**
   * 实现音频初始化
   */
  protected async initializeAudio(): Promise<void> {
    try {
      // 创建立体声处理链
      this.gainLeft = new this.Tone.Gain(0);
      this.gainRight = new this.Tone.Gain(0);
      this.merger = new this.Tone.Merge();

      // 连接左右声道到合并器
      this.gainLeft.connect(this.merger, 0, 0);
      this.gainRight.connect(this.merger, 0, 1);
      this.merger.toDestination();

      // 创建音频输入处理器 - 用于左声道
      this.audioInputHandler = new AudioInputHandler(this.gainLeft, this.Tone);

      // 设置初始状态
      const levelDB = this.getParameterValue('level') as number;
      const gainValue = this.dbToLinear(levelDB);
      const balance = this.getParameterValue('balance') as number;

      // 应用初始平衡设置
      this.applyBalanceSetting(balance);

      // 检查音频上下文状态
      this.checkAudioContextState();

      // 设置定期检查音频上下文状态
      this.contextCheckInterval = setInterval(
        () => this.checkAudioContextState(),
        1000
      );

      // 设置启用状态
      if (this.isEnabled()) {
        this.applyParameterRamp(this.gainLeft.gain, gainValue);
        this.applyParameterRamp(this.gainRight.gain, gainValue);
      }
    } catch (error) {
      console.error(`[${this.moduleType}Module ${this.id}] 初始化失败:`, error);
    }
  }

  /**
   * 重写获取自定义UI方法，提供实时按钮状态更新
   */
  public getCustomUI():
    | { type: string; props?: Record<string, unknown> }
    | undefined {
    if (this.customUI && this.buttonVisible) {
      return {
        type: 'CommonButton',
        props: {
          ...this.customUI.props,
          label: '启动音频',
        },
      };
    }
    return undefined;
  }

  /**
   * 检查音频上下文状态
   */
  private checkAudioContextState(): void {
    if (!this.Tone) return;

    const wasReady = this.contextReady;
    this.contextReady = this.Tone.context.state === 'running';

    // 如果状态发生变化
    if (wasReady !== this.contextReady) {
      // 如果音频上下文已经运行，自动启用模块
      if (this.contextReady) {
        if (!this.isEnabled()) {
          this.setEnabled(true);
        }
        // 隐藏按钮
        this.buttonVisible = false;
      } else {
        // 显示按钮
        this.buttonVisible = true;
      }
    }
  }

  /**
   * 应用平衡设置
   * @param balance 平衡值 (-1到1)
   */
  private applyBalanceSetting(balance: number): void {
    if (!this.gainLeft || !this.gainRight) return;

    const leftGain = balance <= 0 ? 1 : 1 - balance;
    const rightGain = balance >= 0 ? 1 : 1 + balance;

    // 应用平衡设置到左右声道
    this.applyParameterRamp(this.gainLeft.gain.multiplier, leftGain, 0.05);
    this.applyParameterRamp(this.gainRight.gain.multiplier, rightGain, 0.05);
  }

  /**
   * 重写启用状态变化处理
   */
  protected onEnabledStateChanged(enabled: boolean): void {
    if (!this.gainLeft || !this.gainRight) return;

    // 启用时应用当前音量，禁用时设为0
    if (enabled) {
      // 尝试启动音频上下文
      this.startAudioContext();

      // 渐入到目标音量
      const levelDB = this.getParameterValue('level') as number;
      const gainValue = this.dbToLinear(levelDB);
      this.applyParameterRamp(this.gainLeft.gain, gainValue);
      this.applyParameterRamp(this.gainRight.gain, gainValue);
    } else {
      // 渐出到静音
      this.applyParameterRamp(this.gainLeft.gain, 0);
      this.applyParameterRamp(this.gainRight.gain, 0);
    }
  }

  /**
   * 重写音频输入处理方法，支持双声道
   */
  protected handleAudioInput(
    inputPortName: string,
    audioInput: any,
    sourceModuleId: string,
    sourcePortName: string
  ): void {
    if (!this.initialized) {
      // 将音频输入添加到待处理队列
      this.pendingAudioInputs.push({
        sourceModuleId,
        sourcePortName,
        audioInput,
      });
      // 更新输入端口状态
      this.inputPorts[inputPortName].next(audioInput);
      return;
    }

    // 根据输入端口选择正确的目标节点
    if (inputPortName === 'audioInRight' && audioInput && this.gainRight) {
      try {
        audioInput.connect(this.gainRight);
      } catch (error) {
        console.warn(
          `[${this.moduleType}Module ${this.id}] 连接右声道失败:`,
          error
        );
      }
    } else if (inputPortName === 'audioInLeft' && this.audioInputHandler) {
      // 左声道使用audioInputHandler来处理
      this.audioInputHandler.handleInput(
        audioInput,
        sourceModuleId,
        sourcePortName
      );
    }

    // 更新输入端口状态
    this.inputPorts[inputPortName].next(audioInput);
  }

  /**
   * 重写音频断开连接处理方法，支持双声道
   */
  protected handleAudioDisconnect(
    inputPortName: string,
    sourceModuleId?: string,
    sourcePortName?: string
  ): void {
    if (inputPortName === 'audioInRight' && this.gainRight) {
      // 手动处理右声道的断开
      try {
        const source = this.inputPorts[inputPortName].getValue();
        if (source) {
          source.disconnect(this.gainRight);
        }
      } catch (error) {
        console.warn(
          `[${this.moduleType}Module ${this.id}] 断开右声道失败:`,
          error
        );
      }
    } else if (inputPortName === 'audioInLeft' && this.audioInputHandler) {
      // 左声道使用audioInputHandler来处理
      this.audioInputHandler.handleDisconnect(sourceModuleId, sourcePortName);
    }
  }

  /**
   * 设置模块内部绑定，处理输入信号和参数变化
   */
  protected setupInternalBindings(): void {
    // 监听level参数变化
    const levelSubscription = this.parameters.level.subscribe(
      (levelValue: number | boolean | string) => {
        if (
          typeof levelValue === 'number' &&
          this.gainLeft &&
          this.gainRight &&
          this.isEnabled()
        ) {
          const gainValue = this.dbToLinear(levelValue);
          this.applyParameterRamp(this.gainLeft.gain, gainValue);
          this.applyParameterRamp(this.gainRight.gain, gainValue);
        }
      }
    );
    this.addInternalSubscription(levelSubscription);

    // 监听balance参数变化
    const balanceSubscription = this.parameters.balance.subscribe(
      (balanceValue: number | boolean | string) => {
        if (typeof balanceValue === 'number') {
          this.applyBalanceSetting(balanceValue);
        }
      }
    );
    this.addInternalSubscription(balanceSubscription);
  }

  /**
   * 释放资源
   */
  public dispose(): void {
    // 清除定时器
    if (this.contextCheckInterval) {
      clearInterval(this.contextCheckInterval);
      this.contextCheckInterval = null;
    }

    this.disposeAudioNodes([this.merger, this.gainLeft, this.gainRight]);
    super.dispose();
  }
}
