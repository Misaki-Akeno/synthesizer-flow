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

// 事件类型定义

// 模块服务事件
interface ModuleServiceInitializedEvent {
  time: string; // ISO 时间字符串
}

// 模块创建请求事件
interface ModuleCreateRequestEvent {
  typeId: string;
  instanceId?: string;
  position?: Position;
}

// 模块创建成功事件
interface ModuleCreatedEvent {
  moduleId: string;
  typeId: string;
  module: unknown;
}

// 模块创建失败事件
interface ModuleCreateFailedEvent {
  typeId: string;
  instanceId?: string;
  error: unknown;
}

// 模块销毁请求事件
interface ModuleDestroyRequestEvent {
  moduleId: string;
}

// 模块销毁成功事件
interface ModuleDestroyedEvent {
  moduleId: string;
}

// 模块销毁失败事件
interface ModuleDestroyFailedEvent {
  moduleId: string;
  error: unknown;
}

// 模块销毁成功事件
interface ModuleDisposedEvent {
  moduleId: string;
}

// 模块初始化事件
interface ModuleInitializedEvent {
  moduleId: string;
}

// 模块初始化失败事件
interface ModuleInitializeFailedEvent {
  moduleId: string;
  error: unknown;
}

// 参数变更事件
interface ParameterChangedEvent {
  moduleId: string;
  parameterId: string;
  value: ParameterValue;
  previousValue: ParameterValue;
}

// 预设加载事件
interface PresetLoadedEvent {
  moduleId: string;
  presetId: string;
  presetName: string;
}

// 触发同步事件
interface TriggerSyncEvent {
  targetId: string;
  value?: number;       // 添加触发值
  duration?: number;    // 添加触发持续时间
  timestamp?: number;   // 添加触发时间点
}

// 连接建立事件
interface ConnectionEstablishedEvent {
  connectionId: string;
  sourceId: string;
  targetId: string;
  sourceHandle?: string;
  targetHandle?: string;
}

// 连接断开事件
interface ConnectionBrokenEvent {
  connectionId: string;
  sourceId: string;
  targetId: string;
  sourceHandle?: string;
  targetHandle?: string;
}

/**
 * Event types supported by the system
 */
export interface EventTypes {
  // 模块服务事件
  'MODULE_SERVICE.INITIALIZED': ModuleServiceInitializedEvent;

  // 模块事件
  'MODULE.CREATE_REQUEST': ModuleCreateRequestEvent;
  'MODULE.CREATED': ModuleCreatedEvent;
  'MODULE.CREATE_FAILED': ModuleCreateFailedEvent;
  'MODULE.DESTROY_REQUEST': ModuleDestroyRequestEvent;
  'MODULE.DESTROYED': ModuleDestroyedEvent;
  'MODULE.DESTROY_FAILED': ModuleDestroyFailedEvent;
  'MODULE.INITIALIZED': ModuleInitializedEvent;
  'MODULE.INITIALIZE_FAILED': ModuleInitializeFailedEvent;
  'MODULE.DISPOSED': ModuleDisposedEvent;
  'MODULE.INSTANTIATE_REQUESTED': {
    moduleTypeId: string;
    position?: Position;
    requestId?: string; // 新增 requestId 属性
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

  // 参数事件
  'PARAMETER.CHANGED': ParameterChangedEvent;
  'PARAMETER.CHANGE_REQUESTED': {
    moduleId: string;
    parameterId: string;
    value: ParameterValue;
  };

  // 预设事件
  'PRESET.LOADED': PresetLoadedEvent;

  // 触发事件
  'TRIGGER.SYNC': TriggerSyncEvent;
  // 添加触发开始和结束事件
  'TRIGGER.START': {
    targetId: string;
    value: number;
    timestamp: number;
  };
  'TRIGGER.END': {
    targetId: string;
    timestamp: number;
    duration: number;
  };

  // 连接事件
  'CONNECTION.ESTABLISHED': ConnectionEstablishedEvent;
  'CONNECTION.BROKEN': ConnectionBrokenEvent;
  'CONNECTION.REQUESTED': {
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
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
