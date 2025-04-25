'use client';

import { ParameterType, PortType, ModuleMetadata } from '../ModuleBase';
import { AudioModuleBase } from '../AudioModuleBase';

/**
 * 检查是否在浏览器环境中运行
 */
const isBrowser = typeof window !== 'undefined';

/**
 * MIDI输入模块，接收外部MIDI控制器的输入，并将其转换为系统内部的信号
 */
export class MIDIInputModule extends AudioModuleBase {
  // 模块元数据
  public static metadata: ModuleMetadata = {
    type: 'midiinput',
    label: 'MIDI输入器',
    description: 'MIDI输入模块，接收并处理外部MIDI控制器的输入信号',
    category: '输入',
    iconType: 'Music',
  };

  // WebMIDI API相关
  private midiAccess: WebMidi.MIDIAccess | null = null;
  private midiInputs: WebMidi.MIDIInput[] = [];
  private selectedInput: WebMidi.MIDIInput | null = null;
  private inputDeviceId: string = '';
  private isRefreshing: boolean = false; // 新增：标记是否正在刷新设备

  // 模块状态
  // 使用 Map 存储每个活动音符及其力度
  private activeNoteVelocities: Map<number, number> = new Map();

  // 上次音符变化时间（用于防抖动）
  private lastNoteChangeTime: number = 0;

  // 环境信息
  private isServerSide: boolean = !isBrowser;

  constructor(id: string, name: string = 'MIDI输入器') {
    const moduleType = 'midiinput';
    const parameters = {
      channel: {
        type: ParameterType.NUMBER,
        value: 0, // 0表示所有通道，1-16表示具体MIDI通道
        min: 0,
        max: 16,
        step: 1,
        uiOptions: {
          label: 'MIDI通道',
          describe: '选择要监听的MIDI通道，0表示监听所有通道',
        },
      },
      inputDevice: {
        type: ParameterType.LIST,
        value: '',
        options: [],
        uiOptions: {
          label: '输入设备',
          describe: '选择连接的MIDI输入设备',
        },
      },
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
          describe: '调整MIDI音符力度响应，1为标准，小于1减弱，大于1增强',
        },
      },
    };

    // 定义输出端口 - 移除了单音符和力度端口
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

    // 仅在浏览器环境中初始化WebMIDI
    if (isBrowser) {
      // 延迟初始化，确保在客户端渲染时再执行
      setTimeout(() => {
        this.initWebMidi();
      }, 0);
    } else {
      console.warn(
        `[${this.moduleType}Module ${this.id}] 在服务器端运行，WebMIDI功能将在客户端可用`
      );
    }
  }

  /**
   * 初始化WebMIDI
   */
  private async initWebMidi(): Promise<void> {
    // 严格检查浏览器环境
    if (!isBrowser) {
      console.warn(
        `[${this.moduleType}Module ${this.id}] 非浏览器环境，跳过WebMIDI初始化`
      );
      return;
    }

    try {
      // 检查浏览器是否支持WebMIDI
      if ('navigator' in window && 'requestMIDIAccess' in navigator) {
        console.debug(`[${this.moduleType}Module ${this.id}] 初始化WebMIDI...`);
        const midiAccess = await navigator.requestMIDIAccess({ sysex: false });

        this.midiAccess = midiAccess as unknown as WebMidi.MIDIAccess;

        // 更新设备列表
        this.updateMIDIInputDevices();

        // 监听设备状态变化
        this.midiAccess.addEventListener('statechange', (event) => {
          console.debug(
            `[${this.moduleType}Module ${this.id}] MIDI设备状态变化:`,
            event
          );
          this.updateMIDIInputDevices();
        });

        // 如果没有发现设备，尝试延迟再次检测
        setTimeout(() => {
          if (this.midiInputs.length === 0) {
            this.updateMIDIInputDevices();
          }
        }, 1000);
      } else {
        console.warn(
          `[${this.moduleType}Module ${this.id}] 浏览器不支持WebMIDI API`
        );
      }
    } catch (error) {
      console.error(
        `[${this.moduleType}Module ${this.id}] WebMIDI初始化失败:`,
        error
      );
    }
  }

  /**
   * 更新可用的MIDI输入设备列表
   */
  private updateMIDIInputDevices(): void {
    // 检查浏览器环境
    if (!isBrowser || !this.midiAccess) return;

    // 清空当前设备列表
    this.midiInputs = [];
    const deviceNames: string[] = [];
    const deviceOptions: string[] = [];

    // 使用正确的方法访问MIDIInputMap
    try {
      // 获取所有输入设备 - 正确使用iterator
      const inputs = this.midiAccess.inputs.values();
      let input = inputs.next();

      while (!input.done) {
        const midiInput = input.value;
        this.midiInputs.push(midiInput);
        const deviceName =
          midiInput.name || `${midiInput.manufacturer || 'Unknown'} Input`;
        deviceNames.push(deviceName);
        deviceOptions.push(midiInput.id);

        input = inputs.next();
      }

      // 更新参数选项
      if (this.parameterMeta['inputDevice']) {
        this.parameterMeta['inputDevice'].options = deviceOptions;
        if (deviceOptions.length > 0) {
          this.parameters['inputDevice'].next(deviceOptions[0]);
        }
      }

      if (deviceNames.length === 0) {
        console.warn(
          `[${this.moduleType}Module ${this.id}] 未检测到MIDI输入设备，请确保设备已正确连接并授予浏览器访问权限`
        );
      } else {
      }
    } catch (error) {
      console.error(
        `[${this.moduleType}Module ${this.id}] 检测MIDI设备时出错:`,
        error
      );
    }
  }

  /**
   * 连接到指定的MIDI输入设备
   */
  private connectToDevice(deviceId: string): void {
    // 检查浏览器环境
    if (!isBrowser) return;

    if (!this.midiInputs.length) {
      console.warn(
        `[${this.moduleType}Module ${this.id}] 无可用的MIDI输入设备`
      );
      return;
    }

    // 如果已连接到设备，先解除连接
    if (this.selectedInput) {
      this.disconnectFromDevice();
    }

    // 查找指定ID的设备
    const device = this.midiInputs.find((input) => input.id === deviceId);

    if (device) {
      this.selectedInput = device;
      this.inputDeviceId = deviceId;

      // 添加MIDI消息监听器
      this.selectedInput.addEventListener(
        'midimessage',
        this.handleMIDIMessage.bind(this)
      );

      console.debug(
        `[${this.moduleType}Module ${this.id}] 已连接MIDI输入设备: ${device.name || device.manufacturer}`
      );
    } else {
      // 如果没找到，选择第一个可用设备
      if (this.midiInputs.length > 0) {
        this.connectToDevice(this.midiInputs[0].id);
      }
    }
  }

  /**
   * 断开当前MIDI输入设备连接
   */
  private disconnectFromDevice(): void {
    if (this.selectedInput) {
      // 移除MIDI消息监听器
      this.selectedInput.removeEventListener(
        'midimessage',
        this.handleMIDIMessage.bind(this)
      );

      this.selectedInput = null;
      this.inputDeviceId = '';

      // 重置所有音符状态
      this.activeNoteVelocities.clear(); // 清空 Map

      // 更新输出端口
      this.updateOutputPorts();
    }
  }

  /**
   * 处理来自MIDI设备的消息
   */
  private handleMIDIMessage(event: WebMidi.MIDIMessageEvent): void {
    if (!this.isEnabled()) return;

    const data = event.data;

    // 获取通道参数
    const selectedChannel = this.getParameterValue('channel') as number;

    // 解析MIDI消息
    const status = data[0];
    const statusType = status & 0xf0; // 获取消息类型
    const channel = (status & 0x0f) + 1; // 获取通道(1-16)

    // 如果设置了特定通道，且不是该通道的消息，则忽略
    if (selectedChannel !== 0 && channel !== selectedChannel) {
      return;
    }

    // 处理不同类型的消息
    switch (statusType) {
      case 0x90: // Note On
        if (data[2] > 0) {
          // 有些设备发送velocity=0的Note On表示Note Off
          this.handleNoteOn(data[1], data[2]);
        } else {
          this.handleNoteOff(data[1]);
        }
        break;

      case 0x80: // Note Off
        this.handleNoteOff(data[1]);
        break;

      // 可以添加对Control Change等其他消息的处理

      default:
        // 忽略其他类型的消息
        break;
    }
  }

  /**
   * 处理音符按下事件
   */
  private handleNoteOn(note: number, velocity: number): void {
    // 获取当前时间戳，用于批处理
    const currentTime = performance.now();

    // 应用音高转置
    const transpose = this.getParameterValue('transpose') as number;
    const transposedNote = Math.max(0, Math.min(127, note + transpose));

    // 应用力度灵敏度
    const sensitivity = this.getParameterValue('velocitySensitivity') as number;
    const scaledVelocity = Math.max(
      0,
      Math.min(1, (velocity / 127) * sensitivity)
    );

    // 添加到活跃音符 Map 中，存储音符和对应的力度
    this.activeNoteVelocities.set(transposedNote, scaledVelocity);

    // 始终立即更新输出端口，但使用批处理方式减少更新频率
    // 移除条件检查，确保每个音符变化都会更新
    this.updateOutputPorts();
    this.lastNoteChangeTime = currentTime;
  }

  /**
   * 处理音符释放事件
   */
  private handleNoteOff(note: number): void {
    // 应用音高转置
    const transpose = this.getParameterValue('transpose') as number;
    const transposedNote = Math.max(0, Math.min(127, note + transpose));

    // 从活跃音符 Map 中移除
    this.activeNoteVelocities.delete(transposedNote);

    // 始终立即更新输出端口
    this.updateOutputPorts();
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
   * 实现音频初始化（MIDI模块不需要音频处理，但需要实现这个方法）
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

    // 输入设备参数
    const inputDeviceSubscription = this.parameters['inputDevice'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'string') {
          if (value) {
            // 检查设备ID是否在有效列表中
            const deviceOptions =
              this.parameterMeta['inputDevice']?.options || [];
            if (deviceOptions.includes(value)) {
              this.connectToDevice(value);
            } else {
              console.debug(
                `[${this.moduleType}Module ${this.id}] 设备ID "${value}"不在当前可用设备列表中，尝试连接默认设备`
              );
              if (this.midiInputs.length > 0) {
                const defaultDevice = this.midiInputs[0].id;
                // 静默更新参数值，避免触发警告
                if (defaultDevice) {
                  this.parameters['inputDevice'].next(defaultDevice);
                }
              }
            }
          }
        }
      }
    );

    // 通道参数
    const channelSubscription = this.parameters['channel'].subscribe(() => {});

    // 转置参数
    const transposeSubscription = this.parameters['transpose'].subscribe(
      () => {}
    );

    // 力度灵敏度参数
    const velocitySensitivitySubscription = this.parameters[
      'velocitySensitivity'
    ].subscribe(() => {});

    this.addInternalSubscriptions([
      inputDeviceSubscription,
      channelSubscription,
      transposeSubscription,
      velocitySensitivitySubscription,
    ]);
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

    console.debug(
      `[${this.moduleType}Module ${this.id}] 启用状态变更: ${enabled}`
    );
  }

  /**
   * 释放资源
   */
  public dispose(): void {
    // 断开MIDI设备连接
    this.disconnectFromDevice();

    console.debug(`[${this.moduleType}Module ${this.id}] 释放资源`);
    super.dispose();
  }

  /**
   * 刷新MIDI设备列表
   * 用户可通过按钮触发该方法重新扫描可用设备
   */
  public refreshMIDIDevices(): void {
    if (this.isRefreshing) return; // 防止重复刷新

    this.isRefreshing = true;
    console.debug(`[${this.moduleType}Module ${this.id}] 刷新MIDI设备列表...`);

    try {
      // 断开当前连接
      this.disconnectFromDevice();

      // 重新初始化MIDI访问
      if (
        isBrowser &&
        'navigator' in window &&
        'requestMIDIAccess' in navigator
      ) {
        navigator.requestMIDIAccess({ sysex: false }).then(
          (midiAccess) => {
            this.midiAccess = midiAccess as unknown as WebMidi.MIDIAccess;
            // 更新设备列表
            this.updateMIDIInputDevices();
            // 恢复状态
            this.isRefreshing = false;
            console.debug(
              `[${this.moduleType}Module ${this.id}] MIDI设备列表已更新`
            );
          },
          (error) => {
            console.error(
              `[${this.moduleType}Module ${this.id}] 刷新MIDI设备失败:`,
              error
            );
            this.isRefreshing = false;
          }
        );
      } else {
        console.warn(
          `[${this.moduleType}Module ${this.id}] 浏览器不支持WebMIDI API`
        );
        this.isRefreshing = false;
      }
    } catch (error) {
      console.error(
        `[${this.moduleType}Module ${this.id}] 刷新MIDI设备出错:`,
        error
      );
      this.isRefreshing = false;
    }
  }

  /**
   * 获取自定义UI配置
   * 添加刷新MIDI设备的按钮
   */
  public getCustomUI() {
    return {
      type: 'RefreshButton',
      props: {
        label: '刷新MIDI设备',
        onClick: () => this.refreshMIDIDevices(),
        disabled: this.isRefreshing,
      },
    };
  }
}
