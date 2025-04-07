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
  private startTime: number = 0; // 记录LFO启动时间，用于手动计算值

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
      
      // 创建信号缩放器控制深度
      this.signalScaler = new this.Tone.Gain(this.getParameterValue('depth') as number);
      
      // 连接LFO到信号缩放器
      this.lfo.connect(this.signalScaler);
      
      // 记录起始时间，用于直接计算信号
      this.startTime = Date.now();
      
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
    
    // 每16ms计算一次当前LFO值并更新到signal输出
    this.intervalId = setInterval(() => {
      if (!this.lfo || !this.Tone) return;
      
      try {
        // 只有在LFO启用时才更新信号
        if (this.getParameterValue('enabled') as boolean) {
          // 使用基于时间的计算方法获取LFO当前值
          const currentValue = this.calculateLFOValue();
          
          // 更新到signal输出端口
          this.outputPorts['signal'].next(currentValue);
        }
      } catch (error) {
        console.warn('Error calculating LFO value:', error);
      }
    }, 16); // 使用16ms（约60fps）提供更平滑的更新
  }
  
  /**
   * 手动计算当前LFO值
   * 这比尝试从Tone.js中读取当前值更可靠
   */
  private calculateLFOValue(): number {
    const now = Date.now();
    const elapsedSeconds = (now - this.startTime) / 1000;
    const rate = this.getParameterValue('rate') as number;
    const depth = this.getParameterValue('depth') as number;
    const waveType = this.getParameterValue('waveform') as string;
    
    // 计算角度（2π * 频率 * 时间）
    const angle = 2 * Math.PI * rate * elapsedSeconds;
    
    // 基于波形类型计算值
    let value = 0;
    switch (waveType) {
      case 'sine':
        // 标准正弦波：y = sin(angle)，范围从-1到1
        value = Math.sin(angle);
        break;
      case 'square':
        // 方波：正弦波大于0时为1，否则为-1
        value = Math.sin(angle) >= 0 ? 1 : -1;
        break;
      case 'sawtooth':
        // 锯齿波：mod(angle, 2π)/2π * 2 - 1，范围从-1到1
        value = (angle % (2 * Math.PI)) / (2 * Math.PI) * 2 - 1;
        break;
      case 'triangle':
        // 三角波：abs(sawtooth) * 2 - 1，范围从-1到1
        const sawtoothValue = (angle % (2 * Math.PI)) / (2 * Math.PI) * 2 - 1;
        value = Math.abs(sawtoothValue) * 4 - 1;
        value = value > 1 ? 2 - value : value;
        break;
      default:
        value = Math.sin(angle);
    }
    
    // 将-1到1的范围映射到0到1
    value = (value + 1) / 2;
    
    // 应用深度
    value = value * depth;
    
    // 确保值在0-1范围内
    return Math.max(0, Math.min(1, value));
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
        // 重置起始时间，避免波形切换时的跳变
        this.startTime = Date.now();
      }
    });
    
    // 启用状态绑定
    const enabledSubscription = this.parameters['enabled'].subscribe((value: number | boolean | string) => {
      if (!this.lfo) return;
      
      if (typeof value === 'boolean') {
        if (value) {
          if (this.lfo.state !== 'started') {
            this.lfo.start();
            this.startTime = Date.now(); // 重置起始时间
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
