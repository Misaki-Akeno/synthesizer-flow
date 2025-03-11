import { nanoid } from 'nanoid';
import {
  ModuleBase,
  ModuleFactory as IModuleFactory,
  ModuleConfiguration,
  ModuleMetadata,
  ModuleInterface,
  ParameterDefinition,
} from '@/types/module';
import { moduleRegistry } from '../services/ModuleRegistry';
import { eventBus } from '../events/EventBus';

/**
 * 模块构造函数参数类型
 */
interface ModuleConstructorParams {
  id: string;
  typeId: string;
  config?: ModuleConfiguration;
  metadata: ModuleMetadata;
  parameters: Record<string, ParameterDefinition>;
  interfaces: { inputs: ModuleInterface[]; outputs: ModuleInterface[] };
}

/**
 * 模块构造函数类型
 */
type ModuleConstructor = new (params: ModuleConstructorParams) => ModuleBase;

/**
 * 模块工厂实现
 * 负责创建和销毁模块实例
 */
export class ModuleFactory implements IModuleFactory {
  // 存储创建的模块实例
  private modules: Map<string, ModuleBase> = new Map();

  // 模块类的映射表
  private moduleClasses: Record<string, ModuleConstructor> = {};

  /**
   * 注册模块类
   */
  registerModuleClass(typeId: string, moduleClass: ModuleConstructor): void {
    this.moduleClasses[typeId] = moduleClass;
  }

  /**
   * 根据类型ID获取模块类
   * 这个方法单独处理获取模块类的逻辑，使代码更清晰
   */
  private async getModuleClass(
    typeId: string,
    config: ModuleConfiguration
  ): Promise<ModuleConstructor> {
    // 首先检查已注册的模块类
    const ModuleClass = this.moduleClasses[typeId];
    if (ModuleClass) {
      return ModuleClass;
    }

    // 然后检查模块配置中是否包含构造函数
    if (config.metadata.moduleConstructor) {
      const constructor = config.metadata
        .moduleConstructor as ModuleConstructor;
      this.moduleClasses[typeId] = constructor;
      return constructor;
    }

    // 最后尝试通过模块路径动态导入
    if (config.metadata.moduleClass) {
      try {
        const modulePath = config.metadata.moduleClass;
        const moduleExport = await import(modulePath);

        // 尝试获取导出的模块类
        const ExportedClass =
          moduleExport.default || moduleExport[typeId + 'Module'];

        if (ExportedClass && typeof ExportedClass === 'function') {
          const constructor = ExportedClass as ModuleConstructor;
          this.moduleClasses[typeId] = constructor;
          return constructor;
        }

        throw new Error(`从 ${modulePath} 导入的模块没有提供有效的构造函数`);
      } catch (error) {
        console.error(`无法导入模块类 ${typeId}: ${(error as Error).message}`);
        throw new Error(
          `无法导入模块类 ${typeId}: ${(error as Error).message}`
        );
      }
    }

    throw new Error(`找不到模块类 ${typeId} 的实现`);
  }

  /**
   * 创建模块实例
   */
  async create(typeId: string, instanceId?: string): Promise<ModuleBase> {
    try {
      // 获取模块配置
      const moduleConfig = moduleRegistry.getById(typeId);
      if (!moduleConfig) {
        throw new Error(`模块类型 ${typeId} 未注册`);
      }

      // 生成实例ID
      const id = instanceId || nanoid();

      // 获取模块类
      const ModuleClass = await this.getModuleClass(typeId, moduleConfig);

      // 创建模块实例 - 统一传递配置对象
      const moduleInstance = new ModuleClass({
        id,
        typeId,
        config: moduleConfig, // 传递完整配置对象，让模块类自己决定如何使用
        metadata: moduleConfig.metadata,
        parameters: moduleConfig.parameters,
        interfaces: moduleConfig.interfaces,
      });

      // 存储模块实例
      this.modules.set(id, moduleInstance);

      // 发出模块创建事件
      eventBus.emit('MODULE.CREATED', {
        moduleId: id,
        typeId,
        module: moduleInstance,
      });

      // 初始化模块
      await moduleInstance.initialize();

      return moduleInstance;
    } catch (error) {
      console.error(`创建模块 ${typeId} 失败:`, error);
      eventBus.emit('MODULE.CREATE_FAILED', {
        typeId,
        instanceId,
        error,
      });
      throw error;
    }
  }

  /**
   * 销毁模块实例
   */
  async destroy(moduleId: string): Promise<void> {
    try {
      const moduleInstance = this.modules.get(moduleId);
      if (!moduleInstance) {
        throw new Error(`模块 ${moduleId} 不存在`);
      }

      // 调用模块销毁方法
      await moduleInstance.dispose();

      // 从内部存储中移除
      this.modules.delete(moduleId);

      // 发出模块销毁事件
      eventBus.emit('MODULE.DESTROYED', {
        moduleId,
      });
    } catch (error) {
      console.error(`销毁模块 ${moduleId} 失败:`, error);
      eventBus.emit('MODULE.DESTROY_FAILED', {
        moduleId,
        error,
      });
      throw error;
    }
  }

  /**
   * 获取已创建的模块实例
   */
  getInstance(moduleId: string): ModuleBase | undefined {
    return this.modules.get(moduleId);
  }

  /**
   * 获取所有已创建的模块实例
   */
  getAllInstances(): ModuleBase[] {
    return Array.from(this.modules.values());
  }
}

// 导出模块工厂单例
export const moduleFactory = new ModuleFactory();
