/* eslint-disable @typescript-eslint/no-unused-vars */
import { BehaviorSubject, Subscription } from 'rxjs';

// 接口类型枚举
export enum PortType {
  NUMBER = 'number',
  AUDIO = 'audio',
  ARRAY = 'array', // 新增：用于传输数组数据（如复音MIDI数据）
}

// 参数类型枚举
export enum ParameterType {
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  LIST = 'list',
  STRING = 'string', // 新增：用于存储字符串数据（如JSON配置）
}

// 允许接口的数据类型是 number、audio 或数组
export type ModuleInterface = number | Audio | Array<number | object>;

// 定义一个音频类型
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Audio = any;

// 模块元数据接口
export interface ModuleMetadata {
  type: string; // 模块类型标识符
  label: string; // 模块显示名称
  description: string; // 模块描述
  category: string; // 模块分类
  iconType?: string; // 可选的图标类型
}

// 参数定义接口，包含值、类型、范围等
export interface ParameterDefinition {
  type: ParameterType;
  value: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[]; // 用于LIST类型，选项列表
  uiOptions?: {
    // 用于UI相关配置
    hide?: boolean; // 是否在UI中隐藏该参数
    group?: string; // 参数分组名称
    describe?: string; // 参数说明/描述文本
    label?: string; // 参数显示名称（替代参数键名）
    [key: string]: unknown; // 允许其他UI配置选项
  };
}

// 端口颜色映射
export const PORT_COLORS = {
  [PortType.NUMBER]: '#1D4ED8', // 数字端口为蓝色
  [PortType.AUDIO]: '#047857', // 音频端口为绿色
  [PortType.ARRAY]: '#9333EA', // 数组端口为紫色
};

// 模块抽象类
export abstract class ModuleBase {
  // 模块类型标识
  public readonly moduleType: string;
  public readonly id: string;
  public name: string;

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
      uiOptions?: {
        [key: string]: unknown;
      };
    };
  };

  // 添加自定义UI支持
  protected customUI?: {
    type: string;
    props?: Record<string, unknown>;
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

  // 存储输出连接
  private outputConnections: Map<
    string,
    Array<{ targetModule: ModuleBase; targetPort: string }>
  > = new Map();

  // 存储内部订阅关系
  private internalSubscriptions: Subscription[] = [];

  // 存储数组类型的多个输入源的值
  // Map<inputPortName, Map<bindingKey, any[]>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private arrayInputValues: Map<string, Map<string, any[]>> = new Map();
  type: string | undefined;

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
        uiOptions: param.uiOptions,
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
    uiOptions?: {
      [key: string]: unknown;
    };
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

  public setName(newName: string): void {
    this.name = newName;
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
    } else if (meta.type === ParameterType.STRING && typeof value === 'string') {
      // 字符串类型，直接更新
      this.parameters[paramKey].next(value);
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

    // 对于数组端口，也不需要解除现有绑定，允许多个输入源
    const isArrayPort = inputType === PortType.ARRAY;

    // 对于音频端口，也不需要解除现有绑定
    const isAudioPort = inputType === PortType.AUDIO;

    // 对于非音频且非数组端口，解除现有绑定
    if (!isAudioPort && !isArrayPort) {
      this.unbindInput(inputPortName);
    }

    // 创建新的订阅，对于音频和数组端口使用唯一的绑定键
    const bindingKey =
      isAudioPort || isArrayPort
        ? `input_${inputPortName}_${sourceModule.id}_${sourcePortName}`
        : `input_${inputPortName}`;

    // 检查是否已存在相同的绑定
    if (this.subscriptions[bindingKey]) {
      this.subscriptions[bindingKey].unsubscribe();
    }

    this.subscriptions[bindingKey] = sourceModule.outputPorts[
      sourcePortName
    ].subscribe((value) => {
      if (isAudioPort) {
        // 对于音频端口，保留输入值的引用，但不直接修改BehaviorSubject
        // 让模块内部处理多个音频输入
        this.handleAudioInput(
          inputPortName,
          value,
          sourceModule.id,
          sourcePortName
        );
      } else if (isArrayPort) {
        // 对于数组端口，合并多个输入源的值
        if (Array.isArray(value)) {
          if (!this.arrayInputValues.has(inputPortName)) {
            this.arrayInputValues.set(inputPortName, new Map());
          }
          this.arrayInputValues.get(inputPortName)!.set(bindingKey, value);

          // 聚合所有输入源的值
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const aggregated: any[] = [];
          // 对key进行排序以确保确定性的顺序（这对于如notes和velocities这样成对出现的数组很重要）
          const sortedKeys = Array.from(
            this.arrayInputValues.get(inputPortName)!.keys()
          ).sort();

          sortedKeys.forEach((key) => {
            const val = this.arrayInputValues.get(inputPortName)!.get(key);
            if (Array.isArray(val)) {
              aggregated.push(...val);
            }
          });

          this.inputPorts[inputPortName].next(aggregated);
        }
      } else {
        // 对于普通端口，直接更新BehaviorSubject
        this.inputPorts[inputPortName].next(value);
      }
    });
  }

  /**
   * 处理音频输入，子类可以重写此方法以自定义多个音频输入的处理方式
   * @param inputPortName 输入端口名
   * @param audioInput 音频输入值
   * @param sourceModuleId 源模块ID
   * @param sourcePortName 源端口名
   */
  protected handleAudioInput(
    inputPortName: string,
    audioInput: ModuleInterface,
    sourceModuleId: string,
    sourcePortName: string
  ): void {
    // 默认实现：直接更新端口值
    // 子类可以重写此方法以实现自定义的多音频处理
    this.inputPorts[inputPortName].next(audioInput);
  }

  /**
   * 解除输入端口的绑定
   * @param inputPortName 要解除绑定的输入端口名称
   * @param sourceModuleId 可选的源模块ID，如果提供，则只解除与该源模块的绑定
   * @param sourcePortName 可选的源端口名，如果提供，则只解除与该源端口的绑定
   * @returns 是否成功解除绑定
   */
  unbindInput(
    inputPortName: string,
    sourceModuleId?: string,
    sourcePortName?: string
  ): boolean {
    // 检查输入端口是否存在
    if (!this.inputPorts[inputPortName]) {
      console.warn(
        `无法解除绑定：输入端口 '${inputPortName}' 在模块 ${this.id} 上不存在`
      );
      return false;
    }

    const portType = this.inputPortTypes[inputPortName];
    const isArrayPort = portType === PortType.ARRAY;
    const isAudioPort = portType === PortType.AUDIO;

    // 如果是针对特定源模块的音频或数组端口解绑
    if ((isAudioPort || isArrayPort) && sourceModuleId) {
      const prefix = `input_${inputPortName}_`;
      const bindingKey = sourcePortName
        ? `${prefix}${sourceModuleId}_${sourcePortName}`
        : `${prefix}${sourceModuleId}`;

      // 辅助函数：清理数组缓存并更新
      const cleanArrayCache = (key: string) => {
        if (isArrayPort && this.arrayInputValues.has(inputPortName)) {
          const map = this.arrayInputValues.get(inputPortName)!;
          map.delete(key);

          // 重新聚合
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const aggregated: any[] = [];
          const sortedKeys = Array.from(map.keys()).sort();
          sortedKeys.forEach((k) => {
            const val = map.get(k);
            if (Array.isArray(val)) {
              aggregated.push(...val);
            }
          });
          this.inputPorts[inputPortName].next(aggregated);

          if (map.size === 0) {
            this.arrayInputValues.delete(inputPortName);
          }
        }
      };

      if (this.subscriptions[bindingKey]) {
        this.subscriptions[bindingKey].unsubscribe();
        delete this.subscriptions[bindingKey];

        if (isAudioPort) {
          // 通知模块音频连接已移除
          this.handleAudioDisconnect(
            inputPortName,
            sourceModuleId,
            sourcePortName
          );
          const hasRemainingBindings = Object.keys(this.subscriptions).some((key) =>
            key.startsWith(prefix)
          );
          if (!hasRemainingBindings) {
            this.inputPorts[inputPortName].next(null);
          }
        } else if (isArrayPort) {
          cleanArrayCache(bindingKey);
        }
        return true;
      }

      // 尝试查找所有与该源模块相关的订阅
      if (!sourcePortName) {
        let found = false;
        Object.keys(this.subscriptions).forEach((key) => {
          if (key.startsWith(`input_${inputPortName}_${sourceModuleId}_`)) {
            this.subscriptions[key].unsubscribe();
            delete this.subscriptions[key];
            if (isArrayPort) {
              cleanArrayCache(key);
            }
            found = true;
          }
        });
        if (found) {
          if (isAudioPort) {
            this.handleAudioDisconnect(inputPortName, sourceModuleId);
            const hasRemainingBindings = Object.keys(this.subscriptions).some((key) =>
              key.startsWith(prefix)
            );
            if (!hasRemainingBindings) {
              this.inputPorts[inputPortName].next(null);
            }
          }
          return true;
        }
      }

      return false;
    }

    // 常规解绑（非音频/非数组 或 解绑所有连接）
    let unbound = false;

    if (isAudioPort || isArrayPort) {
      // 对于音频或数组端口，解除所有相关订阅
      Object.keys(this.subscriptions).forEach((key) => {
        if (key.startsWith(`input_${inputPortName}_`)) {
          this.subscriptions[key].unsubscribe();
          delete this.subscriptions[key];
          unbound = true;
        }
      });

      if (unbound) {
        if (isAudioPort) {
          // 重置音频输入端口
          this.inputPorts[inputPortName].next(null);
          this.handleAudioDisconnect(inputPortName);
        } else if (isArrayPort) {
          // 清空数组缓存
          this.arrayInputValues.delete(inputPortName);
          this.inputPorts[inputPortName].next([]);
        }
      }
    } else {
      // 对于非音频端口，解除单个订阅
      const bindingKey = `input_${inputPortName}`;
      if (this.subscriptions[bindingKey]) {
        this.subscriptions[bindingKey].unsubscribe();
        delete this.subscriptions[bindingKey];
        // 重置输入端口的值
        this.inputPorts[inputPortName].next(0);
        unbound = true;
      }
    }

    return unbound;
  }

  /**
   * 处理音频断开连接，子类可以重写此方法以自定义断开连接的处理方式
   * @param inputPortName 输入端口名
   * @param sourceModuleId 可选的源模块ID
   * @param sourcePortName 可选的源端口名
   */
  protected handleAudioDisconnect(
    inputPortName: string,
    _sourceModuleId?: string,
    _sourcePortName?: string
  ): void {
    // 默认实现为空，子类应该重写此方法
  }

  /**
   * 将此模块的一个输出端口连接到目标模块的输入端口
   * @param outputPortName 本模块的输出端口名
   * @param targetModule 目标模块
   * @param targetPortName 目标模块的输入端口名
   */
  public connectOutput(
    outputPortName: string,
    targetModule: ModuleBase,
    targetPortName: string
  ): void {
    // 检查输出端口是否存在
    if (!this.outputPorts[outputPortName]) {
      throw new Error(
        `Output port '${outputPortName}' not found on module ${this.id}`
      );
    }

    // 检查目标模块的输入端口是否存在
    if (!targetModule.inputPorts[targetPortName]) {
      throw new Error(
        `Input port '${targetPortName}' not found on target module ${targetModule.id}`
      );
    }

    // 检查端口类型是否兼容
    const outputType = this.outputPortTypes[outputPortName];
    const inputType = targetModule.inputPortTypes[targetPortName];

    if (outputType !== inputType) {
      throw new Error(
        `Type mismatch: Cannot connect ${outputType} output to ${inputType} input`
      );
    }

    // 建立连接
    targetModule.bindInputToOutput(targetPortName, this, outputPortName);

    // 记录输出连接
    if (!this.outputConnections.has(outputPortName)) {
      this.outputConnections.set(outputPortName, []);
    }

    const connections = this.outputConnections.get(outputPortName);
    connections?.push({ targetModule, targetPort: targetPortName });
  }

  /**
   * 断开此模块的输出端口与目标模块输入端口的连接
   * @param outputPortName 本模块的输出端口名
   * @param targetModule 目标模块
   * @param targetPortName 目标模块的输入端口名
   */
  public disconnectOutput(
    outputPortName: string,
    targetModule: ModuleBase,
    targetPortName: string
  ): void {
    // 检查输出端口是否存在
    if (!this.outputPorts[outputPortName]) {
      console.warn(
        `Output port '${outputPortName}' not found on module ${this.id}`
      );
      return;
    }

    // 请求目标模块解除输入绑定
    targetModule.unbindInput(targetPortName, this.id, outputPortName);

    // 更新输出连接记录
    const connections = this.outputConnections.get(outputPortName);
    if (connections) {
      const index = connections.findIndex(
        (conn) =>
          conn.targetModule.id === targetModule.id &&
          conn.targetPort === targetPortName
      );

      if (index !== -1) {
        connections.splice(index, 1);
      }
    }
  }

  /**
   * 获取一个输出端口的所有连接
   * @param outputPortName 输出端口名称
   * @returns 连接到该输出端口的所有目标模块和端口信息
   */
  public getOutputConnections(
    outputPortName: string
  ): Array<{ targetModule: ModuleBase; targetPort: string }> {
    return this.outputConnections.get(outputPortName) || [];
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
   * 获取模块的自定义UI组件信息
   * @returns 自定义UI组件信息，包含类型和props
   */
  public getCustomUI():
    | { type: string; props?: Record<string, unknown> }
    | undefined {
    return this.customUI;
  }

  /**
   * 设置模块的自定义UI
   * @param type 自定义UI组件类型
   * @param props 组件属性
   */
  protected setCustomUI(type: string, props?: Record<string, unknown>): void {
    this.customUI = { type, props };
  }

  /**
   * 释放模块资源
   * 取消所有订阅并清理资源
   */
  public dispose(): void {
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
