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
 * 复音振荡器模块，支持同时发声多个音符
 */
export class AdvancedOscillatorModule extends AudioModuleBase {
  private gainNode: any; // 用于渐变控制
  
  // 复音相关
  private maxVoices: number = 8; // 最大声部数
  private mixer: any; // 声部混合器
  private voices: Map<number, { // 管理中的声部
    oscillator: any,  // 振荡器
    velocityGain: any, // 力度控制增益
    active: boolean,   // 是否激活
    note: number       // 当前音符
  }> = new Map();
  
  // 用于调试
  private debugInfo: string = '';

  constructor(id: string, name: string = '复音振荡器') {
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
      voiceCount: {
        type: ParameterType.NUMBER,
        value: 8,
        min: 1,
        max: 16,
        step: 1,
        uiOptions: { advanced: true },
      },
    };

    // 定义端口
    const inputPorts = {
      notes: {
        type: PortType.ARRAY,
        value: [], // 音符数组
      },
      velocities: {
        type: PortType.ARRAY,
        value: [], // 力度数组
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
      // 创建主增益节点
      this.gainNode = new this.Tone.Gain(1);
      
      // 初始化复音系统
      this.initializePolyphony();
      
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
    // 处理复音音符数组输入
    const notesSubscription = this.inputPorts['notes'].subscribe(
      (value: any) => {
        if (Array.isArray(value) && value.length > 0) {
          // 获取对应的力度数组
          const velocities = this.inputPorts['velocities'].getValue();
          // 处理复音输入
          this.handlePolyphonicInput(value, Array.isArray(velocities) ? velocities : []);
        } else if (Array.isArray(value) && value.length === 0) {
          // 空数组则释放所有声部
          this.voices.forEach((_, note) => {
            this.releaseVoice(note);
          });
        }
      }
    );
    
    // 处理复音力度数组输入 - 如果音符数组存在，触发复音处理
    const velocitiesSubscription = this.inputPorts['velocities'].subscribe(
      (value: any) => {
        if (Array.isArray(value)) {
          const notes = this.inputPorts['notes'].getValue();
          if (Array.isArray(notes) && notes.length > 0) {
            this.handlePolyphonicInput(notes, value);
          }
        }
      }
    );
    
    this.addInternalSubscriptions([notesSubscription, velocitiesSubscription]);
  }
  
  /**
   * 设置参数绑定
   */
  private setupParameterBindings(): void {
    // 声部数量参数
    const voiceCountSubscription = this.parameters['voiceCount'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') {
          this.maxVoices = value;
          console.debug(`[${this.moduleType}Module ${this.id}] 设置最大声部数: ${this.maxVoices}`);
        }
      }
    );
    
    // 波形参数 - 更新所有活跃声部的波形
    const waveformSubscription = this.parameters['waveform'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'string') {
          this.voices.forEach(voice => {
            if (voice.oscillator) {
              voice.oscillator.type = value;
            }
          });
          console.debug(`[${this.moduleType}Module ${this.id}] 更新所有声部波形: ${value}`);
        }
      }
    );
    
    // 微调参数 - 更新所有声部的微调
    const detuneSubscription = this.parameters['detune'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') {
          this.voices.forEach(voice => {
            if (voice.oscillator && voice.oscillator.detune) {
              this.applyParameterRamp(voice.oscillator.detune, value);
            }
          });
          console.debug(`[${this.moduleType}Module ${this.id}] 更新所有声部微调: ${value}`);
        }
      }
    );
    
    this.addInternalSubscriptions([
      voiceCountSubscription,
      waveformSubscription,
      detuneSubscription
    ]);
  }
  
  /**
   * 初始化复音系统
   */
  private initializePolyphony(): void {
    if (!this.Tone) return;
    
    // 创建混音器
    this.mixer = new this.Tone.Gain(1);
    
    // 将混音器连接到主增益节点
    this.mixer.connect(this.gainNode);
    
    console.debug(`[${this.moduleType}Module ${this.id}] 初始化复音系统，最大声部数: ${this.maxVoices}`);
  }
  
  /**
   * 处理复音音符数组输入
   * @param notes 音符数组
   * @param velocities 力度数组（可选）
   */
  private handlePolyphonicInput(notes: number[], velocities: number[] = []): void {
    if (!this.mixer || !this.isEnabled()) return;
    
    // 创建当前活跃音符的集合，用于后续比较
    const activeNotes = new Set(notes);
    
    // 处理释放的音符（当前声部中有，但新音符列表中没有的）
    this.voices.forEach((voice, noteNumber) => {
      if (!activeNotes.has(noteNumber) && voice.active) {
        this.releaseVoice(noteNumber);
      }
    });
    
    // 处理新的音符（新音符列表中有，但未激活的）
    notes.forEach((note, index) => {
      // 获取对应的力度（如果提供）
      const velocity = index < velocities.length ? velocities[index] : 0.7;
      
      // 如果这个音符已经有声部并且是活跃的，只需更新力度
      if (this.voices.has(note) && this.voices.get(note)!.active) {
        this.updateVoiceVelocity(note, velocity);
      } else {
        // 否则触发新的声部
        this.triggerVoice(note, velocity);
      }
    });
    
    this.debugInfo = `复音处理: ${notes.length}个音符活跃`;
    console.debug(`[${this.moduleType}Module ${this.id}] ${this.debugInfo}`);
  }
  
  /**
   * 触发一个新的声部
   * @param note MIDI音符
   * @param velocity 力度值 (0-1)
   */
  private triggerVoice(note: number, velocity: number): void {
    // 如果声部已经存在但没激活，重用它
    if (this.voices.has(note)) {
      const voice = this.voices.get(note)!;
      
      // 更新音符（频率）
      voice.note = note;
      this.applyParameterRamp(voice.oscillator.frequency, midiNoteToFrequency(note), 0.01);
      
      // 更新力度
      this.applyParameterRamp(voice.velocityGain.gain, velocity, 0.01);
      
      // 标记为激活
      voice.active = true;
      
      this.debugInfo = `重用声部: note=${note}, 频率=${midiNoteToFrequency(note).toFixed(2)}Hz, 力度=${velocity.toFixed(2)}`;
    } 
    // 如果需要创建新声部
    else {
      // 检查是否已达到最大声部数
      if (this.voices.size >= this.maxVoices) {
        // 寻找可以替换的声部（当前未激活的）
        let replacedNote: number | null = null;
        this.voices.forEach((v, n) => {
          if (!v.active && replacedNote === null) {
            replacedNote = n;
          }
        });
        
        // 如果没有未激活的声部，则查找持续时间最长的声部
        if (replacedNote === null) {
          // 这里简化处理：直接替换第一个找到的声部
          // 实际应用中可以使用时间戳等方式找出最早触发的声部
          replacedNote = this.voices.keys().next().value ?? null;
        }
        
        // 移除要替换的声部
        if (replacedNote !== null) {
          this.disposeVoice(replacedNote);
        } else {
          console.debug(`[${this.moduleType}Module ${this.id}] 已达到最大声部数${this.maxVoices}，无法创建新声部`);
          return;
        }
      }
      
      try {
        // 获取当前波形
        const waveform = this.getParameterValue('waveform') as string;
        const detune = this.getParameterValue('detune') as number;
        
        // 创建新的振荡器
        const osc = new this.Tone.Oscillator({
          frequency: midiNoteToFrequency(note),
          detune: detune,
          type: waveform,
        });
        
        // 创建力度增益节点
        const velGain = new this.Tone.Gain(velocity);
        
        // 连接：振荡器 -> 力度增益 -> 混音器
        osc.connect(velGain);
        velGain.connect(this.mixer);
        
        // 启动振荡器
        osc.start();
        
        // 存储声部信息
        this.voices.set(note, {
          oscillator: osc,
          velocityGain: velGain,
          active: true,
          note: note
        });
        
        this.debugInfo = `创建新声部: note=${note}, 频率=${midiNoteToFrequency(note).toFixed(2)}Hz, 力度=${velocity.toFixed(2)}`;
      } catch (error) {
        console.error(`[${this.moduleType}Module ${this.id}] 创建声部失败:`, error);
      }
    }
    
    console.debug(`[${this.moduleType}Module ${this.id}] ${this.debugInfo}`);
  }
  
  /**
   * 释放一个声部（不销毁，只停止发声）
   * @param note MIDI音符
   */
  private releaseVoice(note: number): void {
    if (!this.voices.has(note)) return;
    
    const voice = this.voices.get(note)!;
    
    // 应用释放渐变
    this.applyParameterRamp(voice.velocityGain.gain, 0, this.fadeTime);
    
    // 标记为非激活
    voice.active = false;
    
    this.debugInfo = `释放声部: note=${note}`;
    console.debug(`[${this.moduleType}Module ${this.id}] ${this.debugInfo}`);
  }
  
  /**
   * 更新声部的力度
   * @param note MIDI音符
   * @param velocity 新的力度值 (0-1)
   */
  private updateVoiceVelocity(note: number, velocity: number): void {
    if (!this.voices.has(note)) return;
    
    const voice = this.voices.get(note)!;
    
    // 应用力度变化
    this.applyParameterRamp(voice.velocityGain.gain, velocity, 0.01);
    
    this.debugInfo = `更新声部力度: note=${note}, 力度=${velocity.toFixed(2)}`;
    console.debug(`[${this.moduleType}Module ${this.id}] ${this.debugInfo}`);
  }
  
  /**
   * 销毁一个声部并释放资源
   * @param note MIDI音符
   */
  private disposeVoice(note: number): void {
    if (!this.voices.has(note)) return;
    
    const voice = this.voices.get(note)!;
    
    try {
      // 停止并释放资源
      if (voice.oscillator) {
        voice.oscillator.stop();
        voice.oscillator.disconnect();
        voice.oscillator.dispose();
      }
      
      if (voice.velocityGain) {
        voice.velocityGain.disconnect();
        voice.velocityGain.dispose();
      }
      
      // 从映射中删除
      this.voices.delete(note);
      
      this.debugInfo = `销毁声部: note=${note}`;
      console.debug(`[${this.moduleType}Module ${this.id}] ${this.debugInfo}`);
    } catch (error) {
      console.error(`[${this.moduleType}Module ${this.id}] 销毁声部失败:`, error);
    }
  }
  
  /**
   * 重写启用状态变化处理
   */
  protected onEnabledStateChanged(enabled: boolean): void {
    if (this.gainNode) {
      if (enabled) {
        // 恢复增益
        this.applyParameterRamp(this.gainNode.gain, 1);
      } else {
        // 如果禁用，则立即静音
        this.applyParameterRamp(this.gainNode.gain, 0, 0.05);
        
        // 释放所有声部
        this.voices.forEach((_, note) => {
          this.releaseVoice(note);
        });
      }
    }
  }
  
  /**
   * 释放资源
   */
  public dispose(): void {
    // 释放所有声部
    this.voices.forEach((_, note) => {
      this.disposeVoice(note);
    });
    
    // 释放主要音频节点
    this.disposeAudioNodes([this.mixer, this.gainNode]);
    
    console.debug(`[${this.moduleType}Module ${this.id}] 释放资源`);
    super.dispose();
  }
}