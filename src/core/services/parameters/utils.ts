import { Observable, timer, fromEvent } from 'rxjs';
import { 
  map, 
  scan, 
  debounceTime,
  finalize,
  take
} from 'rxjs/operators';
import { Parameter } from '@/interfaces/parameter';
import { ParameterValue } from '@/interfaces/event';
import { ParameterState } from './types';

/**
 * 为参数创建初始状态
 * @param parameter 参数配置
 * @returns 参数状态
 */
export function createInitialParameterState(parameter: Parameter): ParameterState {
  return {
    ...parameter,
    visible: true,
    disabled: false,
    lastUpdated: Date.now(),
    automationActive: false
  };
}

/**
 * 创建参数平滑变化的Observable
 * @param from 起始值
 * @param to 目标值
 * @param duration 持续时间(毫秒)
 * @param steps 变化步数
 */
export function createSmoothTransition(
  from: number, 
  to: number, 
  duration = 500, 
  steps = 30
): Observable<number> {
  const stepTime = Math.floor(duration / steps);
  
  return timer(0, stepTime).pipe(
    map(i => {
      const progress = Math.min(i / steps, 1);
      return from + (to - from) * progress;
    }),
    take(steps + 1),
    scan((acc, value) => value, from),
    finalize(() => to) // 确保最后一个值是目标值
  );
}

/**
 * 检查参数是否可见(基于visibleWhen条件)
 * @param parameter 参数
 * @param getParameterValue 获取其他参数值的函数
 */
export function isParameterVisible(
  parameter: Parameter,
  getParameterValue: (paramId: string) => ParameterValue
): boolean {
  // 如果没有visibleWhen条件，则参数可见
  if (!parameter.visibleWhen) {
    return true;
  }

  const { visibleWhen } = parameter;
  const conditionParamValue = getParameterValue(visibleWhen.parameter);
  
  // 如果条件参数是数组，检查值是否在数组中
  if (Array.isArray(visibleWhen.equals)) {
    return visibleWhen.equals.includes(conditionParamValue);
  }
  
  // 否则直接比较值
  return conditionParamValue === visibleWhen.equals;
}

/**
 * 格式化参数值用于显示
 * @param value 参数值
 * @param parameter 参数定义
 */
export function formatParameterValue(
  value: ParameterValue,
  parameter: Parameter
): string {
  if (value === null || value === undefined) {
    return '-';
  }

  switch (parameter.type) {
    case 'number':
      if (typeof value === 'number') {
        // 格式化数字，保留适当精度
        let precision = 2;
        if (parameter.step) {
          // 根据步长决定精度
          precision = Math.max(0, -Math.floor(Math.log10(parameter.step)));
        }
        
        let formatted = value.toFixed(precision);
        // 删除尾随零
        formatted = formatted.replace(/\.?0+$/, '');
        
        // 添加单位
        if (parameter.unit) {
          formatted += ` ${parameter.unit}`;
        }
        return formatted;
      }
      return String(value);
      
    case 'boolean':
      return value ? '开启' : '关闭';
      
    case 'enum':
      // 枚举值可能需要本地化或映射到友好名称
      return String(value);
      
    default:
      return String(value);
  }
}


/**
 * 从DOM元素创建参数控制Observable
 * @param element DOM元素
 * @param eventName 事件名称
 * @param valueExtractor 从事件中提取值的函数
 */
export function createDOMParameterControl<T extends Event>(
  element: HTMLElement,
  eventName: string,
  valueExtractor: (event: T) => ParameterValue
): Observable<ParameterValue> {
  return fromEvent<T>(element, eventName).pipe(
    map(event => valueExtractor(event)),
    debounceTime(10) // 简单防抖
  );
}

/**
 * 映射参数值到另一个范围
 * @param value 输入值
 * @param inMin 输入最小值
 * @param inMax 输入最大值
 * @param outMin 输出最小值
 * @param outMax 输出最大值
 * @param clamp 是否限制在输出范围内
 */
export function mapRange(
  value: number, 
  inMin: number, 
  inMax: number, 
  outMin: number, 
  outMax: number,
  clamp = true
): number {
  // 规范化输入值到0-1范围
  const normalized = (value - inMin) / (inMax - inMin);
  
  // 映射到输出范围
  let result = normalized * (outMax - outMin) + outMin;
  
  // 如果需要，限制在输出范围内
  if (clamp) {
    result = Math.max(outMin, Math.min(outMax, result));
  }
  
  return result;
}

/**
 * 应用MIDI CC曲线到参数值
 * 实现不同的MIDI控制曲线(线性、对数、指数等)
 * @param value 0-1范围的输入值
 * @param curveType 曲线类型
 */
export function applyCurve(
  value: number, 
  curveType: 'linear' | 'logarithmic' | 'exponential' = 'linear'
): number {
  switch (curveType) {
    case 'logarithmic':
      // 对数曲线 - 低值更敏感
      return Math.log10(value * 9 + 1);
      
    case 'exponential':
      // 指数曲线 - 高值更敏感
      return value * value;
      
    case 'linear':
    default:
      // 线性曲线 - 均匀响应
      return value;
  }
}
