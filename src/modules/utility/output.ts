import * as Tone from 'tone';
import { Module, ModuleParams, Port } from '@/core/domain/Module';
import { ParameterValue } from '@/interfaces/event';
import {
  ModuleCategory,
  ModuleConfiguration,
  DataType,
  ParamType,
  ModuleBase,
} from '@/interfaces/module';

// 模块常量定义
const MODULE_ID = 'output';

/**
 * 输出模块配置
 */
export const outputModuleConfig: ModuleConfiguration = {
  metadata: {
    id: MODULE_ID,
    name: '输出',
    version: '1.0.0',
    category: ModuleCategory.UTILITY,
    tags: ['输出', '音频'],
    description: '音频输出模块，连接到系统扬声器',
    author: 'SynthesizerFlow',
    created: '2023-07-01',
    updated: '2023-07-01',
    moduleClass: './output',
    moduleConstructor: undefined, // 将在后面设置
  },

  interfaces: {
    inputs: [
      {
        id: 'audio_in',
        label: '音频输入',
        dataType: DataType.AUDIO,
        description: '音频信号输入',
      },
    ],
    outputs: [], // 没有输出端口
  },

  parameters: {
    volume: {
      type: ParamType.NUMBER,
      default: 0,
      min: -60,
      max: 6,
      step: 0.1,
      unit: 'dB',
      label: '音量',
      description: '主输出音量',
    },
    mute: {
      type: ParamType.BOOLEAN,
      default: false,
      label: '静音',
      description: '启用/禁用输出',
    },
  },

  presets: [
    {
      id: 'default',
      name: '默认设置',
      author: 'SynthesizerFlow',
      values: {
        volume: 0,
        mute: false,
      },
    },
  ],

  ui: {
    color: '#3d8af7',
    icon: 'speaker',
    width: 180,
    height: 120,
  },
};

export class OutputModule extends Module {
  // 核心音频组件
  private volumeNode: Tone.Volume | null = null;

  constructor(params: ModuleParams) {
    super({
      ...params,
      typeId: MODULE_ID,
    });
  }

  // 定义输入端口
  getInputPorts(): Port[] {
    return outputModuleConfig.interfaces.inputs.map((input) => ({
      id: input.id,
      type: 'input',
      dataType: input.dataType.toLowerCase() as 'audio',
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

    Object.entries(outputModuleConfig.parameters).forEach(([key, param]) => {
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
    // 创建音量控制节点
    this.volumeNode = new Tone.Volume(
      this.getParameterValue('volume') as number
    );

    // 连接到主输出
    this.volumeNode.toDestination();

    // 根据静音状态设置
    if (this.getParameterValue('mute') === true) {
      this.volumeNode.mute = true;
    }

    // 存储音频节点引用
    this._audioNodes = {
      audio_in: this.volumeNode,
    };

    console.log(
      `[OutputModule] 创建音频节点: typeId=${this.typeId}, id=${this.id}`
    );
  }

  // 将参数应用到音频节点
  protected applyParameterToAudioNode(
    paramId: string,
    value: ParameterValue
  ): void {
    if (!this.volumeNode) return;

    switch (paramId) {
      case 'volume':
        if (typeof value === 'number') {
          this.volumeNode.volume.value = value;
        }
        break;

      case 'mute':
        this.volumeNode.mute = Boolean(value);
        break;

      default:
        console.warn(`[OutputModule] 未知参数: ${paramId}`);
    }
  }

  // 获取与指定端口关联的音频节点
  getAudioNodeForPort(
    portId: string,
    portType: 'input' | 'output'
  ): Tone.ToneAudioNode | null {
    if (portType === 'input' && portId === 'audio_in' && this.volumeNode) {
      return this.volumeNode;
    }
    return null;
  }

  // 销毁模块时的清理工作
  async dispose(): Promise<void> {
    if (this.volumeNode) {
      this.volumeNode.dispose();
      this.volumeNode = null;
    }

    this._audioNodes = {};

    // 调用父类的dispose方法
    await super.dispose();
  }
}

// 设置模块构造函数引用
outputModuleConfig.metadata.moduleConstructor = OutputModule as unknown as new (
  ...args: unknown[]
) => ModuleBase;

// 导出模块创建函数
export function createOutputModule(params: ModuleParams): OutputModule {
  return new OutputModule(params);
}
