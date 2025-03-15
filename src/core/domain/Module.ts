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
} from '@/interfaces/module';
import { Parameter } from '@/interfaces/parameter';
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

    // 注册到生命周期管理器，简化状态追踪
    moduleLifecycleManager.registerModule(this.id, this);

    // 初始化参数值为默认值
    const paramDefs = this.getParameterDefinitions();
    Object.keys(paramDefs).forEach((paramId) => {
      const paramDef = paramDefs[paramId];
      this._paramValues[paramId] = paramDef.default;

      // 使用标准Parameter对象
      this.parameters[paramId] = {
        id: paramId,
        name: paramId, // 名称，可以改进为更友好的名称
        type: this.mapParamTypeToParameterType(paramDef.type),
        value: paramDef.default as string | number,
        defaultValue: paramDef.default,
        automationAmount: 0,
        automationSource: null,
        min: paramDef.min,
        max: paramDef.max,
        step: paramDef.step,
        options:
          paramDef.type.toString().toUpperCase() === 'ENUM'
            ? paramDef.options || []
            : undefined,
        automatable: true,
      };
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

  // 简化连接方法，直接连接音频节点
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
      console.error('无效的连接端口');
      return;
    }

    try {
      outputNode.connect(inputNode);
    } catch (error: unknown) {
      console.error('连接失败:', error);
      throw new Error(`连接失败: ${(error as Error).message}`);
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
          try {
            node.disconnect();
          } catch (error) {
            console.warn(`无法断开所有连接: ${(error as Error).message}`);
          }
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
      // 尝试特定断开
      outputNode.disconnect(inputNode);
    } catch (error: unknown) {
      // 特定断开失败，尝试检查错误类型
      if (error instanceof Error && error.name === 'InvalidAccessError') {
        // 这可能意味着连接不存在
        console.warn(`尝试断开不存在的连接: ${this.id} -> ${targetModule.id}`);
      } else {
        // 对于其他错误，重试使用全断开然后重连其他连接的方式
        try {
          // 获取当前模块的所有输出节点
          // const outputNodes = this.getOutputPorts().map(port =>
          //   this.getAudioNodeForPort(port.id, 'output')
          // ).filter(Boolean);

          // 断开当前输出节点的所有连接
          if (outputNode && typeof outputNode.disconnect === 'function') {
            outputNode.disconnect();
            console.log(`断开 ${outputPortId} 的所有连接并将重新连接其他连接`);
          }
        } catch (retryError) {
          console.error('断开连接时发生错误:', retryError);
        }
      }
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
    return this._paramValues[paramId];
  }

  // 设置参数值
  setParameterValue(
    paramId: string,
    value: ParameterValue,
    skipEvent: boolean = false
  ): void {
    const paramDef = this.getParameterDefinitions()[paramId];
    if (!paramDef) {
      console.error(`Parameter ${paramId} not found in module ${this.id}`);
      return;
    }

    // 验证参数值
    const validatedValue = this.validateParameterValue(paramId, value);

    // 更新内部参数值
    this._paramValues[paramId] = validatedValue;

    // 更新Parameter对象的值
    const parameter = this.parameters[paramId];
    if (parameter) {
      parameter.value = validatedValue;
    }

    // 确保应用参数到音频节点 - 这是关键步骤
    if (this._initialized && this._audioNodes) {
      this.applyParameterToAudioNode(paramId, validatedValue);
    } else {
      console.warn(
        `Module ${this.id} not initialized or no audio nodes available`
      );
    }

    // 只有当skipEvent为false时才发送事件，避免重复事件
    if (!skipEvent) {
      eventBus.emit('PARAMETER.CHANGED', {
        moduleId: this.id,
        parameterId: paramId,
        value: validatedValue,
        previousValue: parameter?.value,
      });
    }
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

export type { ModuleParams, Port };
