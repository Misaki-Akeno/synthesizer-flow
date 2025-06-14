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

// ======== 项目配置接口 ========

export interface ProjectConfig {
  id: string; // 项目唯一标识符
  name: string; // 项目名称，用于显示
  description?: string; // 项目描述
  created: string; // 创建时间
  lastModified: string; // 最后修改时间
  data: string; // JSON 格式的画布数据
  thumbnail?: string; // Base64格式的画布缩略图
  tags?: string[]; // 项目标签
  isBuiltIn?: boolean; // 标记是否为内置预设
}

// ======== 项目管理 Store 接口 ========

export interface ProjectPersistState {
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

// ======== 工具函数 ========

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

// ======== 项目管理 Zustand Store ========

export const useProjectStore = create<ProjectPersistState>()(
  persist(
    (set, get) => ({
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
      name: 'synthesizerflow-projects', // 更改存储键名，专门用于项目数据
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            logger.error('项目数据恢复失败', error);
            return;
          }
          
          if (state) {
            logger.info('项目数据已恢复');
          }
        };
      },
    }
  )
);

// ======== 便捷的 Hook 函数 ========

// 为了向后兼容，保留原来的导出名称
export const usePersistStore = useProjectStore;
