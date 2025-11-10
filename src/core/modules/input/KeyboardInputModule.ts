'use client';

import { AudioModuleBase } from '@/core/base/AudioModuleBase';
import {
  ModuleMetadata,
  ParameterType,
  PortType,
} from '@/core/base/ModuleBase';
import keyboardEventListener from '@/lib/KeyboardEventListener';

/**
 * 检查是否在浏览器环境中运行
 */
const isBrowser = typeof window !== 'undefined';

/**
 * 键盘输入模块，提供屏幕虚拟钢琴键盘和计算机键盘输入功能
 */
export class KeyboardInputModule extends AudioModuleBase {
  // 模块元数据
  public static metadata: ModuleMetadata = {
    type: 'keyboardinput',
    label: '键盘输入器',
    description: '虚拟钢琴键盘输入模块，支持屏幕点击和计算机键盘输入',
    category: '输入',
    iconType: 'Music',
  };

  // 使用 Map 存储每个活动音符及其力度
  private activeNoteVelocities: Map<number, number> = new Map();

  // 环境信息
  private isServerSide: boolean = !isBrowser;

  // 钢琴键盘配置
  private keyboardStartNote: number = 60; // 中央C (MIDI音符60)
  private keyboardNoteCount: number = 24; // 默认2个八度

  // 键盘映射
  private keyToNoteMap: Record<string, number> = {};

  // 监听器ID列表，用于清理
  private keyListenerIds: number[] = [];

  constructor(id: string, name: string = '键盘输入器') {
    const moduleType = 'keyboardinput';
    const parameters = {
      transpose: {
        type: ParameterType.NUMBER,
        value: 0, // 音高转置，单位为半音
        min: -24,
        max: 24,
        step: 1,
        uiOptions: {
          label: '音高转置',
          describe: '调整输入音符的音高，单位为半音',
        },
      },
      velocitySensitivity: {
        type: ParameterType.NUMBER,
        value: 1, // 力度灵敏度，1为标准，小于1减弱，大于1增强
        min: 0.1,
        max: 2,
        step: 0.05,
        uiOptions: {
          label: '力度灵敏度',
          describe: '调整音符力度响应，1为标准，小于1减弱，大于1增强',
        },
      },
      startNote: {
        type: ParameterType.NUMBER,
        value: 60, // 起始音符 (中央C是60)
        min: 24,
        max: 96,
        step: 12,
        uiOptions: {
          label: '起始音符',
          describe: '键盘的起始音符，60是中央C',
          group: '键盘设置',
        },
      },
      noteCount: {
        type: ParameterType.NUMBER,
        value: 24, // 音符数量
        min: 12,
        max: 36,
        step: 12,
        uiOptions: {
          label: '键盘范围',
          describe: '键盘上显示的音符数量',
          group: '键盘设置',
        },
      },
      keyboardEnabled: {
        type: ParameterType.BOOLEAN,
        value: true, // 是否启用计算机键盘输入
        uiOptions: {
          label: '启用键盘输入',
          describe: '启用电脑键盘MIDI输入',
          group: '键盘设置',
        },
      },
    };

    // 定义输出端口
    const outputPorts = {
      // 添加复音输出端口
      activeNotes: {
        type: PortType.ARRAY,
        value: [], // 当前激活的音符数组
      },
      activeVelocities: {
        type: PortType.ARRAY,
        value: [], // 当前激活的力度数组 (与activeNotes一一对应)
      },
    };

    const inputPorts = {};

    super(moduleType, id, name, parameters, inputPorts, outputPorts, true);

    if (isBrowser) {
      this.keyboardStartNote = parameters.startNote.value as number;
      this.keyboardNoteCount = parameters.noteCount.value as number;
      this.updateKeyboardMapping();
      this.setupKeyboardListeners();
    } else {
    }
  }

  /**
   * 更新键盘到音符的映射关系
   */
  private updateKeyboardMapping(): void {
    // 基于当前的起始音符生成映射
    const startNote = this.keyboardStartNote;

    // 键盘布局：
    // 第一排: Q W E R T Y U I O P [ ]
    // 第二排: A S D F G H J K L ; '
    // 将一些常用的键映射到钢琴键
    this.keyToNoteMap = {
      // 第一个八度
      a: startNote, // C
      w: startNote + 1, // C#
      s: startNote + 2, // D
      e: startNote + 3, // D#
      d: startNote + 4, // E
      f: startNote + 5, // F
      t: startNote + 6, // F#
      g: startNote + 7, // G
      y: startNote + 8, // G#
      h: startNote + 9, // A
      u: startNote + 10, // A#
      j: startNote + 11, // B

      // 第二个八度
      k: startNote + 12, // C
      o: startNote + 13, // C#
      l: startNote + 14, // D
      p: startNote + 15, // D#
      ';': startNote + 16, // E
      "'": startNote + 17, // F
      ']': startNote + 18, // F#
      // 剩余的键可以根据需要映射
    };
  }

  /**
   * 设置全局键盘事件监听器
   */
  private setupKeyboardListeners(): void {
    if (!isBrowser) return;

    // 清除之前的监听器
    this.clearKeyboardListeners();

    // 添加按键按下监听器
    this.keyListenerIds.push(
      keyboardEventListener.addListener(
        '*',
        'keydown',
        (e) => {
          if (!this.isEnabled() || !this.getParameterValue('keyboardEnabled'))
            return;

          const key = e.key.toLowerCase();
          if (key in this.keyToNoteMap) {
            // 防止重复触发（按住键不放时）
            if (e.repeat) return;

            const note = this.keyToNoteMap[key];
            this.handleNoteOn(note, 0.7); // 默认力度0.7
          }
        },
        this.id
      )
    );

    // 添加按键释放监听器
    this.keyListenerIds.push(
      keyboardEventListener.addListener(
        '*',
        'keyup',
        (e) => {
          if (!this.isEnabled()) return;

          const key = e.key.toLowerCase();
          if (key in this.keyToNoteMap) {
            const note = this.keyToNoteMap[key];
            this.handleNoteOff(note);
          }
        },
        this.id
      )
    );
  }

  /**
   * 清除键盘事件监听器
   */
  private clearKeyboardListeners(): void {
    if (!isBrowser) return;

    // 移除所有为此模块注册的监听器
    keyboardEventListener.removeModuleListeners(this.id);
    this.keyListenerIds = [];
  }

  /**
   * 实现音频初始化（键盘模块不需要音频处理，但需要实现这个方法）
   */
  protected async initializeAudio(): Promise<void> {
    // 仅在浏览器环境中设置参数绑定
    if (isBrowser) {
      // 设置参数绑定
      this.setupParameterBindings();
    }
  }

  /**
   * 设置参数绑定
   */
  private setupParameterBindings(): void {
    // 检查浏览器环境
    if (!isBrowser) return;

    // 起始音符参数
    const startNoteSubscription = this.parameters['startNote'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') {
          this.keyboardStartNote = value;
          // 更新键盘映射
          this.updateKeyboardMapping();
          console.debug(
            `[${this.moduleType}Module ${this.id}] 更新起始音符: ${value}`
          );
        }
      }
    );

    // 音符数量参数
    const noteCountSubscription = this.parameters['noteCount'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') {
          this.keyboardNoteCount = value;
          console.debug(
            `[${this.moduleType}Module ${this.id}] 更新键盘范围: ${value}`
          );
        }
      }
    );

    // 键盘启用状态参数
    const keyboardEnabledSubscription = this.parameters[
      'keyboardEnabled'
    ].subscribe((value: number | boolean | string) => {
      // 当键盘输入被禁用时，释放所有当前活跃的音符
      if (typeof value === 'boolean' && !value) {
        // 获取所有通过键盘激活的音符，并释放它们
        const keysToRelease = Array.from(
          Object.values(this.keyToNoteMap)
        ).filter((note) => this.activeNoteVelocities.has(note));

        keysToRelease.forEach((note) => this.handleNoteOff(note));
      }
    });

    // 转置参数
    const transposeSubscription = this.parameters['transpose'].subscribe(
      () => {}
    );

    // 力度灵敏度参数
    const velocitySensitivitySubscription = this.parameters[
      'velocitySensitivity'
    ].subscribe(() => {});

    this.addInternalSubscriptions([
      startNoteSubscription,
      noteCountSubscription,
      transposeSubscription,
      velocitySensitivitySubscription,
      keyboardEnabledSubscription,
    ]);
  }

  /**
   * 处理音符按下事件
   * @param note 音符编号
   * @param velocity 力度 (0-1)
   */
  public handleNoteOn(note: number, velocity: number): void {
    if (!this.isEnabled()) return;

    // 应用音高转置
    const transpose = this.getParameterValue('transpose') as number;
    const transposedNote = Math.max(0, Math.min(127, note + transpose));

    // 应用力度灵敏度
    const sensitivity = this.getParameterValue('velocitySensitivity') as number;
    const scaledVelocity = Math.max(0, Math.min(1, velocity * sensitivity));

    // 添加到活跃音符 Map 中，存储音符和对应的力度
    this.activeNoteVelocities.set(transposedNote, scaledVelocity);

    // 更新输出端口
    this.updateOutputPorts();
  }

  /**
   * 处理音符释放事件
   * @param note 音符编号
   */
  public handleNoteOff(note: number): void {
    if (!this.isEnabled()) return;

    // 应用音高转置
    const transpose = this.getParameterValue('transpose') as number;
    const transposedNote = Math.max(0, Math.min(127, note + transpose));

    // 从活跃音符 Map 中移除
    this.activeNoteVelocities.delete(transposedNote);

    // 更新输出端口
    this.updateOutputPorts();
  }

  /**
   * 更新音符的力度（触后）
   * @param note 音符编号
   * @param velocity 新的力度值 (0-1)
   */
  public updateVelocity(note: number, velocity: number): void {
    if (!this.isEnabled()) return;

    // 应用音高转置
    const transpose = this.getParameterValue('transpose') as number;
    const transposedNote = Math.max(0, Math.min(127, note + transpose));

    // 只有在音符已激活的情况下才更新力度
    if (this.activeNoteVelocities.has(transposedNote)) {
      // 应用力度灵敏度
      const sensitivity = this.getParameterValue(
        'velocitySensitivity'
      ) as number;
      const scaledVelocity = Math.max(0, Math.min(1, velocity * sensitivity));

      // 更新力度值
      this.activeNoteVelocities.set(transposedNote, scaledVelocity);

      // 更新输出端口
      this.updateOutputPorts();
    }
  }

  /**
   * 更新输出端口的值
   */
  private updateOutputPorts(): void {
    // 从 Map 中提取音符和力度数组
    const notesArray = Array.from(this.activeNoteVelocities.keys());
    const velocitiesArray = Array.from(this.activeNoteVelocities.values());

    // 更新复音输出端口
    this.outputPorts['activeNotes'].next(notesArray);
    this.outputPorts['activeVelocities'].next(velocitiesArray);
  }

  /**
   * 重写启用状态变化处理
   */
  protected onEnabledStateChanged(enabled: boolean): void {
    if (!enabled) {
      // 如果模块被禁用，重置所有状态
      this.activeNoteVelocities.clear(); // 清空 Map
      this.updateOutputPorts();
    }
  }

  /**
   * 获取自定义UI配置
   * 添加钢琴键盘
   */
  public getCustomUI() {
    return {
      type: 'PianoKeyboard',
      props: {
        width: 280,
        height: 120,
        startNote: this.keyboardStartNote,
        noteCount: this.keyboardNoteCount,
        activeNotes: Array.from(this.activeNoteVelocities.keys()),
        onNoteOn: (note: number, velocity: number) =>
          this.handleNoteOn(note, velocity),
        onNoteOff: (note: number) => this.handleNoteOff(note),
        onAftertouch: (note: number, velocity: number) =>
          this.updateVelocity(note, velocity),
      },
    };
  }

  /**
   * 释放资源
   */
  public dispose(): void {
    // 清除键盘事件监听器
    if (isBrowser) {
      this.clearKeyboardListeners();
    }

    // 重置所有状态
    this.activeNoteVelocities.clear();

    console.debug(`[${this.moduleType}Module ${this.id}] 释放资源`);
    super.dispose();
  }
}
