import { ParameterValue } from './event';

/**
 * 参数类型
 */
export type ParameterType = 
  | 'number' 
  | 'integer' 
  | 'boolean' 
  | 'string' 
  | 'enum';

/**
 * 参数接口
 * 用于UI展示和控制的参数对象
 */
export interface Parameter {
  /** 参数唯一标识 */
  id: string;
  
  /** 显示名称 */
  name: string;
  
  /** 参数类型 */
  type: ParameterType | string;
  
  /** 当前值 */
  value: ParameterValue;
  
  /** 默认值 */
  defaultValue: ParameterValue;
  
  /** 自动化量 */
  automationAmount: number;
  
  /** 自动化源(模块ID) */
  automationSource: string | null;
  
  /** 最小值(数字类型) */
  min?: number;
  
  /** 最大值(数字类型) */
  max?: number;
  
  /** 步长(数字类型) */
  step?: number;
  
  /** 单位 */
  unit?: string;
  
  /** 可选项(枚举类型) */
  options?: (string | number)[];
  
  /** 是否可见 */
  visible?: boolean;
  
  /** 是否禁用 */
  disabled?: boolean;
  
  /** 是否可自动化 */
  automatable?: boolean;
  
  /** 显示为禁用的条件 */
  disabledWhen?: {
    parameter: string;
    equals: ParameterValue | ParameterValue[];
  };
  
  /** 显示为可见的条件 */
  visibleWhen?: {
    parameter: string;
    equals: ParameterValue | ParameterValue[];
  };
  
  /** 用于UI显示的标签 */
  label?: string;
  
  /** 显示值，可能与实际值有所不同 */
  displayValue?: ParameterValue;
  
  /** 是否已启用自动化 */
  isAutomated?: boolean;
  
  /** 是否准备启用自动化 */
  isAutomationEnabled?: boolean;
  
  /** 自动化范围 [min, max] */
  automationRange?: [number, number];
}

export * from './parameter';
