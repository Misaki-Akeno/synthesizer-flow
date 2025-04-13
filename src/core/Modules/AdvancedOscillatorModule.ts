/* eslint-disable @typescript-eslint/no-explicit-any */
import { ParameterType, PortType } from '../ModuleBase';
import { AudioModuleBase } from '../AudioModuleBase';

/**
 * 将MIDI音符数转换为频率
 * MIDI标准：A4(69) = 440Hz
 * @param note MIDI音符数
 * @returns 对应的频率(Hz)
 */
function midiNoteToFrequency(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/**
 * 高级振荡器模块，支持MIDI输入和音高控制
 */
export class AdvancedOscillatorModule extends AudioModuleBase {
  private oscillator: any;
  private gainNode: any; // 用于渐变控制
  private velocityGain: any; // 用于MIDI力度控制
  
  private currentNote: number = 69; // A4
  private currentVelocity: number = 0; // 0-1范围的力度
  private currentFreqMod: number = 0; // 频率调制输入
  private noteOn: boolean = false; // 音符是否激活
  
  // 用于调试
  private debugInfo: string = '';

  constructor(id: string, name: string = '高级振荡器') {
    const moduleType = 'advancedoscillator';
    const parameters = {
      detune: {
        type: ParameterType.NUMBER,
        value: 0,
        min: -1200,
        max: 1200,
        step: 1,
        uiOptions: { advanced: true },
      },
      waveform: {
        type: ParameterType.LIST,
        value: 'sine',
        options: ['sine', 'square', 'sawtooth', 'triangle'],
      },
      modDepth: {
        type: ParameterType.NUMBER,
        value: 5,
        min: 0,
        max: 100,
        step: 1,
        uiOptions: { advanced: true },
      },
    };

    // 定义端口
    const inputPorts = {
      note: { // MIDI音符输入
        type: PortType.NUMBER,
        value: 69, // A4 = 69
      },
      velocity: { // MIDI力度输入
        type: PortType.NUMBER,
        value: 0, // 0-1范围
      },
      freqMod: { // 频率调制输入
        type: PortType.NUMBER,
        value: 0,
      },
    };

    const outputPorts = {
      audioout: {
        type: PortType.AUDIO,
        value: null,
      },
    };

    super(moduleType, id, name, parameters, inputPorts, outputPorts, true);
  }

  /**
   * 实现音频初始化
   */
  protected async initializeAudio(): Promise<void> {
    console.debug(`[${this.moduleType}Module ${this.id}] 开始初始化音频`);
    
    try {
      // 创建振荡器
      this.oscillator = new this.Tone.Oscillator({
        frequency: midiNoteToFrequency(this.currentNote),
        detune: this.getParameterValue('detune') as number,
        type: this.getParameterValue('waveform') as string,
      });
      
      // 创建力度增益节点
      this.velocityGain = new this.Tone.Gain(0);
      
      // 创建主增益节点
      this.gainNode = new this.Tone.Gain(0);
      
      // 振荡器 -> 力度增益 -> 主增益
      this.oscillator.connect(this.velocityGain);
      this.velocityGain.connect(this.gainNode);
      
      // 开始振荡器（但没有声音，因为增益为0）
      this.oscillator.start();
      
      // 更新输出端口
      this.outputPorts['audioout'].next(this.gainNode);
      
      // 设置参数和输入端口的绑定
      this.setupParameterBindings();
      this.setupInputBindings();
      
      console.debug(`[${this.moduleType}Module ${this.id}] 音频初始化成功`);
    } catch (error) {
      console.error(`[${this.moduleType}Module ${this.id}] 音频初始化失败:`, error);
    }
  }
  
  /**
   * 设置输入端口的绑定
   */
  private setupInputBindings(): void {
    // 处理MIDI音符输入
    const noteSubscription = this.inputPorts['note'].subscribe(
      (value: any) => {
        if (typeof value === 'number') {
          this.handleNoteInput(value);
        }
      }
    );
    
    // 处理MIDI力度输入
    const velocitySubscription = this.inputPorts['velocity'].subscribe(
      (value: any) => {
        if (typeof value === 'number') {
          this.handleVelocityInput(value);
        }
      }
    );
    
    // 处理频率调制输入
    const freqModSubscription = this.inputPorts['freqMod'].subscribe(
      (value: any) => {
        if (typeof value === 'number') {
          this.currentFreqMod = value;
          this.updateFrequency();
        }
      }
    );
    
    this.addInternalSubscriptions([
      noteSubscription, 
      velocitySubscription,
      freqModSubscription
    ]);
  }
  
  /**
   * 设置参数绑定
   */
  private setupParameterBindings(): void {
    if (!this.oscillator) return;
    
    // 音高微调参数
    const detuneSubscription = this.parameters['detune'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number' && this.oscillator) {
          this.applyParameterRamp(this.oscillator.detune, value);
          this.debugInfo = `应用微调: ${value}分`;
          console.debug(`[${this.moduleType}Module ${this.id}] ${this.debugInfo}`);
        }
      }
    );
    
    // 波形参数
    const waveformSubscription = this.parameters['waveform'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'string' && this.oscillator) {
          this.oscillator.type = value;
          this.debugInfo = `波形变更: ${value}`;
          console.debug(`[${this.moduleType}Module ${this.id}] ${this.debugInfo}`);
        }
      }
    );
    
    // 调制深度参数
    const modDepthSubscription = this.parameters['modDepth'].subscribe(
      () => {
        this.updateFrequency();
      }
    );
    
    this.addInternalSubscriptions([
      detuneSubscription,
      waveformSubscription,
      modDepthSubscription
    ]);
  }
  
  /**
   * 处理MIDI音符输入
   */
  private handleNoteInput(noteValue: number): void {
    // 记录新音符
    this.currentNote = noteValue;
    
    // 先更新频率，无论力度如何
    this.updateFrequency();
    
    // 如果有力度，则触发或维持音符
    if (this.currentVelocity > 0) {
      // 如果还没有音符激活，则触发音符开始
      if (!this.noteOn) {
        this.triggerAttack();
      }
    }
    
    this.debugInfo = `MIDI音符: ${noteValue}, 频率: ${midiNoteToFrequency(noteValue).toFixed(2)}Hz`;
    console.debug(`[${this.moduleType}Module ${this.id}] ${this.debugInfo}`);
  }
  
  /**
   * 处理MIDI力度输入
   */
  private handleVelocityInput(velocityValue: number): void {
    // 记录新的力度值
    this.currentVelocity = velocityValue;
    
    if (velocityValue > 0) {
      // 先更新频率，然后再处理声音的开始
      this.updateFrequency();
      
      // 力度大于0，触发音符开始
      if (!this.noteOn) {
        this.triggerAttack();
      } else {
        // 已经在发声，只更新力度
        this.updateVelocity();
      }
    } else {
      // 力度为0，触发音符释放
      if (this.noteOn) {
        this.triggerRelease();
      }
    }
    
    this.debugInfo = `MIDI力度: ${velocityValue.toFixed(2)}`;
    console.debug(`[${this.moduleType}Module ${this.id}] ${this.debugInfo}`);
  }
  
  /**
   * 触发音符开始
   */
  private triggerAttack(): void {
    if (!this.velocityGain || !this.gainNode) return;
    
    // 标记音符为激活状态
    this.noteOn = true;
    
    // 设置力度增益
    this.updateVelocity();
    
    // 启用主增益节点（使用父类的防爆音渐变）
    this.applyParameterRamp(this.gainNode.gain, 1, this.fadeTime);
    
    this.debugInfo = `触发音符开始: note=${this.currentNote}, 渐变时间=${this.fadeTime}s`;
    console.debug(`[${this.moduleType}Module ${this.id}] ${this.debugInfo}`);
  }
  
  /**
   * 触发音符释放
   */
  private triggerRelease(): void {
    if (!this.gainNode) return;
    
    // 标记音符为非激活状态
    this.noteOn = false;
    
    // 应用释放渐变（使用父类的防爆音渐变）
    this.applyParameterRamp(this.gainNode.gain, 0, this.fadeTime);
    
    this.debugInfo = `触发音符释放: 渐变时间=${this.fadeTime}s`;
    console.debug(`[${this.moduleType}Module ${this.id}] ${this.debugInfo}`);
  }
  
  /**
   * 更新力度增益
   */
  private updateVelocity(): void {
    if (!this.velocityGain) return;
    
    // 将0-1的力度值映射到增益
    const gainValue = this.currentVelocity;
    this.applyParameterRamp(this.velocityGain.gain, gainValue, 0.01);
    
    this.debugInfo = `更新力度增益: ${gainValue.toFixed(2)}`;
    console.debug(`[${this.moduleType}Module ${this.id}] ${this.debugInfo}`);
  }
  
  /**
   * 更新频率（包含调制）
   */
  private updateFrequency(): void {
    if (!this.oscillator) return;
    
    const baseFreq = midiNoteToFrequency(this.currentNote);
    const modDepth = this.getParameterValue('modDepth') as number;
    
    // 调制值范围0-1，映射到[-1, 1]范围用于双向调制
    const normalizedMod = this.currentFreqMod * 2 - 1;
    
    // 计算调制后的频率 (以半音为单位，modDepth是最大半音数)
    const freqRatio = Math.pow(2, (normalizedMod * modDepth) / 1200);
    const modulatedFreq = baseFreq * freqRatio;
    
    // 应用到振荡器
    this.applyParameterRamp(this.oscillator.frequency, modulatedFreq, 0.01);
    
    this.debugInfo = `更新频率: 基础=${baseFreq.toFixed(2)}Hz, 调制后=${modulatedFreq.toFixed(2)}Hz`;
    console.debug(`[${this.moduleType}Module ${this.id}] ${this.debugInfo}`);
  }
  
  /**
   * 重写启用状态变化处理
   */
  protected onEnabledStateChanged(enabled: boolean): void {
    if (this.gainNode) {
      if (enabled) {
        // 如果有活跃音符，则恢复增益
        if (this.noteOn) {
          this.applyParameterRamp(this.gainNode.gain, 1);
        }
      } else {
        // 如果禁用，则立即静音
        this.applyParameterRamp(this.gainNode.gain, 0, 0.05);
      }
    }
  }
  
  /**
   * 释放资源
   */
  public dispose(): void {
    this.disposeAudioNodes([this.oscillator, this.velocityGain, this.gainNode]);
    console.debug(`[${this.moduleType}Module ${this.id}] 释放资源`);
    super.dispose();
  }
}