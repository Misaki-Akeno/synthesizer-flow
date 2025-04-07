/* eslint-disable @typescript-eslint/no-explicit-any */
import { ModuleBase, ParameterType, PortType } from '../ModuleBase';

/**
 * LFO模块，生成低频调制信号用于自动调制声音
 */
export class LFOModule extends ModuleBase {
  private lfo: any;
  private signalScaler: any; // 将-1到1的信号映射到0到1范围
  private Tone: any;
  private intervalId: any = null; // 用于定期更新信号值

  constructor(id: string, name: string = 'LFO') {
    // 初始化基本参数
    const moduleType = 'lfo';
    const parameters = {
      rate: { 
        type: ParameterType.NUMBER, 
        value: 1.0, 
        min: 0.1, 
        max: 20.0,
        step: 0.1
      },
      depth: { 
        type: ParameterType.NUMBER, 
        value: 0.5, 
        min: 0, 
        max: 1.0,
        step: 0.01
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
    
    // LFO没有输入端口
    const inputPorts = {};
    
    // 定义输出端口：只有数值信号输出
    const outputPorts = {
      signal: { 
        type: PortType.NUMBER, 
        value: 0 
      }
    };

    super(moduleType, id, name, parameters, inputPorts, outputPorts);

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

      // 初始化LFO
      this.lfo = new this.Tone.LFO({
        frequency: this.getParameterValue('rate') as number,
        type: this.getParameterValue('waveform') as string,
        min: 0,  // 输出范围0-1
        max: 1
      });
      
      // 创建信号处理链
      this.signalScaler = new this.Tone.Gain(this.getParameterValue('depth') as number);
      
      // 连接LFO到信号缩放器
      this.lfo.connect(this.signalScaler);
      
      // 启动LFO
      if (this.getParameterValue('enabled') as boolean) {
        this.lfo.start();
      }
      
      // 设置参数绑定
      this.setupLFOBindings();
      
      // 启动定期更新信号输出的机制
      this.startSignalPolling();
    } catch (error) {
      console.error('Failed to initialize Tone.js LFO:', error);
    }
  }
  
  /**
   * 启动定期获取和更新LFO信号值的机制
   */
  private startSignalPolling(): void {
    // 先清除可能存在的旧定时器
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }
    
    // 每50ms读取一次LFO的当前值并更新到signal输出
    this.intervalId = setInterval(() => {
      if (!this.lfo || !this.signalScaler || !this.Tone) return;
      
      try {
        // 只有在LFO启用时才更新信号
        if (this.getParameterValue('enabled') as boolean) {
          // 读取当前LFO输出值
          const rawValue = this.signalScaler.getValue();
          
          // 确保值在0-1范围内
          const normalizedValue = Math.max(0, Math.min(1, rawValue));
          
          // 更新到signal输出端口
          this.outputPorts['signal'].next(normalizedValue);
        }
      } catch (error) {
        console.warn('Error polling LFO signal value:', error);
      }
    }, 50); // 50ms间隔，提供平滑的更新而不过度消耗性能
  }

  /**
   * 设置LFO参数绑定
   */
  private setupLFOBindings(): void {
    if (!this.lfo || !this.signalScaler) return;

    // 频率参数绑定
    const rateSubscription = this.parameters['rate'].subscribe((value: number | boolean | string) => {
      if (this.lfo && typeof value === 'number') {
        this.lfo.frequency.rampTo(value, 0.1);
      }
    });

    // 深度参数绑定
    const depthSubscription = this.parameters['depth'].subscribe((value: number | boolean | string) => {
      if (this.signalScaler && typeof value === 'number') {
        this.signalScaler.gain.rampTo(value, 0.1);
      }
    });

    // 波形参数绑定
    const waveformSubscription = this.parameters['waveform'].subscribe((value: number | boolean | string) => {
      if (this.lfo && typeof value === 'string') {
        this.lfo.type = value;
      }
    });
    
    // 启用状态绑定
    const enabledSubscription = this.parameters['enabled'].subscribe((value: number | boolean | string) => {
      if (!this.lfo) return;
      
      if (typeof value === 'boolean') {
        if (value) {
          if (this.lfo.state !== 'started') {
            this.lfo.start();
          }
        } else {
          if (this.lfo.state === 'started') {
            this.lfo.stop();
          }
          // 停止时将信号输出重置为0
          this.outputPorts['signal'].next(0);
        }
      }
    });

    this.addInternalSubscriptions([
      rateSubscription,
      depthSubscription,
      waveformSubscription,
      enabledSubscription
    ]);
  }

  /**
   * 释放资源方法
   */
  public dispose(): void {
    // 清理定时器
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.lfo) {
      try {
        this.lfo.stop();
        this.lfo.dispose();
      } catch (error) {
        console.warn('Error disposing LFO', error);
      }
    }
    
    if (this.signalScaler) {
      try {
        this.signalScaler.dispose();
      } catch (error) {
        console.warn('Error disposing signal scaler', error);
      }
    }
    
    super.dispose();
  }
}
