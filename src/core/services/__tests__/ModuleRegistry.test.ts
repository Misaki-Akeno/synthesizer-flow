/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { ModuleCategory, ModuleConfiguration, DataType } from '@/types/module';

// 在mock之前定义辅助函数
function createMockModuleConfig(
  id: string,
  name: string,
  category: ModuleCategory,
  tags: string[] = ['test']
): ModuleConfiguration {
  return {
    metadata: {
      id,
      name,
      version: '1.0.0',
      category,
      tags,
      description: `Test module ${name}`,
      author: 'Test Author',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    },
    interfaces: {
      inputs: [
        {
          id: 'input1',
          label: 'Input 1',
          dataType: DataType.AUDIO,
          optional: true,
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
        type: 'NUMBER',
        default: 440,
        min: 20,
        max: 20000,
        step: 1,
        label: 'Frequency',
        description: 'Oscillator frequency',
      },
    },
    presets: [
      {
        id: 'default',
        name: 'Default',
        author: 'Test Author',
        values: {
          frequency: 440,
        },
      },
    ],
    ui: {
      color: '#ff0000',
      icon: 'wave',
      width: 200,
      height: 150,
    },
  };
}

// 使用doMock代替mock，它不会被提升
vi.doMock('../../events/EventBus', () => ({
  eventBus: {
    emit: vi.fn(),
  },
}));

vi.doMock('@/modules/generator/oscillator-basic', () => ({
  oscillatorBasicConfig: createMockModuleConfig(
    'oscillator-basic',
    'Basic Oscillator',
    ModuleCategory.GENERATOR
  ),
}));

// 存储动态导入的模块
let ModuleRegistry: any;
let moduleRegistry: any;
let discoverAndRegisterModules: any;
let eventBus: any;

// 在所有测试之前动态导入模块
beforeAll(async () => {
  const moduleRegistryModule = await import('../ModuleRegistry');
  ModuleRegistry = moduleRegistryModule.ModuleRegistry;
  moduleRegistry = moduleRegistryModule.moduleRegistry;
  discoverAndRegisterModules = moduleRegistryModule.discoverAndRegisterModules;

  const eventBusModule = await import('../../events/EventBus');
  eventBus = eventBusModule.eventBus;
});

describe('ModuleRegistry', () => {
  let registry: any;

  beforeEach(() => {
    registry = new ModuleRegistry();
    vi.clearAllMocks();
  });

  it('应该能注册一个模块配置', () => {
    const mockConfig = createMockModuleConfig(
      'test-module',
      'Test Module',
      ModuleCategory.GENERATOR
    );
    registry.register(mockConfig);

    expect(registry.getAll()).toHaveLength(1);
    expect(registry.getById('test-module')).toBe(mockConfig);
  });

  // 其他测试与原文件相同...
});

describe('discoverAndRegisterModules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应该能发现和注册模块', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await discoverAndRegisterModules();

    expect(eventBus.emit).toHaveBeenCalled();
    expect(moduleRegistry.getAll().length).toBeGreaterThan(0);

    consoleSpy.mockRestore();
  });

  // 其他测试与原文件相同...
});
