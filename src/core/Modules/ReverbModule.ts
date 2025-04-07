/* eslint-disable @typescript-eslint/no-explicit-any */
import { ModuleBase, ParameterType, PortType } from '../ModuleBase';
import { AudioInputHandler } from '../AudioInputHandler';
import { moduleInitManager } from '../ModuleInitManager';

/**
 * 混响效果器模块，处理音频信号并添加混响效果
 */
export class ReverbModule extends ModuleBase {
  private reverb: any;
  private Tone: any;
  private audioInputHandler: AudioInputHandler | null = null;
  private bypassEnabled: boolean = false;
  // 添加待处理的音频输入队列
  private pendingAudioInputs: Array<{
    sourceModuleId: string;
    sourcePortName: string;
    audioInput: any;
  }> = [];
  // 初始化完成标志
  private initialized: boolean = false;

  constructor(id: string, name: string = '混响效果器') {
    // 初始化基本参数
    const moduleType = 'reverb';
    const parameters = {
      decay: { 
        type: ParameterType.NUMBER, 
        value: 2.0, 
        min: 0.1, 
        max: 10.0,
        step: 0.1
      },
      wet: { 
        type: ParameterType.NUMBER, 
        value: 0.5, 
        min: 0, 
        max: 1.0,
        step: 0.01
      },
      preDelay: { 
        type: ParameterType.NUMBER, 
        value: 0.01, 
        min: 0, 
        max: 0.5,
        step: 0.01
      },
      bypass: {
        type: ParameterType.BOOLEAN,
        value: false
      }
    };
    
    // 定义输入和输出端口
    const inputPorts = {
      input: { 
        type: PortType.AUDIO, 
        value: null 
      }
    };
    
    const outputPorts = {
      output: { 
        type: PortType.AUDIO, 
        value: null 
      }
    };

    super(moduleType, id, name, parameters, inputPorts, outputPorts);
    this.bypassEnabled = this.getParameterValue('bypass') as boolean;

    // 注册为待初始化模块
    moduleInitManager.registerPendingModule(this.id);

    // 仅在浏览器环境下初始化Tone.js
    if (typeof window !== 'undefined') {
      this.initializeTone();
    }
  }

  /**
   * 动态初始化Tone.js
   */
  private async initializeTone(): Promise<void> {
    try {
      const ToneModule = await import('tone');
      this.Tone = ToneModule;

      // 初始化混响效果器
      this.reverb = new this.Tone.Reverb({
        decay: this.getParameterValue('decay') as number,
        preDelay: this.getParameterValue('preDelay') as number,
        wet: this.getParameterValue('wet') as number
      });
      
      // 生成混响卷积响应（必须等待此操作完成）
      await this.reverb.generate();
      
      // 创建音频输入处理器
      this.audioInputHandler = new AudioInputHandler(this.reverb, this.Tone);
      
      // 设置音频输出
      this.updateOutputConnection();
      
      // 设置参数变更监听
      this.setupReverbBindings();
      
      // 标记初始化完成
      this.initialized = true;
      moduleInitManager.markModuleAsInitialized(this.id);
      
      // 处理待处理的音频输入
      this.processPendingInputs();
    } catch (error) {
      console.error(`[ReverbModule ${this.id}] Failed to initialize Tone.js Reverb:`, error);
    }
  }

  /**
   * 处理初始化期间累积的待处理输入
   */
  private processPendingInputs(): void {
    if (!this.initialized || !this.audioInputHandler) return;
    
    // 处理所有待处理的输入
    this.pendingAudioInputs.forEach(({sourceModuleId, sourcePortName, audioInput}) => {
      if (this.audioInputHandler) {
        this.audioInputHandler.handleInput(audioInput, sourceModuleId, sourcePortName);
      }
    });
    
    // 清空队列
    this.pendingAudioInputs = [];
  }

  /**
   * 更新输出连接，根据bypass设置选择直通或混响输出
   */
  private updateOutputConnection(): void {
    if (!this.audioInputHandler || !this.reverb) return;
    
    if (this.bypassEnabled) {
      // 在bypass模式下，直接输出混合器
      this.outputPorts['output'].next(this.audioInputHandler.getMixerOutput());
    } else {
      // 正常模式下，输出混响效果
      this.outputPorts['output'].next(this.reverb);
    }
  }

  /**
   * 重写音频输入处理方法
   */
  protected handleAudioInput(
    inputPortName: string,
    audioInput: any,
    sourceModuleId: string,
    sourcePortName: string
  ): void {
    if (inputPortName !== 'input') {
      console.warn(`[ReverbModule ${this.id}] Cannot handle audio input: Wrong port name`);
      return;
    }
    
    if (!this.initialized || !this.audioInputHandler) {
      // 将音频输入添加到待处理队列
      this.pendingAudioInputs.push({
        sourceModuleId,
        sourcePortName,
        audioInput
      });
      // 更新输入端口状态
      this.inputPorts[inputPortName].next(audioInput);
      return;
    }
    
    // 更新输入端口状态
    this.inputPorts[inputPortName].next(audioInput);
  }
  
  /**
   * 重写音频断开连接处理方法
   */
  protected handleAudioDisconnect(
    inputPortName: string,
    sourceModuleId?: string,
    sourcePortName?: string
  ): void {
    if (inputPortName !== 'input' || !this.audioInputHandler) {
      console.warn(`[ReverbModule ${this.id}] Cannot handle audio disconnect: ${inputPortName !== 'input' ? 'Wrong port name' : 'AudioInputHandler not initialized'}`);
      return;
    }
    
    // 使用音频输入处理器处理断开连接
    this.audioInputHandler.handleDisconnect(sourceModuleId, sourcePortName);
  }

  /**
   * 设置混响参数绑定
   */
  private setupReverbBindings(): void {
    if (!this.reverb) return;

    const decaySubscription = this.parameters['decay'].subscribe(async (value: number | boolean | string) => {
      if (this.reverb && typeof value === 'number') {
        this.reverb.decay = value;
        await this.reverb.generate(); // 重新生成卷积响应
      }
    });

    const wetSubscription = this.parameters['wet'].subscribe((value: number | boolean | string) => {
      if (this.reverb && typeof value === 'number') {
        this.reverb.wet.value = value;
      }
    });

    const preDelaySubscription = this.parameters['preDelay'].subscribe(async (value: number | boolean | string) => {
      if (this.reverb && typeof value === 'number') {
        this.reverb.preDelay = value;
        await this.reverb.generate(); // 重新生成卷积响应
      }
    });
    
    const bypassSubscription = this.parameters['bypass'].subscribe((value: number | boolean | string) => {
      if (!this.reverb || !this.audioInputHandler) return;
      
      if (typeof value === 'boolean') {
        this.bypassEnabled = value;
        this.updateOutputConnection();
      }
    });

    this.addInternalSubscriptions([
      decaySubscription,
      wetSubscription,
      preDelaySubscription,
      bypassSubscription
    ]);
  }

  /**
   * 释放资源方法
   */
  public dispose(): void {
    if (this.audioInputHandler) {
      this.audioInputHandler.dispose();
      this.audioInputHandler = null;
    }
    
    if (this.reverb) {
      try {
        this.reverb.dispose();
      } catch (error) {
        console.warn('Error disposing reverb', error);
      }
    }
    super.dispose();
  }
}
