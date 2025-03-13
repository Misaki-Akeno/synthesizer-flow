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
const MODULE_ID = 'trigger';

/**
 * 触发器模块配置
 */
export const triggerModuleConfig: ModuleConfiguration = {
  metadata: {
    id: MODULE_ID,
    name: '触发器',
    version: '1.0.0',
    category: ModuleCategory.CONTROLLER,
    tags: ['触发', '控制器'],
    description: '触发器模块，可以手动触发或按指定值触发',
    author: 'SynthesizerFlow',
    created: '2023-07-01',
    updated: '2023-07-01',
    moduleClass: './trigger',
    moduleConstructor: undefined, // 将在后面设置
  },

  interfaces: {
    inputs: [], // 没有输入端口
    outputs: [
      {
        id: 'trigger_out',
        label: '触发输出',
        dataType: DataType.TRIGGER,
        description: '触发信号输出',
      },
    ],
  },

  parameters: {
    triggerValue: {
      type: ParamType.NUMBER,
      default: 1.0,
      min: 0,
      max: 10,
      step: 0.1,
      label: '触发值',
      description: '触发时发送的值',
    },
    triggerButton: {
      type: ParamType.BOOLEAN,
      default: false, 
      label: '触发',
      description: '点击以发送触发信号',
    },
    // 添加触发持续时间参数
    triggerDuration: {
      type: ParamType.NUMBER,
      default: 0.02,
      min: 0.01,
      max: 1.0,
      step: 0.01,
      label: '触发持续时间',
      description: '触发信号持续的时间(秒)',
    },
  },

  presets: [
    {
      id: 'default',
      name: '默认设置',
      author: 'SynthesizerFlow',
      values: {
        triggerValue: 1.0,
        triggerDuration: 0.02,
      },
    },
    {
      id: 'max',
      name: '最大触发',
      author: 'SynthesizerFlow',
      values: {
        triggerValue: 10.0,
        triggerDuration: 0.05,
      },
    },
    // 添加长触发预设
    {
      id: 'long',
      name: '长触发',
      author: 'SynthesizerFlow',
      values: {
        triggerValue: 5.0,
        triggerDuration: 0.5,
      },
    },
  ],

  ui: {
    color: '#ff5722',
    icon: 'bolt',
    width: 160,
    height: 120,
  },
};

export class TriggerModule extends Module {
  // 核心音频组件
  private triggerSignal: Tone.Signal<"number"> | null = null;
  private triggerDelay: Tone.Delay | null = null;
  // 记录上次触发时间，避免重复触发
  private lastTriggerTime: number = 0;
  // 触发计时器，用于取消未完成的触发
  private triggerResetTimer: NodeJS.Timeout | null = null;
  // 触发状态
  private isTriggering: boolean = false;

  constructor(params: ModuleParams) {
    super({
      ...params,
      typeId: MODULE_ID,
    });
  }

  // 定义输入端口
  getInputPorts(): Port[] {
    return [];
  }

  // 定义输出端口
  getOutputPorts(): Port[] {
    return triggerModuleConfig.interfaces.outputs.map((output) => ({
      id: output.id,
      type: 'output',
      dataType: output.dataType.toLowerCase() as 'trigger',
      label: output.label,
    }));
  }

  // 参数定义
  getParameterDefinitions(): Record<
    string,
    { type: string; default: ParameterValue; min?: number; max?: number; options: never[]; step: number | undefined }
  > {
    const result: Record<
      string,
      { type: string; default: ParameterValue; min?: number; max?: number; options: never[]; step: number | undefined }
    > = {};

    Object.entries(triggerModuleConfig.parameters).forEach(([key, param]) => {
      result[key] = {
        type: param.type,
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
    // 检查音频上下文状态
    if (Tone.getContext().state !== 'running') {
      console.warn('[TriggerModule] 音频上下文未运行，可能导致触发不正常');
    }
    
    // 创建触发信号节点
    this.triggerSignal = new Tone.Signal(0);
    
    // 创建短延迟节点，用于重置触发状态
    this.triggerDelay = new Tone.Delay(0.01);
    
    // 连接信号到延迟
    this.triggerSignal.connect(this.triggerDelay);

    // 存储音频节点引用
    this._audioNodes = {
      trigger_out: this.triggerSignal,
    };

    console.log(
      `[TriggerModule] 创建音频节点: typeId=${this.typeId}, id=${this.id}`
    );
  }

  // 将参数应用到音频节点
  protected applyParameterToAudioNode(
    paramId: string,
    value: ParameterValue
  ): void {
    switch (paramId) {
      case 'triggerValue':
        console.log(`[TriggerModule] 触发值更新: ${value}`);
        break;
      
      case 'triggerDuration':
        console.log(`[TriggerModule] 触发持续时间更新: ${value}秒`);
        break;
      
      case 'triggerButton':
        // 当按钮参数被设置为true时，触发信号
        if (value === true && !this.isTriggering) {
          this.executeTrigger();
          // 按钮状态重置将在executeTrigger内部处理
        }
        break;
        
      default:
        console.warn(`[TriggerModule] 未知参数: ${paramId}`);
    }
  }

  // 执行触发动作（内部方法）
  private executeTrigger(): void {
    if (!this.triggerSignal) {
      console.warn('[TriggerModule] 触发信号节点未初始化');
      return;
    }
    
    const now = Date.now();
    // 防止短时间内重复触发（至少间隔50ms）
    if (now - this.lastTriggerTime < 50) {
      console.debug('[TriggerModule] 触发频率过高，忽略此次触发');
      return;
    }
    
    this.lastTriggerTime = now;
    this.isTriggering = true;
    
    // 获取当前触发值和持续时间
    const triggerValue = this.getParameterValue('triggerValue') as number;
    const triggerDuration = this.getParameterValue('triggerDuration') as number;
    
    // 清除之前可能存在的重置计时器
    if (this.triggerResetTimer) {
      clearTimeout(this.triggerResetTimer);
      this.triggerResetTimer = null;
    }
    
    try {
      const audioContextTime = Tone.now();
      
      // 发送触发信号
      this.triggerSignal.setValueAtTime(triggerValue, audioContextTime);
      
      // 在指定持续时间后重置为0
      this.triggerSignal.setValueAtTime(0, audioContextTime + triggerDuration);
      
      // 发送触发事件到事件总线，添加更多信息
      eventBus.emit('TRIGGER.SYNC', {
        targetId: this.id,
        value: triggerValue,
        duration: triggerDuration,
        timestamp: audioContextTime,
      });
      
      console.log(`[TriggerModule] 触发: value=${triggerValue}, duration=${triggerDuration}s`);
      
      // 设置一个定时器，在触发完成后重置按钮状态
      // 使用触发持续时间加上一个小的缓冲
      const resetTimeMs = Math.max(triggerDuration * 1000 + 50, 100);
      this.triggerResetTimer = setTimeout(() => {
        // 重置触发按钮状态
        this._paramValues['triggerButton'] = false;
        if (this.parameters['triggerButton']) {
          this.parameters['triggerButton'].value = 0;
        }
        this.isTriggering = false;
        this.triggerResetTimer = null;
      }, resetTimeMs);
    } catch (error) {
      console.error('[TriggerModule] 触发执行失败:', error);
      this.isTriggering = false;
      // 确保按钮状态在发生错误时也能重置
      this._paramValues['triggerButton'] = false;
      if (this.parameters['triggerButton']) {
        this.parameters['triggerButton'].value = 0;
      }
    }
  }

  // 保留原有触发方法，以便向后兼容，增加防抖逻辑
  trigger(): void {
    const now = Date.now();
    // 增加防抖检查，避免外部多次快速调用
    if (this.isTriggering || now - this.lastTriggerTime < 50) {
      console.debug('[TriggerModule] 正在触发中或触发频率过高，忽略此次调用');
      return;
    }
    // 通过设置按钮参数来触发
    this.setParameterValue('triggerButton', true);
  }

  // 获取与指定端口关联的音频节点
  getAudioNodeForPort(
    portId: string,
    portType: 'input' | 'output'
  ): Tone.ToneAudioNode | null {
    if (portType === 'output' && portId === 'trigger_out' && this.triggerSignal) {
      return this.triggerSignal;
    }
    return null;
  }

  // 需要覆盖父类的setParameterValue方法，确保布尔参数正确处理
  setParameterValue(paramId: string, value: ParameterValue): void {
    // 调用父类方法处理基本逻辑
    super.setParameterValue(paramId, value);
    
    // 特别处理triggerButton参数，确保存储正确的类型
    if (paramId === 'triggerButton' && this.parameters[paramId]) {
      // 在parameters中存储数字(0/1)，但在_paramValues中保留原始布尔值
      this.parameters[paramId].value = value === true ? 1 : 0;
    }
  }

  // 销毁模块时的清理工作
  async dispose(): Promise<void> {
    // 清除任何未完成的触发计时器
    if (this.triggerResetTimer) {
      clearTimeout(this.triggerResetTimer);
      this.triggerResetTimer = null;
    }
    
    if (this.triggerSignal) {
      this.triggerSignal.dispose();
      this.triggerSignal = null;
    }

    if (this.triggerDelay) {
      this.triggerDelay.dispose();
      this.triggerDelay = null;
    }

    this._audioNodes = {};
    this.isTriggering = false;

    // 调用父类的dispose方法
    await super.dispose();
  }
}

// 设置模块构造函数引用
triggerModuleConfig.metadata.moduleConstructor = TriggerModule as unknown as new (
  ...args: unknown[]
) => ModuleBase;

// 导出模块创建函数
export function createTriggerModule(params: ModuleParams): TriggerModule {
  return new TriggerModule(params);
}
