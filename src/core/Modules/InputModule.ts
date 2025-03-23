/* eslint-disable @typescript-eslint/no-explicit-any */
import { ModuleBase, ParameterType, PortType } from '../ModuleBase';

/**
 * 基本输入模块，生成信号并根据gain参数调整输出
 */
export class InputModule extends ModuleBase {
  private oscillator: any;
  private Tone: any;

  constructor(id: string, name: string = '输入模块') {
    // 初始化基本参数，使用新的参数定义格式
    const moduleType = 'input';
    const parameters = {
      gain: { 
        type: ParameterType.NUMBER, 
        value: 1.0, 
        min: 0, 
        max: 2.0,
        step: 0.1
      },
      freq: { 
        type: ParameterType.NUMBER, 
        value: 440, 
        min: 20, 
        max: 2000,
        step: 100
      },
      waveform: { 
        type: ParameterType.LIST, 
        value: 'sine', 
        options: ['sine', 'square', 'sawtooth', 'triangle'] 
      },
      enabled: {
        type: ParameterType.BOOLEAN,
        value: true
      }
    };
    
    // 使用新的端口定义格式
    const inputPorts = {}; // 输入模块没有输入接口
    
    const outputPorts = {
      output: { 
        type: PortType.NUMBER, 
        value: 0 
      },
      audio: { 
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
      
      // 根据enabled参数决定是否启动
      if (this.getParameterValue('enabled') as boolean) {
        this.oscillator.start();
      }

      // 设置音频输出
      this.outputPorts['audio'].next(this.oscillator);

      // 设置参数变更监听
      this.setupOscillatorBindings();
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
        this.oscillator.frequency.value = value;
      }
    });

    const gainSubscription = this.parameters['gain'].subscribe((value: number | boolean | string) => {
      if (this.oscillator && typeof value === 'number') {
        this.oscillator.volume.value = this.Tone.gainToDb(value);
      }
    });

    const waveformSubscription = this.parameters['waveform'].subscribe((value: number | boolean | string) => {
      if (this.oscillator && typeof value === 'string') {
        this.oscillator.type = value;
      }
    });
    
    const enabledSubscription = this.parameters['enabled'].subscribe((value: number | boolean | string) => {
      if (!this.oscillator) return;

      if (typeof value === 'boolean') {
        if (value && this.oscillator.state !== 'started') {
          this.oscillator.start();
        } else if (!value && this.oscillator.state === 'started') {
          this.oscillator.stop();
        }
      }
    });

    this.addInternalSubscriptions([
      freqSubscription,
      gainSubscription,
      waveformSubscription,
      enabledSubscription
    ]);
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
    super.dispose();
  }
}
