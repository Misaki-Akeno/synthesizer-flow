import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moduleManager } from '@/core/services/ModuleManager';
import { moduleInitManager } from '@/core/services/ModuleInitManager';
import { useFlowStore } from './canvas-store';
import { useProjectStore } from './projects-store';
import {
  getBuiltInPresets,
  getProjectById,
  getUserProjects,
  saveProject,
} from '@/actions/project.actions';

vi.mock('@/actions/project.actions', () => ({
  deleteProjectAction: vi.fn(),
  getBuiltInPresets: vi.fn(),
  getProjectById: vi.fn(),
  getUserProjects: vi.fn(),
  saveProject: vi.fn(),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'abc123'),
}));

const memoryStorage = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

const mockGetBuiltInPresets = vi.mocked(getBuiltInPresets);
const mockGetProjectById = vi.mocked(getProjectById);
const mockGetUserProjects = vi.mocked(getUserProjects);
const mockSaveProject = vi.mocked(saveProject);

function resetStores(): void {
  moduleManager.disposeAllModules();
  moduleInitManager.reset();
  useProjectStore.persist.setOptions({
    storage: memoryStorage,
  });
  useFlowStore.setState({
    nodes: [],
    edges: [],
    currentProjectId: '',
    canUndo: false,
    canRedo: false,
    history: {
      past: [],
      future: [],
    },
  });
  useProjectStore.setState({
    userProjects: [],
    builtInProjects: [],
    currentProject: null,
    localDrafts: {},
    isLoading: false,
    isProjectListLoading: false,
    hasHydratedProjects: true,
    projectsLastFetchedAt: null,
    projectListError: null,
    syncStatus: 'idle',
    syncError: null,
    lastAutosavedAt: null,
  });
}

describe('project store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBuiltInPresets.mockResolvedValue({ success: true, data: [] });
    mockGetUserProjects.mockResolvedValue({ success: true, data: [] });
    mockSaveProject.mockResolvedValue({
      success: true,
      projectId: 'saved-1',
      revision: 1,
    });
    mockGetProjectById.mockResolvedValue({ success: false, error: 'missing' });
    resetStores();
  });

  it('caches empty project list fetches and allows forced refresh', async () => {
    await useProjectStore.getState().fetchProjects();

    expect(mockGetUserProjects).toHaveBeenCalledTimes(1);
    expect(mockGetBuiltInPresets).toHaveBeenCalledTimes(1);
    expect(useProjectStore.getState().projectsLastFetchedAt).toEqual(
      expect.any(String)
    );
    expect(useProjectStore.getState().isProjectListLoading).toBe(false);

    await useProjectStore.getState().fetchProjects();

    expect(mockGetUserProjects).toHaveBeenCalledTimes(1);
    expect(mockGetBuiltInPresets).toHaveBeenCalledTimes(1);

    await useProjectStore.getState().fetchProjects({ force: true });

    expect(mockGetUserProjects).toHaveBeenCalledTimes(2);
    expect(mockGetBuiltInPresets).toHaveBeenCalledTimes(2);
  });

  it('surfaces migration failures without caching a false empty result', async () => {
    mockGetBuiltInPresets.mockResolvedValue({
      success: false,
      error: 'PROJECT_DATABASE_MIGRATION_REQUIRED',
    });

    await useProjectStore.getState().fetchProjects();

    expect(useProjectStore.getState().projectListError).toBe(
      'database-migration-required'
    );
    expect(useProjectStore.getState().projectsLastFetchedAt).toBeNull();

    mockGetBuiltInPresets.mockResolvedValue({ success: true, data: [] });
    await useProjectStore.getState().fetchProjects();

    expect(mockGetBuiltInPresets).toHaveBeenCalledTimes(2);
    expect(useProjectStore.getState().projectListError).toBeNull();
    expect(useProjectStore.getState().projectsLastFetchedAt).toEqual(
      expect.any(String)
    );
  });

  it('keeps project and canvas ids aligned when importing a project JSON file', async () => {
    const canvas = JSON.stringify({
      version: '1.0',
      timestamp: Date.now(),
      nodes: [
        {
          id: 'number',
          position: { x: 0, y: 0 },
          data: {
            type: 'numberinput',
            label: 'Number',
            parameters: {
              value: 7,
            },
          },
        },
      ],
      edges: [],
    });

    const imported = await useProjectStore
      .getState()
      .importProjectFromJson(canvas);

    expect(imported).toBe(true);
    expect(useProjectStore.getState().currentProject?.id).toBe(
      'imported_abc123'
    );
    expect(useFlowStore.getState().currentProjectId).toBe('imported_abc123');
    expect(useFlowStore.getState().nodes.map((node) => node.id)).toEqual([
      'number',
    ]);
  });

  it('creates a new server project when saving an imported local project for the first time', async () => {
    const canvas = JSON.stringify({
      version: '1.0',
      timestamp: Date.now(),
      nodes: [
        {
          id: 'number',
          position: { x: 0, y: 0 },
          data: {
            type: 'numberinput',
            label: 'Number',
            parameters: {
              value: 7,
            },
          },
        },
      ],
      edges: [],
    });

    await useProjectStore.getState().importProjectFromJson(canvas);

    const saved = await useProjectStore
      .getState()
      .saveCurrentCanvas('导入的项目');

    expect(saved).toBe(true);
    expect(mockSaveProject).toHaveBeenCalledWith(
      '导入的项目',
      expect.objectContaining({
        version: '1.0',
      }),
      {
        projectId: undefined,
        description: undefined,
        expectedRevision: undefined,
        metadata: undefined,
      }
    );
    expect(useProjectStore.getState().currentProject?.id).toBe('saved-1');
    expect(useFlowStore.getState().currentProjectId).toBe('saved-1');
  });

  it('updates the same server project when its name changes', async () => {
    const created = '2026-01-01T00:00:00.000Z';
    mockSaveProject.mockResolvedValue({
      success: true,
      projectId: 'existing-1',
      revision: 2,
    });
    useProjectStore.setState({
      currentProject: {
        id: 'existing-1',
        name: '旧名称',
        created,
        lastModified: created,
        data: useFlowStore.getState().exportCanvasToJson(),
        revision: 1,
        isBuiltIn: false,
      },
    });

    const saved = await useProjectStore
      .getState()
      .saveCurrentCanvas('新名称', '更新描述');

    expect(saved).toBe(true);
    expect(mockSaveProject).toHaveBeenCalledWith(
      '新名称',
      expect.objectContaining({
        version: '1.0',
      }),
      {
        projectId: 'existing-1',
        description: '更新描述',
        expectedRevision: 1,
        metadata: undefined,
      }
    );
    expect(useProjectStore.getState().currentProject).toEqual(
      expect.objectContaining({
        id: 'existing-1',
        name: '新名称',
        created,
      })
    );
  });

  it('keeps a local draft for an unnamed canvas and round-trips its JSON', async () => {
    const canvas = useFlowStore.getState().exportCanvasToJson();

    await expect(
      useProjectStore.getState().saveLocalDraft(canvas)
    ).resolves.toBe(true);

    const project = useProjectStore.getState().currentProject;
    expect(project).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^draft_/),
        isLocalDraft: true,
        data: canvas,
      })
    );
    expect(useProjectStore.getState().localDrafts[project!.id]?.data).toBe(
      canvas
    );
  });

  it('exports a list entry by id after fetching its full JSON', async () => {
    const canvas = useFlowStore.getState().exportCanvasToJson();
    useProjectStore.setState({
      userProjects: [
        {
          id: 'remote-1',
          name: 'Remote project',
          created: '2026-01-01T00:00:00.000Z',
          lastModified: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    mockGetProjectById.mockResolvedValue({
      success: true,
      data: {
        id: 'remote-1',
        data: JSON.parse(canvas),
      },
    } as Awaited<ReturnType<typeof getProjectById>>);
    const createObjectURL = vi.fn(() => 'blob:project');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const click = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      click,
    } as unknown as HTMLAnchorElement);

    await expect(
      useProjectStore.getState().exportProjectToFile('remote-1')
    ).resolves.toBe(true);

    expect(mockGetProjectById).toHaveBeenCalledWith('remote-1');
    expect(click).toHaveBeenCalledOnce();
  });
});
