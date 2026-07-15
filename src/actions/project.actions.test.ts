import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteProjectAction,
  getProjectById,
  saveProject,
} from './project.actions';
import { auth } from '@/lib/auth/auth';

const mockDbState = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
  insertValues: [] as unknown[],
  updateSets: [] as unknown[],
  updateResults: [[{ revision: 2 }]] as unknown[][],
  deleteCalls: 0,
}));

const mockDb = vi.hoisted(() => {
  const createSelectChain = (result: unknown[]) => {
    const chain: Record<string, unknown> = {};
    chain.from = vi.fn(() => chain);
    chain.innerJoin = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(async () => result);
    chain.limit = vi.fn(async () => result);
    return chain;
  };

  const db = {
    select: vi.fn(() =>
      createSelectChain(mockDbState.selectResults.shift() ?? [])
    ),
    insert: vi.fn(() => ({
      values: vi.fn(async (value: unknown) => {
        mockDbState.insertValues.push(value);
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((value: unknown) => {
        mockDbState.updateSets.push(value);
        const result = mockDbState.updateResults.shift() ?? [];
        return {
          where: vi.fn(() => ({
            returning: vi.fn(async () => result),
          })),
        };
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        mockDbState.deleteCalls += 1;
      }),
    })),
    transaction: vi.fn(),
  };

  db.transaction.mockImplementation(
    async (callback: (tx: typeof db) => Promise<unknown>) => callback(db)
  );
  return db;
});

vi.mock('@/lib/auth/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/db/client', () => ({
  db: mockDb,
}));

vi.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.mocked(auth);

const userSession = {
  user: {
    id: 'user-1',
    role: 'user',
    name: null,
    email: null,
    image: null,
  },
  expires: new Date(Date.now() + 60_000).toISOString(),
};

const adminSession = {
  ...userSession,
  user: {
    ...userSession.user,
    role: 'admin',
  },
};

const validCanvas = {
  version: '1.0',
  timestamp: 1,
  nodes: [],
  edges: [],
};

describe('project actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbState.selectResults = [];
    mockDbState.insertValues = [];
    mockDbState.updateSets = [];
    mockDbState.updateResults = [[{ revision: 2 }]];
    mockDbState.deleteCalls = 0;
  });

  it('allows authenticated users to read built-in presets by direct id', async () => {
    mockAuth.mockResolvedValue(userSession);
    mockDbState.selectResults = [
      [],
      [
        {
          id: 'preset-1',
          name: 'Preset',
          data: {},
          isPreset: true,
        },
      ],
    ];

    const result = await getProjectById('preset-1');

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error);
    }
    expect(result.data?.id).toBe('preset-1');
  });

  it('denies private projects without user association', async () => {
    mockAuth.mockResolvedValue(userSession);
    mockDbState.selectResults = [
      [],
      [
        {
          id: 'project-1',
          name: 'Private Project',
          data: {},
          isPreset: false,
        },
      ],
    ];

    const result = await getProjectById('project-1');

    expect(result).toEqual({
      success: false,
      error: 'Project not found or access denied',
    });
  });

  it('allows editors to update an associated project', async () => {
    mockAuth.mockResolvedValue(userSession);
    mockDbState.selectResults = [[{ role: 'editor' }]];

    const result = await saveProject('Updated', validCanvas, {
      projectId: 'project-1',
    });

    expect(result).toEqual({
      success: true,
      projectId: 'project-1',
      revision: 2,
    });
    expect(mockDbState.updateSets).toHaveLength(1);
    expect(mockDbState.insertValues).toHaveLength(0);
  });

  it('rejects stale project revisions instead of overwriting newer data', async () => {
    mockAuth.mockResolvedValue(userSession);
    mockDbState.selectResults = [[{ role: 'editor' }]];
    mockDbState.updateResults = [[]];

    const result = await saveProject('Updated', validCanvas, {
      projectId: 'project-1',
      expectedRevision: 4,
    });

    expect(result).toEqual({
      success: false,
      error: 'Project was modified elsewhere. Reload and try again.',
    });
  });

  it('rejects blank project names before writing to the database', async () => {
    mockAuth.mockResolvedValue(userSession);

    const result = await saveProject('   ', validCanvas);

    expect(result).toEqual({
      success: false,
      error: 'Project name is required',
    });
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('trims project names before creating new projects', async () => {
    mockAuth.mockResolvedValue(userSession);

    const result = await saveProject('  New Project  ', validCanvas);

    expect(result.success).toBe(true);
    expect(mockDbState.insertValues[0]).toMatchObject({
      name: 'New Project',
    });
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects blank project ids instead of creating an accidental copy', async () => {
    mockAuth.mockResolvedValue(userSession);

    const result = await saveProject('Updated', validCanvas, {
      projectId: '   ',
    });

    expect(result).toEqual({
      success: false,
      error: 'Invalid project id',
    });
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('denies updates without a writable project role instead of creating a copy', async () => {
    mockAuth.mockResolvedValue(userSession);
    mockDbState.selectResults = [[{ role: 'viewer' }]];

    const result = await saveProject('Updated', validCanvas, {
      projectId: 'project-1',
    });

    expect(result).toEqual({
      success: false,
      error: 'Project not found or access denied',
    });
    expect(mockDbState.updateSets).toHaveLength(0);
    expect(mockDbState.insertValues).toHaveLength(0);
  });

  it('denies preset saves for non-admin users', async () => {
    mockAuth.mockResolvedValue(userSession);

    const result = await saveProject('Preset', validCanvas, {
      isPreset: true,
    });

    expect(result).toEqual({
      success: false,
      error: 'Forbidden: Admin only',
    });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('prevents admins from overwriting regular projects through preset saves', async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockDbState.selectResults = [[{ id: 'project-1', isPreset: false }]];

    const result = await saveProject('Preset', validCanvas, {
      projectId: 'project-1',
      isPreset: true,
    });

    expect(result).toEqual({
      success: false,
      error: 'Project not found or access denied',
    });
    expect(mockDbState.updateSets).toHaveLength(0);
    expect(mockDbState.insertValues).toHaveLength(0);
  });

  it('rejects invalid project data before writing to the database', async () => {
    mockAuth.mockResolvedValue(userSession);

    const result = await saveProject('Broken', { nodes: [] });

    expect(result).toEqual({
      success: false,
      error: 'Invalid project data',
    });
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('denies deletion for non-owner project associations', async () => {
    mockAuth.mockResolvedValue(userSession);
    mockDbState.selectResults = [[{ role: 'viewer' }]];

    const result = await deleteProjectAction('project-1');

    expect(result).toEqual({
      success: false,
      error: 'Project not found or access denied',
    });
    expect(mockDbState.updateSets).toHaveLength(0);
  });

  it('allows admins to delete built-in presets', async () => {
    mockAuth.mockResolvedValue(adminSession);
    mockDbState.selectResults = [
      [],
      [
        {
          id: 'preset-1',
          isPreset: true,
        },
      ],
    ];

    const result = await deleteProjectAction('preset-1');

    expect(result).toEqual({ success: true });
    expect(mockDbState.updateSets).toHaveLength(1);
  });
});
