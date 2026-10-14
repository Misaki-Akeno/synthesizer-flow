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
    projectOwnerId: 'user-1',
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

  it('creates a cloud project when an unnamed canvas already has a local draft', async () => {
    await useProjectStore.getState().saveLocalDraft();
    const draftId = useProjectStore.getState().currentProject!.id;

    await expect(
      useProjectStore.getState().saveCurrentCanvas('First cloud save')
    ).resolves.toBe(true);

    expect(mockSaveProject).toHaveBeenCalledWith(
      'First cloud save', expect.any(Object),
      expect.objectContaining({ projectId: undefined, expectedRevision: undefined })
    );
    expect(useProjectStore.getState().currentProject?.id).toBe('saved-1');
    expect(useProjectStore.getState().localDrafts[draftId]).toBeUndefined();
  });

  it.each([false, true])(
    'retains newer drafts during a first manual cloud save (switched=%s)',
    async (switchProject) => {
      let finishSave!: (value: Awaited<ReturnType<typeof saveProject>>) => void;
      let requestStarted!: () => void;
      const started = new Promise<void>((resolve) => { requestStarted = resolve; });
      mockSaveProject.mockImplementationOnce(() => {
        requestStarted();
        return new Promise((resolve) => { finishSave = resolve; });
      });
      const saving = useProjectStore.getState().saveCurrentCanvas('New cloud project');
      await started;
      const oldId = useProjectStore.getState().currentProject!.id;
      const newerData = JSON.stringify({ editedDuringSave: true });
      await useProjectStore.getState().saveLocalDraft(newerData);
      const otherProject = {
        id: 'other', name: 'Other', created: '', lastModified: '',
      };
      if (switchProject) {
        useProjectStore.setState({ currentProject: otherProject });
        useFlowStore.getState().setCurrentProjectId('other');
      }
      finishSave({ success: true, projectId: 'saved-1', revision: 1 });
      await expect(saving).resolves.toBe(true);

      expect(useProjectStore.getState().localDrafts['saved-1']).toEqual(
        expect.objectContaining({ data: newerData, revision: 1, id: 'saved-1' })
      );
      expect(useProjectStore.getState().localDrafts[oldId]).toBeUndefined();
      expect(useProjectStore.getState().currentProject?.id).toBe(
        switchProject ? 'other' : 'saved-1'
      );
      if (!switchProject) {
        expect(useProjectStore.getState().currentProject?.data).toBe(newerData);
        expect(useProjectStore.getState().syncStatus).toBe('saved-local');
      }
    }
  );

  it('rebases newer drafts and serializes manual saves behind cloud autosaves', async () => {
    const project = {
      id: 'remote', name: 'Remote', created: '', lastModified: '',
      data: JSON.stringify({ original: true }), revision: 1,
    };
    useProjectStore.setState({ currentProject: project, localDrafts: { remote: project } });
    let finishSave!: (value: Awaited<ReturnType<typeof saveProject>>) => void;
    mockSaveProject.mockImplementationOnce(() => new Promise((resolve) => {
      finishSave = resolve;
    }));
    const syncing = useProjectStore.getState().syncCurrentProjectDraft('remote');
    await useProjectStore.getState().saveLocalDraft(JSON.stringify({ newer: true }));
    const saving = useProjectStore.getState().saveCurrentCanvas('Renamed');
    expect(mockSaveProject).toHaveBeenCalledTimes(1);
    mockSaveProject.mockResolvedValue({ success: true, projectId: 'remote', revision: 3 });
    finishSave({ success: true, projectId: 'remote', revision: 2 });
    await syncing;
    await saving;
    expect(mockSaveProject.mock.calls[1][2]?.expectedRevision).toBe(2);
  });

  it('uses the advanced revision for the next automatic save of a newer draft', async () => {
    const project = {
      id: 'remote', name: 'Remote', created: '', lastModified: '',
      data: JSON.stringify({ original: true }), revision: 1,
    };
    useProjectStore.setState({ currentProject: project, localDrafts: { remote: project } });
    let finishSave!: (value: Awaited<ReturnType<typeof saveProject>>) => void;
    mockSaveProject.mockImplementationOnce(() => new Promise((resolve) => {
      finishSave = resolve;
    }));
    const syncing = useProjectStore.getState().syncCurrentProjectDraft('remote');
    await useProjectStore.getState().saveLocalDraft(JSON.stringify({ newer: true }));
    finishSave({ success: true, projectId: 'remote', revision: 2 });
    await syncing;
    expect(useProjectStore.getState().localDrafts.remote.revision).toBe(2);
    mockSaveProject.mockResolvedValue({ success: true, projectId: 'remote', revision: 3 });
    await useProjectStore.getState().syncCurrentProjectDraft('remote');
    expect(mockSaveProject.mock.calls[1][2]?.expectedRevision).toBe(2);
    expect(mockSaveProject.mock.calls[1][1]).toEqual({ newer: true });
  });

  it('waits for a draft to receive its cloud ID before syncing edits made during creation', async () => {
    let finishSave!: (value: Awaited<ReturnType<typeof saveProject>>) => void;
    let started!: () => void;
    const requestStarted = new Promise<void>((resolve) => { started = resolve; });
    mockSaveProject.mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => { finishSave = resolve; });
    });
    mockSaveProject.mockResolvedValue({ success: true, projectId: 'cloud', revision: 2 });
    const saving = useProjectStore.getState().saveCurrentCanvas('First save');
    await requestStarted;
    const draftId = useProjectStore.getState().currentProject!.id;
    await useProjectStore.getState().saveLocalDraft(JSON.stringify({ newer: true }));
    const syncing = useProjectStore.getState().syncCurrentProjectDraft(draftId);
    expect(mockSaveProject).toHaveBeenCalledTimes(1);
    finishSave({ success: true, projectId: 'cloud', revision: 1 });
    await saving;
    await syncing;
    expect(mockSaveProject).toHaveBeenCalledTimes(2);
    expect(mockSaveProject.mock.calls[1][1]).toEqual({ newer: true });
    expect(mockSaveProject.mock.calls[1][2]).toMatchObject({ projectId: 'cloud', expectedRevision: 1 });
    expect(useProjectStore.getState().syncStatus).toBe('saved-cloud');
  });

  it('does not leave manual-save status syncing when the project changes while waiting for a lock', async () => {
    const project = { id: 'remote', name: 'Remote', created: '', lastModified: '', data: '{}', revision: 1 };
    useProjectStore.setState({ currentProject: project, localDrafts: { remote: project } });
    let finishSave!: (value: Awaited<ReturnType<typeof saveProject>>) => void;
    mockSaveProject.mockImplementationOnce(() => new Promise((resolve) => { finishSave = resolve; }));
    const syncing = useProjectStore.getState().syncCurrentProjectDraft('remote');
    const saving = useProjectStore.getState().saveCurrentCanvas('Old name');
    useProjectStore.setState({ currentProject: { ...project, id: 'other' }, syncStatus: 'idle' });
    finishSave({ success: true, projectId: 'remote', revision: 2 });
    await syncing;
    await expect(saving).resolves.toBe(false);
    expect(useProjectStore.getState().syncStatus).not.toBe('syncing-cloud');
    expect(useProjectStore.getState().currentProject?.id).toBe('other');
    expect(mockSaveProject).toHaveBeenCalledTimes(1);
  });

  it('does not create a draft when switching away from unchanged content', async () => {
    const data = useFlowStore.getState().exportCanvasToJson();
    const project = { id: 'remote', name: 'Remote', created: '', lastModified: '', data, revision: 1 };
    useProjectStore.setState({ currentProject: project });
    useFlowStore.getState().setCurrentProjectId('remote');
    await useProjectStore.getState().loadProject({ ...project, id: 'local', isLocalDraft: true });
    expect(useProjectStore.getState().localDrafts.remote).toBeUndefined();
  });

  it('preserves a divergent draft and reports a cloud revision conflict instead of loading it silently', async () => {
    const data = useFlowStore.getState().exportCanvasToJson();
    const project = { id: 'remote', name: 'Remote', created: '', lastModified: '', data, revision: 1 };
    useProjectStore.setState({ localDrafts: { remote: project }, userProjects: [project] });
    mockGetProjectById.mockResolvedValue({ success: true, data: {
      id: project.id, name: project.name, description: null, isPreset: false,
      data: { ...JSON.parse(data), metadata: { note: 'cloud edit' } },
      metadata: {}, schemaVersion: 1, revision: 2,
      createdAt: new Date(), updatedAt: new Date(),
    } } as Awaited<ReturnType<typeof getProjectById>>);
    await expect(useProjectStore.getState().loadProject('remote')).resolves.toBe(false);
    expect(useProjectStore.getState().syncStatus).toBe('conflict');
    expect(useProjectStore.getState().localDrafts.remote).toEqual(project);
    expect(useFlowStore.getState().currentProjectId).toBe('');
  });

  it('clears account-owned drafts on logout and ignores an in-flight save from that account', async () => {
    const project = { id: 'remote', name: 'Private', created: '', lastModified: '', data: '{}', revision: 1 };
    useProjectStore.setState({ projectOwnerId: 'user-1', currentProject: project, localDrafts: { remote: project } });
    let finishSave!: (value: Awaited<ReturnType<typeof saveProject>>) => void;
    mockSaveProject.mockImplementationOnce(() => new Promise((resolve) => { finishSave = resolve; }));
    const syncing = useProjectStore.getState().syncCurrentProjectDraft('remote');
    await useProjectStore.getState().setProjectOwner(null);
    finishSave({ success: true, projectId: 'remote', revision: 2 });
    await syncing;
    expect(useProjectStore.getState().currentProject).toBeNull();
    expect(useProjectStore.getState().localDrafts).toEqual({});
    expect(useFlowStore.getState().currentProjectId).toBe('');
    expect(memoryStorage.setItem).toHaveBeenLastCalledWith(
      'synthesizerflow-projects', expect.objectContaining({ state: expect.objectContaining({
        projectOwnerId: null, localDrafts: {}, currentProject: null,
      }) })
    );
  });

  it.each([
    ['a cache written before ownership existed', undefined],
    ['anonymous drafts after signing in', null],
  ] as const)('claims %s instead of clearing it', async (_label, previousOwner) => {
    const project = { id: 'draft_1', name: 'Draft', created: '', lastModified: '', data: '{}', isLocalDraft: true };
    useProjectStore.setState({ projectOwnerId: previousOwner, currentProject: project, localDrafts: { draft_1: project } });
    useFlowStore.getState().setCurrentProjectId('draft_1');

    await useProjectStore.getState().setProjectOwner('user-2');

    expect(useProjectStore.getState().projectOwnerId).toBe('user-2');
    expect(useProjectStore.getState().localDrafts).toEqual({ draft_1: project });
    expect(useProjectStore.getState().currentProject).toEqual(project);
    expect(useFlowStore.getState().currentProjectId).toBe('draft_1');
  });

  it('clears the cache when a different account signs in', async () => {
    const project = { id: 'remote', name: 'Private', created: '', lastModified: '', data: '{}', revision: 1 };
    useProjectStore.setState({ currentProject: project, localDrafts: { remote: project } });

    await useProjectStore.getState().setProjectOwner('user-2');

    expect(useProjectStore.getState().projectOwnerId).toBe('user-2');
    expect(useProjectStore.getState().localDrafts).toEqual({});
    expect(useProjectStore.getState().currentProject).toBeNull();
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
