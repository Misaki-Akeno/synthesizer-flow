import { 
  Observable, 
  Subject, 
  merge, 
  of, 
  combineLatest,
} from 'rxjs';
import { 
  filter, 
  map, 
  takeUntil, 
} from 'rxjs/operators';
import { ParameterSubject } from './ParameterSubject';
import { 
  ParameterChange, 
  ParameterState,
  ModuleParametersState,
  ParameterAutomationConfig
} from './types';
import { ParameterValue } from '@/interfaces/event';

/**
 * 参数流管理类
 * 管理系统中所有参数的流，并提供访问和操作功能
 */
export class ParameterStream {
  /** 所有模块的参数Subjects，以模块ID和参数ID为键 */
  private parameterSubjects = new Map<string, Map<string, ParameterSubject>>();
  
  /** 参数变更事件的全局流 */
  private globalChanges$ = new Subject<ParameterChange>();
  
  /** 模块被销毁的通知Subject */
  private moduleDisposed$ = new Subject<string>();
  
  /** 活跃的参数自动化配置 */
  private automations = new Map<string, ParameterAutomationConfig>();

  /**
   * 注册模块参数
   * @param moduleId 模块ID
   * @param parameters 参数字典
   */
  registerModuleParameters(
    moduleId: string, 
    parameters: Record<string, Partial<ParameterState> | unknown>
  ): void {
    // 创建一个新的模块参数Map
    const moduleParams = new Map<string, ParameterSubject>();
    
    // 为每个参数创建一个Subject
    for (const [parameterId, parameter] of Object.entries(parameters)) {
      const paramState = parameter as Partial<ParameterState>;
      const paramSubject = new ParameterSubject(moduleId, {
        ...paramState,
        id: paramState.id || parameterId, // 确保参数有ID
        name: parameterId, // 参数名称使用参数ID
        automationAmount: 1.0, // 默认自动化量
        automationSource: undefined, // 初始为未定义以匹配期望类型
      });
      // 订阅参数变更并将其转发到全局变更流
      paramSubject.getChanges$()
        .pipe(takeUntil(this.getModuleDisposeSignal$(moduleId)))
        .subscribe(change => {
          this.globalChanges$.next(change);
        });
      
      moduleParams.set(parameterId, paramSubject);
    }
    
    // 存储模块的参数Subjects
    this.parameterSubjects.set(moduleId, moduleParams);
  }

  /**
   * 注销模块参数
   * @param moduleId 模块ID
   */
  unregisterModuleParameters(moduleId: string): void {
    // 发出模块销毁信号
    this.moduleDisposed$.next(moduleId);
    
    // 删除该模块的所有参数
    this.parameterSubjects.delete(moduleId);
    
    // 删除与该模块相关的所有自动化
    for (const [key, config] of this.automations.entries()) {
      if (config.sourceModuleId === moduleId || config.targetModuleId === moduleId) {
        this.automations.delete(key);
      }
    }
  }

  /**
   * 获取特定模块的参数销毁信号
   * @param moduleId 模块ID
   */
  private getModuleDisposeSignal$(moduleId: string): Observable<string> {
    return this.moduleDisposed$.pipe(
      filter(id => id === moduleId)
    );
  }

  /**
   * 获取特定参数的Subject
   * @param moduleId 模块ID
   * @param parameterId 参数ID
   */
  getParameterSubject(
    moduleId: string, 
    parameterId: string
  ): ParameterSubject | undefined {
    const moduleParams = this.parameterSubjects.get(moduleId);
    if (!moduleParams) {
      return undefined;
    }
    return moduleParams.get(parameterId);
  }

  /**
   * 获取特定参数的值流
   * @param moduleId 模块ID
   * @param parameterId 参数ID
   */
  getParameterValue$<T extends unknown[]>(
    moduleId: string, 
    parameterId: string
  ): Observable<T> {
    const subject = this.getParameterSubject(moduleId, parameterId);
    if (!subject) {
      // 如果参数不存在，返回一个不发出值的Observable
      console.warn(`Parameter not found: ${moduleId}.${parameterId}`);
      return new Observable<T>();
    }
    
    return subject.getValue$<T>();
  }

  /**
   * 获取参数的当前值
   * @param moduleId 模块ID
   * @param parameterId 参数ID
   * @returns 参数的当前值
   */
  getParameterValue(
    moduleId: string,
    parameterId: string
  ): ParameterValue {
    const subject = this.getParameterSubject(moduleId, parameterId);
    if (!subject) {
      console.warn(`Parameter not found: ${moduleId}.${parameterId}`);
      return null; // Return null instead of undefined to match ParameterValue type
    }
    
    return subject.getValue();
  }

  /**
   * 获取特定参数的状态流
   * @param moduleId 模块ID
   * @param parameterId 参数ID
   */
  getParameterState$(
    moduleId: string, 
    parameterId: string
  ): Observable<ParameterState> {
    const subject = this.getParameterSubject(moduleId, parameterId);
    if (!subject) {
      console.warn(`Parameter not found: ${moduleId}.${parameterId}`);
      return new Observable<ParameterState>();
    }
    
    return subject.getState$();
  }

  /**
   * 获取模块所有参数状态的流
   * @param moduleId 模块ID
   */
  getModuleParameters$(moduleId: string): Observable<ModuleParametersState> {
    const moduleParams = this.parameterSubjects.get(moduleId);
    if (!moduleParams) {
      console.warn(`Module not found: ${moduleId}`);
      return of({});
    }
    
    // 获取所有参数的状态Observable
    const paramStates$ = Array.from(moduleParams.entries()).map(
      ([parameterId, subject]) => subject.getState$().pipe(
        map(state => ({ [parameterId]: state }))
      )
    );
    
    // 合并所有参数状态
    if (paramStates$.length === 0) {
      return of({});
    }
    
    return combineLatest(paramStates$).pipe(
      map(stateObjects => Object.assign({}, ...stateObjects)),
      takeUntil(this.getModuleDisposeSignal$(moduleId))
    );
  }

  /**
   * 获取全局参数变更流
   */
  getParameterChanges$(): Observable<ParameterChange> {
    return this.globalChanges$.asObservable();
  }

  /**
   * 获取特定模块的参数变更流
   * @param moduleId 模块ID
   */
  getModuleParameterChanges$(moduleId: string): Observable<ParameterChange> {
    return this.globalChanges$.pipe(
      filter(change => change.moduleId === moduleId),
      takeUntil(this.getModuleDisposeSignal$(moduleId))
    );
  }

  /**
   * 更新特定参数值
   * @param moduleId 模块ID
   * @param parameterId 参数ID
   * @param value 参数值
   * @param source 更新源
   */
  updateParameterValue(
    moduleId: string,
    parameterId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
    source: ParameterChange['source'] = 'api'
  ): boolean {
    const subject = this.getParameterSubject(moduleId, parameterId);
    if (!subject) {
      console.warn(`Cannot update parameter, not found: ${moduleId}.${parameterId}`);
      return false;
    }
    
    subject.setValue(value, source);
    return true;
  }

  /**
   * 创建参数自动化
   * @param config 自动化配置
   */
  createParameterAutomation(config: ParameterAutomationConfig): Observable<ParameterChange> {
    const key = `${config.sourceModuleId}:${config.sourceParameterId}->${config.targetModuleId}:${config.targetParameterId}`;
    
    // 存储自动化配置
    this.automations.set(key, config);
    
    // 获取源参数和目标参数
    const sourceSubject = this.getParameterSubject(
      config.sourceModuleId, 
      config.sourceParameterId
    );
    
    const targetSubject = this.getParameterSubject(
      config.targetModuleId,
      config.targetParameterId
    );
    
    if (!sourceSubject || !targetSubject) {
      console.warn('Cannot create automation: source or target parameter not found');
      return new Observable<ParameterChange>();
    }
    
    // 获取源参数的状态，用于访问最小/最大值
    const sourceState = sourceSubject.getCurrentState();
    const targetState = targetSubject.getCurrentState();
    
    // 目标参数启用自动化
    targetSubject.enableAutomation(
      config.sourceModuleId,
      config.sourceParameterId
    );
    
    // 设置自动化映射函数
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const mapValue = config.mapping || ((value: number, min: number, max: number) => {
      // 默认线性映射
      const normalized = (value - (sourceState.min || 0)) / 
                        ((sourceState.max || 1) - (sourceState.min || 0));
      return normalized * ((targetState.max || 1) - (targetState.min || 0)) + 
             (targetState.min || 0);
    });
    
    // 监听源参数的变化并自动化目标参数
    return sourceSubject.getValue$<number>().pipe(
      map(sourceValue => {
        // 仅当源参数为数字时才应用映射
        if (typeof sourceValue === 'number') {
          const mappedValue = mapValue(
            sourceValue, 
            sourceState.min || 0, 
            sourceState.max || 1
          );
          
          // 应用自动化量
          const finalValue = mappedValue * config.amount;
          
          // 更新目标参数
          targetSubject.setValue(finalValue, 'automation');
          
          return {
            moduleId: config.targetModuleId,
            parameterId: config.targetParameterId,
            value: finalValue,
            previousValue: targetSubject.getValue(),
            source: 'automation'
          } as ParameterChange;
        }
        return null;
      }),
      filter((change): change is ParameterChange => change !== null),
      // 停止当模块被销毁时
      takeUntil(merge(
        this.getModuleDisposeSignal$(config.sourceModuleId),
        this.getModuleDisposeSignal$(config.targetModuleId)
      ))
    );
  }

  /**
   * 删除参数自动化
   * @param moduleId 模块ID 
   * @param parameterId 参数ID
   * @param sourceModuleId 可选，特定源模块ID
   * @param sourceParameterId 可选，特定源参数ID
   * @returns 是否成功删除自动化
   */
  removeParameterAutomation(
    moduleId: string, 
    parameterId: string,
    sourceModuleId?: string,
    sourceParameterId?: string
  ): boolean {
    // 如果提供了源模块ID和参数ID，仅删除特定自动化
    if (sourceModuleId && sourceParameterId) {
      const key = `${sourceModuleId}:${sourceParameterId}->${moduleId}:${parameterId}`;
      
      // 检查自动化是否存在
      if (!this.automations.has(key)) {
        return false;
      }
      
      // 删除自动化配置
      this.automations.delete(key);
      
      // 获取目标参数并禁用自动化
      const targetSubject = this.getParameterSubject(moduleId, parameterId);
      if (targetSubject) {
        targetSubject.disableAutomation();
      }
    } else {
      // 否则删除所有相关的自动化
      const subject = this.getParameterSubject(moduleId, parameterId);
      if (!subject) {
        return false;
      }
      
      // 查找所有相关自动化并删除
      let found = false;
      for (const [key, config] of this.automations.entries()) {
        if (
          (config.targetModuleId === moduleId && config.targetParameterId === parameterId) ||
          (config.sourceModuleId === moduleId && config.sourceParameterId === parameterId)
        ) {
          this.automations.delete(key);
          found = true;
        }
      }
      
      if (found) {
        subject.disableAutomation();
      }
    }
    
    return true;
  }

  /**
   * 获取参数自动化范围
   * @param moduleId 模块ID
   * @param parameterId 参数ID
   * @returns 自动化范围 [min, max]
   */
  getParameterAutomationRange(
    moduleId: string,
    parameterId: string
  ): [number, number] {
    const subject = this.getParameterSubject(moduleId, parameterId);
    if (!subject) {
      return [0, 1]; // 默认范围
    }
    
    const state = subject.getCurrentState();
    return state.automationRange || [state.min || 0, state.max || 1];
  }

  /**
   * 设置参数自动化范围
   * @param moduleId 模块ID
   * @param parameterId 参数ID
   * @param minValue 最小值
   * @param maxValue 最大值
   */
  setParameterAutomationRange(
    moduleId: string,
    parameterId: string,
    minValue: number,
    maxValue: number
  ): void {
    const subject = this.getParameterSubject(moduleId, parameterId);
    if (!subject) {
      console.warn(`Cannot set automation range, parameter not found: ${moduleId}.${parameterId}`);
      return;
    }
    
    subject.setAutomationRange([minValue, maxValue]);
  }

  /**
   * 获取参数自动化信息
   * @param moduleId 模块ID
   * @param parameterId 参数ID
   */
  getParameterAutomationInfo(
    moduleId: string,
    parameterId: string
  ) {
    const subject = this.getParameterSubject(moduleId, parameterId);
    if (!subject) {
      return null;
    }
    
    const state = subject.getCurrentState();
    return {
      isAutomated: state.automated || false,
      range: state.automationRange || [state.min || 0, state.max || 1]
    };
  }
  
  /**
   * 删除模块所有参数的自动化
   * @param moduleId 模块ID
   */
  removeAllParameterAutomations(moduleId: string): void {
    const moduleParams = this.parameterSubjects.get(moduleId);
    if (!moduleParams) {
      return;
    }
    
    for (const [paramId, subject] of moduleParams.entries()) {
      for (const [key, config] of this.automations.entries()) {
        if (
          (config.sourceModuleId === moduleId && config.sourceParameterId === paramId) ||
          (config.targetModuleId === moduleId && config.targetParameterId === paramId)
        ) {
          this.automations.delete(key);
          subject.disableAutomation();
        }
      }
    }
  }
}

// 创建参数流单例
export const parameterStream = new ParameterStream();
