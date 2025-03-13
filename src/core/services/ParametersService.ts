import { useModulesStore } from '../store/useModulesStore';
import { Parameter, ParameterType } from '@/interfaces/parameter';
import { ParameterValue } from '@/interfaces/event';
import { eventBus } from '@/core/events/EventBus';
import { ObservableParameter } from '../domain/ObservableParameter';
import { errorHandler, ErrorCode } from '@/core/events/ErrorHandler';
import { container } from '../di/Container';

/**
 * 参数服务 - 提供模块参数管理功能
 */
export class ParametersService {
  /**
   * 初始化参数服务
   */
  async initialize(): Promise<void> {
    console.log('ParametersService initialized');
    
    // 将自身注册到容器
    container.register('parameterService', this);
    
    return Promise.resolve();
  }
  
  /**
   * 创建可观察参数
   */
  createObservableParameter(
    id: string,
    name: string,
    type: ParameterType | string,
    value: string | number,
    defaultValue: ParameterValue,
    options: {
      min?: number;
      max?: number;
      step?: number;
      unit?: string;
      options?: Array<string | number>;
      modulatable?: boolean;
    } = {}
  ): ObservableParameter {
    return new ObservableParameter(
      id,
      name,
      type,
      value,
      defaultValue,
      0, // modulationAmount
      null, // modulationSource
      options.min,
      options.max,
      options.step,
      options.unit,
      options.options,
      options.modulatable
    );
  }

  /**
   * 获取模块的所有参数
   * @param moduleId 模块ID
   * @returns 参数对象字典，如果模块不存在则返回空对象
   */
  getParameters(moduleId: string): Record<string, Parameter> {
    const activeModule = useModulesStore.getState().getModule(moduleId);
    if (!activeModule) {
      console.warn(`模块不存在: ${moduleId}`);
      return {};
    }
    return activeModule.parameters;
  }

  /**
   * 获取指定参数的值
   * @param moduleId 模块ID
   * @param parameterId 参数ID
   * @returns 参数值，如果参数不存在则返回undefined
   */
  getParameterValue(
    moduleId: string,
    parameterId: string
  ): ParameterValue | undefined {
    const activeModule = useModulesStore.getState().getModule(moduleId);
    if (!activeModule) {
      console.warn(`模块不存在: ${moduleId}`);
      return undefined;
    }

    const parameter = activeModule.parameters[parameterId];
    if (!parameter) {
      console.warn(`参数不存在: ${moduleId}.${parameterId}`);
      return undefined;
    }

    return parameter.value;
  }

  /**
   * 设置参数值
   * @param moduleId 模块ID
   * @param parameterId 参数ID
   * @param value 新的参数值
   * @returns 是否成功设置了参数值
   */
  setParameterValue(
    moduleId: string,
    parameterId: string,
    value: ParameterValue
  ): boolean {
    const activeModule = useModulesStore.getState().getModule(moduleId);
    if (!activeModule) {
      errorHandler.moduleError(
        moduleId, 
        ErrorCode.MODULE_NOT_FOUND, 
        `模块不存在: ${moduleId}`
      );
      return false;
    }

    const parameter = activeModule.parameters[parameterId];
    if (!parameter) {
      errorHandler.parameterError(
        moduleId,
        parameterId,
        ErrorCode.PARAMETER_NOT_FOUND,
        `参数不存在: ${moduleId}.${parameterId}`
      );
      return false;
    }

    // 验证并转换值
    const validatedValue = this.validateAndConvertValue(value, parameter);
    if (validatedValue === undefined) {
      errorHandler.parameterError(
        moduleId,
        parameterId,
        ErrorCode.PARAMETER_INVALID_VALUE,
        `参数值类型不匹配: ${moduleId}.${parameterId}`
      );
      return false;
    }

    // 保存先前的值以便发送事件
    const previousValue = parameter.value;

    // 使用模块的内部方法设置参数值
    activeModule.setParameterValue(parameterId, validatedValue);

    // 如果是ObservableParameter，不需要手动发送事件，它会自己发送
    if (!(parameter instanceof ObservableParameter)) {
      // 发布参数变更事件
      eventBus.emit('PARAMETER.CHANGED', {
        moduleId,
        parameterId,
        value: validatedValue,
        previousValue,
      });
    }

    return true;
  }

  /**
   * 请求修改参数值（通过事件总线）
   * @param moduleId 模块ID
   * @param parameterId 参数ID
   * @param value 新的参数值
   */
  requestParameterChange(
    moduleId: string,
    parameterId: string,
    value: ParameterValue
  ): void {
    eventBus.emit('PARAMETER.CHANGE_REQUESTED', {
      moduleId,
      parameterId,
      value,
    });
  }

  /**
   * 设置参数调制
   * @param moduleId 模块ID
   * @param parameterId 参数ID
   * @param sourceId 调制源ID
   * @param amount 调制量
   * @returns 是否成功设置了调制
   */
  setModulation(
    moduleId: string,
    parameterId: string,
    sourceId: string | null,
    amount: number
  ): boolean {
    const activeModule = useModulesStore.getState().getModule(moduleId);
    if (!activeModule) {
      console.warn(`模块不存在: ${moduleId}`);
      return false;
    }

    const parameter = activeModule.parameters[parameterId];
    if (!parameter) {
      console.warn(`参数不存在: ${moduleId}.${parameterId}`);
      return false;
    }

    // 设置调制源和调制量
    parameter.modulationSource = sourceId;
    parameter.modulationAmount = amount;

    // 可以在这里添加发布调制变更事件
    eventBus.emit('PARAMETER.MODULATION_CHANGED', {
      moduleId,
      parameterId,
      source: sourceId,
      amount,
    });

    return true;
  }

  /**
   * 根据参数类型验证并转换值
   * @param value 待验证的值
   * @param parameter 参数对象
   * @returns 转换后的值，如果无效则返回undefined
   */
  private validateAndConvertValue(
    value: ParameterValue,
    parameter: Parameter
  ): ParameterValue | undefined {
    switch (parameter.type) {
      case ParameterType.NUMBER:
        if (typeof value !== 'number') {
          try {
            value = Number(value);
          } catch {
            return undefined;
          }
        }
        // 确保值在范围内
        if (parameter.min !== undefined && value < parameter.min) {
          value = parameter.min;
        }
        if (parameter.max !== undefined && value > parameter.max) {
          value = parameter.max;
        }
        return value;

      case ParameterType.INTEGER:
        if (typeof value !== 'number') {
          try {
            value = Number(value);
          } catch {
            return undefined;
          }
        }
        value = Math.round(value as number);
        // 确保值在范围内
        if (parameter.min !== undefined && value < parameter.min) {
          value = parameter.min;
        }
        if (parameter.max !== undefined && value > parameter.max) {
          value = parameter.max;
        }
        return value;

      case ParameterType.BOOLEAN:
        if (typeof value === 'boolean') {
          return value;
        }
        if (typeof value === 'string') {
          return value.toLowerCase() === 'true';
        }
        if (typeof value === 'number') {
          return value !== 0;
        }
        return undefined;

      case ParameterType.STRING:
        return String(value);

      case ParameterType.ENUM:
        if (!parameter.options?.includes(value as string | number)) {
          return undefined;
        }
        return value;

      default:
        return value;
    }
  }
}
