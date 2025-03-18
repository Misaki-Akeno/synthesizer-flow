/* eslint-disable @typescript-eslint/no-explicit-any */
import { ModuleBase, ModuleInterface } from '../ModuleBase';

/**
 * 基本输入模块，生成信号并根据gain参数调整输出
 */
export class InputModule extends ModuleBase {
  private oscillator: any;
  private Tone: any;

  constructor(id: string, name: string = '输入模块') {
    // 初始化基本参数，包含范围定义
    const moduleType = 'input';
    const parameters = {
      gain: { value: 1.0, min: 0, max: 2.0 },
      freq: { value: 440, min: 20, max: 20000 },
      waveform: { value: 0, min: 0, max: 3 }, // 0:sine, 1:square, 2:sawtooth, 3:triangle
    };
    const inputPorts = {}; // 输入模块没有输入接口
    const outputPorts = {
      output: 0 as ModuleInterface,
      audio: null as ModuleInterface, // 音频输出端口
    }; // 输出接口

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
    const ToneModule = await import('tone');
    this.Tone = ToneModule;

    // 初始化Tone.js振荡器
    this.oscillator = new this.Tone.Oscillator({
      frequency: this.getParameterValue('freq'),
      volume: this.Tone.gainToDb(this.getParameterValue('gain')),
      type: 'sine',
    }).start();

    // 设置音频输出
    this.outputPorts['audio'].next(this.oscillator);

    // 设置参数变更监听
    this.setupOscillatorBindings();
  }

  /**
   * 设置振荡器参数绑定
   */
  private setupOscillatorBindings(): void {
    if (!this.oscillator || !this.Tone) return;

    const freqSubscription = this.parameters['freq'].subscribe((value) => {
      if (this.oscillator) {
        this.oscillator.frequency.value = value;
      }
    });

    const gainSubscription = this.parameters['gain'].subscribe((value) => {
      if (this.oscillator) {
        this.oscillator.volume.value = this.Tone.gainToDb(value);
      }
    });

    const waveformSubscription = this.parameters['waveform'].subscribe(
      (value) => {
        if (this.oscillator) {
          const waveforms = ['sine', 'square', 'sawtooth', 'triangle'];
          const index = Math.min(Math.floor(value), waveforms.length - 1);
          this.oscillator.type = waveforms[index] as any;
        }
      }
    );

    this.addInternalSubscriptions([
      freqSubscription,
      gainSubscription,
      waveformSubscription,
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
    this.oscillator.stop();
    this.oscillator.dispose();
    super.dispose();
  }
}
