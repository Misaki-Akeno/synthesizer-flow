/* eslint-disable @typescript-eslint/no-explicit-any */
import { ModuleBase, ParameterType, PortType } from '../ModuleBase';

/**
 * 振荡器模块，生成音频信号并根据参数调整输出
 */
export class OscillatorModule extends ModuleBase {
  private oscillator: any;
  private gainNode: any; // 添加增益节点用于渐变控制
  private Tone: any;
  private fadeTime = 0.01; //避免爆破音
  
  // 存储调制信号的当前值
  private currentFreqMod: number = 0;
  private currentGainMod: number = 0;

  constructor(id: string, name: string = '振荡器') {
    // 初始化基本参数，使用新的参数定义格式
    const moduleType = 'oscillator';
    const parameters = {
      gain: {
        type: ParameterType.NUMBER,
        value: 1.0,
        min: 0,
        max: 2.0,
        step: 0.1,
      },
      freq: {
        type: ParameterType.NUMBER,
        value: 440,
        min: 20,
        max: 2000,
        step: 10,
      },
      waveform: {
        type: ParameterType.LIST,
        value: 'sine',
        options: ['sine', 'square', 'sawtooth', 'triangle'],
      },
      enabled: {
        type: ParameterType.BOOLEAN,
        value: true,
      },
      // 新增调制深度参数
      freqModDepth: {
        type: ParameterType.NUMBER,
        value: 2, // 默认调制深度100Hz
        min: 0,
        max: 20,
        step: 1,
      },
      gainModDepth: {
        type: ParameterType.NUMBER,
        value: 0.5, // 默认调制深度0.5
        min: 0,
        max: 1,
        step: 0.05,
      },
    };
    
    // 使用新的端口定义格式，添加调制输入端口
    const inputPorts = {
      // 增加频率调制输入
      freqMod: { 
        type: PortType.NUMBER, 
        value: 0 
      },
      // 增加音量调制输入
      gainMod: { 
        type: PortType.NUMBER, 
        value: 0 
      }
    };
    
    const outputPorts = {
      output: { 
        type: PortType.NUMBER, 
        value: 0 
      },
      audioout: { 
        type: PortType.AUDIO, 
        value: null 
      }
    };

    super(moduleType, id, name, parameters, inputPorts, outputPorts);

    // 仅在浏览器环境下初始化Tone.js
    if (typeof window !== 'undefined') {
      // 使用动态导入Tone.js
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
      if (this.getParameterValue('enabled') as boolean) {
        this.gainNode.gain.rampTo(1, this.fadeTime);
      }

      this.outputPorts['audioout'].next(this.gainNode);

      // 设置参数变更监听
      this.setupOscillatorBindings();
      
      // 设置调制输入处理
      this.setupModulationHandling();
    } catch (error) {
      console.error('Failed to initialize Tone.js:', error);
    }
  }

  /**
   * 设置振荡器参数绑定
   */
  private setupOscillatorBindings(): void {
    if (!this.oscillator || !this.Tone) return;

    const freqSubscription = this.parameters['freq'].subscribe((value: number | boolean | string) => {
      if (this.oscillator && typeof value === 'number') {
        // 应用基础频率加上调制效果
        this.applyFrequencyWithModulation(value);
      }
    });

    const gainSubscription = this.parameters['gain'].subscribe((value: number | boolean | string) => {
      if (this.oscillator && typeof value === 'number') {
        // 应用基础增益加上调制效果
        this.applyGainWithModulation(value);
      }
    });

    const waveformSubscription = this.parameters['waveform'].subscribe((value: number | boolean | string) => {
      if (this.oscillator && typeof value === 'string') {
        this.oscillator.type = value;
      }
    });
    
    const enabledSubscription = this.parameters['enabled'].subscribe((value: number | boolean | string) => {
      if (!this.oscillator || !this.gainNode) return;

      if (typeof value === 'boolean') {
        if (value) {
          // 渐入: 音量从0到1
          this.gainNode.gain.cancelScheduledValues(this.Tone.now());
          this.gainNode.gain.rampTo(1, this.fadeTime);
        } else {
          // 渐出: 音量从1到0
          this.gainNode.gain.cancelScheduledValues(this.Tone.now());
          this.gainNode.gain.rampTo(0, this.fadeTime);
        }
      }
    });

    // 添加调制深度参数的订阅，当调制深度改变时重新应用调制
    const freqModDepthSubscription = this.parameters['freqModDepth'].subscribe(() => {
      const baseFreq = this.getParameterValue('freq') as number;
      this.applyFrequencyWithModulation(baseFreq);
    });

    const gainModDepthSubscription = this.parameters['gainModDepth'].subscribe(() => {
      const baseGain = this.getParameterValue('gain') as number;
      this.applyGainWithModulation(baseGain);
    });

    this.addInternalSubscriptions([
      freqSubscription,
      gainSubscription,
      waveformSubscription,
      enabledSubscription,
      freqModDepthSubscription,
      gainModDepthSubscription
    ]);
  }

  /**
   * 设置调制输入处理
   */
  private setupModulationHandling(): void {
    if (!this.oscillator) return;

    // 处理频率调制输入
    const freqModSubscription = this.inputPorts['freqMod'].subscribe((value: any) => {
      if (typeof value === 'number') {
        this.currentFreqMod = value;
        const baseFreq = this.getParameterValue('freq') as number;
        this.applyFrequencyWithModulation(baseFreq);
      }
    });

    // 处理增益调制输入
    const gainModSubscription = this.inputPorts['gainMod'].subscribe((value: any) => {
      if (typeof value === 'number') {
        this.currentGainMod = value;
        const baseGain = this.getParameterValue('gain') as number;
        this.applyGainWithModulation(baseGain);
      }
    });

    this.addInternalSubscriptions([freqModSubscription, gainModSubscription]);
  }

  /**
   * 应用频率调制
   * @param baseFrequency 基础频率
   */
  private applyFrequencyWithModulation(baseFrequency: number): void {
    if (!this.oscillator) return;
    
    const modDepth = this.getParameterValue('freqModDepth') as number;
    // 调制值范围0-1，映射到[-1, 1]范围用于双向调制
    const normalizedMod = (this.currentFreqMod * 2) - 1; 
    // 计算调制后的频率: 基础频率 + 调制深度 * 调制信号
    const modulatedFreq = baseFrequency + (modDepth * normalizedMod);
    
    // 应用到振荡器，使用cancelScheduledValues和rampTo确保平滑过渡
    this.oscillator.frequency.cancelScheduledValues(this.Tone.now());
    this.oscillator.frequency.rampTo(modulatedFreq, 0.01); // 快速过渡但避免爆音
  }

  /**
   * 应用增益调制
   * @param baseGain 基础增益
   */
  private applyGainWithModulation(baseGain: number): void {
    if (!this.oscillator) return;
    
    const modDepth = this.getParameterValue('gainModDepth') as number;
    // 计算调制后的增益: 基础增益 + 调制深度 * 调制信号
    const modulatedGain = Math.max(0, Math.min(2, baseGain + (modDepth * this.currentGainMod)));
    
    // 应用到振荡器
    this.oscillator.volume.cancelScheduledValues(this.Tone.now());
    this.oscillator.volume.rampTo(this.Tone.gainToDb(modulatedGain), 0.01);
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
    if (this.oscillator) {
      try {
        this.oscillator.stop();
        this.oscillator.dispose();
      } catch (error) {
        console.warn('Error disposing oscillator', error);
      }
    }
    
    if (this.gainNode) {
      try {
        this.gainNode.dispose();
      } catch (error) {
        console.warn('Error disposing gain node', error);
      }
    }
    
    super.dispose();
  }
}
