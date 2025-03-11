/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModuleService } from '../ModuleService';
import { moduleFactory } from '../../factory/ModuleFactory';
import { eventBus } from '../../events/EventBus';
import { useModulesStore } from '../../store/useModulesStore';
import { ModuleBase } from '@/types/module';
import { Position } from '@/types/event';

// 模拟依赖
vi.mock('nanoid', () => ({
  nanoid: () => 'mocked-id-12345'
}));

vi.mock('../../factory/ModuleFactory', () => ({
  moduleFactory: {
    create: vi.fn(),
    destroy: vi.fn()
  }
}));

vi.mock('../../events/EventBus', () => ({
  eventBus: {
    on: vi.fn(),
    emit: vi.fn(),
    off: vi.fn()
  }
}));

vi.mock('../../store/useModulesStore', () => {
  const mockAddModule = vi.fn();
  const mockGetModule = vi.fn();
  
  return {
    useModulesStore: {
      getState: vi.fn(() => ({
        addModule: mockAddModule,
        getModule: mockGetModule
      }))
    }
  };
});

describe('ModuleService', () => {
  let moduleService: ModuleService;
  const mockModuleBase: Partial<ModuleBase> = {
    id: 'test-module-id',
    typeId: 'test-type-id',
    connect: vi.fn(),
    setParameterValue: vi.fn()
  };

  beforeEach(() => {
    vi.resetAllMocks();
    moduleService = new ModuleService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialize', () => {
    it('should register event handlers and emit initialization event', async () => {
      await moduleService.initialize();

      // 验证事件监听器已正确注册
      expect(eventBus.on).toHaveBeenCalledTimes(6);
      expect(eventBus.on).toHaveBeenCalledWith('MODULE.CREATE_REQUEST', expect.any(Function));
      expect(eventBus.on).toHaveBeenCalledWith('MODULE.DESTROY_REQUEST', expect.any(Function));
      expect(eventBus.on).toHaveBeenCalledWith('MODULE.INSTANTIATE_REQUESTED', expect.any(Function));
      expect(eventBus.on).toHaveBeenCalledWith('MODULE.DISPOSE_REQUESTED', expect.any(Function));
      expect(eventBus.on).toHaveBeenCalledWith('CONNECTION.REQUESTED', expect.any(Function));
      expect(eventBus.on).toHaveBeenCalledWith('PARAMETER.CHANGE_REQUESTED', expect.any(Function));

      // 验证初始化事件已发出
      expect(eventBus.emit).toHaveBeenCalledWith('MODULE_SERVICE.INITIALIZED', {
        time: expect.any(String),
      });
    });
  });

  describe('handleModuleCreateRequest', () => {
    it('should create a module and add it to the store', async () => {
      // 设置模拟返回值
      (moduleFactory.create as any).mockResolvedValue(mockModuleBase);

      const event = {
        typeId: 'test-type-id',
        instanceId: 'test-instance-id',
        position: { x: 100, y: 200 } as Position
      };

      // @ts-ignore - 访问私有方法
      await moduleService['handleModuleCreateRequest'](event);

      expect(moduleFactory.create).toHaveBeenCalledWith('test-type-id', 'test-instance-id');
      expect(useModulesStore.getState().addModule).toHaveBeenCalledWith(mockModuleBase, event.position);
    });

    it('should handle errors when creating a module', async () => {
      const error = new Error('Creation failed');
      (moduleFactory.create as any).mockRejectedValue(error);
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const event = {
        typeId: 'test-type-id',
        instanceId: 'test-instance-id'
      };

      // @ts-ignore - 访问私有方法
      await moduleService['handleModuleCreateRequest'](event);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to create module:', error);
      consoleSpy.mockRestore();
    });
  });

  describe('handleModuleDestroyRequest', () => {
    it('should destroy a module', async () => {
      (moduleFactory.destroy as any).mockResolvedValue(undefined);

      const event = { moduleId: 'test-module-id' };

      // @ts-ignore - 访问私有方法
      await moduleService['handleModuleDestroyRequest'](event);

      expect(moduleFactory.destroy).toHaveBeenCalledWith('test-module-id');
    });

    it('should handle errors when destroying a module', async () => {
      const error = new Error('Destruction failed');
      (moduleFactory.destroy as any).mockRejectedValue(error);
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const event = { moduleId: 'test-module-id' };

      // @ts-ignore - 访问私有方法
      await moduleService['handleModuleDestroyRequest'](event);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to destroy module:', error);
      consoleSpy.mockRestore();
    });
  });

  describe('handleModuleInstantiateRequest', () => {
    it('should emit events for module instantiation', async () => {
      const event = {
        moduleTypeId: 'test-type-id',
        position: { x: 100, y: 200 } as Position
      };

      // @ts-ignore - 访问私有方法
      await moduleService['handleModuleInstantiateRequest'](event);

      // 验证创建请求事件已发出
      expect(eventBus.emit).toHaveBeenCalledWith('MODULE.CREATE_REQUEST', {
        typeId: 'test-type-id',
        instanceId: 'mocked-id-12345',
        position: event.position
      });

      // 验证实例化完成事件已发出
      expect(eventBus.emit).toHaveBeenCalledWith('MODULE.INSTANTIATED', {
        moduleId: 'mocked-id-12345',
        moduleTypeId: 'test-type-id',
        position: event.position
      });
    });

    it('should handle errors during instantiation', async () => {
      const error = new Error('Instantiation failed');
      (eventBus.emit as any).mockImplementationOnce(() => {
        throw error;
      });
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const event = {
        moduleTypeId: 'test-type-id'
      };

      // @ts-ignore - 访问私有方法
      await moduleService['handleModuleInstantiateRequest'](event);

      expect(consoleSpy).toHaveBeenCalledWith('Failed to instantiate module:', error);
      expect(eventBus.emit).toHaveBeenLastCalledWith('MODULE.INSTANTIATE_FAILED', {
        moduleTypeId: 'test-type-id',
        error: {
          code: 'MODULE_INSTANTIATE_ERROR',
          message: `Failed to instantiate module: ${error.message}`,
        }
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('handleModuleDisposeRequest', () => {
    it('should emit module destroy request event', async () => {
      const event = { moduleId: 'test-module-id' };

      // @ts-ignore - 访问私有方法
      await moduleService['handleModuleDisposeRequest'](event);

      expect(eventBus.emit).toHaveBeenCalledWith('MODULE.DESTROY_REQUEST', {
        moduleId: 'test-module-id'
      });
    });
  });

  describe('handleConnectionRequest', () => {
    it('should connect modules', () => {
      // 设置模拟返回值
      (useModulesStore.getState().getModule as any)
        .mockImplementationOnce(() => ({ ...mockModuleBase }))
        .mockImplementationOnce(() => ({ ...mockModuleBase, id: 'target-module-id' }));

      const event = {
        source: 'source-id',
        target: 'target-id',
        sourceHandle: 'output1',
        targetHandle: 'input1'
      };

      // @ts-ignore - 访问私有方法
      moduleService['handleConnectionRequest'](event);

      expect(useModulesStore.getState().getModule).toHaveBeenCalledWith('source-id');
      expect(useModulesStore.getState().getModule).toHaveBeenCalledWith('target-id');
      expect(mockModuleBase.connect).toHaveBeenCalledWith(
        { ...mockModuleBase, id: 'target-module-id' }, 
        'output1', 
        'input1'
      );
    });

    it('should handle errors when modules cannot be found', () => {
      // 设置模拟返回值
      (useModulesStore.getState().getModule as any)
        .mockReturnValueOnce(mockModuleBase)
        .mockReturnValueOnce(null);
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const event = {
        source: 'source-id',
        target: 'target-id'
      };

      // @ts-ignore - 访问私有方法
      moduleService['handleConnectionRequest'](event);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to establish connection:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('handleParameterChangeRequest', () => {
    it('should set parameter value on the module', () => {
      // 设置模拟返回值
      (useModulesStore.getState().getModule as any).mockReturnValue(mockModuleBase);

      const event = {
        moduleId: 'test-module-id',
        parameterId: 'test-param',
        value: 42
      };

      // @ts-ignore - 访问私有方法
      moduleService['handleParameterChangeRequest'](event);

      expect(useModulesStore.getState().getModule).toHaveBeenCalledWith('test-module-id');
      expect(mockModuleBase.setParameterValue).toHaveBeenCalledWith('test-param', 42);
    });

    it('should handle errors when module cannot be found', () => {
      // 设置模拟返回值
      (useModulesStore.getState().getModule as any).mockReturnValue(null);
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const event = {
        moduleId: 'test-module-id',
        parameterId: 'test-param',
        value: 42
      };

      // @ts-ignore - 访问私有方法
      moduleService['handleParameterChangeRequest'](event);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to change parameter:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('createModule', () => {
    it('should create and return a module instance', async () => {
      // 设置模拟返回值
      (moduleFactory.create as any).mockResolvedValue(mockModuleBase);
      
      const position = { x: 100, y: 200 } as Position;
      const result = await moduleService.createModule('test-type-id', position);

      expect(eventBus.emit).toHaveBeenCalledWith('MODULE.CREATE_REQUEST', {
        typeId: 'test-type-id',
        instanceId: 'mocked-id-12345',
        position
      });
      
      expect(moduleFactory.create).toHaveBeenCalledWith('test-type-id', 'mocked-id-12345');
      expect(useModulesStore.getState().addModule).toHaveBeenCalledWith(mockModuleBase, position);
      expect(result).toBe(mockModuleBase);
    });
  });
});
