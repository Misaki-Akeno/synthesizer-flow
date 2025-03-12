/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ModuleFactory } from '../ModuleFactory';
import {
  ModuleBase,
  ModuleCategory,
  ModuleMetadata,
  ModuleConfiguration,
  DataType,
} from '@/types/module';
import { moduleRegistry } from '../../services/ModuleRegistry';
import { eventBus } from '../../events/EventBus';
import { Parameter } from '@/types/parameter';

// 模拟依赖
vi.mock('nanoid', () => ({
  nanoid: () => 'test-id-123',
}));

vi.mock('../../services/ModuleRegistry', () => ({
  moduleRegistry: {
    getById: vi.fn(),
  },
}));

vi.mock('../../events/EventBus', () => ({
  eventBus: {
    emit: vi.fn(),
  },
}));

// 创建一个模拟的模块类，使用静态模拟函数以便在测试中正确模拟行为
class MockModule implements ModuleBase {
  id: string;
  typeId: string;
  metadata: ModuleMetadata;
  parameters: Record<string, Parameter>;

  // 使用静态方法作为共享模拟函数，这样可以在测试中轻松修改它们的行为
  static initializeMock = vi.fn().mockResolvedValue(undefined);
  static disposeMock = vi.fn().mockResolvedValue(undefined);

  // 将实例方法声明为成员变量，这样可以在构造函数中赋值
  initialize: () => Promise<void>;
  dispose: () => Promise<void>;
  connect: any;
  disconnect: any;
  getParameterValue: any;
  setParameterValue: any;
  loadPreset: any;
  [key: string]: unknown;

  constructor(params: any) {
    this.id = params.id;
    this.typeId = params.typeId;
    this.metadata = params.metadata;
    this.parameters = {};

    // 在构造函数中创建可跟踪的模拟函数
    this.initialize = vi
      .fn()
      .mockImplementation(() => MockModule.initializeMock());
    this.dispose = vi.fn().mockImplementation(() => MockModule.disposeMock());
    this.connect = vi.fn();
    this.disconnect = vi.fn();
    this.getParameterValue = vi.fn().mockReturnValue(0);
    this.setParameterValue = vi.fn();
    this.loadPreset = vi.fn();
  }
}

// 模拟模块配置
const createMockModuleConfig = (): ModuleConfiguration => ({
  metadata: {
    id: 'test-module',
    name: 'Test Module',
    version: '1.0.0',
    category: ModuleCategory.GENERATOR,
    tags: ['test'],
    description: 'A test module',
    author: 'Tester',
    created: '2023-01-01',
    updated: '2023-01-01',
  },
  interfaces: {
    inputs: [
      {
        id: 'input1',
        label: 'Input 1',
        dataType: DataType.AUDIO,
      },
    ],
    outputs: [
      {
        id: 'output1',
        label: 'Output 1',
        dataType: DataType.AUDIO,
      },
    ],
  },
  parameters: {
    frequency: {
      type: 'number',
      default: 440,
      min: 20,
      max: 20000,
      step: 1,
      label: 'Frequency',
    },
  },
  presets: [
    {
      id: 'default',
      name: 'Default',
      author: 'System',
      values: { frequency: 440 },
    },
  ],
  ui: {
    color: '#ff0000',
    icon: 'wave',
    width: 200,
    height: 150,
  },
});

describe('ModuleFactory', () => {
  let moduleFactory: ModuleFactory;
  let mockModuleConfig: ModuleConfiguration;

  beforeEach(() => {
    moduleFactory = new ModuleFactory();
    mockModuleConfig = createMockModuleConfig();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('registerModuleClass', () => {
    it('应该成功注册模块类', async () => {
      // 注册模块类
      moduleFactory.registerModuleClass('test-module', MockModule);

      // 设置 moduleRegistry 模拟
      vi.mocked(moduleRegistry.getById).mockReturnValue(mockModuleConfig);

      // 调用 create 方法应该使用已注册的模块类
      const moduleInstance = await moduleFactory.create('test-module');

      // 验证结果
      expect(moduleInstance).toBeInstanceOf(MockModule);
      expect(moduleInstance.id).toBe('test-id-123');
      expect(moduleInstance.typeId).toBe('test-module');
    });
  });

  describe('create', () => {
    it('应该创建模块实例并初始化', async () => {
      // 注册模块类
      moduleFactory.registerModuleClass('test-module', MockModule);

      // 设置 moduleRegistry 模拟
      vi.mocked(moduleRegistry.getById).mockReturnValue(mockModuleConfig);

      // 创建模块实例
      const moduleInstance = await moduleFactory.create('test-module');

      // 验证结果
      expect(moduleInstance).toBeInstanceOf(MockModule);
      expect(moduleInstance.initialize).toHaveBeenCalledTimes(1);
      expect(eventBus.emit).toHaveBeenCalledWith('MODULE.CREATED', {
        moduleId: 'test-id-123',
        typeId: 'test-module',
        module: moduleInstance,
      });
    });

    it('使用提供的 instanceId 创建模块', async () => {
      // 注册模块类
      moduleFactory.registerModuleClass('test-module', MockModule);

      // 设置 moduleRegistry 模拟
      vi.mocked(moduleRegistry.getById).mockReturnValue(mockModuleConfig);

      // 创建模块实例，指定 instanceId
      const moduleInstance = await moduleFactory.create(
        'test-module',
        'custom-id'
      );

      // 验证结果
      expect(moduleInstance.id).toBe('custom-id');
    });

    it('当模块类型未注册时抛出错误', async () => {
      // 设置 moduleRegistry 模拟返回 undefined
      vi.mocked(moduleRegistry.getById).mockReturnValue(undefined);

      // 创建模块实例应该抛出错误
      await expect(moduleFactory.create('unknown-module')).rejects.toThrow(
        '模块类型 unknown-module 未注册'
      );

      // 验证错误事件
      expect(eventBus.emit).toHaveBeenCalledWith('MODULE.CREATE_FAILED', {
        typeId: 'unknown-module',
        instanceId: undefined,
        error: expect.any(Error),
      });
    });

    it('当模块初始化失败时应该处理异常', async () => {
      // 注册模块类
      moduleFactory.registerModuleClass('test-module', MockModule);

      // 设置 moduleRegistry 模拟
      vi.mocked(moduleRegistry.getById).mockReturnValue(mockModuleConfig);

      // 设置初始化失败 - 使用静态模拟函数
      const error = new Error('初始化失败');
      MockModule.initializeMock.mockRejectedValueOnce(error);

      // 创建模块实例应该失败
      await expect(moduleFactory.create('test-module')).rejects.toThrow(
        '初始化失败'
      );

      // 验证错误事件
      expect(eventBus.emit).toHaveBeenCalledWith('MODULE.CREATE_FAILED', {
        typeId: 'test-module',
        instanceId: undefined,
        error,
      });
    });

    it('应该使用模块配置中的构造函数', async () => {
      // 设置 moduleRegistry 模拟，包含 moduleConstructor
      const configWithConstructor = {
        ...mockModuleConfig,
        metadata: {
          ...mockModuleConfig.metadata,
          moduleConstructor: MockModule,
        },
      };

      vi.mocked(moduleRegistry.getById).mockReturnValue(configWithConstructor);

      // 创建模块实例
      const moduleInstance = await moduleFactory.create('test-module');

      // 验证结果
      expect(moduleInstance).toBeInstanceOf(MockModule);
    });
  });

  describe('destroy', () => {
    it('应该销毁模块实例', async () => {
      // 注册模块类
      moduleFactory.registerModuleClass('test-module', MockModule);

      // 设置 moduleRegistry 模拟
      vi.mocked(moduleRegistry.getById).mockReturnValue(mockModuleConfig);

      // 创建模块实例
      const moduleInstance = await moduleFactory.create('test-module');

      // 销毁模块实例
      await moduleFactory.destroy('test-id-123');

      // 验证结果
      expect(moduleInstance.dispose).toHaveBeenCalledTimes(1);
      expect(eventBus.emit).toHaveBeenCalledWith('MODULE.DESTROYED', {
        moduleId: 'test-id-123',
      });

      // 验证模块已从实例映射中删除
      expect(moduleFactory.getInstance('test-id-123')).toBeUndefined();
    });

    it('当模块不存在时抛出错误', async () => {
      // 销毁不存在的模块应该抛出错误
      await expect(moduleFactory.destroy('non-existent-id')).rejects.toThrow(
        '模块 non-existent-id 不存在'
      );

      // 验证错误事件
      expect(eventBus.emit).toHaveBeenCalledWith('MODULE.DESTROY_FAILED', {
        moduleId: 'non-existent-id',
        error: expect.any(Error),
      });
    });

    it('当模块销毁失败时处理异常', async () => {
      // 注册模块类
      moduleFactory.registerModuleClass('test-module', MockModule);

      // 设置 moduleRegistry 模拟
      vi.mocked(moduleRegistry.getById).mockReturnValue(mockModuleConfig);

      // 创建模块实例
      await moduleFactory.create('test-module');

      // 设置销毁失败 - 使用静态模拟函数
      const error = new Error('销毁失败');
      MockModule.disposeMock.mockRejectedValueOnce(error);

      // 销毁模块实例应该失败
      await expect(moduleFactory.destroy('test-id-123')).rejects.toThrow(
        '销毁失败'
      );

      // 验证错误事件
      expect(eventBus.emit).toHaveBeenCalledWith('MODULE.DESTROY_FAILED', {
        moduleId: 'test-id-123',
        error,
      });
    });
  });

  describe('getInstance', () => {
    it('应该返回现有的模块实例', async () => {
      // 注册模块类
      moduleFactory.registerModuleClass('test-module', MockModule);

      // 设置 moduleRegistry 模拟
      vi.mocked(moduleRegistry.getById).mockReturnValue(mockModuleConfig);

      // 创建模块实例
      const createdModule = await moduleFactory.create('test-module');

      // 获取模块实例
      const retrievedModule = moduleFactory.getInstance('test-id-123');

      // 验证结果
      expect(retrievedModule).toBe(createdModule);
    });

    it('当模块不存在时返回 undefined', () => {
      // 获取不存在的模块应该返回 undefined
      const moduleInstance = moduleFactory.getInstance('non-existent-id');

      // 验证结果
      expect(moduleInstance).toBeUndefined();
    });
  });

  describe('getAllInstances', () => {
    it('应该返回所有模块实例', async () => {
      // 注册模块类
      moduleFactory.registerModuleClass('test-module', MockModule);

      // 设置 moduleRegistry 模拟
      vi.mocked(moduleRegistry.getById).mockReturnValue(mockModuleConfig);

      // 创建两个模块实例
      const module1 = await moduleFactory.create('test-module', 'id-1');
      const module2 = await moduleFactory.create('test-module', 'id-2');

      // 获取所有模块实例
      const allInstances = moduleFactory.getAllInstances();

      // 验证结果
      expect(allInstances).toHaveLength(2);
      expect(allInstances).toContain(module1);
      expect(allInstances).toContain(module2);
    });

    it('当没有模块实例时返回空数组', () => {
      // 获取所有模块实例
      const allInstances = moduleFactory.getAllInstances();

      // 验证结果
      expect(allInstances).toEqual([]);
    });
  });
});
