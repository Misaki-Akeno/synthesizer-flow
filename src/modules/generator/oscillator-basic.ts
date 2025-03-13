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
const MODULE_ID = 'oscillator-basic';
const VALID_WAVEFORMS = ['sine', 'square', 'triangle', 'sawtooth'];

/**
 * 基础振荡器模块配置
 */
export const oscillatorBasicConfig: ModuleConfiguration = {
  metadata: {
    id: MODULE_ID,
    name: '基础振荡器',
    version: '1.0.0',
    category: ModuleCategory.GENERATOR,
    tags: ['音频', '生成器', '振荡器'],
    description: '一个基础的振荡器模块，支持四种基本波形',
    author: 'SynthesizerFlow',
    created: '2023-07-01',
    updated: '2023-07-01',
    moduleClass: './oscillator-basic',
    moduleConstructor: undefined, // 将在后面设置
  },

  interfaces: {
    // 移除了sync输入端口
    inputs: [],
    outputs: [
      {
        id: 'audio_out',
        label: '音频输出',
        dataType: DataType.AUDIO,
        description: '振荡器音频输出',
      },
    ],
  },

  parameters: {
    frequency: {
      type: ParamType.NUMBER,
      default: 440,
      min: 20,
      max: 20000,
      step: 1,
      unit: 'Hz',
      label: '频率',
      description: '振荡器频率',
      modulatable: true,
    },
    waveform: {
      type: ParamType.ENUM,
      default: 'sine',
      options: VALID_WAVEFORMS,
      label: '波形',
      description: '振荡器波形类型',
    },
    amplitude: {
      type: ParamType.NUMBER,
      default: 0.8,
      min: 0,
      max: 1,
      step: 0.01,
      label: '振幅',
      description: '振荡器输出音量',
      modulatable: true,
    },
    detune: {
      type: ParamType.NUMBER,
      default: 0,
      min: -1200,
      max: 1200,
      step: 1,
      unit: 'cents',
      label: '失谐',
      description: '振荡器失谐量（以音分为单位）',
      modulatable: true,
    },
  },

  presets: [
    {
      id: 'default',
      name: '默认设置',
      author: 'SynthesizerFlow',
      values: {
        frequency: 440,
        waveform: 'sine',
        amplitude: 0.8,
        detune: 0,
      },
    },
    {
      id: 'sub-bass',
      name: '低音',
      author: 'SynthesizerFlow',
      values: {
        frequency: 55,
        waveform: 'sine',
        amplitude: 0.9,
        detune: 0,
      },
    },
  ],

  ui: {
    color: '#ff9500',
    icon: 'waveform',
    width: 200,
    height: 180,
  },
};

export class OscillatorBasic extends Module {
  // 核心音频组件
  private oscillator: Tone.Oscillator | null = null;
  private outputGain: Tone.Gain | null = null;

  constructor(params: ModuleParams) {
    super({
      ...params,
      typeId: MODULE_ID,
    });
  }

  // 定义输入端口
  getInputPorts(): Port[] {
    return oscillatorBasicConfig.interfaces.inputs.map((input) => ({
      id: input.id,
      type: 'input',
      dataType: input.dataType.toLowerCase() as 'trigger' | 'audio' | 'control',
      label: input.label,
    }));
  }

  // 定义输出端口
  getOutputPorts(): Port[] {
    return oscillatorBasicConfig.interfaces.outputs.map((output) => ({
      id: output.id,
      type: 'output',
      dataType: output.dataType.toLowerCase() as
        | 'audio'
        | 'trigger'
        | 'control',
      label: output.label,
    }));
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

    Object.entries(oscillatorBasicConfig.parameters).forEach(([key, param]) => {
      result[key] = {
        type: param.type,
        default: param.default,
        min: param.min,
        max: param.max,
        options: Array.isArray(param.options) ? (param.options as never[]) : [],
        step: param.step,
      };
    });

    return result;
  }

  // 创建音频节点
  protected async createAudioNodes(): Promise<void> {
    // 创建并配置振荡器
    this.oscillator = new Tone.Oscillator();
    this.oscillator.set({
      frequency: this.getParameterValue('frequency') as number,
      detune: this.getParameterValue('detune') as number,
      type: this.getParameterValue('waveform') as Tone.ToneOscillatorType,
    });
    this.oscillator.start();

    // 创建输出增益节点
    this.outputGain = new Tone.Gain(
      this.getParameterValue('amplitude') as number
    );

    // 连接振荡器到增益节点
    this.oscillator.connect(this.outputGain);

    // 存储音频节点引用
    this._audioNodes = {
      oscillator: this.oscillator,
      audio_out: this.outputGain,
    };

    console.log(
      `[OscillatorBasic] 创建音频节点: typeId=${this.typeId}, id=${this.id}`
    );
  }

  // 将参数应用到音频节点
  protected applyParameterToAudioNode(
    paramId: string,
    value: ParameterValue
  ): void {
    if (!this.oscillator || !this.outputGain) return;

    switch (paramId) {
      case 'frequency':
        if (typeof value === 'number') {
          this.oscillator.frequency.value = value;
        }
        break;

      case 'waveform':
        if (typeof value === 'string' && this.isValidWaveform(value)) {
          this.oscillator.type = value as Tone.ToneOscillatorType;
        }
        break;

      case 'amplitude':
        if (typeof value === 'number') {
          this.outputGain.gain.value = value;
        }
        break;

      case 'detune':
        if (typeof value === 'number') {
          this.oscillator.detune.value = value;
        }
        break;

      default:
        console.warn(`[OscillatorBasic] 未知参数: ${paramId}`);
    }
  }

  // 验证波形值是否有效
  private isValidWaveform(value: string): boolean {
    // 检查是否是基本波形或带有分量数字的格式(如"sine2", "triangle4"等)
    const basicTypeValid = VALID_WAVEFORMS.includes(value);
    const typeWithPartialsValid = VALID_WAVEFORMS.some((type) => {
      return (
        value.startsWith(type) && /^\d+$/.test(value.substring(type.length))
      );
    });

    return basicTypeValid || typeWithPartialsValid;
  }

  // 获取与指定端口关联的音频节点
  getAudioNodeForPort(
    portId: string,
    portType: 'input' | 'output'
  ): Tone.ToneAudioNode | null {
    if (portType === 'output' && portId === 'audio_out' && this.outputGain) {
      return this.outputGain;
    }
    return null;
  }

  // 销毁模块时的清理工作
  async dispose(): Promise<void> {
    if (this.oscillator) {
      this.oscillator.stop();
      this.oscillator.dispose();
      this.oscillator = null;
    }

    if (this.outputGain) {
      this.outputGain.dispose();
      this.outputGain = null;
    }

    this._audioNodes = {};

    // 调用父类的dispose方法
    await super.dispose();
  }
}

// 设置模块构造函数引用
oscillatorBasicConfig.metadata.moduleConstructor =
  OscillatorBasic as unknown as new (...args: unknown[]) => ModuleBase;

// 导出模块创建函数
export function createOscillatorBasic(params: ModuleParams): OscillatorBasic {
  return new OscillatorBasic(params);
}
