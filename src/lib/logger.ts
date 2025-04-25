/**
 * 综合日志系统
 * 提供统一的日志记录功能，支持控制台输出和Toast通知
 */

import { toast } from 'sonner';

// 日志级别枚举
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  SUCCESS = 2,
  WARN = 3,
  ERROR = 4,
}

// 日志配置接口
export interface LoggerConfig {
  minConsoleLevel: LogLevel; // 控制台最小显示级别
  minToastLevel: LogLevel; // Toast最小显示级别
  enableConsole: boolean; // 是否启用控制台日志
  enableToast: boolean; // 是否启用Toast通知
  prefix?: string; // 日志前缀
}

// 默认日志配置
const DEFAULT_CONFIG: LoggerConfig = {
  minConsoleLevel: LogLevel.DEBUG,
  minToastLevel: LogLevel.WARN, // 默认只有警告和错误才会显示Toast
  enableConsole: true,
  enableToast: true,
};

// 自定义日志事件接口
export interface LogEvent {
  level: LogLevel;
  message: string;
  details?: unknown;
  timestamp: Date;
  prefix?: string;
}

// 日志处理器接口
export interface LogHandler {
  handle(event: LogEvent): void;
}

// 控制台日志处理器
class ConsoleLogHandler implements LogHandler {
  handle(event: LogEvent): void {
    const { level, message, details, timestamp, prefix } = event;

    const formattedTime = timestamp.toLocaleTimeString('zh-CN');
    const prefixStr = prefix ? `[${prefix}] ` : '';
    const logMessage = `${formattedTime} ${prefixStr}${message}`;

    switch (level) {
      case LogLevel.DEBUG:
        if (details) {
          console.debug(logMessage, details);
        } else {
          console.debug(logMessage);
        }
        break;
      case LogLevel.INFO:
        if (details) {
          console.info(logMessage, details);
        } else {
          console.info(logMessage);
        }
        break;
      case LogLevel.SUCCESS:
        if (details) {
          console.log(`%c${logMessage}`, 'color: green', details);
        } else {
          console.log(`%c${logMessage}`, 'color: green');
        }
        break;
      case LogLevel.WARN:
        if (details) {
          console.warn(logMessage, details);
        } else {
          console.warn(logMessage);
        }
        break;
      case LogLevel.ERROR:
        if (details) {
          console.error(logMessage, details);
        } else {
          console.error(logMessage);
        }
        break;
    }
  }
}

// Toast日志处理器
class ToastLogHandler implements LogHandler {
  handle(event: LogEvent): void {
    const { level, message, details, prefix } = event;

    const prefixStr = prefix ? `[${prefix}] ` : '';
    const toastMessage = `${prefixStr}${message}`;
    const detailsStr = details
      ? typeof details === 'object'
        ? JSON.stringify(details)
        : String(details)
      : undefined;

    switch (level) {
      case LogLevel.SUCCESS:
        toast.success(toastMessage, {
          description: detailsStr,
        });
        break;
      case LogLevel.INFO:
        toast.info(toastMessage, {
          description: detailsStr,
        });
        break;
      case LogLevel.WARN:
        toast.warning(toastMessage, {
          description: detailsStr,
        });
        break;
      case LogLevel.ERROR:
        toast.error(toastMessage, {
          description: detailsStr,
        });
        break;
      default:
        // DEBUG级别不显示Toast
        break;
    }
  }
}

/**
 * 日志系统类
 */
export class Logger {
  private config: LoggerConfig;
  private handlers: LogHandler[] = [];
  private prefix?: string;

  /**
   * 创建一个新的Logger实例
   * @param config 日志配置
   */
  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.prefix = config.prefix;

    // 初始化内置处理器
    if (this.config.enableConsole) {
      this.handlers.push(new ConsoleLogHandler());
    }

    if (this.config.enableToast) {
      this.handlers.push(new ToastLogHandler());
    }
  }

  /**
   * 添加自定义日志处理器
   * @param handler 日志处理器
   */
  addHandler(handler: LogHandler): void {
    this.handlers.push(handler);
  }

  /**
   * 创建子日志记录器，继承父级配置但可以有不同前缀
   * @param prefix 子日志记录器前缀
   */
  child(prefix: string): Logger {
    const childLogger = new Logger(this.config);
    childLogger.prefix = prefix;
    return childLogger;
  }

  /**
   * 记录日志
   * @param level 日志级别
   * @param message 日志消息
   * @param details 详细信息（可选）
   */
  private log(level: LogLevel, message: string, details?: unknown): void {
    // 检查是否需要记录此级别的日志
    if (
      (level < this.config.minConsoleLevel &&
        level < this.config.minToastLevel) ||
      (!this.config.enableConsole && !this.config.enableToast)
    ) {
      return;
    }

    const event: LogEvent = {
      level,
      message,
      details,
      timestamp: new Date(),
      prefix: this.prefix,
    };

    // 分发到所有处理器
    for (const handler of this.handlers) {
      if (
        (level >= this.config.minConsoleLevel &&
          handler instanceof ConsoleLogHandler) ||
        (level >= this.config.minToastLevel &&
          handler instanceof ToastLogHandler)
      ) {
        handler.handle(event);
      }
    }
  }

  // 不同级别的日志方法
  debug(message: string, details?: unknown): void {
    this.log(LogLevel.DEBUG, message, details);
  }

  info(message: string, details?: unknown): void {
    this.log(LogLevel.INFO, message, details);
  }

  success(message: string, details?: unknown): void {
    this.log(LogLevel.SUCCESS, message, details);
  }

  warn(message: string, details?: unknown): void {
    this.log(LogLevel.WARN, message, details);
  }

  error(message: string, details?: unknown): void {
    this.log(LogLevel.ERROR, message, details);
  }
}

// 创建默认日志实例
const defaultLogger = new Logger();
export default defaultLogger;

/**
 * 创建特定模块的日志记录器
 * @param moduleName 模块名称
 */
export function createModuleLogger(moduleName: string): Logger {
  return defaultLogger.child(moduleName);
}
