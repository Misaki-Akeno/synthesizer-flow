// 事件总线实现，基于 mitt
// 提供全局事件发布和订阅功能

import mitt from 'mitt';
import type { EventTypes } from '@/interfaces/event';

// 创建事件总线
const emitter = mitt<EventTypes>();

// 增强版事件总线，支持日志等功能
export const eventBus = {
  emit: <K extends keyof EventTypes>(type: K, event: EventTypes[K]) => {
    console.debug(`[Event] ${String(type)}`, event);
    emitter.emit(type, event);
  },

  on: <K extends keyof EventTypes>(
    type: K,
    handler: (event: EventTypes[K]) => void
  ) => {
    emitter.on(type, handler as (event: unknown) => void);
  },

  off: <K extends keyof EventTypes>(
    type: K,
    handler: (event: EventTypes[K]) => void
  ) => {
    emitter.off(type, handler as (event: unknown) => void);
  },
};
