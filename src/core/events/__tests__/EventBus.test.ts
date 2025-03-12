import { describe, beforeEach, test, expect, vi } from 'vitest';
import { eventBus } from '../EventBus';

describe('EventBus', () => {
  beforeEach(() => {
    // 监听所有事件前清理
    vi.clearAllMocks();
  });

  test('on 和 emit 方法应该正确处理事件', () => {
    // 模拟处理函数
    const mockHandler = vi.fn();

    // 监听事件
    eventBus.on('MODULE.CREATED', mockHandler);

    // 触发事件
    const eventData = {
      moduleId: 'test-module',
      typeId: 'test-type',
      module: {},
    };
    eventBus.emit('MODULE.CREATED', eventData);

    // 验证处理函数被调用
    expect(mockHandler).toHaveBeenCalledWith(eventData);
  });

  test('off 方法应该取消事件监听', () => {
    // 模拟处理函数
    const mockHandler = vi.fn();

    // 监听事件
    eventBus.on('MODULE.CREATED', mockHandler);

    // 取消监听
    eventBus.off('MODULE.CREATED', mockHandler);

    // 触发事件
    eventBus.emit('MODULE.CREATED', {
      moduleId: 'test-module',
      typeId: 'test-type',
      module: {},
    });

    // 验证处理函数没有被调用
    expect(mockHandler).not.toHaveBeenCalled();
  });

  test('emit 应该正确记录事件日志', () => {
    // 监听 console.debug
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    // 触发事件
    const eventData = { moduleId: 'test-module' };
    eventBus.emit('MODULE.DISPOSED', eventData);

    // 验证日志输出
    expect(debugSpy).toHaveBeenCalledWith('[Event] MODULE.DISPOSED', eventData);

    // 清理
    debugSpy.mockRestore();
  });
});
