import { BehaviorSubject } from 'rxjs';
import { parameterStream } from './ParameterStream';

/**
 * 参数系统入口点
 * 导出所有必要的类、接口和实例
 */

// 重新导出类型
export * from './types';

// 导出核心类
export { ParameterSubject } from './ParameterSubject';
export { ParameterStream } from './ParameterStream';

// 导出默认实例
export { parameterStream };

// 参数系统当前是否激活
export const parameterSystemActive = new BehaviorSubject<boolean>(false);

/**
 * 初始化参数系统
 */
export function initializeParameterSystem(): void {
  // 这里将来可以放置任何初始化逻辑
  parameterSystemActive.next(true);
  console.log('Parameter system initialized');
}

/**
 * 关闭参数系统
 */
export function shutdownParameterSystem(): void {
  parameterSystemActive.next(false);
  console.log('Parameter system shutdown');
}
