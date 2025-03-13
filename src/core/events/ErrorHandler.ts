import { eventBus } from './EventBus';
import { type EventBusError, type MetadataRecord } from '@/interfaces/event';

/**
 * 错误代码枚举
 */
export enum ErrorCode {
  // 原有错误代码
  MODULE_NOT_FOUND = 'MODULE_NOT_FOUND',
  PARAMETER_NOT_FOUND = 'PARAMETER_NOT_FOUND',
  PARAMETER_INVALID_VALUE = 'PARAMETER_INVALID_VALUE',

  // 新增错误代码
  MODULE_CONFIG_NOT_FOUND = 'MODULE_CONFIG_NOT_FOUND',
  PRESET_NOT_FOUND = 'PRESET_NOT_FOUND',
  PARAMETER_NOT_MODULATABLE = 'PARAMETER_NOT_MODULATABLE',

  // 模块错误
  MODULE_INIT_FAILED = 'MODULE_INIT_FAILED',
  MODULE_DISPOSE_FAILED = 'MODULE_DISPOSE_FAILED',

  // 连接错误
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_INVALID = 'CONNECTION_INVALID',

  // 系统错误
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * 错误处理服务
 */
export class ErrorHandler {
  /**
   * 创建并发布错误
   */
  handleError(
    code: ErrorCode,
    message: string,
    originalError?: Error,
    metadata?: MetadataRecord
  ): EventBusError {
    const error: EventBusError = {
      code,
      message,
      originalError,
      metadata,
    };

    console.error(`[Error ${code}]`, message, originalError || '');

    // 发布错误事件
    eventBus.emit('SYSTEM.ERROR', {
      message,
      error,
    });

    return error;
  }

  /**
   * 创建模块错误
   */
  moduleError(
    moduleId: string,
    code: ErrorCode,
    message: string,
    originalError?: Error
  ): EventBusError {
    return this.handleError(code, message, originalError, { moduleId });
  }

  /**
   * 创建参数错误
   */
  parameterError(
    moduleId: string,
    parameterId: string,
    code: ErrorCode,
    message: string,
    originalError?: Error
  ): EventBusError {
    return this.handleError(code, message, originalError, {
      moduleId,
      parameterId,
    });
  }
}

// 导出单例实例
export const errorHandler = new ErrorHandler();
