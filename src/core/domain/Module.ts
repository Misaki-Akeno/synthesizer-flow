import { nanoid } from 'nanoid';
import { eventBus } from '@/core/events/EventBus';
import * as Tone from 'tone';
import { ParameterValue } from '@/interfaces/event';
import {
  ModuleBase,
  ModuleMetadata,
  Preset,
  Port,
  ModuleParams,
  ConnectionEvent,
} from '@/interfaces/module';
import { Parameter } from '@/interfaces/parameter';
import { ObservableParameter } from './ObservableParameter';
import { moduleLifecycleManager } from './ModuleLifecycle';
import { ModuleLifecycleState } from '@/interfaces/lifecycle';

export abstract class Module implements ModuleBase {
  id: string;
  typeId: string;
  metadata: ModuleMetadata;
  parameters: Record<string, Parameter> = {};
  position: { x: number; y: number };
  protected _initialized: boolean = false;
  private _presets: Record<string, Preset> = {};

  // Property to satisfy ModuleBase interface
  get initialized(): boolean {
    return this._initialized;
  }

  // 音频节点引用
  protected _audioNodes: Record<string, Tone.ToneAudioNode> = {};

  // 添加索引签名以满足ModuleBase接口
  [key: string]: unknown;

  // 端口定义
  abstract getInputPorts(): Port[];
  abstract getOutputPorts(): Port[];

  // 参数定义与值
  protected _paramValues: Record<string, ParameterValue> = {};
  abstract getParameterDefinitions(): Record<
    string,
    {
      options: never[];
      step: number | undefined;
      type: string;
      default: ParameterValue;
      min?: number;
      max?: number;
    }
  >;

  constructor(params: ModuleParams) {
    this.id = params.id || nanoid();
    this.typeId = params.typeId;
    this.metadata = params.metadata;
    this.position = params.position || { x: 100, y: 100 };

    // 注册到生命周期管理器
    moduleLifecycleManager.registerModule(this.id, this);

    // 初始化参数值为默认值
    const paramDefs = this.getParameterDefinitions();
    Object.keys(paramDefs).forEach((paramId) => {
      const paramDef = paramDefs[paramId];
      this._paramValues[paramId] = paramDef.default;

      // 使用ObservableParameter代替普通的Parameter
      this.parameters[paramId] = new ObservableParameter(
        paramId,
        paramId, // 名称，可以改进为更友好的名称
        this.mapParamTypeToParameterType(paramDef.type),
        paramDef.default as string | number,
        paramDef.default,
        0, // modulationAmount
        null, // modulationSource
        paramDef.min,
        paramDef.max,
        paramDef.step,
        undefined, // unit
        paramDef.type.toString().toUpperCase() === 'ENUM'
          ? paramDef.options || []
          : undefined,
        true // modulatable
      );

      // 添加参数变化监听，自动应用到音频节点
      (this.parameters[paramId] as ObservableParameter).onChange((value) => {
        this._paramValues[paramId] = value;
        this.applyParameterToAudioNode(paramId, value);
      });
    });

    // 初始化预设
    if (this.metadata.presets && Array.isArray(this.metadata.presets)) {
      // 添加类型断言确保类型兼容性
      (this.metadata.presets as Preset[]).forEach((preset: Preset) => {
        this._presets[preset.id] = preset;
      });
    }
  }

  // 将参数类型映射到ParameterType枚举
  private mapParamTypeToParameterType(type: string): string {
    // 确保类型字符串有值
    if (!type) {
      console.warn(
        'Parameter type is undefined or empty, defaulting to "number"'
      );
      return 'number';
    }

    // 标准化类型字符串 (转为小写并去除空格)
    const normalizedType = type.toLowerCase().trim();

    // 映射类型字符串到ParameterType
    switch (normalizedType) {
      case 'number':
        return 'number';
      case 'integer':
        return 'integer';
      case 'boolean':
        return 'boolean';
      case 'string':
        return 'string';
      case 'enum':
        return 'enum';
      default:
        // 对于未知类型，尝试智能匹配
        if (normalizedType.includes('int')) {
          return 'integer';
        } else if (normalizedType.includes('bool')) {
          return 'boolean';
        } else if (normalizedType.includes('str')) {
          return 'string';
        } else if (
          normalizedType.includes('enum') ||
          normalizedType.includes('option')
        ) {
          return 'enum';
        } else {
          console.warn(
            `Unknown parameter type: ${type}, defaulting to "number"`
          );
          return 'number';
        }
    }
  }

  // 初始化音频节点
  async initialize(): Promise<void> {
    if (this._initialized) return;

    try {
      // 更新模块状态
      moduleLifecycleManager.setState(
        this.id,
        ModuleLifecycleState.INITIALIZING
      );

      await this.createAudioNodes();
      this._initialized = true;

      // 更新状态到已初始化
      moduleLifecycleManager.setState(
        this.id,
        ModuleLifecycleState.INITIALIZED
      );
      eventBus.emit('MODULE.INITIALIZED', { moduleId: this.id });
    } catch (error) {
      // 更新状态到错误
      moduleLifecycleManager.setState(this.id, ModuleLifecycleState.ERROR);
      console.error(`Failed to initialize module ${this.id}:`, error);
      eventBus.emit('MODULE.INITIALIZE_FAILED', { moduleId: this.id, error });
      throw error;
    }
  }

  // 创建音频节点（子类实现）
  protected abstract createAudioNodes(): Promise<void>;

  // 连接到目标模块
  connect(
    targetModule: ModuleBase,
    outputPortId: string = 'default',
    inputPortId: string = 'default'
  ): void {
    const outputNode = this.getAudioNodeForPort(outputPortId, 'output');
    const inputNode = (targetModule as unknown as Module).getAudioNodeForPort(
      inputPortId,
      'input'
    );

    if (!outputNode || !inputNode) {
      console.error('Invalid connection ports');
      return;
    }

    try {
      outputNode.connect(inputNode);
      const connectionId = nanoid(); // 生成唯一的连接ID
      eventBus.emit('CONNECTION.ESTABLISHED', {
        connectionId: connectionId,
        sourceId: this.id,
        targetId: targetModule.id,
        sourceHandle: outputPortId,
        targetHandle: inputPortId,
      } as ConnectionEvent);
    } catch (error: unknown) {
      console.error('Connection failed:', error);
      throw new Error(`Connection failed: ${(error as Error).message}`);
    }
  }

  // 断开连接
  disconnect(
    targetModule?: ModuleBase,
    outputPortId: string = 'default',
    inputPortId: string = 'default'
  ): void {
    // 如果没有指定目标，断开所有连接
    if (!targetModule) {
      Object.values(this._audioNodes).forEach((node) => {
        if (node && typeof node.disconnect === 'function') {
          node.disconnect();
        }
      });
      return;
    }

    const outputNode = this.getAudioNodeForPort(outputPortId, 'output');
    const inputNode = (targetModule as unknown as Module).getAudioNodeForPort(
      inputPortId,
      'input'
    );

    if (!outputNode || !inputNode) {
      console.error('Invalid connection ports for disconnect');
      return;
    }

    try {
      outputNode.disconnect(inputNode);
      // 对于断开连接，我们需要一个连接ID，这里临时生成一个
      const connectionId = nanoid();
      eventBus.emit('CONNECTION.BROKEN', {
        connectionId: connectionId,
        sourceId: this.id,
        targetId: targetModule.id,
        sourceHandle: outputPortId,
        targetHandle: inputPortId,
      } as ConnectionEvent);
    } catch (error: unknown) {
      console.error('Disconnect failed:', error);
    }
  }

  // 获取与指定端口关联的音频节点
  getAudioNodeForPort(
    portId: string,
    _portType: 'input' | 'output'
  ): Tone.ToneAudioNode | null {
    return this._audioNodes[portId] || null;
  }

  // 获取参数值
  getParameterValue(paramId: string): ParameterValue {
    return this.parameters[paramId]?.value ?? this._paramValues[paramId];
  }

  // 设置参数值
  setParameterValue(paramId: string, value: ParameterValue): void {
    const paramDef = this.getParameterDefinitions()[paramId];
    if (!paramDef) {
      console.error(`Parameter ${paramId} not found in module ${this.id}`);
      return;
    }

    // 验证参数值
    const validatedValue = this.validateParameterValue(paramId, value);

    // 如果是ObservableParameter，使用其setter
    const parameter = this.parameters[paramId];
    if (parameter && parameter instanceof ObservableParameter) {
      if (
        validatedValue !== null &&
        (typeof validatedValue === 'string' ||
          typeof validatedValue === 'number')
      ) {
        parameter.value = validatedValue;
      }
      return; // ObservableParameter会处理通知和事件
    }

    // 传统方式处理非ObservableParameter
    const oldValue = this._paramValues[paramId];
    this._paramValues[paramId] = validatedValue;

    if (parameter && validatedValue !== null) {
      if (
        typeof validatedValue === 'string' ||
        typeof validatedValue === 'number'
      ) {
        parameter.value = validatedValue;
      }
    }

    // 应用参数到音频节点
    this.applyParameterToAudioNode(paramId, validatedValue);

    // 发出参数变更事件
    eventBus.emit('PARAMETER.CHANGED', {
      moduleId: this.id,
      parameterId: paramId,
      value: validatedValue,
      previousValue: oldValue,
    });
  }

  // 加载预设
  loadPreset(presetId: string): void {
    const preset = this._presets[presetId];
    if (!preset) {
      console.error(`Preset ${presetId} not found for module ${this.id}`);
      return;
    }

    // 应用预设中的所有参数值
    Object.entries(preset.values).forEach(([paramId, value]) => {
      this.setParameterValue(paramId, value);
    });

    eventBus.emit('PRESET.LOADED', {
      moduleId: this.id,
      presetId: presetId,
      presetName: preset.name,
    });
  }

  // 验证参数值（确保在允许范围内）
  protected validateParameterValue(
    paramId: string,
    value: ParameterValue
  ): ParameterValue {
    const paramDef = this.getParameterDefinitions()[paramId];
    if (!paramDef) return value;

    if (paramDef.type === 'NUMBER' || paramDef.type === 'INTEGER') {
      let numValue = Number(value);

      if (paramDef.min !== undefined && numValue < paramDef.min) {
        numValue = paramDef.min;
      }

      if (paramDef.max !== undefined && numValue > paramDef.max) {
        numValue = paramDef.max;
      }

      if (paramDef.type === 'INTEGER') {
        numValue = Math.round(numValue);
      }

      return numValue;
    }

    return value;
  }

  // 应用参数到音频节点（子类实现）
  protected abstract applyParameterToAudioNode(
    paramId: string,
    value: ParameterValue
  ): void;

  // 销毁模块
  async dispose(): Promise<void> {
    // 更新状态
    moduleLifecycleManager.setState(this.id, ModuleLifecycleState.DISPOSING);

    // 销毁音频节点
    Object.values(this._audioNodes).forEach((node) => {
      if (node && typeof node.dispose === 'function') {
        node.dispose();
      }
    });

    this._audioNodes = {};
    this._initialized = false;

    // 更新状态到已销毁
    moduleLifecycleManager.setState(this.id, ModuleLifecycleState.DISPOSED);
    eventBus.emit('MODULE.DISPOSED', { moduleId: this.id });
  }
}
