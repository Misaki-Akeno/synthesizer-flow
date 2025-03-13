import {
  ModuleConfiguration,
  ModuleCategory,
  ModuleRegistry as IModuleRegistry,
} from '@/interfaces/module';
import { eventBus } from '../events/EventBus';
import { oscillatorBasicConfig } from '@/modules/generator/oscillator-basic';
import { outputModuleConfig } from '@/modules/utility/output';
import { triggerModuleConfig } from '@/modules/controller/trigger';
import { debugModuleConfig } from '@/modules/utility/debug';

/**
 * 模块注册表服务实现
 */
export class ModuleRegistry implements IModuleRegistry {
  private modules: Map<string, ModuleConfiguration> = new Map();

  /**
   * 注册模块配置
   */
  register(moduleConfig: ModuleConfiguration): void {
    if (this.modules.has(moduleConfig.metadata.id)) {
      console.warn(`模块 ${moduleConfig.metadata.id} 已经注册，将被覆盖`);
    }

    this.modules.set(moduleConfig.metadata.id, moduleConfig);
    console.log(
      `已注册模块: ${moduleConfig.metadata.name} (${moduleConfig.metadata.id})`
    );
  }

  /**
   * 获取所有已注册的模块配置
   */
  getAll(): ModuleConfiguration[] {
    return Array.from(this.modules.values());
  }

  /**
   * 根据ID获取模块配置
   */
  getById(id: string): ModuleConfiguration | undefined {
    return this.modules.get(id);
  }

  /**
   * 根据类别获取模块配置
   */
  getByCategory(category: ModuleCategory | string): ModuleConfiguration[] {
    return Array.from(this.modules.values()).filter(
      (module) => module.metadata.category === category
    );
  }

  /**
   * 根据标签获取模块配置
   */
  getByTag(tag: string): ModuleConfiguration[] {
    return Array.from(this.modules.values()).filter((module) =>
      module.metadata.tags.includes(tag)
    );
  }
}

// 导出单例实例
export const moduleRegistry = new ModuleRegistry();

// 用于自动发现和加载模块的函数
export async function discoverAndRegisterModules(): Promise<void> {
  try {
    // 这里使用动态导入来获取所有模块
    // 注意: 这种方法在 Next.js 中需要特殊处理
    const moduleConfigs = await loadAllModuleConfigs();

    // 注册所有模块配置
    for (const config of moduleConfigs) {
      moduleRegistry.register(config);
    }

    // 发出模块注册完成事件
    eventBus.emit('MODULE_SERVICE.INITIALIZED', {
      time: new Date().toISOString(),
    });

    console.log(`注册完成，共注册了 ${moduleRegistry.getAll().length} 个模块`);
  } catch (error) {
    console.error('注册模块时出错:', error);
  }
}

/**
 * 加载所有模块配置
 * 直接从模块文件中导入配置
 */
async function loadAllModuleConfigs(): Promise<ModuleConfiguration[]> {
  const configs: ModuleConfiguration[] = [];

  // 导入已知的模块配置
  try {
    configs.push(oscillatorBasicConfig);
    configs.push(outputModuleConfig);
    configs.push(triggerModuleConfig);
    configs.push(debugModuleConfig);

    // 2. 以后可以在这里添加更多模块
    // configs.push(otherModuleConfig);
    // configs.push(anotherModuleConfig);
  } catch (error) {
    console.error('加载模块配置时出错:', error);
  }

  return configs;
}
