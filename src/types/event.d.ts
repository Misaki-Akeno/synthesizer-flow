/**
 * 元数据类型
 */
export type MetadataValue =
  | string
  | number
  | boolean
  | object
  | null
  | undefined;

/**
 * 元数据记录类型
 */
export type MetadataRecord = Record<string, MetadataValue>;

/**
 * Position interface for module positioning
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Connection handle information
 */
export interface ConnectionHandle {
  sourceId: string;
  targetId: string;
  sourceHandle?: string;
  targetHandle?: string;
}

/**
 * Parameter value type
 */
export type ParameterValue = string | number | boolean | object | null;

/**
 * Event types supported by the system
 */
export interface EventTypes {
  // 模块事件
  'MODULE.INSTANTIATE_REQUESTED': {
    moduleTypeId: string;
    position?: Position;
  };
  'MODULE.INSTANTIATED': {
    moduleId: string;
    moduleTypeId: string;
    position?: Position;
  };
  'MODULE.INSTANTIATE_COMPLETED': {
    moduleId: string;
    moduleTypeId: string;
  };
  'MODULE.INSTANTIATE_FAILED': {
    moduleTypeId: string;
    error: EventBusError;
  };
  'MODULE.DISPOSE_REQUESTED': {
    moduleId: string;
  };
  'MODULE.DISPOSED': {
    moduleId: string;
  };

  // 连接事件
  'CONNECTION.REQUESTED': {
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  };
  'CONNECTION.ESTABLISHED': {
    connectionId: string;
    sourceId: string;
    targetId: string;
  };
  'CONNECTION.BROKEN': {
    connectionId: string;
  };

  // UI事件
  'UI.NODE.CREATED': {
    nodeId: string;
  };
  'UI.NODE.DELETED': {
    nodeId: string;
  };
  'UI.NODE.MOVED': {
    nodeId: string;
    position: Position;
  };
  'UI.CONNECTION.CREATED': ConnectionHandle & {
    connectionId: string;
  };
  'UI.CONNECTION.DELETED': {
    connectionId: string;
  };

  // 参数事件
  'PARAMETER.CHANGE_REQUESTED': {
    moduleId: string;
    parameterId: string;
    value: ParameterValue;
  };
  'PARAMETER.CHANGED': {
    moduleId: string;
    parameterId: string;
    value: ParameterValue;
    previousValue: ParameterValue;
  };

  // 系统事件
  'SYSTEM.INITIALIZED': Record<string, never>;
  'SYSTEM.ERROR': {
    message: string;
    error: EventBusError;
  };

  // 音频事件
  'AUDIO.STARTED': Record<string, never>;
  'AUDIO.STOPPED': Record<string, never>;

  // 字符串索引签名，允许任何字符串作为键
  [key: string]: unknown;
  // symbol索引签名，允许任何symbol作为键
  [key: symbol]: unknown;
}

/**
 * Event bus error interface
 */
export interface EventBusError {
  /**
   * Error code
   */
  code: string;

  /**
   * Error message
   */
  message: string;

  /**
   * Optional original error
   */
  originalError?: Error;

  /**
   * Optional metadata
   */
  metadata?: MetadataRecord;
}

/**
 * Event bus error types
 */
export enum EventBusErrorType {
  SUBSCRIPTION_ERROR = 'SUBSCRIPTION_ERROR',
  PUBLICATION_ERROR = 'PUBLICATION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
}

/**
 * Event bus error factory
 */
export interface EventBusErrorFactory {
  create(
    type: EventBusErrorType,
    message: string,
    originalError?: Error,
    metadata?: MetadataRecord
  ): EventBusError;
}
