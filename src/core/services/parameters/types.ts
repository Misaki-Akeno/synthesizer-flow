import { Observable } from 'rxjs';
import { Parameter } from '@/interfaces/parameter';
import { ParameterValue } from '@/interfaces/event';

/**
 * 参数变更事件
 */
export interface ParameterChange {
  /** 模块ID */
  moduleId: string;
  
  /** 参数ID */
  parameterId: string;
  
  /** 新参数值 */
  value: ParameterValue;
  
  /** 先前的参数值 */
  previousValue?: ParameterValue;
  
  /** 可选的时间戳 */
  timestamp?: number;
  
  /** 可选的单位 */
  unit?: string;
  
  /** 可选的源标识符(例如UI、自动化、预设) */
  source?: 'ui' | 'automation' | 'preset' | 'api' | 'internal';
}

/**
 * 参数状态
 */
export interface ParameterState extends Parameter {
  /** 参数是否可见 */
  visible: boolean;
  
  /** 参数是否被禁用 */
  disabled: boolean;
  
  /** 参数的最后更新时间 */
  lastUpdated: number;
  
  /** 参数更新来源 */
  lastUpdateSource?: string;
  
  /** 自动化活跃状态 */
  automationActive: boolean;
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
  
  /** 自动化量(影响程度) */
  amount: number;
  
  /** 可选的映射函数 */
  mapping?: (value: number, min: number, max: number) => number;
  
  /** 是否双向绑定 */
  bidirectional?: boolean;
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
