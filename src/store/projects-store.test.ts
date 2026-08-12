import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moduleInitManager } from '@/core/services/ModuleInitManager';
import { audioGraphController } from '@/core/runtime/AudioGraphController';
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
  audioGraphController.reset();
  moduleInitManager.reset();
  useProjectStore.persist.setOptions({
    storage: memoryStorage,
  });
  useFlowStore.setState({
    nodes: [],
    edges: [],
    currentProjectId: '',
    subpatches: [],
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
    isLoading: false,
    isProjectListLoading: false,
    hasHydratedProjects: true,
    projectsLastFetchedAt: null,
    projectListError: null,
    saveStatus: 'idle',
    lastLocalSaveAt: null,
    localDraft: null,
    draftHistory: [],
    recoveryDraftAvailable: false,
    saveConflict: null,
  });
}

describe('project store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBuiltInPresets.mockResolvedValue({ success: true, data: [] });
    mockGetUserProjects.mockResolvedValue({ success: true, data: [] });
    mockGetProjectById.mockResolvedValue({
      success: false,
      error: 'Project not found',
    });
    mockSaveProject.mockResolvedValue({
      success: true,
      projectId: 'saved-1',
      revision: 1,
    });
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
        version: '2.0',
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
        version: '2.0',
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

  it('captures and restores a local canvas draft without touching the server', () => {
    const baseline = useFlowStore.getState().exportCanvasToJson();
    useProjectStore.setState({
      currentProject: {
        id: 'draft-project',
        name: 'Draft Project',
        created: '2026-01-01T00:00:00.000Z',
        lastModified: '2026-01-01T00:00:00.000Z',
        data: baseline,
        revision: 3,
      },
    });
    useFlowStore
      .getState()
      .addNode('numberinput', 'Number', { x: 0, y: 0 }, 'number');

    useProjectStore.getState().captureLocalDraft();
    const draft = useProjectStore.getState().localDraft;

    expect(draft).toEqual(
      expect.objectContaining({
        projectId: 'draft-project',
        projectName: 'Draft Project',
        baseRevision: 3,
      })
    );
    expect(useProjectStore.getState().draftHistory).toHaveLength(1);
    expect(useProjectStore.getState().saveStatus).toBe('dirty');

    useFlowStore.getState().deleteNode('number');
    expect(useProjectStore.getState().restoreLocalDraft(draft?.id)).toBe(true);
    expect(useFlowStore.getState().nodes.map((node) => node.id)).toEqual([
      'number',
    ]);
    expect(mockSaveProject).not.toHaveBeenCalled();
  });

  it('does not create a draft for timestamp and default-metadata migrations', () => {
    useProjectStore.setState({
      currentProject: {
        id: 'legacy-project',
        name: 'Legacy Project',
        created: '2026-01-01T00:00:00.000Z',
        lastModified: '2026-01-01T00:00:00.000Z',
        data: JSON.stringify({
          version: '1.0',
          timestamp: 1,
          nodes: [],
          edges: [],
        }),
        revision: 1,
      },
    });

    useProjectStore.getState().captureLocalDraft();

    expect(useProjectStore.getState().localDraft).toBeNull();
    expect(useProjectStore.getState().draftHistory).toEqual([]);
    expect(useProjectStore.getState().saveStatus).toBe('saved');
  });

  it('preserves both sides of a revision conflict and can reload remote', async () => {
    const baseline = useFlowStore.getState().exportCanvasToJson();
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    useProjectStore.setState({
      currentProject: {
        id: 'shared-project',
        name: 'Shared Project',
        created: createdAt.toISOString(),
        lastModified: createdAt.toISOString(),
        data: baseline,
        revision: 1,
      },
    });
    useFlowStore
      .getState()
      .addNode('numberinput', 'Local Number', { x: 0, y: 0 }, 'local-number');
    mockSaveProject.mockResolvedValueOnce({
      success: false,
      code: 'PROJECT_REVISION_CONFLICT',
      error: 'Project was modified elsewhere. Reload and try again.',
    });
    mockGetProjectById.mockResolvedValueOnce({
      success: true,
      data: {
        id: 'shared-project',
        name: 'Shared Project',
        description: null,
        createdAt,
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        isPreset: false,
        metadata: {},
        schemaVersion: 1,
        revision: 2,
        data: JSON.parse(baseline),
      },
    });

    const saved = await useProjectStore
      .getState()
      .saveCurrentCanvas('Shared Project');

    expect(saved).toBe(false);
    expect(useProjectStore.getState().saveStatus).toBe('conflict');
    expect(useProjectStore.getState().saveConflict).toEqual(
      expect.objectContaining({
        localDraft: expect.objectContaining({
          canvasData: expect.stringContaining('local-number'),
        }),
        remoteProject: expect.objectContaining({ revision: 2 }),
      })
    );

    expect(useProjectStore.getState().reloadConflictRemote()).toBe(true);
    expect(useFlowStore.getState().nodes).toEqual([]);
    expect(useProjectStore.getState().saveConflict).toBeNull();
    expect(useProjectStore.getState().draftHistory).toHaveLength(1);
  });
});
