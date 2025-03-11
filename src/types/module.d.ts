// 模块类型定义
// 包含模块元数据的类型定义
// 模块实例本身的类型定义，可以在后面开发过程中逐步添加

import { Parameter } from './parameter';
import { ParameterValue } from './event';

/**
 * 模块类别枚举
 */
export enum ModuleCategory {
  GENERATOR = 'GENERATOR',
  FILTER = 'FILTER',
  MODULATOR = 'MODULATOR',
  UTILITY = 'UTILITY',
  EFFECT = 'EFFECT',
  MIXER = 'MIXER',
  CONTROLLER = 'CONTROLLER',
  CUSTOM = 'CUSTOM',
}

/**
 * 数据类型枚举
 */
export enum DataType {
  AUDIO = 'AUDIO',
  CONTROL = 'CONTROL',
  TRIGGER = 'TRIGGER',
  MIDI = 'MIDI',
  EVENT = 'EVENT',
  CUSTOM = 'CUSTOM',
}

/**
 * 参数类型枚举
 */
export enum ParamType {
  NUMBER = 'NUMBER',
  STRING = 'STRING',
  BOOLEAN = 'BOOLEAN',
  ENUM = 'ENUM',
  OBJECT = 'OBJECT',
}

/**
 * 模块接口定义
 */
export interface ModuleInterface {
  id: string;
  label: string;
  dataType: DataType;
  multiConnection?: boolean;
  optional?: boolean;
  description?: string;
  [key: string]: unknown;
}

/**
 * 模块UI配置
 */
export interface ModuleUI {
  color: string;
  icon: string;
  width: number | string;
  height: number | string;
  customView?: string;
}

/**
 * 参数定义
 */
export interface ParameterDefinition {
  type: string;
  default: ParameterValue;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  label: string;
  description?: string;
  options?: Array<string | number>;
  modulatable?: boolean;
  visibleWhen?: {
    parameter: string;
    equals: ParameterValue | ParameterValue[];
  };
}

/**
 * 预设定义
 */
export interface Preset {
  id: string;
  name: string;
  author: string;
  description?: string;
  values: Record<string, ParameterValue>;
  tags?: string[];
}

/**
 * 引擎配置数据类型
 */
export type EngineConfigData = Record<string, ParameterValue>;

/**
 * 音频引擎特定配置
 */
export interface EngineConfig {
  toneComponent?: string;
  toneConfiguration?: {
    setup: (params: EngineConfigData) => EngineConfigData;
  };
  [key: string]: ParameterValue | undefined;
}

/**
 * 模块元数据扩展属性类型
 */
export type ModuleMetadataExtension = Record<string, ParameterValue>;

/**
 * 模块元数据
 */
export interface ModuleMetadata {
  /** 模块唯一标识符 */
  id: string;

  /** 模块名称 */
  name: string;

  /** 模块版本 */
  version: string;

  /** 模块类别 */
  category: ModuleCategory | string;

  /** 标签列表，用于模块分类和搜索 */
  tags: string[];

  /** 模块描述 */
  description: string;

  /** 作者信息 */
  author: string;

  /** 创建日期 */
  created: string;

  /** 更新日期 */
  updated: string;

  /** 模块类引用路径，用于动态导入 */
  moduleClass?: string;

  /** 模块构造函数引用，用于实例化 */
  moduleConstructor?: new (...args: unknown[]) => ModuleBase;

  /** 其他自定义元数据 */
  [key: string]:
    | ParameterValue
    | string[]
    | undefined
    | (new (...args: unknown[]) => ModuleBase);
}

/**
 * 模块配置扩展属性类型
 */
export type ModuleConfigurationExtension = Record<
  string,
  ParameterValue | Record<string, unknown>
>;

/**
 * 模块完整配置
 */
export interface ModuleConfiguration {
  /** 模块元数据 */
  metadata: ModuleMetadata;

  /** 模块接口定义 */
  interfaces: {
    inputs: ModuleInterface[];
    outputs: ModuleInterface[];
  };

  /** 参数定义 */
  parameters: Record<string, ParameterDefinition>;

  /** 预设列表 */
  presets: Preset[];

  /** UI配置 */
  ui: ModuleUI;

  /** 引擎特定配置和其他扩展属性 */
  [key: string]:
    | ModuleMetadata
    | { inputs: ModuleInterface[]; outputs: ModuleInterface[] }
    | Record<string, ParameterDefinition>
    | Preset[]
    | ModuleUI
    | ModuleConfigurationExtension[keyof ModuleConfigurationExtension];
}

/**
 * 模块实例基类接口
 */
export interface ModuleBase {
  /** 模块实例ID */
  id: string;

  /** 模块类型ID (引用ModuleMetadata.id) */
  typeId: string;

  /** 模块元数据 */
  metadata: ModuleMetadata;

  /** 模块参数 */
  parameters: Record<string, Parameter>;

  /** 初始化模块 */
  initialize(): Promise<void>;

  /** 销毁模块 */
  dispose(): Promise<void>;

  /** 连接到其他模块 */
  connect(targetModule: ModuleBase, outputId?: string, inputId?: string): void;

  /** 断开与其他模块的连接 */
  disconnect(
    targetModule?: ModuleBase,
    outputId?: string,
    inputId?: string
  ): void;

  /** 获取参数值 */
  getParameterValue(parameterId: string): ParameterValue;

  /** 设置参数值 */
  setParameterValue(parameterId: string, value: ParameterValue): void;

  /** 加载预设 */
  loadPreset(presetId: string): void;

  /** 自定义方法和属性 */
  [key: string]: unknown;
}

/**
 * 模块注册表接口
 */
export interface ModuleRegistry {
  /** 注册模块类型 */
  register(moduleConfig: ModuleConfiguration): void;

  /** 获取所有已注册的模块类型 */
  getAll(): ModuleConfiguration[];

  /** 根据ID获取模块类型 */
  getById(id: string): ModuleConfiguration | undefined;

  /** 根据类别获取模块类型 */
  getByCategory(category: ModuleCategory | string): ModuleConfiguration[];

  /** 根据标签获取模块类型 */
  getByTag(tag: string): ModuleConfiguration[];
}

/**
 * 模块工厂接口
 */
export interface ModuleFactory {
  /** 创建模块实例 */
  create(typeId: string, instanceId?: string): Promise<ModuleBase>;

  /** 销毁模块实例 */
  destroy(moduleId: string): Promise<void>;
}

export { ParameterValue };
