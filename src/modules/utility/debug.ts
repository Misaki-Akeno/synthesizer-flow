/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Tone from 'tone';
import { Module } from '@/core/domain/Module';
import { ParameterValue } from '@/types/event';
import {
  ModuleCategory,
  ModuleConfiguration,
  DataType,
  ParamType,
  ModuleBase,
  ModuleParams,
  Port,
} from '@/types/module';
import { eventBus } from '@/core/events/EventBus';

// 模块常量定义
const MODULE_ID = 'debug';

// 定义日志条目类型
interface LogEntry {
  id: string; // 唯一ID
  timestamp: number; // 时间戳
  type: string; // 日志类型 (parameter, signal, trigger, audio)
  source: string; // 来源 (端口ID或参数名称)
  value: any; // 值
  metadata?: Record<string, any>; // 额外元数据
}

/**
 * 调试模块配置
 */
export const debugModuleConfig: ModuleConfiguration = {
  metadata: {
    id: MODULE_ID,
    name: '调试器',
    version: '1.0.0',
    category: ModuleCategory.UTILITY,
    tags: ['调试', '监控', '工具'],
    description: '通用调试模块，可接收所有类型的输入并记录信号和参数变化',
    author: 'SynthesizerFlow',
    created: '2023-07-15',
    updated: '2023-07-15',
    moduleClass: './debug',
    moduleConstructor: undefined, // 将在后面设置
  },

  interfaces: {
    inputs: [
      {
        id: 'audio_in',
        label: '音频输入',
        dataType: DataType.AUDIO,
        description: '接收任何音频信号',
      },
      {
        id: 'control_in',
        label: '控制输入',
        dataType: DataType.CONTROL,
        description: '接收任何控制信号',
      },
      {
        id: 'trigger_in',
        label: '触发输入',
        dataType: DataType.TRIGGER,
        description: '接收任何触发信号',
      },
      {
        id: 'note_in',
        label: '音符输入',
        dataType: DataType.NOTE,
        description: '接收任何音符信号',
      },
      {
        id: 'midi_in',
        label: 'MIDI输入',
        dataType: DataType.MIDI,
        description: '接收任何MIDI信号',
      },
    ],
    outputs: [], // 没有输出端口
  },

  parameters: {
    maxLogEntries: {
      type: ParamType.INTEGER,
      default: 100,
      min: 10,
      max: 1000,
      step: 10,
      label: '最大日志条数',
      description: '限制日志条目的最大数量',
    },
    clearLogs: {
      type: ParamType.BOOLEAN,
      default: false,
      label: '清除日志',
      description: '点击清除所有日志记录',
    },
    logAudio: {
      type: ParamType.BOOLEAN,
      default: true,
      label: '记录音频信号',
      description: '是否记录音频信号变化',
    },
    logControl: {
      type: ParamType.BOOLEAN,
      default: true,
      label: '记录控制信号',
      description: '是否记录控制信号变化',
    },
    logTrigger: {
      type: ParamType.BOOLEAN,
      default: true,
      label: '记录触发信号',
      description: '是否记录触发信号',
    },
    logParams: {
      type: ParamType.BOOLEAN,
      default: true,
      label: '记录参数变化',
      description: '是否记录模块参数变化',
    },
    sampleInterval: {
      type: ParamType.NUMBER,
      default: 0.1,
      min: 0.01,
      max: 1.0,
      step: 0.01,
      label: '采样间隔(秒)',
      description: '信号采样的时间间隔，影响性能',
    },
  },

  presets: [
    {
      id: 'default',
      name: '默认设置',
      author: 'SynthesizerFlow',
      values: {
        maxLogEntries: 100,
        logAudio: true,
        logControl: true,
        logTrigger: true,
        logParams: true,
        sampleInterval: 0.1,
      },
    },
    {
      id: 'performance',
      name: '高性能模式',
      author: 'SynthesizerFlow',
      values: {
        maxLogEntries: 50,
        logAudio: false,
        logControl: true,
        logTrigger: true,
        logParams: true,
        sampleInterval: 0.2,
      },
    },
    {
      id: 'detailed',
      name: '详细记录',
      author: 'SynthesizerFlow',
      values: {
        maxLogEntries: 500,
        logAudio: true,
        logControl: true,
        logTrigger: true,
        logParams: true,
        sampleInterval: 0.05,
      },
    },
  ],

  ui: {
    color: '#4caf50',
    icon: 'bug_report',
    width: 300,
    height: 400,
  },
};

export class DebugModule extends Module {
  // 核心音频组件
  private audioAnalyser: Tone.Analyser | null = null;
  private controlListener: Tone.Volume | null = null;
  // 修改触发监听器的类型，使用和Trigger模块兼容的Signal类型
  private triggerListener: Tone.Signal<'number'> | null = null;
  private noteListener: Tone.Volume | null = null;
  private midiListener: Tone.Volume | null = null;

  // 添加触发检测回调
  private triggerWatcher: Tone.ToneAudioWorklet | null = null;
  private triggerThreshold = 0.01;
  private lastTriggerValue = 0;

  // 采样计时器
  private sampleTimer: NodeJS.Timeout | null = null;

  // 日志存储
  private logs: LogEntry[] = [];

  // 最近的信号值记录
  private latestValues: Record<string, any> = {};

  // 上次采样时间
  private lastSampleTimes: Record<string, number> = {};

  constructor(params: ModuleParams) {
    super({
      ...params,
      typeId: MODULE_ID,
    });

    // 监听模块参数变化
    this.setupParameterListeners();

    // 监听全局事件
    this.setupGlobalEventListeners();
  }

  // 定义输入端口
  getInputPorts(): Port[] {
    return debugModuleConfig.interfaces.inputs.map((input) => ({
      id: input.id,
      type: 'input',
      dataType: input.dataType.toLowerCase() as
        | 'audio'
        | 'control'
        | 'trigger'
        | 'note'
        | 'midi',
      label: input.label,
    }));
  }

  // 定义输出端口
  getOutputPorts(): Port[] {
    return [];
  }

  // 参数定义
  getParameterDefinitions(): Record<
    string,
    {
      type: string;
      default: ParameterValue;
      min?: number;
      max?: number;
      options: never[];
      step: number | undefined;
    }
  > {
    const result: Record<
      string,
      {
        type: string;
        default: ParameterValue;
        min?: number;
        max?: number;
        options: never[];
        step: number | undefined;
      }
    > = {};

    Object.entries(debugModuleConfig.parameters).forEach(([key, param]) => {
      result[key] = {
        type: param.type.toString().toLowerCase(),
        default: param.default,
        min: param.min,
        max: param.max,
        options: [],
        step: param.step,
      };
    });

    return result;
  }

  // 创建音频节点
  protected async createAudioNodes(): Promise<void> {
    // 创建音频分析器
    this.audioAnalyser = new Tone.Analyser('waveform', 128);

    // 创建控制信号监听器
    this.controlListener = new Tone.Volume();

    // 创建触发信号监听器 - 使用和Trigger模块兼容的Signal类型
    this.triggerListener = new Tone.Signal(0);

    // 创建音符信号监听器
    this.noteListener = new Tone.Volume();

    // 创建MIDI信号监听器
    this.midiListener = new Tone.Volume();

    try {
      // 添加触发信号变化检测
      const triggerWatcherNode = new Tone.Gain();
      this.triggerListener.connect(triggerWatcherNode);

      // 设置信号变化回调
      this.triggerListener.onchange = (value) => {
        if (value > this.triggerThreshold && value !== this.lastTriggerValue) {
          this.handleDirectTrigger(value);
          this.lastTriggerValue = value;
        }
      };
    } catch (error) {
      console.error('[DebugModule] 设置触发信号检测失败:', error);
    }

    // 存储音频节点引用
    this._audioNodes = {
      audio_in: this.audioAnalyser,
      control_in: this.controlListener,
      trigger_in: this.triggerListener,
      note_in: this.noteListener,
      midi_in: this.midiListener,
    };

    console.log(
      `[DebugModule] 创建音频节点: typeId=${this.typeId}, id=${this.id}`
    );

    // 记录模块启动日志
    this.addLogEntry({
      type: 'system',
      source: 'module.init',
      value: '调试模块初始化完成',
      metadata: {
        ports: this.getInputPorts().map((p) => p.id),
        audioNodesReady: Object.keys(this._audioNodes),
      },
    });

    // 开始采样计时器
    this.startSampling();
  }

  // 处理直接接收到的触发信号
  private handleDirectTrigger(value: number): void {
    if (!this.getParameterValue('logTrigger')) {
      return;
    }

    this.addLogEntry({
      type: 'trigger_received',
      source: 'trigger_in',
      value: value,
      metadata: {
        timestamp: Tone.now(),
        received: Date.now(),
      },
    });

    // 在控制台也显示触发信息
    console.log(`[DebugModule] 接收到触发信号: ${value}`);
  }

  // 配置参数监听器
  private setupParameterListeners(): void {
    // 监听自身的参数变化
    eventBus.on('PARAMETER.CHANGED', this.handleParameterChange.bind(this));
  }

  // 配置全局事件监听器
  private setupGlobalEventListeners(): void {
    // 监听触发事件
    eventBus.on('TRIGGER.SYNC', this.handleTriggerEvent.bind(this));

    // 监听连接事件
    eventBus.on(
      'CONNECTION.ESTABLISHED',
      this.handleConnectionEstablished.bind(this)
    );
    eventBus.on('CONNECTION.BROKEN', this.handleConnectionBroken.bind(this));
  }

  // 处理参数变化事件
  private handleParameterChange(event: {
    moduleId: string;
    parameterId: string;
    value: ParameterValue;
    previousValue: ParameterValue;
  }): void {
    // 如果是清除日志参数，且值为true，则清除日志
    if (
      event.moduleId === this.id &&
      event.parameterId === 'clearLogs' &&
      event.value === true
    ) {
      this.clearLogs();
      return;
    }

    // 如果是调整采样间隔，重启采样计时器
    if (
      event.moduleId === this.id &&
      event.parameterId === 'sampleInterval' &&
      typeof event.value === 'number'
    ) {
      this.restartSampling();
      return;
    }

    // 如果不是记录参数变化，直接返回
    if (!this.getParameterValue('logParams')) {
      return;
    }

    // 记录其他模块的参数变化
    if (event.moduleId !== this.id) {
      this.addLogEntry({
        type: 'parameter',
        source: `${event.moduleId}.${event.parameterId}`,
        value: event.value,
        metadata: {
          previousValue: event.previousValue,
          moduleId: event.moduleId,
          parameterId: event.parameterId,
        },
      });
    }
  }

  // 处理触发事件
  private handleTriggerEvent(event: {
    targetId: string;
    value?: number;
    duration?: number;
    timestamp?: number;
  }): void {
    // 如果不是记录触发信号，直接返回
    if (!this.getParameterValue('logTrigger')) {
      return;
    }

    this.addLogEntry({
      type: 'trigger',
      source: `trigger.${event.targetId}`,
      value: event.value ?? 1,
      metadata: {
        targetId: event.targetId,
        duration: event.duration,
        timestamp: event.timestamp,
      },
    });
  }

  // 处理连接建立事件
  private handleConnectionEstablished(event: {
    connectionId: string;
    sourceId: string;
    targetId: string;
    sourceHandle?: string;
    targetHandle?: string;
  }): void {
    // 记录与本模块相关的连接
    if (event.targetId === this.id) {
      this.addLogEntry({
        type: 'connection',
        source: 'established',
        value: {
          connectionId: event.connectionId,
          sourceId: event.sourceId,
          sourceHandle: event.sourceHandle,
          targetHandle: event.targetHandle,
        },
        metadata: event,
      });

      // 当有新连接到触发输入时，记录特殊日志
      if (event.targetHandle === 'trigger_in') {
        this.addLogEntry({
          type: 'system',
          source: 'connection.trigger',
          value: '触发输入连接已建立',
          metadata: {
            sourceId: event.sourceId,
            sourceHandle: event.sourceHandle,
          },
        });
      }
    }
  }

  // 处理连接断开事件
  private handleConnectionBroken(event: {
    connectionId: string;
    sourceId: string;
    targetId: string;
    sourceHandle?: string;
    targetHandle?: string;
  }): void {
    // 记录与本模块相关的连接断开
    if (event.targetId === this.id) {
      this.addLogEntry({
        type: 'connection',
        source: 'broken',
        value: {
          connectionId: event.connectionId,
          sourceId: event.sourceId,
          sourceHandle: event.sourceHandle,
          targetHandle: event.targetHandle,
        },
        metadata: event,
      });
    }
  }

  // 采样当前信号值
  private sampleSignals(): void {
    const now = Date.now();
    const sampleIntervalMs =
      (this.getParameterValue('sampleInterval') as number) * 1000;

    // 采样音频信号
    if (
      this.audioAnalyser &&
      this.getParameterValue('logAudio') &&
      now - (this.lastSampleTimes.audio || 0) >= sampleIntervalMs
    ) {
      try {
        const audioData = this.audioAnalyser.getValue();
        // 计算音频信号的平均振幅
        let sum = 0;
        const values = audioData as Float32Array;
        for (let i = 0; i < values.length; i++) {
          sum += Math.abs(values[i]);
        }
        const average = sum / values.length;

        // 仅当值变化明显时记录
        if (Math.abs((this.latestValues.audio || 0) - average) > 0.01) {
          this.latestValues.audio = average;
          this.lastSampleTimes.audio = now;
          this.addLogEntry({
            type: 'audio',
            source: 'audio_in',
            value: average,
            metadata: {
              peak: Math.max(...Array.from(values).map(Math.abs)),
              samples: values.length,
            },
          });
        }
      } catch (error) {
        console.error('[DebugModule] 音频采样错误:', error);
      }
    }

    // 采样控制信号
    if (
      this.controlListener &&
      this.getParameterValue('logControl') &&
      now - (this.lastSampleTimes.control || 0) >= sampleIntervalMs
    ) {
      try {
        const controlValue = this.controlListener.volume.value;
        // 仅当值变化明显时记录
        if (Math.abs((this.latestValues.control || 0) - controlValue) > 0.01) {
          this.latestValues.control = controlValue;
          this.lastSampleTimes.control = now;
          this.addLogEntry({
            type: 'control',
            source: 'control_in',
            value: controlValue,
          });
        }
      } catch (error) {
        console.error('[DebugModule] 控制信号采样错误:', error);
      }
    }

    // 采样触发信号 - 增强检测逻辑
    if (
      this.triggerListener &&
      this.getParameterValue('logTrigger') &&
      now - (this.lastSampleTimes.trigger || 0) >= sampleIntervalMs
    ) {
      try {
        // 获取当前触发信号值
        const triggerValue = this.triggerListener.value;

        // 更有效地检测触发信号
        if (
          triggerValue > this.triggerThreshold &&
          Math.abs((this.latestValues.trigger || 0) - triggerValue) >
            this.triggerThreshold
        ) {
          this.latestValues.trigger = triggerValue;
          this.lastSampleTimes.trigger = now;

          this.addLogEntry({
            type: 'trigger_sampled',
            source: 'trigger_in',
            value: triggerValue,
            metadata: {
              audioTime: Tone.now(),
              threshold: this.triggerThreshold,
            },
          });
        } else if (
          this.latestValues.trigger > this.triggerThreshold &&
          triggerValue < this.triggerThreshold
        ) {
          // 检测触发信号的结束
          this.latestValues.trigger = triggerValue;
          this.addLogEntry({
            type: 'trigger_ended',
            source: 'trigger_in',
            value: triggerValue,
            metadata: {
              audioTime: Tone.now(),
              previousValue: this.latestValues.trigger,
            },
          });
        }
      } catch (error) {
        console.error('[DebugModule] 触发信号采样错误:', error);
      }
    }

    // 采样音符信号
    if (
      this.noteListener &&
      this.getParameterValue('logControl') &&
      now - (this.lastSampleTimes.note || 0) >= sampleIntervalMs
    ) {
      try {
        const noteValue = this.noteListener.volume.value;
        if (Math.abs((this.latestValues.note || 0) - noteValue) > 0.01) {
          this.latestValues.note = noteValue;
          this.lastSampleTimes.note = now;
          this.addLogEntry({
            type: 'note',
            source: 'note_in',
            value: noteValue,
          });
        }
      } catch (error) {
        console.error('[DebugModule] 音符信号采样错误:', error);
      }
    }
  }

  // 开始采样计时器
  private startSampling(): void {
    if (this.sampleTimer) {
      clearInterval(this.sampleTimer);
    }

    const interval = Math.max(
      50,
      (this.getParameterValue('sampleInterval') as number) * 1000
    );
    this.sampleTimer = setInterval(() => this.sampleSignals(), interval);
  }

  // 重新启动采样
  private restartSampling(): void {
    this.startSampling();
  }

  // 添加日志条目
  private addLogEntry(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
    const maxEntries = this.getParameterValue('maxLogEntries') as number;

    // 创建完整的日志条目
    const fullEntry: LogEntry = {
      ...entry,
      id: nanoid(),
      timestamp: Date.now(),
    };

    // 添加到日志数组
    this.logs.unshift(fullEntry);

    // 限制日志条目数量
    if (this.logs.length > maxEntries) {
      this.logs = this.logs.slice(0, maxEntries);
    }

    // 发出事件通知UI更新
    eventBus.emit('DEBUG.LOG_ADDED', {
      moduleId: this.id,
      entry: fullEntry,
    });

    console.debug(
      `[DebugModule] 记录: ${entry.type} ${entry.source} = ${entry.value}`
    );
  }

  // 清除所有日志
  private clearLogs(): void {
    this.logs = [];

    // 重置按钮状态
    this._paramValues['clearLogs'] = false;
    if (this.parameters['clearLogs']) {
      this.parameters['clearLogs'].value = 0;
    }

    // 发出事件通知UI更新
    eventBus.emit('DEBUG.LOGS_CLEARED', {
      moduleId: this.id,
    });

    console.log('[DebugModule] 所有日志已清除');
  }

  // 将参数应用到音频节点
  protected applyParameterToAudioNode(
    paramId: string,
    value: ParameterValue
  ): void {
    // 大多数参数改变处理已在handleParameterChange中完成
    switch (paramId) {
      case 'maxLogEntries':
        // 如果当前日志条目超过新的最大值，截断日志
        if (typeof value === 'number' && this.logs.length > value) {
          this.logs = this.logs.slice(0, value);
          console.log(`[DebugModule] 日志条目限制为${value}条`);
        }
        break;

      default:
        // 其他参数处理
        break;
    }
  }

  // 获取日志条目
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  // 获取最近的信号值
  getLatestValues(): Record<string, any> {
    return { ...this.latestValues };
  }

  // 获取与指定端口关联的音频节点
  getAudioNodeForPort(
    portId: string,
    portType: 'input' | 'output'
  ): Tone.ToneAudioNode | null {
    if (portType === 'input') {
      switch (portId) {
        case 'audio_in':
          return this.audioAnalyser;
        case 'control_in':
          return this.controlListener;
        case 'trigger_in':
          return this.triggerListener;
        case 'note_in':
          return this.noteListener;
        case 'midi_in':
          return this.midiListener;
        default:
          return null;
      }
    }
    return null;
  }

  // 重写connect方法，以便记录连接细节
  connect(targetModule: ModuleBase, outputId?: string, inputId?: string): void {
    // 记录连接操作
    this.addLogEntry({
      type: 'module_action',
      source: 'connect',
      value: {
        targetModuleId: targetModule.id,
        outputId,
        inputId,
      },
    });

    // 调用父类的connect方法
    super.connect(targetModule, outputId, inputId);
  }

  // 销毁模块时的清理工作
  async dispose(): Promise<void> {
    // 停止采样计时器
    if (this.sampleTimer) {
      clearInterval(this.sampleTimer);
      this.sampleTimer = null;
    }

    // 移除事件监听器
    eventBus.off('PARAMETER.CHANGED', this.handleParameterChange.bind(this));
    eventBus.off('TRIGGER.SYNC', this.handleTriggerEvent.bind(this));
    eventBus.off(
      'CONNECTION.ESTABLISHED',
      this.handleConnectionEstablished.bind(this)
    );
    eventBus.off('CONNECTION.BROKEN', this.handleConnectionBroken.bind(this));

    // 清理音频节点
    if (this.audioAnalyser) {
      this.audioAnalyser.dispose();
      this.audioAnalyser = null;
    }

    if (this.controlListener) {
      this.controlListener.dispose();
      this.controlListener = null;
    }

    if (this.triggerListener) {
      // 移除信号变化回调
      this.triggerListener.onchange = null;
      this.triggerListener.dispose();
      this.triggerListener = null;
    }

    if (this.triggerWatcher) {
      this.triggerWatcher.dispose();
      this.triggerWatcher = null;
    }

    if (this.noteListener) {
      this.noteListener.dispose();
      this.noteListener = null;
    }

    if (this.midiListener) {
      this.midiListener.dispose();
      this.midiListener = null;
    }

    this._audioNodes = {};

    // 调用父类的dispose方法
    await super.dispose();
  }
}

// 辅助函数 - 生成唯一ID
function nanoid(): string {
  return Math.random().toString(36).substring(2, 15);
}

debugModuleConfig.metadata.moduleConstructor = DebugModule as unknown as new (
  ...args: unknown[]
) => ModuleBase;

// 导出模块创建函数
export function createDebugModule(params: ModuleParams): DebugModule {
  return new DebugModule(params);
}
