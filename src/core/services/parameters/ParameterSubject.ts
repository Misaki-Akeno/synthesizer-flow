import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { 
  distinctUntilChanged, 
  map, 
  shareReplay, 
  debounceTime, 
  throttleTime,
  observeOn
} from 'rxjs/operators';
import { animationFrameScheduler } from 'rxjs';
import { ParameterValue } from '@/interfaces/event';
import { 
  ParameterState, 
  ParameterChange, 
  ParameterSubscriptionOptions 
} from './types';

/**
 * 参数Subject类
 * 封装单个参数的响应式状态和行为
 */
export class ParameterSubject {
  /** 参数状态的主Subject */
  private state$: BehaviorSubject<ParameterState>;
  
  /** 参数变更事件通知 */
  private changes$: Subject<ParameterChange>;
  
  /** 共享的参数值Observable */
  private sharedValue$: Observable<ParameterValue>;

  /**
   * 创建新的参数Subject
   * @param moduleId 模块ID
   * @param parameter 初始参数配置
   */
  constructor(
    private readonly moduleId: string,
    parameter: Partial<ParameterState>
  ) {
    // 初始化参数状态
    const initialState: ParameterState = {
      id: parameter.id || '',
      type: parameter.type || 'number',
      value: parameter.value !== undefined ? parameter.value : null,
      defaultValue: parameter.defaultValue !== undefined ? parameter.defaultValue : null,
      min: parameter.min,
      max: parameter.max,
      step: parameter.step,
      options: parameter.options,
      unit: parameter.unit,
      label: parameter.label || parameter.id || '',
      visible: true,
      disabled: false,
      automatable: parameter.automatable || false,
      automated: false,
      automationRange: parameter.automationRange,
      automationSource: parameter.automationSource,
      lastUpdated: 0
    };

    // 创建主要subjects
    this.state$ = new BehaviorSubject<ParameterState>(initialState);
    this.changes$ = new Subject<ParameterChange>();
    
    // 创建共享的值流，使用shareReplay确保多个订阅者获得相同的值
    this.sharedValue$ = this.state$.pipe(
      map(state => state.value),
      distinctUntilChanged(),
      shareReplay(1)
    );
  }

  /**
   * 获取参数状态Observable
   */
  getState$(): Observable<ParameterState> {
    return this.state$.asObservable();
  }

  /**
   * 获取参数值Observable，支持订阅配置
   */
  getValue$<T extends ParameterValue = ParameterValue>(
    options?: ParameterSubscriptionOptions
  ): Observable<T> {
    // 创建基础值流
    let valueStream: Observable<T> = this.sharedValue$ as Observable<T>;
    
    // 应用选项设置
    if (options) {
      // 应用时间控制，如果指定了
      if (options.debounceTime && options.debounceTime > 0) {
        valueStream = valueStream.pipe(debounceTime(options.debounceTime));
      }
      
      if (options.throttleTime && options.throttleTime > 0) {
        valueStream = valueStream.pipe(throttleTime(options.throttleTime));
      }
      
      // 使用动画帧调度器，如果需要
      if (options.animationFrame) {
        valueStream = valueStream.pipe(observeOn(animationFrameScheduler));
      }
      
      // 确保值变化后才发出
      if (options.distinctUntilChanged !== false) {
        valueStream = valueStream.pipe(distinctUntilChanged());
      }
    }
    
    return valueStream;
  }

  /**
   * 获取参数变更事件Observable
   */
  getChanges$(): Observable<ParameterChange> {
    return this.changes$.asObservable();
  }

  /**
   * 更新参数值
   */
  setValue(
    value: ParameterValue, 
    source: ParameterChange['source'] = 'api'
  ): void {
    const currentState = this.state$.getValue();
    
    // 如果值没有变化，不执行更新
    if (currentState.value === value) {
      return;
    }
    
    // 验证并调整值
    const validValue = this.validateValue(value, currentState);
    
    // 更新状态
    const newState: ParameterState = {
      ...currentState,
      value: validValue
    };
    
    // 发出值变更事件
    this.changes$.next({
      moduleId: this.moduleId,
      parameterId: currentState.id,
      value: validValue,
      previousValue: currentState.value,
      source
    });
    
    // 更新状态
    this.state$.next(newState);
  }

  /**
   * 更新参数状态
   */
  updateState(partialState: Partial<ParameterState>): void {
    const currentState = this.state$.getValue();
    
    // 合并状态
    const newState: ParameterState = {
      ...currentState,
      ...partialState
    };
    
    // 如果值发生变化，发出变更事件
    if (partialState.value !== undefined && 
        partialState.value !== currentState.value) {
      this.changes$.next({
        moduleId: this.moduleId,
        parameterId: currentState.id,
        value: partialState.value,
        previousValue: currentState.value,
        source: 'internal'
      });
    }
    
    // 更新状态
    this.state$.next(newState);
  }

  /**
   * 获取当前参数值
   */
  getValue(): ParameterValue {
    return this.state$.getValue().value;
  }

  /**
   * 获取当前参数状态
   */
  getCurrentState(): ParameterState {
    return this.state$.getValue();
  }

  /**
   * 重置参数到默认值
   */
  reset(): void {
    const state = this.state$.getValue();
    this.setValue(state.defaultValue, 'api');
  }

  /**
   * 启用自动化
   */
  enableAutomation(sourceModuleId: string, sourceParameterId: string): void {
    this.updateState({
      automated: true,
      automationSource: {
        moduleId: sourceModuleId,
        parameterId: sourceParameterId
      }
    });
  }

  /**
   * 禁用自动化
   */
  disableAutomation(): void {
    this.updateState({
      automated: false,
      automationSource: undefined
    });
  }

  /**
   * 设置自动化范围
   * @param range 自动化范围 [min, max]
   */
  setAutomationRange(range: [number, number]): void {
    const currentState = this.state$.getValue();
    
    this.state$.next({
      ...currentState,
      automationRange: range
    });
  }

  /**
   * 验证并调整参数值
   * 从私有方法改为公共方法，方便兼容层调用
   */
  validateValue(value: ParameterValue, state: ParameterState): ParameterValue {
    if (value === null || value === undefined) {
      return state.defaultValue;
    }

    // 根据参数类型验证和调整值
    switch (state.type) {
      case 'number':
        if (typeof value !== 'number') {
          try {
            value = Number(value);
          } catch {
            return state.defaultValue;
          }
        }
        // 限制在最大最小值范围内
        if (state.min !== undefined && value < state.min) {
          value = state.min;
        }
        if (state.max !== undefined && value > state.max) {
          value = state.max;
        }
        break;
        
      case 'integer':
        if (typeof value !== 'number') {
          try {
            value = Number(value);
          } catch {
            return state.defaultValue;
          }
        }
        value = Math.round(value as number);
        // 限制在最大最小值范围内
        if (state.min !== undefined && value < state.min) {
          value = state.min;
        }
        if (state.max !== undefined && value > state.max) {
          value = state.max;
        }
        break;
        
      case 'boolean':
        if (typeof value !== 'boolean') {
          value = Boolean(value);
        }
        break;
        
      case 'string':
        if (typeof value !== 'string') {
          value = String(value);
        }
        break;
        
      case 'enum':
        // 类型安全的检查
        if (state.options && Array.isArray(state.options)) {
          const options = state.options as Array<string | number>;
          if (!options.some(opt => opt === value)) {
            return state.defaultValue;
          }
        }
        break;
    }

    return value;
  }
}
