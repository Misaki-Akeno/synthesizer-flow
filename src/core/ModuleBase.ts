import { BehaviorSubject, Subscription } from 'rxjs';

// 接口类型枚举
export enum PortType {
  NUMBER = 'number',
  AUDIO = 'audio',
}

// 参数类型枚举
export enum ParameterType {
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  LIST = 'list',
}

// 允许接口的数据类型是 number 或 audio
export type ModuleInterface = number | Audio;

// 定义一个音频类型
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Audio = any;

// 参数定义接口，包含值、类型、范围等
export interface ParameterDefinition {
  type: ParameterType;
  value: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[]; // 用于LIST类型，选项列表
}

// 端口颜色映射
export const PORT_COLORS = {
  [PortType.NUMBER]: '#1D4ED8', // 数字端口为蓝色
  [PortType.AUDIO]: '#047857', // 音频端口为绿色
};

// 模块抽象类
export abstract class ModuleBase {
  // 模块类型标识
  public readonly moduleType: string;
  public readonly id: string;
  public readonly name: string;

  // 模块参数，使用BehaviorSubject
  public parameters: {
    [key: string]: BehaviorSubject<number | boolean | string>;
  };

  // 存储参数的元数据（类型、最小值、最大值等）
  public parameterMeta: {
    [key: string]: {
      type: ParameterType;
      min?: number;
      max?: number;
      step?: number;
      options?: string[];
    };
  };

  // 输入接口，使用BehaviorSubject
  public inputPorts: { [key: string]: BehaviorSubject<ModuleInterface> };
  // 输出接口，使用BehaviorSubject
  public outputPorts: { [key: string]: BehaviorSubject<ModuleInterface> };

  // 存储端口类型
  public inputPortTypes: { [key: string]: PortType };
  public outputPortTypes: { [key: string]: PortType };

  // 存储订阅关系以便取消订阅
  private subscriptions: { [key: string]: Subscription } = {};

  // 存储内部订阅关系
  private internalSubscriptions: Subscription[] = [];

  constructor(
    moduleType: string,
    id: string,
    name: string,
    parameters: { [key: string]: ParameterDefinition } = {},
    inputPorts: {
      [key: string]: { type: PortType; value: ModuleInterface };
    } = {},
    outputPorts: {
      [key: string]: { type: PortType; value: ModuleInterface };
    } = {}
  ) {
    this.moduleType = moduleType;
    this.id = id;
    this.name = name;

    console.debug(`[ModuleBase] Creating module: ${id} (${moduleType})`);

    // 转换参数为BehaviorSubject并记录元数据
    this.parameters = {};
    this.parameterMeta = {};
    for (const [key, param] of Object.entries(parameters)) {
      this.parameters[key] = new BehaviorSubject<number | boolean | string>(
        param.value
      );
      this.parameterMeta[key] = {
        type: param.type,
        min: param.min,
        max: param.max,
        step: param.step,
        options: param.options,
      };
    }

    // 转换输入端口为BehaviorSubject并记录类型
    this.inputPorts = {};
    this.inputPortTypes = {};
    for (const [key, { type, value }] of Object.entries(inputPorts)) {
      this.inputPorts[key] = new BehaviorSubject<ModuleInterface>(value);
      this.inputPortTypes[key] = type;
    }

    // 转换输出端口为BehaviorSubject并记录类型
    this.outputPorts = {};
    this.outputPortTypes = {};
    for (const [key, { type, value }] of Object.entries(outputPorts)) {
      this.outputPorts[key] = new BehaviorSubject<ModuleInterface>(value);
      this.outputPortTypes[key] = type;
    }

    // 设置内部绑定
    console.debug(`[ModuleBase] Setting up internal bindings for: ${id}`);
    this.setupInternalBindings();
  }

  /**
   * 获取参数元数据
   * @param paramKey 参数名
   * @returns 参数的元数据
   */
  getParameterMeta(paramKey: string): {
    type: ParameterType;
    min?: number;
    max?: number;
    step?: number;
    options?: string[];
  } {
    return (
      this.parameterMeta[paramKey] || {
        type: ParameterType.NUMBER,
        min: 0,
        max: 1,
        step: 0.1,
      }
    );
  }

  /**
   * 获取输入端口类型
   * @param portName 端口名称
   * @returns 端口类型
   */
  getInputPortType(portName: string): PortType {
    return this.inputPortTypes[portName] || PortType.NUMBER;
  }

  /**
   * 获取输出端口类型
   * @param portName 端口名称
   * @returns 端口类型
   */
  getOutputPortType(portName: string): PortType {
    return this.outputPortTypes[portName] || PortType.NUMBER;
  }

  /**
   * 获取端口颜色
   * @param portType 端口类型
   * @returns 颜色代码
   */
  getPortColor(portType: PortType): string {
    return PORT_COLORS[portType] || '#6B7280'; // 默认灰色
  }

  /**
   * 设置模块内部订阅关系，子类必须重写此方法
   */
  protected setupInternalBindings(): void {
    console.debug(
      `[ModuleBase] Base setupInternalBindings called for ${this.id}`
    );
    // 子类应该重写此方法
  }

  /**
   * 绑定参数到输出端口
   * @param paramKey 参数名
   * @param outputPortName 输出端口名
   */
  protected bindParameterToOutput(
    paramKey: string,
    outputPortName: string
  ): void {
    if (!this.parameters[paramKey]) {
      throw new Error(`Parameter '${paramKey}' not found on module ${this.id}`);
    }
    if (!this.outputPorts[outputPortName]) {
      throw new Error(
        `Output port '${outputPortName}' not found on module ${this.id}`
      );
    }

    // 确保参数类型与端口类型兼容
    const paramType = this.parameterMeta[paramKey].type;
    const portType = this.outputPortTypes[outputPortName];

    // 布尔值和列表最终都转为数字输出
    if (portType === PortType.NUMBER) {
      const subscription = this.parameters[paramKey].subscribe((value) => {
        let outputValue: number;
        if (typeof value === 'boolean') {
          outputValue = value ? 1 : 0;
        } else if (typeof value === 'string') {
          const options = this.parameterMeta[paramKey].options || [];
          outputValue =
            options.indexOf(value) / Math.max(1, options.length - 1);
        } else {
          outputValue = value;
        }
        this.outputPorts[outputPortName].next(outputValue);
      });
      this.internalSubscriptions.push(subscription);
    } else {
      console.warn(
        `Parameter type ${paramType} not compatible with port type ${portType}`
      );
    }
  }

  /**
   * 绑定输入端口到参数
   * @param inputPortName 输入端口名
   * @param paramKey 参数名
   */
  protected bindInputToParameter(
    inputPortName: string,
    paramKey: string
  ): void {
    if (!this.inputPorts[inputPortName]) {
      throw new Error(
        `Input port '${inputPortName}' not found on module ${this.id}`
      );
    }
    if (!this.parameters[paramKey]) {
      throw new Error(`Parameter '${paramKey}' not found on module ${this.id}`);
    }

    const paramType = this.parameterMeta[paramKey].type;
    const portType = this.inputPortTypes[inputPortName];

    if (portType === PortType.NUMBER) {
      const subscription = this.inputPorts[inputPortName].subscribe((value) => {
        if (typeof value === 'number') {
          if (paramType === ParameterType.BOOLEAN) {
            this.parameters[paramKey].next(value >= 0.5);
          } else if (paramType === ParameterType.LIST) {
            const options = this.parameterMeta[paramKey].options || [];
            if (options.length > 0) {
              const index = Math.min(
                Math.floor(value * options.length),
                options.length - 1
              );
              this.parameters[paramKey].next(options[index]);
            }
          } else {
            this.parameters[paramKey].next(value);
          }
        }
      });
      this.internalSubscriptions.push(subscription);
    } else {
      console.warn(
        `Port type ${portType} not compatible with parameter type ${paramType}`
      );
    }
  }

  /**
   * 绑定输入端口到输出端口，可以添加处理函数
   * @param inputPortName 输入端口名
   * @param outputPortName 输出端口名
   * @param processor 可选的处理函数
   */
  protected bindInputToOutputPort(
    inputPortName: string,
    outputPortName: string,
    processor?: (input: ModuleInterface) => ModuleInterface
  ): void {
    if (!this.inputPorts[inputPortName]) {
      throw new Error(
        `Input port '${inputPortName}' not found on module ${this.id}`
      );
    }
    if (!this.outputPorts[outputPortName]) {
      throw new Error(
        `Output port '${outputPortName}' not found on module ${this.id}`
      );
    }

    const subscription = this.inputPorts[inputPortName].subscribe((value) => {
      if (processor) {
        this.outputPorts[outputPortName].next(processor(value));
      } else {
        this.outputPorts[outputPortName].next(value);
      }
    });

    this.internalSubscriptions.push(subscription);
  }

  /**
   * 获取参数当前值
   * @param paramKey 参数名
   */
  getParameterValue(paramKey: string): number | boolean | string {
    return this.parameters[paramKey].getValue();
  }

  /**
   * 更新参数值
   * @param paramKey 参数名
   * @param value 新值
   */
  updateParameter(paramKey: string, value: number | boolean | string): void {
    if (!this.parameters[paramKey]) {
      console.warn(`Parameter '${paramKey}' not found on module ${this.id}`);
      return;
    }

    const meta = this.getParameterMeta(paramKey);

    // 根据参数类型处理值
    if (
      meta.type === ParameterType.NUMBER &&
      typeof value === 'number' &&
      meta.min !== undefined &&
      meta.max !== undefined
    ) {
      // 数值类型，确保在范围内
      const clampedValue = Math.max(meta.min, Math.min(meta.max, value));
      this.parameters[paramKey].next(clampedValue);
    } else if (
      meta.type === ParameterType.BOOLEAN &&
      typeof value === 'boolean'
    ) {
      // 布尔类型
      this.parameters[paramKey].next(value);
    } else if (meta.type === ParameterType.LIST && typeof value === 'string') {
      // 列表类型，确保值在选项中
      if (meta.options && meta.options.includes(value)) {
        this.parameters[paramKey].next(value);
      } else {
        console.warn(`Invalid option: ${value} for parameter ${paramKey}`);
      }
    } else {
      console.warn(
        `Type mismatch: Cannot set ${typeof value} to parameter ${paramKey} of type ${meta.type}`
      );
    }
  }

  /**
   * 获取输入端口当前值
   * @param portName 端口名
   */
  getInputValue(portName: string): ModuleInterface {
    return this.inputPorts[portName].getValue();
  }

  /**
   * 获取输出端口当前值
   * @param portName 端口名
   */
  getOutputValue(portName: string): ModuleInterface {
    return this.outputPorts[portName].getValue();
  }

  /**
   * 更新输出端口值
   * @param portName 端口名
   * @param value 新值
   */
  protected setOutputValue(portName: string, value: ModuleInterface): void {
    if (this.outputPorts[portName]) {
      this.outputPorts[portName].next(value);
    }
  }

  /**
   * 绑定此模块的输入端口到另一个模块的输出端口
   * @param inputPortName 输入端口名
   * @param sourceModule 源模块
   * @param sourcePortName 源模块输出端口名
   */
  bindInputToOutput(
    inputPortName: string,
    sourceModule: ModuleBase,
    sourcePortName: string
  ): void {
    // 检查端口是否存在
    if (!this.inputPorts[inputPortName]) {
      throw new Error(
        `Input port '${inputPortName}' not found on module ${this.id}`
      );
    }
    if (!sourceModule.outputPorts[sourcePortName]) {
      throw new Error(
        `Output port '${sourcePortName}' not found on module ${sourceModule.id}`
      );
    }

    // 检查端口类型是否兼容
    const inputType = this.inputPortTypes[inputPortName];
    const outputType = sourceModule.outputPortTypes[sourcePortName];

    if (inputType !== outputType) {
      throw new Error(
        `Type mismatch: Cannot connect ${outputType} output to ${inputType} input`
      );
    }

    // 解除现有绑定
    this.unbindInput(inputPortName);

    // 创建新的订阅
    const bindingKey = `input_${inputPortName}`;
    this.subscriptions[bindingKey] = sourceModule.outputPorts[
      sourcePortName
    ].subscribe((value) => {
      this.inputPorts[inputPortName].next(value);
    });
  }

  /**
   * 添加内部订阅到管理列表
   * @param subscription 要添加的订阅
   */
  protected addInternalSubscription(subscription: Subscription): void {
    this.internalSubscriptions.push(subscription);
  }

  /**
   * 添加多个内部订阅到管理列表
   * @param subscriptions 要添加的订阅列表
   */
  protected addInternalSubscriptions(subscriptions: Subscription[]): void {
    subscriptions.forEach((sub) => this.internalSubscriptions.push(sub));
  }

  /**
   * 解除输入端口的绑定
   * @param inputPortName 要解除绑定的输入端口名称
   * @returns 是否成功解除绑定
   */
  unbindInput(inputPortName: string): boolean {
    // 检查输入端口是否存在
    if (!this.inputPorts[inputPortName]) {
      console.warn(
        `无法解除绑定：输入端口 '${inputPortName}' 在模块 ${this.id} 上不存在`
      );
      return false;
    }

    // 构建绑定键
    const bindingKey = `input_${inputPortName}`;

    // 检查是否存在该订阅
    if (this.subscriptions[bindingKey]) {
      // 取消订阅
      this.subscriptions[bindingKey].unsubscribe();
      // 从订阅列表中删除
      delete this.subscriptions[bindingKey];

      // 重置输入端口的值
      const portType = this.inputPortTypes[inputPortName];
      if (portType === PortType.NUMBER) {
        // 数值类型端口重置为0
        this.inputPorts[inputPortName].next(0);
      } else if (portType === PortType.AUDIO) {
        // 音频类型端口需要特别处理，将其重置为 null 或空音频对象
        // 这样可以确保音频处理模块停止处理
        this.inputPorts[inputPortName].next(null);
      }

      console.debug(
        `[ModuleBase] 已解除模块 ${this.id} 的输入端口 '${inputPortName}' 的绑定并重置值`
      );
      return true;
    }
    return false;
  }

  /**
   * 释放模块资源
   * 取消所有订阅并清理资源
   */
  public dispose(): void {
    console.debug(
      `[ModuleBase] Disposing module: ${this.id} (${this.moduleType})`
    );

    // 取消所有外部订阅
    Object.values(this.subscriptions).forEach((subscription) => {
      subscription.unsubscribe();
    });
    this.subscriptions = {};

    // 取消所有内部订阅
    this.internalSubscriptions.forEach((subscription) => {
      subscription.unsubscribe();
    });
    this.internalSubscriptions = [];

    // 完成所有BehaviorSubject
    Object.values(this.parameters).forEach((param) => {
      param.complete();
    });

    Object.values(this.inputPorts).forEach((port) => {
      port.complete();
    });

    Object.values(this.outputPorts).forEach((port) => {
      port.complete();
    });
  }
}
