/* eslint-disable @typescript-eslint/no-explicit-any */
import { ModuleBase, ParameterType, PortType } from '../ModuleBase';

/**
 * 混响效果器模块，处理音频信号并添加混响效果
 */
export class ReverbModule extends ModuleBase {
  private reverb: any;
  private Tone: any;

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
      
      // 设置音频输出
      this.outputPorts['output'].next(this.reverb);

      // 监听输入端口变化
      this.setupInputHandling();
      
      // 设置参数变更监听
      this.setupReverbBindings();
    } catch (error) {
      console.error('Failed to initialize Tone.js Reverb:', error);
    }
  }

  /**
   * 设置输入处理
   */
  private setupInputHandling(): void {
    if (!this.reverb) return;

    const audioInputSubscription = this.inputPorts['input'].subscribe((audioSource: any) => {
      if (!audioSource || !this.reverb) return;
      
      try {
        // 断开现有连接
        this.reverb.disconnect();
        
        // 连接新的音频源到混响
        audioSource.connect(this.reverb);
        
        // 如果启用了bypass，则直接将输入连接到输出
        if (this.getParameterValue('bypass') as boolean) {
          this.outputPorts['output'].next(audioSource);
        } else {
          this.outputPorts['output'].next(this.reverb);
        }
      } catch (error) {
        console.error('Error connecting audio to reverb:', error);
      }
    });

    this.addInternalSubscription(audioInputSubscription);
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
      if (!this.reverb) return;
      
      if (typeof value === 'boolean') {
        const inputSource = this.getInputValue('input');
        if (inputSource) {
          if (value) { // Bypass enabled
            this.outputPorts['output'].next(inputSource);
          } else { // Bypass disabled
            this.outputPorts['output'].next(this.reverb);
          }
        }
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
   * 设置模块内部参数与输出之间的绑定关系
   */
  protected setupInternalBindings(): void {
    // 混响模块不需要将参数直接绑定到输出
  }

  /**
   * 释放资源方法
   */
  public dispose(): void {
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
