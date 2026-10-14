'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useFlowStore } from './canvas-store';
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
import {
  getIndexedDbStorage,
  hasPersistentBrowserStorage,
} from './persist-storage';

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
  metadata?: Record<string, unknown>; // 封面、标签等开放扩展信息
  schemaVersion?: number; // 服务端项目数据结构版本
  revision?: number; // 服务端乐观并发版本
  isBuiltIn?: boolean; // 标记是否为内置预设
  /** 尚未保存到云端的本地草稿。 */
  isLocalDraft?: boolean;
}

export type ProjectSyncStatus =
  | 'idle'
  | 'saving-local'
  | 'saved-local'
  | 'syncing-cloud'
  | 'saved-cloud'
  | 'conflict'
  | 'error';

export interface FetchProjectsOptions {
  force?: boolean;
}

export type ProjectListErrorCode =
  | 'database-migration-required'
  | 'user-projects-unavailable'
  | 'built-in-projects-unavailable'
  | 'projects-unavailable';

// ======== 项目管理 Store 接口 ========

export interface ProjectPersistState {
  // 项目列表
  userProjects: ProjectConfig[];
  builtInProjects: ProjectConfig[];

  // 当前加载的项目 (包含完整数据)
  currentProject: ProjectConfig | null;
  /** 已编辑但尚未成功同步的画布，按项目保存以避免切换项目时丢失。 */
  localDrafts: Record<string, ProjectConfig>;

  // 状态标志
  isLoading: boolean;
  isProjectListLoading: boolean;
  hasHydratedProjects: boolean;
  projectsLastFetchedAt: string | null;
  projectListError: ProjectListErrorCode | null;
  syncStatus: ProjectSyncStatus;
  syncError: string | null;
  lastAutosavedAt: string | null;

  // 动作
  fetchProjects: (options?: FetchProjectsOptions) => Promise<void>;
  markProjectsHydrated: () => void;

  // 获取所有可用项目（包括内置预设和用户项目）
  getAllProjects: () => ProjectConfig[];

  // 获取项目
  getProjectById: (id: string) => ProjectConfig | null;

  // 项目管理方法
  saveCurrentCanvas: (name: string, description?: string) => Promise<boolean>;
  saveLocalDraft: (canvasData?: string) => Promise<boolean>;
  syncCurrentProjectDraft: (projectId?: string) => Promise<boolean>;
  saveAsPreset: (name: string, description?: string) => Promise<boolean>;
  loadProject: (projectOrId: ProjectConfig | string) => Promise<boolean>;
  deleteProject: (projectId: string) => Promise<boolean>;
  exportProjectToFile: (projectId: string) => Promise<boolean>;
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

function isLocalImportedProject(project: ProjectConfig): boolean {
  return project.id.startsWith('imported_');
}

function isLocalOnlyProject(project: ProjectConfig): boolean {
  return Boolean(project.isLocalDraft) || isLocalImportedProject(project);
}

function isProjectConflict(error: string | null | undefined): boolean {
  return Boolean(error?.toLowerCase().includes('modified elsewhere'));
}

function makeLocalDraftProject(canvasData: string): ProjectConfig {
  const now = new Date().toISOString();
  return {
    id: `draft_${nanoid(8)}`,
    name: '未命名草稿',
    created: now,
    lastModified: now,
    data: canvasData,
    isBuiltIn: false,
    isLocalDraft: true,
  };
}

const PROJECT_LIST_CACHE_TTL_MS = 60_000;
const PROJECT_PERSISTENCE_NAME = 'synthesizerflow-projects';
const PROJECT_DATABASE_MIGRATION_REQUIRED =
  'PROJECT_DATABASE_MIGRATION_REQUIRED';
const projectSyncLocks = new Map<string, Promise<void>>();
let projectLoadGeneration = 0;
let projectCacheWriteQueue: Promise<void> = Promise.resolve();

async function persistProjectCacheSnapshot(
  state: ProjectPersistState
): Promise<void> {
  if (
    typeof window !== 'undefined' &&
    !hasPersistentBrowserStorage(() => window.localStorage)
  ) {
    throw new Error('项目本地存储不可用');
  }
  const storage = useProjectStore.persist.getOptions().storage;
  if (!storage) {
    throw new Error('项目本地存储不可用');
  }
  const value = {
    state: {
      currentProject: state.currentProject,
      localDrafts: state.localDrafts,
      userProjects: state.userProjects,
      builtInProjects: state.builtInProjects.map((project) => ({
        ...project,
        data: undefined,
      })),
      projectsLastFetchedAt: state.projectsLastFetchedAt,
    },
    version: 4,
  };
  // IndexedDB writes are asynchronous. Serialize snapshots so an older project
  // cannot finish after a newer project switch and overwrite the recoverable cache.
  const write = projectCacheWriteQueue
    .catch(() => undefined)
    .then(() => storage.setItem(PROJECT_PERSISTENCE_NAME, value));
  projectCacheWriteQueue = write.then(
    () => undefined,
    () => undefined
  );
  await write;
}

function resolveProjectListError(
  userError: string | null,
  presetError: string | null
): ProjectListErrorCode | null {
  if (
    userError === PROJECT_DATABASE_MIGRATION_REQUIRED ||
    presetError === PROJECT_DATABASE_MIGRATION_REQUIRED
  ) {
    return 'database-migration-required';
  }

  if (userError && presetError) {
    return 'projects-unavailable';
  }
  if (userError) {
    return 'user-projects-unavailable';
  }
  if (presetError) {
    return 'built-in-projects-unavailable';
  }

  return null;
}

// ======== 项目管理 Zustand Store ========

export const useProjectStore = create<ProjectPersistState>()(
  persist(
    (set, get) => ({
      userProjects: [],
      // 初始时使用本地硬编码预设作为 fallback，fetchProjects 后会被覆盖
      builtInProjects: [],
      currentProject: null,
      localDrafts: {},
      isLoading: false,
      isProjectListLoading: false,
      hasHydratedProjects: false,
      projectsLastFetchedAt: null,
      projectListError: null,
      syncStatus: 'idle',
      syncError: null,
      lastAutosavedAt: null,

      markProjectsHydrated: () => {
        set({ hasHydratedProjects: true });
      },

      saveLocalDraft: async (canvasData) => {
        const data = canvasData ?? useFlowStore.getState().exportCanvasToJson();
        const currentProject = get().currentProject;
        const now = new Date().toISOString();
        const draft = currentProject
          ? {
              ...currentProject,
              data,
              lastModified: now,
            }
          : makeLocalDraftProject(data);

        set((state) => ({
          currentProject: draft,
          localDrafts: {
            ...state.localDrafts,
            [draft.id]: draft,
          },
          syncStatus: 'saving-local',
          syncError: null,
          lastAutosavedAt: state.lastAutosavedAt,
        }));
        if (useFlowStore.getState().currentProjectId !== draft.id) {
          useFlowStore.getState().setCurrentProjectId(draft.id);
        }
        try {
          await persistProjectCacheSnapshot(get());
          set({
            syncStatus: 'saved-local',
            syncError: null,
            lastAutosavedAt: now,
          });
          return true;
        } catch (error) {
          logger.error('本地草稿保存失败', error);
          set({
            syncStatus: 'error',
            syncError: '无法写入本地草稿；请释放存储空间后重试。',
          });
          return false;
        }
      },

      syncCurrentProjectDraft: async (projectId) => {
        const currentProject = projectId
          ? (get().localDrafts[projectId] ??
            (get().currentProject?.id === projectId
              ? get().currentProject
              : null))
          : get().currentProject;
        if (
          !currentProject ||
          currentProject.isBuiltIn ||
          isLocalOnlyProject(currentProject)
        ) {
          return true;
        }

        const draft = get().localDrafts[currentProject.id];
        const canvasData = draft?.data ?? currentProject.data;
        if (!canvasData) {
          return true;
        }

        const pendingSync = projectSyncLocks.get(currentProject.id);
        if (pendingSync) {
          // 同一个项目的自动保存必须按 revision 串行。前一个请求完成后重新
          // 读取草稿，确保不会把编辑期间产生的新内容用旧 revision 覆盖。
          await pendingSync;
          return get().syncCurrentProjectDraft();
        }

        let releaseSync!: () => void;
        const syncLock = new Promise<void>((resolve) => {
          releaseSync = resolve;
        });
        projectSyncLocks.set(currentProject.id, syncLock);

        try {
          let dataToSave: unknown;
          try {
            dataToSave = JSON.parse(canvasData);
          } catch (error) {
            logger.error('本地草稿无法解析，未同步到云端', error);
            set({
              syncStatus: 'error',
              syncError: '本地草稿数据无效，已保留在本机。',
            });
            return false;
          }

          set({ syncStatus: 'syncing-cloud', syncError: null });
          const result = await saveProject(currentProject.name, dataToSave, {
            projectId: currentProject.id,
            description: currentProject.description,
            expectedRevision: currentProject.revision,
            metadata: currentProject.metadata,
          });

          if (!result.success || !result.projectId) {
            const error = result.error ?? '云端同步失败';
            set({
              syncStatus: isProjectConflict(error) ? 'conflict' : 'error',
              syncError: isProjectConflict(error)
                ? '云端版本已更新；本地草稿已保留，请重新加载后手动合并。'
                : `${error}；本地草稿已保留。`,
            });
            return false;
          }

          const now = new Date().toISOString();
          set((state) => {
            const nextDrafts = { ...state.localDrafts };
            const hasNewerLocalDraft =
              nextDrafts[currentProject.id]?.data !== canvasData;
            if (!hasNewerLocalDraft) {
              delete nextDrafts[currentProject.id];
            }
            const activeProject =
              state.currentProject?.id === currentProject.id
                ? {
                    ...state.currentProject,
                    data: hasNewerLocalDraft
                      ? state.currentProject.data
                      : canvasData,
                    lastModified: now,
                    revision: result.revision,
                  }
                : state.currentProject;

            return {
              currentProject: activeProject,
              localDrafts: nextDrafts,
              syncStatus: hasNewerLocalDraft ? 'saved-local' : 'saved-cloud',
              syncError: null,
              lastAutosavedAt: now,
            };
          });
          return true;
        } catch (error) {
          logger.error('自动同步项目失败', error);
          set({
            syncStatus: 'error',
            syncError: '云端同步失败；本地草稿已保留。',
          });
          return false;
        } finally {
          projectSyncLocks.delete(currentProject.id);
          releaseSync();
        }
      },

      fetchProjects: async (options = {}) => {
        const { force = false } = options;
        const { projectsLastFetchedAt, isProjectListLoading } = get();
        const lastFetchedTime = projectsLastFetchedAt
          ? new Date(projectsLastFetchedAt).getTime()
          : 0;
        const hasFreshCache =
          Number.isFinite(lastFetchedTime) &&
          Date.now() - lastFetchedTime < PROJECT_LIST_CACHE_TTL_MS;

        if (!force && hasFreshCache) {
          return;
        }

        if (isProjectListLoading) {
          return;
        }

        set({
          isLoading: true,
          isProjectListLoading: true,
          projectListError: null,
        });
        try {
          const [userRes, presetRes] = await Promise.all([
            getUserProjects(),
            getBuiltInPresets(),
          ]);

          if (userRes.success && userRes.data) {
            const mappedProjects: ProjectConfig[] = userRes.data.map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description ?? undefined,
              created: p.createdAt
                ? new Date(p.createdAt).toISOString()
                : new Date().toISOString(),
              lastModified: p.updatedAt
                ? new Date(p.updatedAt).toISOString()
                : new Date().toISOString(),
              metadata: p.metadata as Record<string, unknown>,
              schemaVersion: p.schemaVersion,
              revision: p.revision,
              data: undefined, // 列表不返回数据
              isBuiltIn: false,
            }));
            set({ userProjects: mappedProjects });
          } else {
            if (userRes.error === 'Unauthorized') {
              // 持久化缓存不带用户作用域。退出登录后绝不能继续展示上个账号的项目。
              set((state) => ({
                userProjects: [],
                currentProject:
                  state.currentProject &&
                  !state.currentProject.isBuiltIn &&
                  !isLocalOnlyProject(state.currentProject)
                    ? null
                    : state.currentProject,
              }));
            }
            // 仅当非授权错误时才记录错误，避免未登录时的噪音
            if (userRes.error !== 'Unauthorized') {
              logger.error('获取用户项目列表失败', userRes.error);
            }
          }

          if (presetRes.success && presetRes.data) {
            const mappedPresets: ProjectConfig[] = presetRes.data.map((p) => {
              return {
                id: p.id,
                name: p.name,
                description: p.description ?? undefined,
                created: p.createdAt
                  ? new Date(p.createdAt).toISOString()
                  : new Date().toISOString(),
                lastModified: p.updatedAt
                  ? new Date(p.updatedAt).toISOString()
                  : new Date().toISOString(),
                metadata: p.metadata as Record<string, unknown>,
                schemaVersion: p.schemaVersion,
                revision: p.revision,
                data: undefined,
                isBuiltIn: true,
              };
            });
            set({ builtInProjects: mappedPresets });
          }

          const userError =
            !userRes.success && userRes.error !== 'Unauthorized'
              ? (userRes.error ?? 'Failed to fetch projects')
              : null;
          const presetError = !presetRes.success
            ? (presetRes.error ?? 'Failed to fetch presets')
            : null;
          const projectListError = resolveProjectListError(
            userError,
            presetError
          );

          set({
            projectListError,
            // 失败结果不能进入成功缓存，否则用户会在 TTL 内持续看到伪空状态。
            projectsLastFetchedAt: projectListError
              ? null
              : new Date().toISOString(),
          });
        } catch (error) {
          logger.error('获取项目列表异常', error);
          set({
            projectListError: 'projects-unavailable',
            projectsLastFetchedAt: null,
          });
        } finally {
          set({
            isLoading: false,
            isProjectListLoading: false,
          });
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
          set({
            isLoading: true,
            syncStatus: 'syncing-cloud',
            syncError: null,
          });

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
          // 手动保存也先落到 IndexedDB；网络错误或并发冲突不应丢失当前编辑。
          if (!(await get().saveLocalDraft(canvasData))) {
            return false;
          }
          const projectIdAtSaveStart = get().currentProject?.id;
          // 当前非预设项目始终按 ID 更新；改名不应隐式创建副本。
          let projectIdToUpdate: string | undefined = undefined;

          if (
            currentProject &&
            !currentProject.isBuiltIn &&
            !isLocalImportedProject(currentProject)
          ) {
            projectIdToUpdate = currentProject.id;
          }

          const result = await saveProject(name, dataToSave, {
            projectId: projectIdToUpdate,
            description,
            expectedRevision: projectIdToUpdate
              ? currentProject?.revision
              : undefined,
            metadata: currentProject?.metadata,
          });

          if (result.success && result.projectId) {
            // 保存成功，更新当前项目状态（包括 data，这里保持 string 格式以便本地缓存）
            const now = new Date().toISOString();

            // 重新获取列表以确保同步
            await get().fetchProjects({ force: true });

            // 更新 currentProject
            const newProjectConfig: ProjectConfig = {
              id: result.projectId,
              name,
              description,
              created:
                projectIdToUpdate && currentProject?.created
                  ? currentProject.created
                  : now,
              lastModified: now,
              data: canvasData, // 保持 string
              metadata: currentProject?.metadata,
              schemaVersion: currentProject?.schemaVersion ?? 1,
              revision: result.revision,
              isBuiltIn: false,
            };

            // 异步保存期间用户可能已切换项目；不要把旧请求的结果重新
            // 设为当前画布，但仍保留已成功写入云端的结果。
            if (get().currentProject?.id !== projectIdAtSaveStart) {
              set((state) => {
                const localDrafts = { ...state.localDrafts };
                if (currentProject) {
                  delete localDrafts[currentProject.id];
                }
                return { localDrafts };
              });
              return true;
            }

            set((state) => {
              const nextDrafts = { ...state.localDrafts };
              if (currentProject) {
                delete nextDrafts[currentProject.id];
              }
              delete nextDrafts[result.projectId!];
              return {
                currentProject: newProjectConfig,
                localDrafts: nextDrafts,
                syncStatus: 'saved-cloud',
                syncError: null,
                lastAutosavedAt: now,
              };
            });
            useFlowStore.getState().setCurrentProjectId(result.projectId);
            logger.success(`项目"${name}"保存成功`);
            return true;
          } else {
            logger.error('保存失败', result.error);
            set({
              syncStatus: isProjectConflict(result.error)
                ? 'conflict'
                : 'error',
              syncError: result.error ?? '保存失败；本地草稿已保留。',
            });
            return false;
          }
        } catch (error) {
          logger.error('保存画布失败', error);
          set({
            syncStatus: 'error',
            syncError: '保存失败；本地草稿已保留。',
          });
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      saveAsPreset: async (name: string, description?: string) => {
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
          const result = await saveProject(name, dataToSave, {
            isPreset: true,
            description,
          });

          if (result.success && result.projectId) {
            await get().fetchProjects({ force: true });
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
          const loadGeneration = ++projectLoadGeneration;
          const activeProject = get().currentProject;
          // 切换项目前先把正在编辑的画布写入本地草稿。水合出的缓存尚未
          // 导入画布时 currentProjectId 为空，不能用空画布覆盖它。
          if (
            activeProject &&
            useFlowStore.getState().currentProjectId === activeProject.id
          ) {
            if (!(await get().saveLocalDraft())) {
              return false;
            }
          }

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
                  description: res.data.description ?? undefined,
                  created: res.data.createdAt
                    ? new Date(res.data.createdAt).toISOString()
                    : new Date().toISOString(),
                  lastModified: res.data.updatedAt
                    ? new Date(res.data.updatedAt).toISOString()
                    : new Date().toISOString(),
                  isBuiltIn: res.data.isPreset,
                  metadata: res.data.metadata as Record<string, unknown>,
                  schemaVersion: res.data.schemaVersion,
                  revision: res.data.revision,
                  data:
                    typeof res.data.data === 'object'
                      ? JSON.stringify(res.data.data)
                      : String(res.data.data),
                };
              }
            }
          } else {
            projectConfig = projectOrId;
          }

          const requestedProjectId =
            typeof projectOrId === 'string' ? projectOrId : projectOrId.id;
          const localDraft = get().localDrafts[requestedProjectId];
          if (localDraft) {
            projectConfig = localDraft;
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

          logger.info(
            `加载项目: "${projectConfig.name}" (ID: ${projectConfig.id})`
          );
          set({ isLoading: true });

          // 如果没有数据（或者是用户项目，只有元数据），需要从 DB 获取
          let fullData = projectConfig.data;

          if (!fullData) {
            // 从 DB 获取详情
            const result = await getProjectById(projectConfig.id);
            if (result.success && result.data) {
              // DB 返回的 data 是 jsonb (object)
              // store 需要 string
              fullData = JSON.stringify(result.data.data);
              projectConfig = {
                ...projectConfig,
                description: result.data.description ?? undefined,
                metadata: result.data.metadata as Record<string, unknown>,
                schemaVersion: result.data.schemaVersion,
                revision: result.data.revision,
                lastModified: new Date(result.data.updatedAt).toISOString(),
              };
            } else {
              logger.error('无法从服务器获取项目详情', result.error);
              set({ isLoading: false });
              return false;
            }
          }

          if (loadGeneration !== projectLoadGeneration) {
            return false;
          }

          if (!fullData) {
            logger.error('项目数据为空');
            set({ isLoading: false });
            return false;
          }

          // 解析数据
          const jsonData = jsonUtils.restoreUrlSafeJson(fullData);
          const parseResult = validateAndParseJson(
            jsonData,
            validateSerializedCanvas
          );

          if (!parseResult.success) {
            logger.error('项目数据验证失败', parseResult.error);
            set({ isLoading: false });
            return false;
          }

          const success = useFlowStore
            .getState()
            .importCanvasFromJson(jsonData, projectConfig.id);

          if (success && loadGeneration === projectLoadGeneration) {
            set({
              currentProject: {
                ...projectConfig,
                data: jsonData, // 更新为完整数据
              },
              syncStatus: localDraft ? 'saved-local' : 'idle',
              syncError: null,
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
          if (builtInProjects.some((p) => p.id === projectId)) {
            logger.warn('无法删除内置项目');
            return false;
          }

          const result = await deleteProjectAction(projectId);
          if (result.success) {
            await get().fetchProjects({ force: true }); // 刷新列表

            const { currentProject } = get();
            if (currentProject?.id === projectId) {
              set((state) => {
                const localDrafts = { ...state.localDrafts };
                delete localDrafts[projectId];
                return { currentProject: null, localDrafts };
              });
              useFlowStore.getState().setCurrentProjectId('');
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

      exportProjectToFile: async (projectId: string) => {
        const { userProjects, builtInProjects, currentProject } = get();
        const project =
          (currentProject?.id === projectId ? currentProject : undefined) ??
          [...builtInProjects, ...userProjects].find(
            (candidate) => candidate.id === projectId
          );

        if (!project) {
          logger.error(`找不到要导出的项目: "${projectId}"`);
          return false;
        }

        let data = project.data;
        // 当前画布是唯一可信的实时副本；列表项只有元数据，需要取得详情。
        if (currentProject?.id === project.id) {
          data = useFlowStore.getState().exportCanvasToJson();
        } else if (!data) {
          const result = await getProjectById(project.id);
          if (!result.success || !result.data) {
            logger.error('导出项目详情失败', result.error);
            return false;
          }
          data = JSON.stringify(result.data.data);
        }

        try {
          const jsonData = jsonUtils.restoreUrlSafeJson(data);
          const parsed = validateAndParseJson(
            jsonData,
            validateSerializedCanvas
          );
          if (!parsed.success) {
            logger.error('导出项目数据验证失败', parsed.error);
            return false;
          }
          const dataBlob = new Blob([jsonData], { type: 'application/json' });
          const url = URL.createObjectURL(dataBlob);
          const filename = `synthesizerflow_${project.name}_${new Date().toISOString().slice(0, 10)}.json`;

          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          link.click();
          URL.revokeObjectURL(url);
          logger.success(`项目导出成功: ${filename}`);
          return true;
        } catch (error) {
          logger.error(`项目导出失败`, error);
          return false;
        }
      },

      importProjectFromJson: async (jsonData: string) => {
        try {
          const parseResult = validateAndParseJson(
            jsonData,
            validateSerializedCanvas
          );
          if (!parseResult.success) {
            logger.error('JSON数据验证失败', parseResult.error);
            return false;
          }

          const now = new Date().toISOString();
          const importedProject: ProjectConfig = {
            id: 'imported_' + nanoid(6),
            name: `导入的项目`,
            created: now,
            lastModified: now,
            data: jsonData,
            isBuiltIn: false,
            isLocalDraft: true,
          };

          const success = useFlowStore
            .getState()
            .importCanvasFromJson(jsonData, importedProject.id);
          if (success) {
            set((state) => ({
              currentProject: importedProject,
              localDrafts: {
                ...state.localDrafts,
                [importedProject.id]: importedProject,
              },
              syncStatus: 'saved-local',
              syncError: null,
              lastAutosavedAt: now,
            }));
            logger.success('项目导入成功，在保存前仅存在于本地');
            return true;
          }
          return false;
        } catch (error) {
          logger.error('导入失败', error);
          return false;
        }
      },
    }),
    {
      name: 'synthesizerflow-projects',
      // 持久化项目列表和当前项目，实现“本地缓存”
      partialize: (state) => ({
        currentProject: state.currentProject,
        localDrafts: state.localDrafts,
        userProjects: state.userProjects,
        builtInProjects: state.builtInProjects.map((project) => ({
          ...project,
          data: undefined,
        })),
        projectsLastFetchedAt: state.projectsLastFetchedAt,
      }),
      version: 4,
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState as ProjectPersistState;
        }

        const state = persistedState as Partial<ProjectPersistState>;
        return {
          ...state,
          localDrafts: state.localDrafts ?? {},
          builtInProjects: (state.builtInProjects ?? []).map((project) => ({
            ...project,
            data: undefined,
          })),
        } as ProjectPersistState;
      },
      storage: createJSONStorage(() =>
        getIndexedDbStorage({
          databaseName: 'synthesizerflow',
          storeName: 'project-cache',
          getFallbackStorage: () => window.localStorage,
        })
      ),
      onRehydrateStorage: () => (state) => {
        if (state) {
          logger.info('本地缓存已恢复');
          state.markProjectsHydrated();
          // 移除 state.fetchProjects()，由 UI 组件 (ProjectManager) 通过 useEffect 触发

          // 注意：自动恢复逻辑已下放至 Canvas 组件，以便与 URL 参数协调
        }
      },
    }
  )
);

// 为兼容性保留导出
export const usePersistStore = useProjectStore;
