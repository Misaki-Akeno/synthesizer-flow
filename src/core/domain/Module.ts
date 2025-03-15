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
import { moduleLifecycleManager } from './ModuleLifecycle';
import { ModuleLifecycleState } from '@/interfaces/lifecycle';
import { services } from '../services/ServiceManager';

export abstract class Module implements ModuleBase {
  id: string;
  typeId: string;
  metadata: ModuleMetadata;
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

  // 参数定义
  abstract getParameterDefinitions(): Record<
    string,
    {
      options: never[];
      step: number | undefined;
      type: string;
      default: ParameterValue;
      min?: number;
      max?: number;
      unit?: string;
      label?: string;
    }
  >;

  constructor(params: ModuleParams) {
    this.id = params.id || nanoid();
    this.typeId = params.typeId;
    this.metadata = params.metadata;
    this.position = params.position || { x: 100, y: 100 };

    // 注册到生命周期管理器，简化状态追踪
    moduleLifecycleManager.registerModule(this.id, this);

    // 初始化参数并注册到新的参数系统
    this.registerParametersWithSystem();

    // 初始化预设
    if (this.metadata.presets && Array.isArray(this.metadata.presets)) {
      (this.metadata.presets as Preset[]).forEach((preset: Preset) => {
        this._presets[preset.id] = preset;
      });
    }
  }

  /**
   * 向参数系统注册模块的所有参数
   */
  private registerParametersWithSystem(): void {
    const paramDefs = this.getParameterDefinitions();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const moduleParameters: Record<string, any> = {};
    
    Object.entries(paramDefs).forEach(([paramId, def]) => {
      // 转换参数定义到参数系统需要的格式
      moduleParameters[paramId] = {
        id: paramId,
        type: this.normalizeParameterType(def.type),
        value: def.default,
        defaultValue: def.default,
        min: def.min,
        max: def.max,
        step: def.step,
        unit: def.unit || '',
        label: def.label || paramId,
        options: def.type.toString().toLowerCase() === 'enum' ? def.options : undefined,
        automatable: true
      };
    });
    
    // 向参数系统注册模块参数
    services.parameterSystem.registerModuleParameters(this.id, moduleParameters);
  }
  
  /**
   * 标准化参数类型
   */
  private normalizeParameterType(type: string): string {
    if (!type) return 'number';

    const normalizedType = type.toLowerCase().trim();

    switch (normalizedType) {
      case 'number':
      case 'integer':
      case 'boolean':
      case 'string':
      case 'enum':
        return normalizedType;
      default:
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
        }
        return 'number';
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
      
      // 添加参数变更订阅，自动应用到音频节点
      this.setupParameterSubscriptions();
      
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
  
  /**
   * 设置参数变更订阅，当参数变化时应用到音频节点
   */
  private setupParameterSubscriptions(): void {
    // 获取模块定义的所有参数ID
    const paramDefs = this.getParameterDefinitions();
    
    Object.keys(paramDefs).forEach(paramId => {
      // 订阅参数变更
      services.parameterSystem.getParameterValue$(this.id, paramId)
        .subscribe(value => {
          this.applyParameterToAudioNode(paramId, value);
        });
    });
  }

  // 创建音频节点（子类实现）
  protected abstract createAudioNodes(): Promise<void>;
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

  // 获取参数值 - 使用新参数系统
  getParameterValue(paramId: string): ParameterValue {
    return services.parameterSystem.getParameterValue(this.id, paramId);
  }

  // 设置参数值 - 使用新参数系统
  setParameterValue(
    paramId: string,
    value: ParameterValue,
    skipEvent: boolean = false
  ): void {
    services.parameterSystem.updateParameterValue(
      this.id, 
      paramId, 
      value, 
      skipEvent ? 'internal' : 'ui'
    );
  }

  /**
   * 设置参数自动化范围
   * @param paramId 参数ID
   * @param minValue 最小值
   * @param maxValue 最大值
   */
  setParameterAutomationRange(
    paramId: string,
    minValue: number,
    maxValue: number
  ): void {
    services.parameterSystem.setParameterAutomationRange(
      this.id,
      paramId,
      minValue,
      maxValue
    );
  }

  /**
   * 获取参数自动化范围
   * @param paramId 参数ID
   * @returns 自动化范围 [min, max]，如果未设置则返回默认全范围
   */
  getParameterAutomationRange(paramId: string): [number, number] {
    return services.parameterSystem.getParameterAutomationRange(this.id, paramId);
  }

  /**
   * 启用参数自动化
   * @param paramId 参数ID
   * @param sourceModuleId 源模块ID
   * @param sourceParamId 源参数ID
   * @param amount 自动化强度 (0-1)
   */
  enableParameterAutomation(
    paramId: string,
    sourceModuleId: string,
    sourceParamId: string,
    amount = 1
  ): void {
    services.parameterSystem.createParameterAutomation({
      sourceModuleId,
      sourceParameterId: sourceParamId,
      targetModuleId: this.id,
      targetParameterId: paramId,
      amount
    });
    
    eventBus.emit('PARAMETER.AUTOMATION_ENABLED', {
      moduleId: this.id,
      parameterId: paramId,
      sourceModuleId,
      sourceParameterId: sourceParamId,
      amount
    });
  }

  /**
   * 禁用参数自动化
   * @param paramId 参数ID
   * @param sourceModuleId 可选，特定源模块ID
   */
  disableParameterAutomation(paramId: string, sourceModuleId?: string): void {
    services.parameterSystem.removeParameterAutomation(
      this.id,
      paramId,
      sourceModuleId,
      undefined  // 添加第四个参数，sourceParameterId 可以为 undefined
    );
    
    eventBus.emit('PARAMETER.AUTOMATION_DISABLED', {
      moduleId: this.id,
      parameterId: paramId,
      sourceModuleId
    });
  }

  // 加载预设 - 改用参数系统实现
  loadPreset(presetId: string): void {
    const preset = this._presets[presetId];
    if (!preset) {
      console.error(`Preset ${presetId} not found for module ${this.id}`);
      return;
    }

    // 不使用不存在的批量更新方法，而是逐个更新参数
    Object.entries(preset.values).forEach(([paramId, value]) => {
      services.parameterSystem.updateParameterValue(
        this.id,
        paramId,
        value,
        'preset'
      );
    });

    eventBus.emit('PRESET.LOADED', {
      moduleId: this.id,
      presetId: presetId,
      presetName: preset.name,
    });
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
    
    // 先移除所有参数自动化
    services.parameterSystem.removeAllParameterAutomations(this.id);
    
    services.parameterSystem.unregisterModuleParameters(this.id);
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
  
  // 移除对parameters属性的支持，改为通过参数系统获取
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get parameters(): Record<string, any> {
    console.warn('直接访问module.parameters已废弃，请使用参数系统API');
    // 返回一个代理对象，将操作转发到参数系统
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new Proxy({} as Record<string, any>, {
      get: (_, prop: string) => {
        if (typeof prop === 'string') {
          const value = this.getParameterValue(prop);
          return {
            id: prop,
            value,
          };
        }
        return undefined;
      },
      set: (_, prop: string, value) => {
        if (typeof prop === 'string') {
          this.setParameterValue(prop, value);
        }
        return true;
      }
    });
  }
}

export type { ModuleParams, Port };
