'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useFlowStore } from './store';
import { getAllPresets } from '../lib/getpresetjson';
import { nanoid } from 'nanoid';
import { createModuleLogger } from '@/lib/logger';
import {
  validateProjectConfig,
  validateAndParseJson,
  validateSerializedCanvas,
} from '@/core/types/SerializationValidator';

// 创建项目管理器专用日志记录器
const logger = createModuleLogger('ProjectManager');

// 生成短UUID的工具函数
function generateShortId(): string {
  return nanoid(10); // 生成10个字符的短ID
}

export interface ProjectConfig {
  id: string; // 项目唯一标识符，现在是必填项
  name: string; // 项目名称，用于显示
  description?: string;
  created: string;
  lastModified: string;
  data: string; // JSON 格式的画布数据
  thumbnail?: string; // Base64格式的画布缩略图
  tags?: string[];
  isBuiltIn?: boolean; // 标记是否为内置预设
}

export interface CanvsSettings {
  darkMode: boolean;
  autoSave: boolean;
  snapToGrid: boolean;
  gridSize: number;
  controlPanelVisible: boolean;
}

export interface AIModelSettings {
  modelName: string; // 如 'gpt-4', 'claude-3' 等
  apiKey: string; // API 密钥
  apiEndpoint: string; // 可选的 API 端点
}

export interface PersistState {
  // 用户偏好设置
  preferences: {
    canvsSettings: CanvsSettings; // 画布相关的偏好设置
    aiModelSettings: AIModelSettings; // AI 模型相关的偏好设置
    // 新的偏好设置
  };

  // 更新偏好设置方法
  updatePreferences: (
    newPreferences: Partial<PersistState['preferences']>
  ) => void;

  // 用户最近保存的项目记录
  recentProjects: ProjectConfig[];

  // 当前加载的项目
  currentProject: ProjectConfig | null;

  // 内置预设项目
  builtInProjects: ProjectConfig[];

  // 获取所有可用项目（包括内置预设和用户项目）
  getAllProjects: () => ProjectConfig[];

  // 获取项目
  getProjectById: (id: string) => ProjectConfig | null;

  // 项目管理方法
  saveCurrentCanvas: (name: string, description?: string) => Promise<boolean>;
  loadProject: (projectData: ProjectConfig) => Promise<boolean>;
  deleteProject: (projectName: string) => void;
  exportProjectToFile: (projectName: string) => void;
  importProjectFromJson: (jsonData: string) => Promise<boolean>;
}

// 创建用于处理JSON字符串的工具函数
const jsonUtils = {
  // 将JSON字符串转换为URL安全格式（替换特殊字符）
  makeJsonUrlSafe(jsonStr: string): string {
    return encodeURIComponent(jsonStr);
  },

  // 将URL安全的JSON字符串转回正常格式
  restoreUrlSafeJson(safeJsonStr: string): string {
    return decodeURIComponent(safeJsonStr);
  },
};

// 确保 Zustand 的 getSnapshot 返回稳定的结果
export const usePersistStore = create<PersistState>()(
  persist(
    (set, get) => ({
      // 默认偏好设置
      preferences: {
        canvsSettings: {
          darkMode: false,
          autoSave: true,
          snapToGrid: true,
          gridSize: 10, // 默认网格大小
          controlPanelVisible: true, // 控制面板默认可见
        },
        aiModelSettings: {
          modelName: 'qwen-turbo-2025-04-28', // 默认模型
          apiKey: '', // 初始为空，用户需要设置
          apiEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', // 默认API端点
        },
      },

      // 更新偏好设置
      updatePreferences: (newPreferencesPartial) => {
        set((state) => {
          let changed = false;
          const nextPreferences = { ...state.preferences };

          if (newPreferencesPartial.canvsSettings) {
            const updatedCanvsSettings = {
              ...state.preferences.canvsSettings,
              ...newPreferencesPartial.canvsSettings,
            };
            if (
              JSON.stringify(state.preferences.canvsSettings) !==
              JSON.stringify(updatedCanvsSettings)
            ) {
              nextPreferences.canvsSettings = updatedCanvsSettings;
              changed = true;
            }
          }

          if (newPreferencesPartial.aiModelSettings) {
            const updatedAiModelSettings = {
              ...state.preferences.aiModelSettings,
              ...newPreferencesPartial.aiModelSettings,
            };
            if (
              JSON.stringify(state.preferences.aiModelSettings) !==
              JSON.stringify(updatedAiModelSettings)
            ) {
              nextPreferences.aiModelSettings = updatedAiModelSettings;
              changed = true;
            }
          }

          // 如果还有其他偏好设置组，也类似处理
          // if (newPreferencesPartial.someOtherSettings) { ... }

          if (!changed) {
            return state; // 没有实际变化，返回当前状态以避免不必要的更新
          }

          return { preferences: nextPreferences };
        });
        // 只有在实际发生更改时才记录日志可能更精确，但这需要在 set 回调之外或使用 get() 来检查。
        // 当前的日志记录方式（即使没有实际更改也记录尝试更新的操作）也可以接受。
        logger.info('用户偏好设置已更新');
      },

      // 添加 getSnapshot 方法，确保返回值稳定
      getSnapshot: () => {
        const state = get();
        return {
          preferences: state.preferences,
          recentProjects: state.recentProjects,
          currentProject: state.currentProject,
        };
      },

      // 保存的项目列表
      recentProjects: [],

      // 内置预设项目 - 每次初始化时从 getpresetjson 获取最新的预设
      builtInProjects: getAllPresets(),

      // 当前项目
      currentProject: null,

      // 获取所有可用项目（包括内置预设和用户项目）
      getAllProjects: () => {
        // 确保每次都使用最新的内置预设
        const freshBuiltInPresets = getAllPresets();
        const { recentProjects } = get();
        return [...freshBuiltInPresets, ...recentProjects];
      },

      // 按ID获取项目
      getProjectById: (id: string) => {
        // 确保每次都使用最新的内置预设
        const freshBuiltInPresets = getAllPresets();
        const { recentProjects } = get();
        const allProjects = [...freshBuiltInPresets, ...recentProjects];
        const project = allProjects.find((p) => p.id === id) || null;

        if (!project) {
          logger.warn(`找不到ID为"${id}"的项目`);
        }

        return project;
      },

      // 保存当前画布状态为新项目
      saveCurrentCanvas: async (name: string, description?: string) => {
        try {
          logger.info(`保存项目: "${name}"`);

          // 获取当前画布的JSON编码
          const canvasData = useFlowStore.getState().exportCanvasToJson();

          // 使用URL安全的JSON格式
          const safeJson = jsonUtils.makeJsonUrlSafe(canvasData);

          // 创建项目配置
          const now = new Date().toISOString();

          set((state) => {
            // 检查是否已存在同名项目
            const existingIndex = state.recentProjects.findIndex(
              (p) => p.name === name
            );

            let project: ProjectConfig;
            const updatedProjects = [...state.recentProjects];

            if (existingIndex >= 0) {
              // 更新现有项目，保留原有ID
              project = {
                ...updatedProjects[existingIndex],
                name,
                description,
                lastModified: now,
                data: safeJson,
              };
              updatedProjects[existingIndex] = project;
              logger.info(`更新已存在的项目: "${name}"`);
            } else {
              // 添加新项目，生成唯一ID
              project = {
                name,
                description,
                created: now,
                lastModified: now,
                data: safeJson,
                id: generateShortId(),
                // TODO: 添加缩略图生成功能
              };

              updatedProjects.unshift(project);
              logger.success(`创建新项目: "${name}" (ID: ${project.id})`);

              // 保持列表长度不超过20个项目
              if (updatedProjects.length > 20) {
                logger.debug(`项目列表超过20个，移除最旧的项目`);
                updatedProjects.pop();
              }
            }

            // 验证项目配置
            const validationResult = validateProjectConfig(project);
            if (!validationResult.success) {
              logger.error(`项目配置验证失败`, validationResult.error);
              throw new Error('项目配置验证失败');
            }

            return {
              recentProjects: updatedProjects,
              currentProject: project,
            };
          });

          return true;
        } catch (error) {
          logger.error('保存画布失败', error);
          return false;
        }
      },

      // 加载已保存的项目
      loadProject: async (projectData: ProjectConfig) => {
        try {
          logger.info(
            `加载项目: "${projectData.name}" (ID: ${projectData.id})`
          );

          // 验证项目配置
          const configValidation = validateProjectConfig(projectData);
          if (!configValidation.success) {
            logger.error(`项目配置验证失败，无法加载`, configValidation.error);
            return false;
          }

          const currentNodes = useFlowStore.getState().nodes;
          if (currentNodes.length > 0) {
            logger.debug(`清理当前画布: ${currentNodes.length}个节点`);

            const speakerNodes = currentNodes.filter(
              (node) => node.data?.module?.moduleType === 'speaker'
            );

            // 首先停止音频输出
            speakerNodes.forEach((node) => {
              if (node.data?.module?.dispose) {
                try {
                  node.data.module.dispose();
                  logger.debug(`已停止音频输出: ${node.id}`);
                } catch (e) {
                  logger.warn(`停止音频输出失败: ${node.id}`, e);
                }
              }
            });

            // 然后清理其他节点
            currentNodes.forEach((node) => {
              if (
                node.data?.module?.dispose &&
                node.data.module.moduleType !== 'speaker'
              ) {
                try {
                  node.data.module.dispose();
                  logger.debug(`已释放模块资源: ${node.id}`);
                } catch (e) {
                  logger.warn(`释放模块资源失败: ${node.id}`, e);
                }
              }
            });

            // 为了安全起见，引入短暂延迟确保资源释放完成
            await new Promise((resolve) => setTimeout(resolve, 50));
            logger.debug('资源释放完成');
          }

          // 将URL安全的JSON转换回标准JSON
          const jsonData = jsonUtils.restoreUrlSafeJson(projectData.data);

          // 验证JSON数据结构
          const parseResult = validateAndParseJson(
            jsonData,
            validateSerializedCanvas
          );
          if (!parseResult.success) {
            logger.error('项目数据验证失败，无法加载', parseResult.error);
            return false;
          }

          // 将JSON数据导入到画布
          const success = useFlowStore
            .getState()
            .importCanvasFromJson(jsonData);

          if (success) {
            // 更新当前项目
            set({
              currentProject: {
                ...projectData,
                lastModified: new Date().toISOString(),
              },
            });
            logger.success(`项目"${projectData.name}"加载成功`);
          } else {
            logger.error(`项目"${projectData.name}"加载失败`);
          }

          return success;
        } catch (error) {
          logger.error('加载项目失败', error);
          return false;
        }
      },

      // 删除已保存的项目
      deleteProject: (projectName: string) => {
        logger.info(`请求删除项目: "${projectName}"`);

        set((state) => {
          // 不允许删除内置预设
          const projectToDelete = state.recentProjects.find(
            (p) => p.name === projectName
          );

          if (!projectToDelete) {
            logger.warn(`找不到要删除的项目: "${projectName}"`);
            return state;
          }

          if (projectToDelete.isBuiltIn) {
            logger.warn(`无法删除内置预设项目: "${projectName}"`);
            return state;
          }

          const updatedProjects = state.recentProjects.filter(
            (p) => p.name !== projectName
          );

          logger.success(`已删除项目: "${projectName}"`);

          return {
            recentProjects: updatedProjects,
            // 如果删除的是当前项目，则清空当前项目
            currentProject:
              state.currentProject?.name === projectName
                ? null
                : state.currentProject,
          };
        });
      },

      // 导出项目到文件
      exportProjectToFile: (projectName: string) => {
        logger.info(`导出项目到文件: "${projectName}"`);

        const { recentProjects, builtInProjects } = get();
        const allProjects = [...recentProjects, ...builtInProjects];
        const project = allProjects.find((p) => p.name === projectName);

        if (!project) {
          logger.error(`找不到要导出的项目: "${projectName}"`);
          return;
        }

        try {
          // 获取项目的JSON数据
          const jsonData = jsonUtils.restoreUrlSafeJson(project.data);

          // 验证JSON数据结构
          const parseResult = validateAndParseJson(
            jsonData,
            validateSerializedCanvas
          );
          if (!parseResult.success) {
            logger.error('项目数据验证失败，无法导出', parseResult.error);
            return;
          }

          // 创建下载链接来导出画布数据
          const dataBlob = new Blob([jsonData], { type: 'application/json' });
          const url = URL.createObjectURL(dataBlob);
          const filename = `synthesizerflow_canvas_${new Date().toISOString().slice(0, 10)}.json`;

          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          link.click();

          // 清理资源
          URL.revokeObjectURL(url);

          logger.success(`项目"${projectName}"导出成功: ${filename}`);
        } catch (error) {
          logger.error(`项目"${projectName}"导出失败`, error);
        }
      },

      // 从JSON字符串导入项目
      importProjectFromJson: async (jsonData: string) => {
        try {
          logger.info('从JSON导入项目');

          // 验证JSON数据结构
          const parseResult = validateAndParseJson(
            jsonData,
            validateSerializedCanvas
          );
          if (!parseResult.success) {
            logger.error('JSON数据验证失败，无法导入', parseResult.error);
            return false;
          }

          const success = useFlowStore
            .getState()
            .importCanvasFromJson(jsonData);

          if (success) {
            // 自动创建一个导入的项目
            const now = new Date().toISOString();
            const safeJson = jsonUtils.makeJsonUrlSafe(jsonData);
            const projectId = generateShortId();
            const projectName = `导入的项目 ${new Date().toLocaleString()}`;

            const importedProject: ProjectConfig = {
              name: projectName,
              created: now,
              lastModified: now,
              data: safeJson,
              id: projectId,
            };

            // 验证项目配置
            const validationResult = validateProjectConfig(importedProject);
            if (!validationResult.success) {
              logger.error(`导入的项目配置验证失败`, validationResult.error);
              return false;
            }

            set((state) => ({
              recentProjects: [importedProject, ...state.recentProjects],
              currentProject: importedProject,
            }));

            logger.success(`项目导入成功: "${projectName}" (ID: ${projectId})`);
          } else {
            logger.error('项目导入失败: 无法导入到画布');
          }

          return success;
        } catch (error) {
          logger.error('导入项目失败', error);
          return false;
        }
      },
    }),
    {
      name: 'synthesizer-flow-storage', // 本地存储的键名
    }
  )
);
