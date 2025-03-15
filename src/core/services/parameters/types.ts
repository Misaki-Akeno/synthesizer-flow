import { Observable } from 'rxjs';
import { ParameterValue } from '@/interfaces/event';
import { ParameterType } from '@/interfaces/parameter';

/**
 * 参数变更事件
 */
export interface ParameterChange {
  /** 模块ID */
  moduleId: string;
  
  /** 参数ID */
  parameterId: string;
  
  /** 新值 */
  value: ParameterValue;
  
  /** 旧值 */
  previousValue: ParameterValue;
  
  /** 变更来源 */
  source: 'ui' | 'api' | 'automation' | 'preset' | 'internal';
}

/**
 * 参数状态接口
 */
export interface ParameterState {
  /** 参数唯一标识 */
  id: string;
  
  /** 参数名称 */
  name?: string;
  
  /** 参数类型 */
  type: ParameterType | string;
  
  /** 参数当前值 */
  value: ParameterValue;
  
  /** 参数默认值 */
  defaultValue: ParameterValue;
  
  /** 自动化量 (0-1) */
  automationAmount?: number;
  
  /** 最小值 (适用于number类型) */
  min?: number;
  
  /** 最大值 (适用于number类型) */
  max?: number;
  
  /** 步长 (适用于number类型) */
  step?: number;
  
  /** 可选选项 (适用于enum类型) */
  options?: (string | number)[];
  
  /** 值单位 */
  unit?: string;
  
  /** 参数显示名 */
  label?: string;
  
  /** 是否可见 */
  visible?: boolean;
  
  /** 是否已禁用 */
  disabled?: boolean;
  
  /** 是否可自动化 */
  automatable?: boolean;
  
  /** 是否被自动化控制 */
  automated?: boolean;
  
  /** 自动化控制源 */
  automationSource?: {
    moduleId: string;
    parameterId: string;
  };
  
  /** 自动化范围 [min, max] */
  automationRange?: [number, number];
  
  /** 上次更新时间戳 */
  lastUpdated: number;
}

/**
 * 模块参数状态映射
 */
export type ModuleParametersState = Record<string, ParameterState>;

/**
 * 参数订阅配置
 */
export interface ParameterSubscriptionOptions {
  /** 节流时间(毫秒) */
  throttleTime?: number;

  /** 去抖时间(毫秒) */
  debounceTime?: number;

  /** 是否使用动画帧调度器(UI友好) */
  animationFrame?: boolean;

  /** 是否区分变更(过滤相同值) */
  distinctUntilChanged?: boolean;
  
  /** 是否在订阅时立即发射当前值 */
  emitCurrentValue?: boolean;
}

/**
 * 参数自动化配置
 */
export interface ParameterAutomationConfig {
  /** 源模块ID */
  sourceModuleId: string;
  
  /** 源参数ID */
  sourceParameterId: string;
  
  /** 目标模块ID */
  targetModuleId: string;
  
  /** 目标参数ID */
  targetParameterId: string;
  
  /** 自动化强度 (0-1) */
  amount: number;
  
  /** 自定义值映射函数 */
  mapping?: (value: number, min: number, max: number) => number;
}

/**
 * 参数观察者接口
 */
export interface ParameterObserver {
  /** 获取特定模块所有参数状态的流 */
  getModuleParameters$(moduleId: string): Observable<ModuleParametersState>;
  
  /** 获取特定参数值的流 */
  getParameterValue$<T extends ParameterValue = ParameterValue>(
    moduleId: string,
    parameterId: string
  ): Observable<T>;
  
  /** 获取特定参数状态的流 */
  getParameterState$(
    moduleId: string, 
    parameterId: string
  ): Observable<ParameterState>;
  
  /** 获取参数变更事件的流 */
  getParameterChanges$(): Observable<ParameterChange>;
  
  /** 按模块ID获取参数变更事件的流 */
  getModuleParameterChanges$(moduleId: string): Observable<ParameterChange>;
}
