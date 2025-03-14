import { useModulesStore } from '../store/useModulesStore';
import { Parameter, ParameterType } from '@/interfaces/parameter';
import { ParameterValue } from '@/interfaces/event';
import { eventBus } from '@/core/events/EventBus';
import { errorHandler, ErrorCode } from '@/core/events/ErrorHandler';
import { container } from '../di/Container';
import { ModuleRegistry } from '@/interfaces/module';

/**
 * 参数服务 - 提供模块参数管理功能
 */
export class ParametersService {
  constructor() {
    // 监听参数变更请求
    eventBus.on(
      'PARAMETER.CHANGE_REQUESTED',
      this.handleParameterChangeRequest.bind(this)
    );
  }

  /**
   * 初始化参数服务
   */
  async initialize(): Promise<void> {
    // 将自身注册到容器
    container.register('parameterService', this);

    return Promise.resolve();
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

    // 如果值没有变化，直接返回成功
    if (validatedValue === previousValue) {
      return true;
    }

    // 更新参数值
    parameter.value = validatedValue;

    // 调用模块的 setParameterValue 方法确保音频引擎参数同步更新
    // 传入 true 作为 skipEvent 参数，防止模块再次触发事件
    if (activeModule.setParameterValue) {
      activeModule.setParameterValue(parameterId, validatedValue, true);
    } else {
      console.warn(`模块 ${moduleId} 没有实现 setParameterValue 方法`);
    }

    // 发布参数变更事件
    eventBus.emit('PARAMETER.CHANGED', {
      moduleId,
      parameterId,
      value: validatedValue,
      previousValue,
    });

    return true;
  }

  /**
   * 处理参数变更请求
   */
  private handleParameterChangeRequest(event: {
    moduleId: string;
    parameterId: string;
    value: unknown;
  }): void {
    const { moduleId, parameterId, value } = event;
    this.setParameterValue(moduleId, parameterId, value as ParameterValue);
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
   * 批量设置参数值（用于预设加载）
   * @param moduleId 模块ID
   * @param values 参数值映射
   * @returns 是否成功设置了所有参数值
   */
  setParameterValues(
    moduleId: string,
    values: Record<string, ParameterValue>
  ): boolean {
    let allSuccessful = true;

    for (const [parameterId, value] of Object.entries(values)) {
      const success = this.setParameterValue(moduleId, parameterId, value);
      if (!success) {
        allSuccessful = false;
      }
    }

    return allSuccessful;
  }

  /**
   * 加载预设
   * @param moduleId 模块ID
   * @param presetId 预设ID
   * @returns 是否成功加载了预设
   */
  loadPreset(moduleId: string, presetId: string): boolean {
    const activeModule = useModulesStore.getState().getModule(moduleId);
    if (!activeModule) {
      errorHandler.moduleError(
        moduleId,
        ErrorCode.MODULE_NOT_FOUND,
        `模块不存在: ${moduleId}`
      );
      return false;
    }

    // 获取模块配置
    const moduleRegistry = container.get<ModuleRegistry>('moduleRegistry');
    if (!moduleRegistry) {
      errorHandler.moduleError(
        moduleId,
        ErrorCode.MODULE_NOT_FOUND,
        `模块注册表不存在`
      );
      return false;
    }

    const moduleConfig = moduleRegistry.getById(activeModule.typeId);
    if (!moduleConfig) {
      errorHandler.moduleError(
        moduleId,
        ErrorCode.MODULE_NOT_FOUND,
        `模块配置不存在: ${activeModule.typeId}`
      );
      return false;
    }

    // 查找预设
    const preset = moduleConfig.presets?.find((p) => p.id === presetId);
    if (!preset) {
      errorHandler.moduleError(
        moduleId,
        ErrorCode.PARAMETER_NOT_FOUND, // 使用已存在的错误代码
        `预设不存在: ${presetId}`
      );
      return false;
    }

    // 批量设置参数值
    const success = this.setParameterValues(moduleId, preset.values);

    // 发布预设加载事件
    if (success) {
      eventBus.emit('PRESET.LOADED', {
        moduleId,
        presetId,
        presetName: preset.name,
      });
    }

    return success;
  }

  /**
   * 请求加载预设
   * @param moduleId 模块ID
   * @param presetId 预设ID
   */
  requestLoadPreset(moduleId: string, presetId: string): void {
    eventBus.emit('PRESET.LOAD_REQUESTED', {
      moduleId,
      presetId,
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

    // 检查参数是否支持调制
    if (parameter.modulatable === false) {
      errorHandler.parameterError(
        moduleId,
        parameterId,
        ErrorCode.PARAMETER_INVALID_VALUE, // 使用已存在的错误代码
        `参数不支持调制: ${moduleId}.${parameterId}`
      );
      return false;
    }

    // 设置调制源和调制量
    parameter.modulationSource = sourceId;
    parameter.modulationAmount = amount;

    // 发布调制变更事件
    eventBus.emit('PARAMETER.MODULATION_CHANGED', {
      moduleId,
      parameterId,
      source: sourceId,
      amount,
    });

    return true;
  }

  /**
   * 应用调制到参数值
   * @param moduleId 模块ID
   * @param parameterId 参数ID
   * @param modulationValue 调制值（通常在-1到1之间）
   * @returns 是否成功应用了调制
   */
  applyModulation(
    moduleId: string,
    parameterId: string,
    modulationValue: number
  ): boolean {
    const parameter = this.getParameters(moduleId)[parameterId];
    if (!parameter || !parameter.modulatable || !parameter.modulationSource) {
      return false;
    }

    // 根据调制量和调制值计算最终值
    const baseValue = parameter.value as number;
    const modAmount = parameter.modulationAmount;

    // 计算调制范围
    const range =
      parameter.max !== undefined && parameter.min !== undefined
        ? parameter.max - parameter.min
        : 1;

    // 计算最终值 = 基础值 + 调制量 * 调制值 * 调制范围
    const finalValue = baseValue + modAmount * modulationValue * range;

    // 设置参数值（不使用事件总线，避免循环）
    return this.setParameterValue(moduleId, parameterId, finalValue);
  }

  /**
   * 创建模块参数列表
   * @param moduleId 模块ID
   * @param typeId 模块类型ID
   * @param parameterDefinitions 参数定义字典
   * @returns 创建的参数列表
   */
  createParametersForModule(
    moduleId: string,
    typeId: string,
    parameterDefinitions: Record<string, Record<string, unknown>>
  ): Record<string, Parameter> {
    const parameters: Record<string, Parameter> = {};

    for (const [paramId, paramDef] of Object.entries(parameterDefinitions)) {
      parameters[paramId] = {
        id: paramId,
        name: (paramDef.label as string) || paramId,
        type: paramDef.type as string,
        value: paramDef.default as ParameterValue,
        defaultValue: paramDef.default as ParameterValue,
        modulationAmount: 0,
        modulationSource: null,
        min: paramDef.min as number | undefined,
        max: paramDef.max as number | undefined,
        step: paramDef.step as number | undefined,
        unit: paramDef.unit as string | undefined,
        options: paramDef.options as Array<string | number> | undefined,
        modulatable:
          paramDef.modulatable !== undefined
            ? (paramDef.modulatable as boolean)
            : false,
        visibleWhen: paramDef.visibleWhen as
          | Parameter['visibleWhen']
          | undefined,
      };
    }

    return parameters;
  }

  /**
   * 重置参数到默认值
   * @param moduleId 模块ID
   * @param parameterId 参数ID
   * @returns 是否成功重置了参数
   */
  resetParameter(moduleId: string, parameterId: string): boolean {
    const parameter = this.getParameters(moduleId)[parameterId];
    if (!parameter) {
      return false;
    }

    return this.setParameterValue(
      moduleId,
      parameterId,
      parameter.defaultValue
    );
  }

  /**
   * 重置所有参数到默认值
   * @param moduleId 模块ID
   * @returns 是否成功重置了所有参数
   */
  resetAllParameters(moduleId: string): boolean {
    const parameters = this.getParameters(moduleId);
    let allSuccessful = true;

    for (const parameterId in parameters) {
      const success = this.resetParameter(moduleId, parameterId);
      if (!success) {
        allSuccessful = false;
      }
    }

    return allSuccessful;
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

// 创建单例实例
export const parametersService = new ParametersService();
