import { ParameterValue } from './event';

/**
 * 参数类型枚举
 */
export enum ParameterType {
  NUMBER = 'number',
  INTEGER = 'integer',
  STRING = 'string',
  BOOLEAN = 'boolean',
  ENUM = 'enum',
  OBJECT = 'object',
}

/**
 * 参数接口
 */
export interface Parameter {
  /** 参数ID */
  id: string;

  /** 参数名称 */
  name: string;

  /** 参数类型 */
  type: ParameterType | string;

  /** 当前值 */
  value: ParameterValue;

  /** 默认值 */
  defaultValue: ParameterValue;

  /** 自动化量 */
  automationAmount: number;

  /** 自动化源 */
  automationSource: string | null;

  /** 最小值（数值类型参数） */
  min?: number;

  /** 最大值（数值类型参数） */
  max?: number;

  /** 步长（数值类型参数） */
  step?: number;

  /** 单位（如Hz、dB等） */
  unit?: string;

  /** 可选值列表（枚举类型参数） */
  options?: Array<string | number>;

  /** 是否可自动化 */
  automatable?: boolean;

  /** 显示条件 */
  visibleWhen?: {
    parameter: string;
    equals: ParameterValue | ParameterValue[];
  };
}

export * from './parameter';
