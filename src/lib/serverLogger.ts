/**
 * 服务端日志工具
 * 与客户端logger类似，但不使用Toast，仅使用控制台输出
 */

// 日志级别枚举
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  SUCCESS = 2,
  WARN = 3,
  ERROR = 4,
}

// 简单的服务端日志接口
export interface ServerLogger {
  debug(message: string, details?: unknown): void;
  info(message: string, details?: unknown): void;
  success(message: string, details?: unknown): void;
  warn(message: string, details?: unknown): void;
  error(message: string, details?: unknown): void;
}

/**
 * 创建服务端日志记录器
 * @param moduleName 模块名称
 * @returns 日志记录器实例
 */
export function createServerLogger(moduleName: string): ServerLogger {
  const prefix = moduleName ? `[${moduleName}]` : '';

  return {
    debug(message: string, details?: unknown): void {
      console.debug(`${prefix} ${message}`, details || '');
    },

    info(message: string, details?: unknown): void {
      console.info(`${prefix} ${message}`, details || '');
    },

    success(message: string, details?: unknown): void {
      console.log(`✅ ${prefix} ${message}`, details || '');
    },

    warn(message: string, details?: unknown): void {
      console.warn(`⚠️ ${prefix} ${message}`, details || '');
    },

    error(message: string, details?: unknown): void {
      console.error(`❌ ${prefix} ${message}`, details || '');
    },
  };
}
