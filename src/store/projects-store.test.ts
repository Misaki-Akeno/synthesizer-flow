import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moduleManager } from '@/core/services/ModuleManager';
import { moduleInitManager } from '@/core/services/ModuleInitManager';
import { useFlowStore } from './canvas-store';
import { useProjectStore } from './projects-store';
import {
  getBuiltInPresets,
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
  });
  useProjectStore.setState({
    userProjects: [],
    builtInProjects: [],
    currentProject: null,
    isLoading: false,
    isProjectListLoading: false,
    hasHydratedProjects: true,
    projectsLastFetchedAt: null,
  });
}

describe('project store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBuiltInPresets.mockResolvedValue({ success: true, data: [] });
    mockGetUserProjects.mockResolvedValue({ success: true, data: [] });
    mockSaveProject.mockResolvedValue({ success: true, projectId: 'saved-1' });
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
      undefined,
      false,
      undefined
    );
    expect(useProjectStore.getState().currentProject?.id).toBe('saved-1');
    expect(useFlowStore.getState().currentProjectId).toBe('saved-1');
  });
});
