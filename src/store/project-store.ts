'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useFlowStore } from './store';
import { createModuleLogger } from '@/lib/logger';
import {
  validateAndParseJson,
  validateSerializedCanvas,
} from '@/core/types/SerializationValidator';
import {
  getUserProjects,
  getProjectById,
  saveProject,
  deleteProjectAction,
  getBuiltInPresets,
} from '@/actions/project.actions';
import { nanoid } from 'nanoid';

// 创建项目管理器专用日志记录器
const logger = createModuleLogger('ProjectManager');

// ======== 项目配置接口 ========

export interface ProjectConfig {
  id: string; // 项目唯一标识符
  name: string; // 项目名称，用于显示
  description?: string; // 项目描述
  created: string; // 创建时间
  lastModified: string; // 最后修改时间
  data?: string; // JSON 格式的画布数据 (列表模式下可能为空)
  tags?: string[]; // 项目标签
  isBuiltIn?: boolean; // 标记是否为内置预设
}

// ======== 项目管理 Store 接口 ========

export interface ProjectPersistState {
  // 项目列表
  userProjects: ProjectConfig[];
  builtInProjects: ProjectConfig[];

  // 当前加载的项目 (包含完整数据)
  currentProject: ProjectConfig | null;

  // 状态标志
  isLoading: boolean;

  // 动作
  fetchProjects: () => Promise<void>;

  // 获取所有可用项目（包括内置预设和用户项目）
  getAllProjects: () => ProjectConfig[];

  // 获取项目
  getProjectById: (id: string) => ProjectConfig | null;

  // 项目管理方法
  saveCurrentCanvas: (name: string, description?: string) => Promise<boolean>;
  saveAsPreset: (name: string, description?: string) => Promise<boolean>;
  loadProject: (projectOrId: ProjectConfig | string) => Promise<boolean>;
  deleteProject: (projectId: string) => Promise<boolean>;
  exportProjectToFile: (projectIdOrName: string) => void;
  importProjectFromJson: (jsonData: string) => Promise<boolean>;
}

// ======== 工具函数 ========

const jsonUtils = {
  // 将JSON字符串转换为URL安全格式（如果需要）
  makeJsonUrlSafe(jsonStr: string): string {
    return encodeURIComponent(jsonStr);
  },

  // 将URL安全的JSON字符串转回正常格式
  restoreUrlSafeJson(safeJsonStr: string): string {
    // 简单判断是否被编码过
    if (safeJsonStr.startsWith('%7B') || safeJsonStr.includes('%22')) {
      return decodeURIComponent(safeJsonStr);
    }
    return safeJsonStr;
  },
};

// ======== 项目管理 Zustand Store ========

export const useProjectStore = create<ProjectPersistState>()(
  persist(
    (set, get) => ({
      userProjects: [],
      // 初始时使用本地硬编码预设作为 fallback，fetchProjects 后会被覆盖
      builtInProjects: [],
      currentProject: null,
      isLoading: false,

      fetchProjects: async () => {
        set({ isLoading: true });
        try {
          const [userRes, presetRes] = await Promise.all([
            getUserProjects(),
            getBuiltInPresets()
          ]);

          if (userRes.success && userRes.data) {
            const mappedProjects: ProjectConfig[] = userRes.data.map((p) => ({
              id: p.id,
              name: p.name,
              created: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
              lastModified: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
              data: undefined, // 列表不返回数据
              isBuiltIn: false
            }));
            set({ userProjects: mappedProjects });
          } else {
            // 仅当非授权错误时才记录错误，避免未登录时的噪音
            if (userRes.error !== 'Unauthorized') {
              logger.error('获取用户项目列表失败', userRes.error);
            }
          }

          if (presetRes.success && presetRes.data) {
            const mappedPresets: ProjectConfig[] = presetRes.data.map((p) => {
              // DB 中 data 是 object (jsonb)，需要 stringify
              const dataStr = typeof p.data === 'object' ? JSON.stringify(p.data) : String(p.data);
              return {
                id: p.id,
                name: p.name,
                description: '系统预设', // 暂时硬编码
                created: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
                lastModified: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
                data: jsonUtils.makeJsonUrlSafe(dataStr),
                isBuiltIn: true
              };
            });
            set({ builtInProjects: mappedPresets });
          }
        } catch (error) {
          logger.error('获取项目列表异常', error);
        } finally {
          set({ isLoading: false });
        }
      },

      getAllProjects: () => {
        const { builtInProjects, userProjects } = get();
        return [...builtInProjects, ...userProjects];
      },

      getProjectById: (id: string) => {
        const { builtInProjects, userProjects } = get();
        const allProjects = [...builtInProjects, ...userProjects];
        return allProjects.find((p) => p.id === id) || null;
      },

      saveCurrentCanvas: async (name: string, description?: string) => {
        try {
          logger.info(`保存项目: "${name}"`);
          set({ isLoading: true });

          // 获取当前画布的JSON
          const canvasData = useFlowStore.getState().exportCanvasToJson();
          // 注意：canvasData 是 string。DB 需要 object。
          // 我们尝试解析它成对象传递给 Server Action
          let dataToSave;
          try {
            dataToSave = JSON.parse(canvasData);
          } catch (e) {
            logger.error('Canvas data parse error', e);
            return false;
          }

          const { currentProject } = get();
          // 如果当前项目有ID且不是内置的，且名字没变（或者是显式保存），则更新
          // 这里简化逻辑：如果名字和当前项目名字一样，就更新当前项目ID，否则新建
          let projectIdToUpdate: string | undefined = undefined;

          if (currentProject && !currentProject.isBuiltIn && currentProject.name === name) {
            projectIdToUpdate = currentProject.id;
          }

          const result = await saveProject(name, dataToSave, projectIdToUpdate);

          if (result.success && result.projectId) {
            // 保存成功，更新当前项目状态（包括 data，这里保持 string 格式以便本地缓存）
            const now = new Date().toISOString();

            // 重新获取列表以确保同步
            await get().fetchProjects();

            // 更新 currentProject
            const newProjectConfig: ProjectConfig = {
              id: result.projectId,
              name,
              description,
              created: currentProject?.created || now,
              lastModified: now,
              data: canvasData, // 保持 string
              isBuiltIn: false
            };

            set({ currentProject: newProjectConfig });
            logger.success(`项目"${name}"保存成功`);
            return true;
          } else {
            logger.error('保存失败', result.error);
            return false;
          }
        } catch (error) {
          logger.error('保存画布失败', error);
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      saveAsPreset: async (name: string, _description?: string) => {
        try {
          logger.info(`保存为预设: "${name}"`);
          set({ isLoading: true });

          const canvasData = useFlowStore.getState().exportCanvasToJson();
          let dataToSave;
          try {
            dataToSave = JSON.parse(canvasData);
          } catch (e) {
            logger.error('Canvas data parse error', e);
            return false;
          }

          // 强制新建，不检查ID更新（为了简单，总算创建新预设）
          // 传入 isPreset = true
          const result = await saveProject(name, dataToSave, undefined, true);

          if (result.success && result.projectId) {
            await get().fetchProjects();
            logger.success(`预设"${name}"保存成功`);
            return true;
          } else {
            logger.error('保存预设失败', result.error);
            return false;
          }
        } catch (error) {
          logger.error('保存预设异常', error);
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      loadProject: async (projectOrId: ProjectConfig | string) => {
        try {
          let projectConfig: ProjectConfig | null = null;

          if (typeof projectOrId === 'string') {
            // 按照ID查找
            projectConfig = get().getProjectById(projectOrId);

            // 如果本地列表里找不到（可能是列表未加载或这是个新URL），尝试直接从后端拉取
            if (!projectConfig) {
              const res = await getProjectById(projectOrId);
              if (res.success && res.data) {
                projectConfig = {
                  id: res.data.id,
                  name: res.data.name,
                  created: res.data.createdAt ? new Date(res.data.createdAt).toISOString() : new Date().toISOString(),
                  lastModified: res.data.updatedAt ? new Date(res.data.updatedAt).toISOString() : new Date().toISOString(),
                  isBuiltIn: res.data.isPreset,
                  data: typeof res.data.data === 'object' ? JSON.stringify(res.data.data) : String(res.data.data)
                };
              }
            }
          } else {
            projectConfig = projectOrId;
          }

          if (!projectConfig) {
            // 如果在列表中找不到（例如是刚恢复的缓存对象，尚未在 fetchProjects 中返回），
            // 且 projectOrId 是对象，可以尝试直接使用
            if (typeof projectOrId !== 'string') {
              projectConfig = projectOrId;
            } else {
              logger.error('找不到项目');
              return false;
            }
          }

          logger.info(`加载项目: "${projectConfig.name}" (ID: ${projectConfig.id})`);
          set({ isLoading: true });

          // 如果没有数据（或者是用户项目，只有元数据），需要从 DB 获取
          let fullData = projectConfig.data;

          if (!fullData && !projectConfig.isBuiltIn) {
            // 从 DB 获取详情
            const result = await getProjectById(projectConfig.id);
            if (result.success && result.data) {
              // DB 返回的 data 是 jsonb (object)
              // store 需要 string
              fullData = JSON.stringify(result.data.data);
            } else {
              logger.error('无法从服务器获取项目详情', result.error);
              set({ isLoading: false });
              return false;
            }
          }

          if (!fullData) {
            logger.error('项目数据为空');
            set({ isLoading: false });
            return false;
          }

          // 资源清理逻辑
          const currentNodes = useFlowStore.getState().nodes;
          if (currentNodes.length > 0) {
            const speakerNodes = currentNodes.filter(
              (node) => node.data?.module?.moduleType === 'speaker'
            );
            speakerNodes.forEach((node) => {
              if (node.data?.module?.dispose) {
                try { node.data.module.dispose(); } catch (_e) { }
              }
            });
            currentNodes.forEach((node) => {
              if (node.data?.module?.dispose && node.data.module.moduleType !== 'speaker') {
                try { node.data.module.dispose(); } catch (_e) { }
              }
            });
            await new Promise((resolve) => setTimeout(resolve, 50));
          }

          // 解析数据
          const jsonData = jsonUtils.restoreUrlSafeJson(fullData);
          const parseResult = validateAndParseJson(jsonData, validateSerializedCanvas);

          if (!parseResult.success) {
            logger.error('项目数据验证失败', parseResult.error);
            set({ isLoading: false });
            return false;
          }

          const success = useFlowStore.getState().importCanvasFromJson(jsonData);

          if (success) {
            set({
              currentProject: {
                ...projectConfig,
                data: jsonData, // 更新为完整数据
                lastModified: new Date().toISOString(),
              },
            });
            logger.success(`项目"${projectConfig.name}"加载成功`);
          } else {
            logger.error(`项目"${projectConfig.name}"加载失败`);
          }

          set({ isLoading: false });
          return success;
        } catch (error) {
          logger.error('加载项目失败', error);
          set({ isLoading: false });
          return false;
        }
      },

      deleteProject: async (projectId: string) => {
        logger.info(`请求删除项目: "${projectId}"`);
        set({ isLoading: true });

        try {
          // 检查是否是内置项目
          const { builtInProjects } = get();
          if (builtInProjects.some(p => p.id === projectId)) {
            logger.warn('无法删除内置项目');
            return false;
          }

          const result = await deleteProjectAction(projectId);
          if (result.success) {
            await get().fetchProjects(); // 刷新列表

            const { currentProject } = get();
            if (currentProject?.id === projectId) {
              set({ currentProject: null });
            }
            logger.success('项目删除成功');
            return true;
          } else {
            logger.error('删除项目失败', result.error);
            return false;
          }
        } catch (error) {
          logger.error('删除项目异常', error);
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      exportProjectToFile: (projectIdOrName: string) => {
        // 支持根据 ID 或 Name 查找
        const { userProjects, builtInProjects, currentProject } = get();
        const allProject = [...builtInProjects, ...userProjects];
        if (currentProject) allProject.push(currentProject);

        // 优先匹配 ID，其次匹配 Name
        const project = allProject.find(p => p.id === projectIdOrName) ||
          allProject.find(p => p.name === projectIdOrName);

        if (!project) {
          logger.error(`找不到要导出的项目: "${projectIdOrName}"`);
          return;
        }

        if (!project.data) {
          logger.warn('项目数据未加载，请先加载项目后再导出');
          return;
        }

        try {
          const jsonData = jsonUtils.restoreUrlSafeJson(project.data);
          const dataBlob = new Blob([jsonData], { type: 'application/json' });
          const url = URL.createObjectURL(dataBlob);
          const filename = `synthesizerflow_${project.name}_${new Date().toISOString().slice(0, 10)}.json`;

          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          link.click();
          URL.revokeObjectURL(url);
          logger.success(`项目导出成功: ${filename}`);
        } catch (error) {
          logger.error(`项目导出失败`, error);
        }
      },

      importProjectFromJson: async (jsonData: string) => {
        try {
          const parseResult = validateAndParseJson(jsonData, validateSerializedCanvas);
          if (!parseResult.success) {
            logger.error('JSON数据验证失败', parseResult.error);
            return false;
          }

          const success = useFlowStore.getState().importCanvasFromJson(jsonData);
          if (success) {
            const now = new Date().toISOString();
            const importedProject: ProjectConfig = {
              id: 'imported_' + nanoid(6),
              name: `导入的项目`,
              created: now,
              lastModified: now,
              data: jsonData,
              isBuiltIn: false
            };

            set({ currentProject: importedProject });
            logger.success('项目导入成功，在保存前仅存在于本地');
            return true;
          }
          return false;
        } catch (error) {
          logger.error('导入失败', error);
          return false;
        }
      }
    }),
    {
      name: 'synthesizerflow-projects',
      // 只持久化 currentProject，实现"本地缓存"
      partialize: (state) => ({ currentProject: state.currentProject }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          logger.info('本地缓存已恢复');
          // 移除 state.fetchProjects()，由 UI 组件 (ProjectManager) 通过 useEffect 触发

          // 注意：自动恢复逻辑已下放至 Canvas 组件，以便与 URL 参数协调
        }
      }
    }
  )
);

// 为兼容性保留导出
export const usePersistStore = useProjectStore;
