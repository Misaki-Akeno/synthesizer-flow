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
const MODULE_ID = 'automation-debug';

/**
 * 自动化调试模块配置
 */
export const automationDebugModuleConfig: ModuleConfiguration = {
  metadata: {
    id: MODULE_ID,
    name: '自动化调试',
    version: '1.0.0',
    category: ModuleCategory.UTILITY,
    tags: ['调试', '自动化', '控制'],
    description: '用于自动化调试的模块，可输出控制信号到其他模块',
    author: 'SynthesizerFlow',
    created: '2023-08-15',
    updated: '2023-08-15',
    moduleClass: './automation-debug',
    moduleConstructor: undefined, // 将在后面设置
  },

  interfaces: {
    inputs: [], // 没有输入端口
    outputs: [
      {
        id: 'control_out',
        label: '控制输出',
        dataType: DataType.CONTROL,
        description: '控制信号输出，可连接到其他模块进行自动化控制',
      },
    ],
  },

  parameters: {
    value: {
      type: ParamType.NUMBER,
      default: 0,
      min: 0,
      max: 1,
      step: 0.01,
      label: '控制值',
      description: '控制信号值，范围0-1',
      automatable: true,
    },
    bipolar: {
      type: ParamType.BOOLEAN,
      default: false,
      label: '双极性',
      description: '启用后，控制值范围变为-1到1',
    },
    range: {
      type: ParamType.NUMBER,
      default: 1,
      min: 0,
      max: 10,
      step: 0.01,
      label: '范围',
      description: '控制信号的最大值',
    },
  },

  presets: [
    {
      id: 'default',
      name: '默认设置',
      author: 'SynthesizerFlow',
      values: {
        value: 0.5,
        bipolar: false,
        range: 1,
      },
    },
    {
      id: 'bipolar',
      name: '双极性',
      author: 'SynthesizerFlow',
      values: {
        value: 0,
        bipolar: true,
        range: 1,
      },
    },
  ],

  ui: {
    color: '#4CAF50',
    icon: 'tune',
    width: 180,
    height: 140,
  },
};

export class AutomationDebugModule extends Module {
  // 核心音频组件
  private signalNode: Tone.Signal | null = null;
  private bipolar: boolean = false;
  private range: number = 1;

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
    return automationDebugModuleConfig.interfaces.outputs.map((output) => ({
      id: output.id,
      type: 'output',
      dataType: output.dataType.toLowerCase() as 'control',
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

    Object.entries(automationDebugModuleConfig.parameters).forEach(([key, param]) => {
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
    // 从参数系统获取初始值
    const initialValue = this.getParameterValue('value') as number;
    this.bipolar = Boolean(this.getParameterValue('bipolar'));
    this.range = Number(this.getParameterValue('range') || 1);
    
    // 创建信号节点
    this.signalNode = new Tone.Signal({
      value: this.mapValueToOutput(initialValue),
      units: 'number',
    });

    // 存储音频节点引用
    this._audioNodes = {
      control_out: this.signalNode,
    };
  }

  // 将UI值映射到实际输出值
  private mapValueToOutput(value: number): number {
    if (this.bipolar) {
      // 将0-1映射到-range到range
      return (value * 2 - 1) * this.range;
    } else {
      // 将0-1映射到0-range
      return value * this.range;
    }
  }

  // 将参数应用到音频节点
  protected applyParameterToAudioNode(
    paramId: string,
    value: ParameterValue
  ): void {
    if (!this.signalNode) return;

    switch (paramId) {
      case 'value':
        if (typeof value === 'number') {
          this.signalNode.value = this.mapValueToOutput(value);
        }
        break;

      case 'bipolar':
        this.bipolar = Boolean(value);
        // 更新当前值，使其适应新的极性设置
        const currentValue = this.getParameterValue('value');
        if (typeof currentValue === 'number' && this.signalNode) {
          this.signalNode.value = this.mapValueToOutput(currentValue);
        }
        break;

      case 'range':
        if (typeof value === 'number') {
          this.range = value;
          // 更新当前值，使其适应新的范围设置
          const currentValue = this.getParameterValue('value');
          if (typeof currentValue === 'number' && this.signalNode) {
            this.signalNode.value = this.mapValueToOutput(currentValue);
          }
        }
        break;

      default:
        console.warn(`[AutomationDebugModule] 未知参数: ${paramId}`);
    }
  }

  // 获取与指定端口关联的音频节点
  getAudioNodeForPort(
    portId: string,
    portType: 'input' | 'output'
  ): Tone.ToneAudioNode | null {
    if (portType === 'output' && portId === 'control_out' && this.signalNode) {
      return this.signalNode;
    }
    return null;
  }

  // 销毁模块时的清理工作
  async dispose(): Promise<void> {
    if (this.signalNode) {
      this.signalNode.dispose();
      this.signalNode = null;
    }

    this._audioNodes = {};

    // 调用父类的dispose方法
    await super.dispose();
  }
}

// 设置模块构造函数引用
automationDebugModuleConfig.metadata.moduleConstructor = AutomationDebugModule as unknown as new (
  ...args: unknown[]
) => ModuleBase;

// 导出模块创建函数
export function createAutomationDebugModule(params: ModuleParams): AutomationDebugModule {
  return new AutomationDebugModule(params);
}
