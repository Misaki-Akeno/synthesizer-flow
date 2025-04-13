import { ParameterType, PortType } from '../ModuleBase';
import { AudioModuleBase } from '../AudioModuleBase';

/**
 * MIDI输入模块，接收外部MIDI控制器的输入，并将其转换为系统内部的信号
 */
export class MIDIInputModule extends AudioModuleBase {
  // WebMIDI API相关
  private midiAccess: WebMidi.MIDIAccess | null = null;
  private midiInputs: WebMidi.MIDIInput[] = [];
  private selectedInput: WebMidi.MIDIInput | null = null;
  private inputDeviceId: string = '';
  
  // 模块状态
  private currentNote: number = 0; // 最后按下的MIDI音符
  private currentVelocity: number = 0; // 最后按下的力度
  private activeNotes: Set<number> = new Set(); // 当前激活的音符集合
  private debugInfo: string = '';
  
  // 上次音符变化时间（用于防抖动）
  private lastNoteChangeTime: number = 0;
  
  constructor(id: string, name: string = 'MIDI输入器') {
    const moduleType = 'midiinput';
    const parameters = {
      channel: {
        type: ParameterType.NUMBER,
        value: 0, // 0表示所有通道，1-16表示具体MIDI通道
        min: 0,
        max: 16,
        step: 1,
      },
      inputDevice: {
        type: ParameterType.LIST,
        value: '',
        options: [],
      },
      transpose: {
        type: ParameterType.NUMBER,
        value: 0, // 音高转置，单位为半音
        min: -24,
        max: 24, 
        step: 1,
      },
      velocitySensitivity: {
        type: ParameterType.NUMBER,
        value: 1, // 力度灵敏度，1为标准，小于1减弱，大于1增强
        min: 0.1,
        max: 2,
        step: 0.05,
      },
    };

    // 定义输出端口 - 移除了gate端口
    const outputPorts = {
      note: {
        type: PortType.NUMBER,
        value: 60, // 默认C4
      },
      velocity: {
        type: PortType.NUMBER,
        value: 0, // 0-1范围
      }
    };
    
    const inputPorts = {};

    super(moduleType, id, name, parameters, inputPorts, outputPorts, true);
    
    this.initWebMidi();
  }

  /**
   * 初始化WebMIDI
   */
  private async initWebMidi(): Promise<void> {
    
    try {
      // 检查浏览器是否支持WebMIDI
      if (typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator) {
        const midiAccess = await navigator.requestMIDIAccess({ sysex: false });
          
          this.midiAccess = midiAccess as unknown as WebMidi.MIDIAccess;
        
        // 更新设备列表
        this.updateMIDIInputDevices();
        
        // 监听设备状态变化
        this.midiAccess.addEventListener('statechange', (event) => {
          console.debug(`[${this.moduleType}Module ${this.id}] MIDI设备状态变化:`, event);
          this.updateMIDIInputDevices();
        });
        
      } else {
        console.warn(`[${this.moduleType}Module ${this.id}] 浏览器不支持WebMIDI`);
      }
    } catch (error) {
      console.error(`[${this.moduleType}Module ${this.id}] WebMIDI初始化失败:`, error);
    }
  }
  
  /**
   * 更新可用的MIDI输入设备列表
   */
  private updateMIDIInputDevices(): void {
    if (!this.midiAccess) return;
    
    // 清空当前设备列表
    this.midiInputs = [];
    const deviceNames: string[] = [];
    const deviceOptions: string[] = [];
    
    // 获取所有输入设备
    this.midiAccess.inputs.forEach(input => {
      this.midiInputs.push(input);
      const deviceName = input.name || `${input.manufacturer} Input`;
      deviceNames.push(deviceName);
      deviceOptions.push(input.id);
    });
    
    // 更新参数选项
    if (this.parameterMeta['inputDevice']) {
      this.parameterMeta['inputDevice'].options = deviceOptions;
      if (deviceOptions.length > 0) {
        this.parameters['inputDevice'].next(deviceOptions[0]);
      }
    }
    
    console.debug(`[${this.moduleType}Module ${this.id}] 发现${deviceNames.length}个MIDI输入设备:`, deviceNames);
  }
  
  /**
   * 连接到指定的MIDI输入设备
   */
  private connectToDevice(deviceId: string): void {
    if (!this.midiInputs.length) {
      console.warn(`[${this.moduleType}Module ${this.id}] 无可用的MIDI输入设备`);
      return;
    }
    
    // 如果已连接到设备，先解除连接
    if (this.selectedInput) {
      this.disconnectFromDevice();
    }
    
    // 查找指定ID的设备
    const device = this.midiInputs.find(input => input.id === deviceId);
    
    if (device) {
      this.selectedInput = device;
      this.inputDeviceId = deviceId;
      
      // 添加MIDI消息监听器
      this.selectedInput.addEventListener('midimessage', this.handleMIDIMessage.bind(this));
      
      console.debug(`[${this.moduleType}Module ${this.id}] 已连接MIDI输入设备: ${device.name || device.manufacturer}`);
    } else {
      console.warn(`[${this.moduleType}Module ${this.id}] 未找到ID为${deviceId}的MIDI输入设备`);
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
      this.selectedInput.removeEventListener('midimessage', this.handleMIDIMessage.bind(this));
      
      console.debug(`[${this.moduleType}Module ${this.id}] 已断开MIDI输入设备: ${this.selectedInput.name || this.selectedInput.manufacturer}`);
      
      this.selectedInput = null;
      this.inputDeviceId = '';
      
      // 重置所有音符状态
      this.activeNotes.clear();
      this.currentNote = 0;
      this.currentVelocity = 0;
      
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
    const statusType = status & 0xF0; // 获取消息类型
    const channel = (status & 0x0F) + 1; // 获取通道(1-16)
    
    // 如果设置了特定通道，且不是该通道的消息，则忽略
    if (selectedChannel !== 0 && channel !== selectedChannel) {
      return;
    }
    
    // 处理不同类型的消息
    switch (statusType) {
      case 0x90: // Note On
        if (data[2] > 0) { // 有些设备发送velocity=0的Note On表示Note Off
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
    // 获取当前时间戳，用于防抖动
    const currentTime = performance.now();
    
    // 应用音高转置
    const transpose = this.getParameterValue('transpose') as number;
    const transposedNote = Math.max(0, Math.min(127, note + transpose));
    
    // 应用力度灵敏度
    const sensitivity = this.getParameterValue('velocitySensitivity') as number;
    const scaledVelocity = Math.max(0, Math.min(1, (velocity / 127) * sensitivity));
    
    // 添加到活跃音符集合
    this.activeNotes.add(transposedNote);
    
    // 更新当前音符和力度
    this.currentNote = transposedNote;
    this.currentVelocity = scaledVelocity;
    
    // 更新输出端口（加入防抖动，避免频繁更新）
    if (currentTime - this.lastNoteChangeTime > 5) { // 5ms的防抖动时间
      this.updateOutputPorts();
      this.lastNoteChangeTime = currentTime;
    }
    
    this.debugInfo = `收到MIDI音符按下: note=${note}->转置为${transposedNote}, velocity=${velocity}->缩放为${scaledVelocity.toFixed(2)}`;
    console.debug(`[${this.moduleType}Module ${this.id}] ${this.debugInfo}`);
  }
  
  /**
   * 处理音符释放事件
   */
  private handleNoteOff(note: number): void {
    // 应用音高转置
    const transpose = this.getParameterValue('transpose') as number;
    const transposedNote = Math.max(0, Math.min(127, note + transpose));
    
    // 从活跃音符集合中移除
    this.activeNotes.delete(transposedNote);
    
    // 如果没有活跃音符了，则将velocity设为0
    if (this.activeNotes.size === 0) {
      this.currentVelocity = 0;
    } else {
      // 如果释放的是当前音符，则切换到最后按下的音符
      if (this.currentNote === transposedNote) {
        // 选择最后一个活跃的音符
        this.currentNote = Array.from(this.activeNotes).pop() || 0;
      }
    }
    
    // 更新输出端口
    this.updateOutputPorts();
    
    this.debugInfo = `收到MIDI音符释放: note=${note}->转置为${transposedNote}, 剩余活跃音符: ${this.activeNotes.size}`;
    console.debug(`[${this.moduleType}Module ${this.id}] ${this.debugInfo}`);
  }
  
  /**
   * 更新输出端口的值
   */
  private updateOutputPorts(): void {
    // 更新note输出
    this.outputPorts['note'].next(this.currentNote);
    
    // 更新velocity输出
    this.outputPorts['velocity'].next(this.currentVelocity);
    
    this.debugInfo = `更新MIDI输出: note=${this.currentNote}, velocity=${this.currentVelocity.toFixed(2)}`;
    console.debug(`[${this.moduleType}Module ${this.id}] ${this.debugInfo}`);
  }
  
  /**
   * 实现音频初始化（MIDI模块不需要音频处理，但需要实现这个方法）
   */
  protected async initializeAudio(): Promise<void> {
    console.debug(`[${this.moduleType}Module ${this.id}] MIDI输入模块不需要初始化音频`);
    
    // 设置参数绑定
    this.setupParameterBindings();
  }
  
  /**
   * 设置参数绑定
   */
  private setupParameterBindings(): void {
    // 输入设备参数
    const inputDeviceSubscription = this.parameters['inputDevice'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'string' && value) {
          this.connectToDevice(value);
        }
      }
    );
    
    // 通道参数
    const channelSubscription = this.parameters['channel'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') {
          this.debugInfo = `设置MIDI通道过滤: ${value === 0 ? '所有通道' : `通道${value}`}`;
          console.debug(`[${this.moduleType}Module ${this.id}] ${this.debugInfo}`);
        }
      }
    );
    
    // 转置参数
    const transposeSubscription = this.parameters['transpose'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') {
          this.debugInfo = `设置MIDI音高转置: ${value > 0 ? '+' : ''}${value} 半音`;
          console.debug(`[${this.moduleType}Module ${this.id}] ${this.debugInfo}`);
        }
      }
    );
    
    // 力度灵敏度参数
    const velocitySensitivitySubscription = this.parameters['velocitySensitivity'].subscribe(
      (value: number | boolean | string) => {
        if (typeof value === 'number') {
          this.debugInfo = `设置力度灵敏度: ${value.toFixed(2)}`;
          console.debug(`[${this.moduleType}Module ${this.id}] ${this.debugInfo}`);
        }
      }
    );
    
    this.addInternalSubscriptions([
      inputDeviceSubscription,
      channelSubscription,
      transposeSubscription,
      velocitySensitivitySubscription
    ]);
  }
  
  /**
   * 重写启用状态变化处理
   */
  protected onEnabledStateChanged(enabled: boolean): void {
    if (!enabled) {
      // 如果模块被禁用，重置所有状态
      this.activeNotes.clear();
      this.currentNote = 0;
      this.currentVelocity = 0;
      this.updateOutputPorts();
    }
    
    console.debug(`[${this.moduleType}Module ${this.id}] 启用状态变更: ${enabled}`);
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
}