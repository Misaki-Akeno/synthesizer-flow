import { ModuleBase, ModuleMetadata, ParameterType, PortType } from '@/core/base/ModuleBase';

/**
 * 数字输入模块，提供一个可调节的数值输出
 */
export class NumberInputModule extends ModuleBase {
  public static metadata: ModuleMetadata = {
    type: 'numberinput',
    label: '数字输入',
    description: '提供一个可调节的数值输出，用于控制其他模块的参数',
    category: '逻辑', // 'Logic' in Chinese
    iconType: 'SlidersHorizontal', // A slider-like icon
  };

  constructor(id: string, name: string = '数字输入') {
    const moduleType = 'numberinput';
    const parameters = {
      value: {
        type: ParameterType.NUMBER,
        value: 120,
        min: 0,
        max: 999, // Adjustable range
        step: 1,
        uiOptions: {
          label: '数值',
          describe: '输出的数值',
        },
      },
    };

    const inputPorts = {};

    const outputPorts = {
      output: {
        type: PortType.NUMBER,
        value: 120,
      },
    };

    super(moduleType, id, name, parameters, inputPorts, outputPorts);
  }

  protected setupInternalBindings(): void {
    // Bind the 'value' parameter to the 'output' port
    this.bindParameterToOutput('value', 'output');
  }
}
