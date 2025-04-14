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
  private mainGainDb: any; // db单位的增益控制

  // 复音相关
  private maxVoices: number = 8; // 最大声部数
  private mixer: any; // 声部混合器
  private voices: Map<
    number,
    {
      // 管理中的声部
      oscillator: any; // 振荡器
      velocityGain: any; // 力度控制增益
      envelope: any; // 包络发生器
      active: boolean; // 是否激活
      note: number; // 当前音符
      triggerTime: number; // 触发时间戳
    }
  > = new Map();

  // 包络默认值
  private attackVelSens: number = 0; // 力度对音量起始的影响系数
  private attackTime: number = 0.01; // 起音时间(秒)
  private decayTime: number = 0.1; // 衰减时间(秒)
  private sustainLevel: number = 0.7; // 延音电平(0-1)
  private sustainFade: number = 0; // 延音渐弱时间(秒)
  private releaseTime: number = 0.2; // 释音时间(秒)

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
        uiOptions: {
          group: '不常见参数',
          label: '微调',
          describe: '调整音高的偏移值，单位为音分',
        },
      },
      octave: {
        type: ParameterType.NUMBER,
        value: 0,
        min: -4,
        max: 4,
        step: 1,
        uiOptions: {
          group: '不常见参数',
          label: '八度',
          describe: '对音符进行八度移调',
        },
      },
      semi: {
        type: ParameterType.NUMBER,
        value: 0,
        min: -11,
        max: 11,
        step: 1,
        uiOptions: {
          group: '不常见参数',
          label: '半音',
          describe: '调整半音移调',
        },
      },
      gainDb: {
        type: ParameterType.NUMBER,
        value: 0,
        min: -60,
        max: 12,
        step: 0.1,
        uiOptions: {
          label: '增益',
          describe: '控制音频信号的音量大小，单位为分贝(dB)',
        },
      },
      waveform: {
        type: ParameterType.LIST,
        value: 'sine',
        options: ['sine', 'square', 'sawtooth', 'triangle'],
        uiOptions: {
          label: '波形',
          describe: '选择振荡器的波形类型',
        },
      },
      voiceCount: {
        type: ParameterType.NUMBER,
        value: 8,
        min: 1,
        max: 16,
        step: 1,
        uiOptions: {
          group: '不常见参数',
          label: '声部数',
          describe: '设置同时发声的最大音符数',
        },
      },
      attackVelSens: {
        type: ParameterType.NUMBER,
        value: 0.8,
        min: -1,
        max: 1,
        step: 0.01,
        uiOptions: {
          label: 'Att<Vel',
          describe: '力度对起音速度的影响',
          group: '包络设置',
        },
      },
      attack: {
        type: ParameterType.NUMBER,
        value: 0.2,
        min: 0.001,
        max: 5,
        step: 0.001,
        uiOptions: {
          log: true,
          label: '起音时间',
          describe: '触发音符时包络的起始时间，单位为秒',
          group: '包络设置',
        },
      },
      decay: {
        type: ParameterType.NUMBER,
        value: 0.5,
        min: 0.001,
        max: 5,
        step: 0.001,
        uiOptions: {
          log: true,
          label: '衰减时间',
          describe: '音调达到持续水平前的衰减时间，单位为秒',
          group: '包络设置',
        },
      },
      sustain: {
        type: ParameterType.NUMBER,
        value: 0.7,
        min: 0,
        max: 1,
        step: 0.01,
        uiOptions: {
          label: '持续音量',
          describe: '维持音符时的音量水平（0-1）',
          group: '包络设置',
        },
      },
      sustainTime: {
        type: ParameterType.NUMBER,
        value: 0,
        min: 0,
        max: 20,
        step: 0.01,
        uiOptions: {
          label: 'S.Time',
          describe: '延音渐弱时间，单位为秒',
          group: '包络设置',
        },
      },
      release: {
        type: ParameterType.NUMBER,
        value: 0.8,
        min: 0.001,
        max: 10,
        step: 0.001,
        uiOptions: {
          label: '释音时间',
          describe: '音符释放后的衰减时间，单位为秒',
          group: '包络设置',
        },
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
      detuneIn: {
        type: PortType.NUMBER,
        value: null, // 外部detune输入
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
      this.mainGainDb = new this.Tone.Gain(1);
      this.gainNode = new this.Tone.Gain(1);

      // 连接：主增益dB -> 主增益线性
      this.mainGainDb.connect(this.gainNode);

      // 初始化复音系统
      this.initializePolyphony();

      // 更新输出端口
      this.outputPorts['audioout'].next(this.gainNode);

      // 设置参数和输入端口的绑定
      this.setupParameterBindings();
      this.setupInputBindings();

      console.debug(`[${this.moduleType}Module ${this.id}] 音频初始化成功`);
    } catch (error) {
      console.error(
        `[${this.moduleType}Module ${this.id}] 音频初始化失败:`,
        error
      );
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
          this.handlePolyphonicInput(
            value,
            Array.isArray(velocities) ? velocities : []
          );
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

    // 处理外部detune输入
    const detuneInSubscription = this.inputPorts['detuneIn'].subscribe(
      (value: any) => {
        if (typeof value === 'number') {
          // 更新所有声部的detune
          this.voices.forEach((voice) => {
            if (voice.oscillator && voice.oscillator.detune) {
              this.applyParameterRamp(voice.oscillator.detune, value, 0.01);
            }
          });
          console.debug(
            `[${this.moduleType}Module ${this.id}] 外部detune设置: ${value}`
          );
        }
      }
    );

    this.addInternalSubscriptions([
      notesSubscription,
      velocitiesSubscription,
      detuneInSubscription,
    ]);
  }

  /**
   * 设置参数绑定
   */
  private setupParameterBindings(): void {
    // 最大声部数参数
    const voiceCountSubscription = this.parameters['voiceCount'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') {
          this.maxVoices = value;
          console.debug(
            `[${this.moduleType}Module ${this.id}] 设置最大声部数: ${this.maxVoices}`
          );
        }
      }
    );

    // 波形参数 - 更新所有活跃声部的波形
    const waveformSubscription = this.parameters['waveform'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'string') {
          this.voices.forEach((voice) => {
            if (voice.oscillator) {
              voice.oscillator.type = value;
            }
          });
          console.debug(
            `[${this.moduleType}Module ${this.id}] 更新所有声部波形: ${value}`
          );
        }
      }
    );

    // 微调参数 - 只有在没有外部detune输入时生效
    const detuneSubscription = this.parameters['detune'].subscribe(
      (value: number | boolean | string) => {
        if (
          typeof value === 'number' &&
          this.inputPorts['detuneIn'].getValue() === null
        ) {
          this.voices.forEach((voice) => {
            if (voice.oscillator && voice.oscillator.detune) {
              this.applyParameterRamp(
                voice.oscillator.detune,
                this.calculateTotalDetune(),
                0.01
              );
            }
          });
          console.debug(
            `[${this.moduleType}Module ${this.id}] 更新所有声部微调: ${value}`
          );
        }
      }
    );

    // 八度移调参数
    const octaveSubscription = this.parameters['octave'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') {
          // 更新所有声部的频率
          this.updateAllVoicesFrequency();
          console.debug(
            `[${this.moduleType}Module ${this.id}] 设置八度移调: ${value}`
          );
        }
      }
    );

    // 半音移调参数
    const semiSubscription = this.parameters['semi'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') {
          // 更新所有声部的频率
          this.updateAllVoicesFrequency();
          console.debug(
            `[${this.moduleType}Module ${this.id}] 设置半音移调: ${value}`
          );
        }
      }
    );

    // dB增益参数
    const gainDbSubscription = this.parameters['gainDb'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number' && this.mainGainDb) {
          // 将dB转换为线性增益
          const linearGain = Math.pow(10, value / 20);
          this.applyParameterRamp(this.mainGainDb.gain, linearGain, 0.02);
          console.debug(
            `[${this.moduleType}Module ${this.id}] 设置增益: ${value}dB (${linearGain})`
          );
        }
      }
    );

    // 包络参数
    const attackVelSensSubscription = this.parameters[
      'attackVelSens'
    ].subscribe((value: number | boolean | string) => {
      if (typeof value === 'number') {
        this.attackVelSens = value;
      }
    });

    const attackSubscription = this.parameters['attack'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') {
          this.attackTime = value;
        }
      }
    );

    const decaySubscription = this.parameters['decay'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') {
          this.decayTime = value;
        }
      }
    );

    const sustainSubscription = this.parameters['sustain'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') {
          this.sustainLevel = value;
        }
      }
    );

    const sustainTimeSubscription = this.parameters['sustainTime'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') {
          this.sustainFade = value;
        }
      }
    );

    const releaseSubscription = this.parameters['release'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') {
          this.releaseTime = value;
        }
      }
    );

    this.addInternalSubscriptions([
      voiceCountSubscription,
      waveformSubscription,
      detuneSubscription,
      octaveSubscription,
      semiSubscription,
      gainDbSubscription,
      attackVelSensSubscription,
      attackSubscription,
      decaySubscription,
      sustainSubscription,
      sustainTimeSubscription,
      releaseSubscription,
    ]);
  }

  /**
   * 计算总的detune值（包括octave和semi）
   */
  private calculateTotalDetune(): number {
    // 获取参数值
    const detune = this.getParameterValue('detune') as number;
    const octave = this.getParameterValue('octave') as number;
    const semi = this.getParameterValue('semi') as number;

    // 外部detune输入优先
    const detuneInput = this.inputPorts['detuneIn'].getValue();
    const baseDetune = typeof detuneInput === 'number' ? detuneInput : detune;

    // 计算总的detune
    // 八度 = 1200音分，半音 = 100音分
    const totalDetune = baseDetune + octave * 1200 + semi * 100;

    return totalDetune;
  }

  /**
   * 更新所有声部的频率（移调后）
   */
  private updateAllVoicesFrequency(): void {
    const totalDetune = this.calculateTotalDetune();

    this.voices.forEach((voice, _note) => {
      if (voice.oscillator && voice.oscillator.detune) {
        this.applyParameterRamp(voice.oscillator.detune, totalDetune, 0.02);
      }
    });
  }

  /**
   * 初始化复音系统
   */
  private initializePolyphony(): void {
    if (!this.Tone) return;

    // 创建混音器
    this.mixer = new this.Tone.Gain(1);

    // 将混音器连接到主增益节点
    this.mixer.connect(this.mainGainDb);

    console.debug(
      `[${this.moduleType}Module ${this.id}] 初始化复音系统，最大声部数: ${this.maxVoices}`
    );
  }

  /**
   * 处理复音音符数组输入
   * @param notes 音符数组
   * @param velocities 力度数组（可选）
   */
  private handlePolyphonicInput(
    notes: number[],
    velocities: number[] = []
  ): void {
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
      this.applyParameterRamp(
        voice.oscillator.frequency,
        midiNoteToFrequency(note),
        0.01
      );

      // 重置触发时间戳
      voice.triggerTime = Date.now();

      // 触发包络
      this.triggerEnvelope(voice, velocity);

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
          // 找出最早触发的声部
          let oldestTime = Infinity;
          this.voices.forEach((v, n) => {
            if (v.triggerTime < oldestTime) {
              oldestTime = v.triggerTime;
              replacedNote = n;
            }
          });
        }

        // 移除要替换的声部
        if (replacedNote !== null) {
          this.disposeVoice(replacedNote);
        } else {
          console.debug(
            `[${this.moduleType}Module ${this.id}] 已达到最大声部数${this.maxVoices}，无法创建新声部`
          );
          return;
        }
      }

      try {
        // 获取当前波形
        const waveform = this.getParameterValue('waveform') as string;
        const totalDetune = this.calculateTotalDetune();

        // 创建新的振荡器
        const osc = new this.Tone.Oscillator({
          frequency: midiNoteToFrequency(note),
          detune: totalDetune,
          type: waveform,
        });

        // 创建包络发生器
        const env = new this.Tone.Envelope({
          attack: this.getAttackTime(velocity),
          decay: this.decayTime,
          sustain: this.sustainLevel,
          release: this.releaseTime,
        });

        // 创建力度增益节点
        const velGain = new this.Tone.Gain(0);

        // 连接包络到力度增益控制
        env.connect(velGain.gain);

        // 连接：振荡器 -> 力度增益 -> 混音器
        osc.connect(velGain);
        velGain.connect(this.mixer);

        // 启动振荡器
        osc.start();

        // 触发包络
        env.triggerAttack();

        // 保存当前时间戳
        const now = Date.now();

        // 如果设置了延音衰减时间，设置延音结束处理
        if (this.sustainFade > 0) {
          const fadeStartTime = now + (this.attackTime + this.decayTime) * 1000;
          setTimeout(() => {
            if (this.voices.has(note) && this.voices.get(note)!.active) {
              velGain.gain.linearRampToValueAtTime(
                0,
                this.Tone.now() + this.sustainFade
              );
            }
          }, fadeStartTime - now);
        }

        // 存储声部信息
        this.voices.set(note, {
          oscillator: osc,
          velocityGain: velGain,
          envelope: env,
          active: true,
          note: note,
          triggerTime: now,
        });

        this.debugInfo = `创建新声部: note=${note}, 频率=${midiNoteToFrequency(note).toFixed(2)}Hz, 力度=${velocity.toFixed(2)}`;
      } catch (error) {
        console.error(
          `[${this.moduleType}Module ${this.id}] 创建声部失败:`,
          error
        );
      }
    }

    console.debug(`[${this.moduleType}Module ${this.id}] ${this.debugInfo}`);
  }

  /**
   * 基于力度和包络感应参数计算真实的Attack时间
   * @param velocity 力度值（0-1）
   * @returns 实际attack时间
   */
  private getAttackTime(velocity: number): number {
    // 如果攻击速度对力度敏感，调整攻击时间
    if (this.attackVelSens !== 0) {
      const velFactor = 1 - velocity * this.attackVelSens;
      // 确保攻击时间不会小于0.001秒
      return Math.max(0.001, this.attackTime * velFactor);
    }
    return this.attackTime;
  }

  /**
   * 触发声部的包络
   * @param voice 声部对象
   * @param velocity 力度值（0-1）
   */
  private triggerEnvelope(voice: any, velocity: number): void {
    if (!voice.envelope) return;

    // 更新包络参数
    voice.envelope.attack = this.getAttackTime(velocity);
    voice.envelope.decay = this.decayTime;
    voice.envelope.sustain = this.sustainLevel;
    voice.envelope.release = this.releaseTime;

    // 触发包络
    voice.envelope.triggerAttack();

    // 如果设置了延音衰减时间，设置延音结束处理
    if (this.sustainFade > 0) {
      const fadeStartTime =
        Date.now() + (this.attackTime + this.decayTime) * 1000;
      setTimeout(() => {
        if (
          this.voices.has(voice.note) &&
          this.voices.get(voice.note)!.active
        ) {
          voice.velocityGain.gain.linearRampToValueAtTime(
            0,
            this.Tone.now() + this.sustainFade
          );
        }
      }, fadeStartTime - Date.now());
    }
  }

  /**
   * 释放一个声部（不销毁，只停止发声）
   * @param note MIDI音符
   */
  private releaseVoice(note: number): void {
    if (!this.voices.has(note)) return;

    const voice = this.voices.get(note)!;

    // 应用释放渐变
    if (voice.envelope) {
      voice.envelope.triggerRelease();
    } else {
      this.applyParameterRamp(voice.velocityGain.gain, 0, this.releaseTime);
    }

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

    // 重触发包络以更新力度
    this.triggerEnvelope(voice, velocity);

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

      if (voice.envelope) {
        voice.envelope.disconnect();
        voice.envelope.dispose();
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
      console.error(
        `[${this.moduleType}Module ${this.id}] 销毁声部失败:`,
        error
      );
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
    this.disposeAudioNodes([this.mixer, this.mainGainDb, this.gainNode]);

    console.debug(`[${this.moduleType}Module ${this.id}] 释放资源`);
    super.dispose();
  }
}
