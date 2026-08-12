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
import { getIndexedDbStorage } from './persist-storage';
import { ensureAudioContextReady } from '@/core/audio/audio-context';
import { audioGraphRuntime } from '@/core/runtime/AudioGraphRuntime';
import { normalizeTransportDocument } from '@/core/transport/automation';

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
}

export interface FetchProjectsOptions {
  force?: boolean;
}

export type ProjectListErrorCode =
  | 'database-migration-required'
  | 'user-projects-unavailable'
  | 'built-in-projects-unavailable'
  | 'projects-unavailable';

export type ProjectSaveStatus =
  | 'idle'
  | 'dirty'
  | 'saving'
  | 'saved'
  | 'conflict'
  | 'error';

export interface LocalProjectDraft {
  id: string;
  projectId: string;
  projectName: string;
  canvasData: string;
  savedAt: string;
  baseRevision?: number;
}

export interface ProjectSaveConflict {
  detectedAt: string;
  message: string;
  localDraft: LocalProjectDraft;
  remoteProject: ProjectConfig | null;
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
  isProjectListLoading: boolean;
  hasHydratedProjects: boolean;
  projectsLastFetchedAt: string | null;
  projectListError: ProjectListErrorCode | null;
  saveStatus: ProjectSaveStatus;
  lastLocalSaveAt: string | null;
  localDraft: LocalProjectDraft | null;
  draftHistory: LocalProjectDraft[];
  recoveryDraftAvailable: boolean;
  saveConflict: ProjectSaveConflict | null;

  // 动作
  fetchProjects: (options?: FetchProjectsOptions) => Promise<void>;
  markProjectsHydrated: () => void;

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
  captureLocalDraft: () => void;
  restoreLocalDraft: (draftId?: string) => boolean;
  discardLocalDraft: () => void;
  reloadConflictRemote: () => boolean;
  saveConflictAsCopy: () => Promise<boolean>;
  flagDraftForRecovery: () => void;
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

export function getCanvasDataSignature(canvasData: string): string {
  try {
    const parsed = JSON.parse(canvasData) as {
      nodes?: unknown;
      edges?: unknown;
      metadata?: unknown;
    };
    const metadata =
      parsed.metadata &&
      typeof parsed.metadata === 'object' &&
      !Array.isArray(parsed.metadata)
        ? (parsed.metadata as Record<string, unknown>)
        : {};
    const { transport, subpatches, ...extraMetadata } = metadata;
    return JSON.stringify({
      nodes: parsed.nodes ?? [],
      edges: parsed.edges ?? [],
      metadata: {
        ...extraMetadata,
        transport: normalizeTransportDocument(transport),
        subpatches: Array.isArray(subpatches) ? subpatches : [],
      },
    });
  } catch {
    return canvasData;
  }
}

const PROJECT_LIST_CACHE_TTL_MS = 60_000;
const PROJECT_DATABASE_MIGRATION_REQUIRED =
  'PROJECT_DATABASE_MIGRATION_REQUIRED';
const LOCAL_DRAFT_HISTORY_LIMIT = 10;
const LOCAL_DRAFT_COALESCE_MS = 30_000;

interface ProjectActionData {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  isPreset: boolean;
  metadata: unknown;
  schemaVersion: number;
  revision: number;
  data: unknown;
}

function toProjectConfig(project: ProjectActionData): ProjectConfig {
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? undefined,
    created: new Date(project.createdAt).toISOString(),
    lastModified: new Date(project.updatedAt).toISOString(),
    isBuiltIn: project.isPreset,
    metadata: project.metadata as Record<string, unknown>,
    schemaVersion: project.schemaVersion,
    revision: project.revision,
    data:
      typeof project.data === 'object'
        ? JSON.stringify(project.data)
        : String(project.data),
  };
}

function appendDraftVersion(
  history: LocalProjectDraft[],
  draft: LocalProjectDraft
): LocalProjectDraft[] {
  const previous = history[history.length - 1];
  if (
    previous &&
    getCanvasDataSignature(previous.canvasData) ===
      getCanvasDataSignature(draft.canvasData)
  ) {
    return history;
  }

  const shouldCoalesce =
    previous?.projectId === draft.projectId &&
    new Date(draft.savedAt).getTime() - new Date(previous.savedAt).getTime() <
      LOCAL_DRAFT_COALESCE_MS;
  const next = shouldCoalesce
    ? [...history.slice(0, -1), draft]
    : [...history, draft];
  return next.slice(-LOCAL_DRAFT_HISTORY_LIMIT);
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
      isLoading: false,
      isProjectListLoading: false,
      hasHydratedProjects: false,
      projectsLastFetchedAt: null,
      projectListError: null,
      saveStatus: 'idle',
      lastLocalSaveAt: null,
      localDraft: null,
      draftHistory: [],
      recoveryDraftAvailable: false,
      saveConflict: null,

      markProjectsHydrated: () => {
        set({ hasHydratedProjects: true });
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
          set({ isLoading: true, saveStatus: 'saving' });

          // 获取当前画布的JSON
          const canvasData = useFlowStore.getState().exportCanvasToJson();
          // 注意：canvasData 是 string。DB 需要 object。
          // 我们尝试解析它成对象传递给 Server Action
          let dataToSave;
          try {
            dataToSave = JSON.parse(canvasData);
          } catch (e) {
            logger.error('Canvas data parse error', e);
            set({ saveStatus: 'error' });
            return false;
          }

          const { currentProject } = get();
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
          const resultError =
            'error' in result ? result.error : 'Unknown save error';

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

            set({ currentProject: newProjectConfig });
            set({
              localDraft: null,
              draftHistory: get().draftHistory.map((draft) =>
                currentProject && draft.projectId === currentProject.id
                  ? {
                      ...draft,
                      projectId: result.projectId as string,
                      projectName: name,
                      baseRevision: result.revision,
                    }
                  : draft
              ),
              recoveryDraftAvailable: false,
              saveConflict: null,
              saveStatus: 'saved',
              lastLocalSaveAt: now,
            });
            useFlowStore.getState().setCurrentProjectId(result.projectId);
            logger.success(`项目"${name}"保存成功`);
            return true;
          } else {
            const isRevisionConflict =
              'code' in result &&
              result.code === 'PROJECT_REVISION_CONFLICT' &&
              Boolean(projectIdToUpdate && currentProject);
            if (isRevisionConflict && projectIdToUpdate && currentProject) {
              get().captureLocalDraft();
              const localDraft = get().localDraft;
              const remoteResult = await getProjectById(projectIdToUpdate);
              const remoteProject =
                remoteResult.success && remoteResult.data
                  ? toProjectConfig(remoteResult.data as ProjectActionData)
                  : null;
              if (localDraft) {
                set({
                  saveStatus: 'conflict',
                  recoveryDraftAvailable: false,
                  saveConflict: {
                    detectedAt: new Date().toISOString(),
                    message:
                      resultError ??
                      'Project was modified elsewhere. Reload and try again.',
                    localDraft,
                    remoteProject,
                  },
                });
              }
            } else {
              set({ saveStatus: 'error' });
            }
            logger.error('保存失败', resultError);
            return false;
          }
        } catch (error) {
          logger.error('保存画布失败', error);
          set({ saveStatus: 'error' });
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
          const resultError =
            'error' in result ? result.error : 'Unknown save error';

          if (result.success && result.projectId) {
            await get().fetchProjects({ force: true });
            logger.success(`预设"${name}"保存成功`);
            return true;
          } else {
            logger.error('保存预设失败', resultError);
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
        // 如果调用来自点击，必须在第一个异步数据库请求前消费用户手势。
        const audioReady = ensureAudioContextReady();
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

          if (success) {
            set({
              currentProject: {
                ...projectConfig,
                data: jsonData, // 更新为完整数据
              },
            });
            if (await audioReady) {
              audioGraphRuntime.activateOutputModules();
            }
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
              set({ currentProject: null });
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

      exportProjectToFile: (projectIdOrName: string) => {
        // 支持根据 ID 或 Name 查找
        const { userProjects, builtInProjects, currentProject } = get();
        const allProject = [...builtInProjects, ...userProjects];
        if (currentProject) allProject.push(currentProject);

        // 优先匹配 ID，其次匹配 Name
        const project =
          allProject.find((p) => p.id === projectIdOrName) ||
          allProject.find((p) => p.name === projectIdOrName);

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
          };

          const success = useFlowStore
            .getState()
            .importCanvasFromJson(jsonData, importedProject.id);
          if (success) {
            set({
              currentProject: importedProject,
              saveStatus: 'dirty',
            });
            logger.success('项目导入成功，在保存前仅存在于本地');
            return true;
          }
          return false;
        } catch (error) {
          logger.error('导入失败', error);
          return false;
        }
      },

      captureLocalDraft: () => {
        const canvasData = useFlowStore.getState().exportCanvasToJson();
        const { currentProject, localDraft, draftHistory } = get();
        const projectId =
          currentProject?.id ||
          useFlowStore.getState().currentProjectId ||
          'untitled';

        if (
          currentProject?.data &&
          getCanvasDataSignature(currentProject.data) ===
            getCanvasDataSignature(canvasData)
        ) {
          set({
            localDraft: localDraft?.projectId === projectId ? null : localDraft,
            saveStatus: 'saved',
            recoveryDraftAvailable: false,
          });
          return;
        }
        if (
          localDraft?.projectId === projectId &&
          getCanvasDataSignature(localDraft.canvasData) ===
            getCanvasDataSignature(canvasData)
        ) {
          return;
        }

        const savedAt = new Date().toISOString();
        const draft: LocalProjectDraft = {
          id: `draft_${Date.now()}_${nanoid(6)}`,
          projectId,
          projectName: currentProject?.name ?? '未命名工程',
          canvasData,
          savedAt,
          baseRevision: currentProject?.revision,
        };
        set({
          localDraft: draft,
          draftHistory: appendDraftVersion(draftHistory, draft),
          lastLocalSaveAt: savedAt,
          saveStatus: 'dirty',
          recoveryDraftAvailable: false,
        });
      },

      restoreLocalDraft: (draftId) => {
        const draft = draftId
          ? get().draftHistory.find((item) => item.id === draftId)
          : get().localDraft;
        if (!draft) return false;
        const restored = useFlowStore
          .getState()
          .importCanvasFromJson(draft.canvasData, draft.projectId);
        if (!restored) return false;

        const currentProject = get().currentProject;
        set({
          currentProject:
            currentProject?.id === draft.projectId
              ? currentProject
              : {
                  id: draft.projectId,
                  name: draft.projectName,
                  created: draft.savedAt,
                  lastModified: draft.savedAt,
                  revision: draft.baseRevision,
                  isBuiltIn: false,
                },
          localDraft: draft,
          recoveryDraftAvailable: false,
          saveConflict: null,
          saveStatus: 'dirty',
        });
        return true;
      },

      discardLocalDraft: () => {
        set({
          localDraft: null,
          recoveryDraftAvailable: false,
          saveConflict: null,
          saveStatus: 'saved',
        });
      },

      reloadConflictRemote: () => {
        const remote = get().saveConflict?.remoteProject;
        if (!remote?.data) return false;
        const restored = useFlowStore
          .getState()
          .importCanvasFromJson(remote.data, remote.id);
        if (!restored) return false;
        set({
          currentProject: remote,
          localDraft: null,
          recoveryDraftAvailable: false,
          saveConflict: null,
          saveStatus: 'saved',
        });
        return true;
      },

      saveConflictAsCopy: async () => {
        const conflict = get().saveConflict;
        if (!conflict) return false;
        set({ isLoading: true, saveStatus: 'saving' });
        try {
          const data = JSON.parse(conflict.localDraft.canvasData) as unknown;
          const copyName = `${conflict.localDraft.projectName}（冲突副本）`;
          const result = await saveProject(copyName, data, {
            metadata: conflict.remoteProject?.metadata,
          });
          if (!result.success || !result.projectId) {
            set({ saveStatus: 'error' });
            return false;
          }
          const now = new Date().toISOString();
          const project: ProjectConfig = {
            id: result.projectId,
            name: copyName,
            created: now,
            lastModified: now,
            data: conflict.localDraft.canvasData,
            metadata: conflict.remoteProject?.metadata,
            schemaVersion: conflict.remoteProject?.schemaVersion ?? 1,
            revision: result.revision,
            isBuiltIn: false,
          };
          await get().fetchProjects({ force: true });
          useFlowStore.getState().setCurrentProjectId(result.projectId);
          set({
            currentProject: project,
            localDraft: null,
            recoveryDraftAvailable: false,
            saveConflict: null,
            saveStatus: 'saved',
            lastLocalSaveAt: now,
          });
          return true;
        } catch (error) {
          logger.error('保存冲突副本失败', error);
          set({ saveStatus: 'error' });
          return false;
        } finally {
          set({ isLoading: false });
        }
      },

      flagDraftForRecovery: () => {
        set({ recoveryDraftAvailable: Boolean(get().localDraft) });
      },
    }),
    {
      name: 'synthesizerflow-projects',
      // 持久化项目列表和当前项目，实现“本地缓存”
      partialize: (state) => ({
        currentProject: state.currentProject,
        userProjects: state.userProjects,
        builtInProjects: state.builtInProjects.map((project) => ({
          ...project,
          data: undefined,
        })),
        projectsLastFetchedAt: state.projectsLastFetchedAt,
        localDraft: state.localDraft,
        draftHistory: state.draftHistory,
        lastLocalSaveAt: state.lastLocalSaveAt,
        saveConflict: state.saveConflict,
      }),
      version: 4,
      migrate: (persistedState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return persistedState as ProjectPersistState;
        }

        const state = persistedState as Partial<ProjectPersistState>;
        return {
          ...state,
          builtInProjects: (state.builtInProjects ?? []).map((project) => ({
            ...project,
            data: undefined,
          })),
          localDraft: state.localDraft ?? null,
          draftHistory: state.draftHistory ?? [],
          lastLocalSaveAt: state.lastLocalSaveAt ?? null,
          saveConflict: state.saveConflict ?? null,
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
          state.flagDraftForRecovery();
          // 移除 state.fetchProjects()，由 UI 组件 (ProjectManager) 通过 useEffect 触发

          // 注意：自动恢复逻辑已下放至 Canvas 组件，以便与 URL 参数协调
        }
      },
    }
  )
);

// 为兼容性保留导出
export const usePersistStore = useProjectStore;
