import { moduleConfigurations } from '../../modules/moduleMeta';
import * as Tone from 'tone';

/**
 * 模块服务 - 负责加载和管理合成器模块
 */
class ModuleService {
  constructor() {
    this.modules = {};
    this.initialized = false;
  }

  /**
   * 初始化模块服务
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // 从配置文件加载模块
      this.loadModulesFromConfig();

      this.initialized = true;
      console.log(
        '模块服务初始化成功，已加载',
        Object.keys(this.modules).length,
        '个模块'
      );
    } catch (error) {
      console.error('模块服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 从配置文件加载模块
   */
  loadModulesFromConfig() {
    moduleConfigurations.forEach((config) => {
      this.modules[config.metadata.id] = {
        ...config,
        // 添加额外的运行时属性
        runtime: {
          loaded: true,
          lastUsed: null,
        },
      };
    });
  }

  /**
   * 获取所有可用模块
   * @returns {Object} 所有模块的映射
   */
  getAllModules() {
    return this.modules;
  }

  /**
   * 按类别获取模块
   * @param {string} category 模块类别
   * @returns {Array} 该类别的模块列表
   */
  getModulesByCategory(category) {
    return Object.values(this.modules).filter(
      (module) => module.metadata.category === category
    );
  }

  /**
   * 按标签搜索模块
   * @param {string} tag 标签名称
   * @returns {Array} 包含该标签的模块列表
   */
  getModulesByTag(tag) {
    return Object.values(this.modules).filter((module) =>
      module.metadata.tags.includes(tag)
    );
  }

  /**
   * 根据ID获取模块
   * @param {string} id 模块ID
   * @returns {Object|null} 模块配置或null
   */
  getModuleById(id) {
    return this.modules[id] || null;
  }

  /**
   * 创建模块的Tone.js实例
   * @param {string} moduleId 模块ID
   * @param {Object} parameters 参数覆盖
   * @returns {Object} Tone.js实例和配置
   */
  createToneInstance(moduleId, parameters = {}) {
    const loadedModule = this.getModuleById(moduleId);
    if (!loadedModule) {
      throw new Error(`模块 ${moduleId} 不存在`);
    }

    // 合并默认参数和提供的参数
    const mergedParams = {};
    Object.keys(loadedModule.parameters).forEach((key) => {
      mergedParams[key] =
        parameters[key] !== undefined
          ? parameters[key]
          : loadedModule.parameters[key].default;
    });

    // 获取Tone组件类型和配置
    const { toneComponent, toneConfiguration } = loadedModule;

    // 使用配置函数创建Tone.js配置
    const toneParams = toneConfiguration.setup(mergedParams);

    // 创建Tone.js实例
    const instance = new Tone[toneComponent](toneParams);

    // 记录最后使用时间
    loadedModule.runtime.lastUsed = new Date();

    return {
      instance,
      config: loadedModule,
      params: mergedParams,
    };
  }

  /**
   * 加载模块预设
   * @param {string} moduleId 模块ID
   * @param {string} presetId 预设ID
   * @returns {Object|null} 预设参数或null
   */
  loadPreset(moduleId, presetId) {
    const loadedModule = this.getModuleById(moduleId);
    if (!loadedModule) return null;

    const preset = loadedModule.presets.find((p) => p.id === presetId);
    return preset ? preset.values : null;
  }

  /**
   * 未来支持 - 从数据库加载模块
   * 这是一个占位方法，方便未来实现数据库支持
   */
  async loadModulesFromDatabase() {
    // 未来实现 - 从数据库加载模块
    console.log('数据库加载尚未实现，使用配置文件');
    this.loadModulesFromConfig();
  }
}

// 创建单例实例
const moduleService = new ModuleService();

export default moduleService;
