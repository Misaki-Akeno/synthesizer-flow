import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deleteCheckpoint,
  getCheckpoints,
  saveCheckpoint,
  updateCheckpointTitle,
} from './checkpoint-actions';
import { auth } from '@/lib/auth/auth';
import { resolveAISettingsForUser } from '@/lib/ai/server-settings';

const mockDbState = vi.hoisted(() => ({
  insertValues: [] as unknown[],
  selectResults: [] as unknown[][],
  selectWhere: [] as unknown[],
  deleteWhere: [] as unknown[],
  updateSets: [] as unknown[],
  updateWhere: [] as unknown[],
}));

const mockDb = vi.hoisted(() => {
  const createSelectChain = (result: unknown[]) => {
    const chain: Record<string, unknown> = {};
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn((condition: unknown) => {
      mockDbState.selectWhere.push(condition);
      return chain;
    });
    chain.orderBy = vi.fn(async () => result);
    return chain;
  };

  return {
    insert: vi.fn(() => ({
      values: vi.fn(async (value: unknown) => {
        mockDbState.insertValues.push(value);
      }),
    })),
    select: vi.fn(() =>
      createSelectChain(mockDbState.selectResults.shift() ?? [])
    ),
    delete: vi.fn(() => ({
      where: vi.fn(async (condition: unknown) => {
        mockDbState.deleteWhere.push(condition);
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((value: unknown) => {
        mockDbState.updateSets.push(value);
        return {
          where: vi.fn(async (condition: unknown) => {
            mockDbState.updateWhere.push(condition);
          }),
        };
      }),
    })),
  };
});

vi.mock('@/lib/auth/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/ai/server-settings', () => ({
  resolveAISettingsForUser: vi.fn(),
}));

vi.mock('@/db/client', () => ({
  db: mockDb,
}));

vi.mock('@/db/schema', () => ({
  checkpoints: {
    id: 'checkpoint.id',
    userId: 'checkpoint.userId',
    createdAt: 'checkpoint.createdAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions: unknown[]) => ({ op: 'and', conditions })),
  desc: vi.fn((column: unknown) => ({ op: 'desc', column })),
  eq: vi.fn((column: unknown, value: unknown) => ({
    op: 'eq',
    column,
    value,
  })),
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'checkpoint-new'),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const mockAuth = vi.mocked(auth);
const mockResolveAISettingsForUser = vi.mocked(resolveAISettingsForUser);

const session = {
  user: {
    id: 'session-user',
    role: 'user',
    name: null,
    email: null,
    image: null,
  },
  expires: new Date(Date.now() + 60_000).toISOString(),
};

describe('checkpoint actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbState.insertValues = [];
    mockDbState.selectResults = [];
    mockDbState.selectWhere = [];
    mockDbState.deleteWhere = [];
    mockDbState.updateSets = [];
    mockDbState.updateWhere = [];
  });

  it('rejects unauthenticated checkpoint reads', async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getCheckpoints();

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it('saves checkpoints for the authenticated user, not the client user id', async () => {
    mockAuth.mockResolvedValue(session);

    const result = await saveCheckpoint(
      'Manual title',
      [{ role: 'user', content: 'hello' }],
      { nodes: [], edges: [] }
    );

    expect(result).toEqual({ success: true, id: 'checkpoint-new' });
    expect(mockDbState.insertValues).toEqual([
      expect.objectContaining({
        id: 'checkpoint-new',
        userId: 'session-user',
        title: 'Manual title',
      }),
    ]);
  });

  it('trims manual checkpoint titles before saving', async () => {
    mockAuth.mockResolvedValue(session);

    const result = await saveCheckpoint(
      '  Manual title  ',
      [{ role: 'user', content: 'hello' }],
      { nodes: [], edges: [] }
    );

    expect(result).toEqual({ success: true, id: 'checkpoint-new' });
    expect(mockDbState.insertValues).toEqual([
      expect.objectContaining({
        title: 'Manual title',
      }),
    ]);
  });

  it('rejects invalid checkpoint messages before saving', async () => {
    mockAuth.mockResolvedValue(session);

    const result = await saveCheckpoint(
      '',
      [{ role: 'developer', content: 'hello' }] as never,
      { nodes: [], edges: [] }
    );

    expect(result).toEqual({
      success: false,
      error: 'Invalid checkpoint messages',
    });
    expect(mockResolveAISettingsForUser).not.toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('accepts checkpoint messages with restorable tool calls and approvals', async () => {
    mockAuth.mockResolvedValue(session);

    const result = await saveCheckpoint(
      'Tool chat',
      [
        {
          role: 'assistant',
          content: 'Created an oscillator.',
          approval: { status: 'approved' },
          toolCalls: [
            {
              id: 'tool-1',
              type: 'function',
              function: {
                name: 'create_module',
                arguments: '{"type":"oscillator"}',
              },
              result: 'ok',
            },
          ],
        },
      ],
      { nodes: [], edges: [] }
    );

    expect(result).toEqual({ success: true, id: 'checkpoint-new' });
    expect(mockDbState.insertValues).toEqual([
      expect.objectContaining({
        title: 'Tool chat',
        messages: [
          expect.objectContaining({
            role: 'assistant',
            approval: { status: 'approved' },
          }),
        ],
      }),
    ]);
  });

  it('rejects graph states that cannot be restored later', async () => {
    mockAuth.mockResolvedValue(session);

    const result = await saveCheckpoint(
      'Broken graph',
      [{ role: 'user', content: 'hello' }],
      {
        nodes: [
          {
            id: 'node-1',
            position: { x: 0, y: 0 },
            data: {
              label: 'Missing Type',
            },
          },
        ],
        edges: [],
      } as never
    );

    expect(result).toEqual({
      success: false,
      error: 'Invalid checkpoint graph state',
    });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('accepts React Flow edges with null handles', async () => {
    mockAuth.mockResolvedValue(session);

    const result = await saveCheckpoint(
      'Default handles',
      [{ role: 'user', content: 'hello' }],
      {
        nodes: [
          {
            id: 'node-1',
            position: { x: 0, y: 0 },
            data: {
              type: 'numberinput',
            },
          },
        ],
        edges: [
          {
            source: 'node-1',
            target: 'node-2',
            sourceHandle: null,
            targetHandle: null,
          },
        ],
      }
    );

    expect(result).toEqual({ success: true, id: 'checkpoint-new' });
    expect(mockDbState.insertValues).toEqual([
      expect.objectContaining({
        title: 'Default handles',
      }),
    ]);
  });

  it('resolves title-generation settings for the authenticated user', async () => {
    mockAuth.mockResolvedValue(session);
    mockResolveAISettingsForUser.mockResolvedValue({
      modelName: 'qwen',
      apiEndpoint: 'https://example.com/v1',
      apiKey: '',
    });

    await saveCheckpoint(
      '',
      [{ role: 'user', content: 'hello' }],
      { nodes: [], edges: [] },
      {
        modelName: 'client-model',
        apiEndpoint: 'https://client.example/v1',
        apiKey: 'client-key',
      }
    );

    expect(mockResolveAISettingsForUser).toHaveBeenCalledWith('session-user', {
      modelName: 'client-model',
      apiEndpoint: 'https://client.example/v1',
      apiKey: 'client-key',
    });
    expect(mockDbState.insertValues).toEqual([
      expect.objectContaining({
        userId: 'session-user',
        title: 'Saved Chat',
      }),
    ]);
  });

  it('lists only checkpoints owned by the authenticated user', async () => {
    mockAuth.mockResolvedValue(session);
    mockDbState.selectResults = [[{ id: 'checkpoint-1' }]];

    const result = await getCheckpoints();

    expect(result).toEqual({ success: true, data: [{ id: 'checkpoint-1' }] });
    expect(mockDbState.selectWhere).toEqual([
      { op: 'eq', column: 'checkpoint.userId', value: 'session-user' },
    ]);
  });

  it('deletes only matching checkpoints owned by the authenticated user', async () => {
    mockAuth.mockResolvedValue(session);

    const result = await deleteCheckpoint('checkpoint-1');

    expect(result).toEqual({ success: true });
    expect(mockDbState.deleteWhere).toEqual([
      {
        op: 'and',
        conditions: [
          { op: 'eq', column: 'checkpoint.id', value: 'checkpoint-1' },
          { op: 'eq', column: 'checkpoint.userId', value: 'session-user' },
        ],
      },
    ]);
  });

  it('rejects blank checkpoint ids before deleting', async () => {
    mockAuth.mockResolvedValue(session);

    const result = await deleteCheckpoint('   ');

    expect(result).toEqual({
      success: false,
      error: 'Invalid checkpoint id',
    });
    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it('updates titles only for checkpoints owned by the authenticated user', async () => {
    mockAuth.mockResolvedValue(session);

    const result = await updateCheckpointTitle('checkpoint-1', '  New title  ');

    expect(result).toEqual({ success: true });
    expect(mockDbState.updateSets).toEqual([{ title: 'New title' }]);
    expect(mockDbState.updateWhere).toEqual([
      {
        op: 'and',
        conditions: [
          { op: 'eq', column: 'checkpoint.id', value: 'checkpoint-1' },
          { op: 'eq', column: 'checkpoint.userId', value: 'session-user' },
        ],
      },
    ]);
  });

  it('rejects blank checkpoint titles before updating', async () => {
    mockAuth.mockResolvedValue(session);

    const result = await updateCheckpointTitle('checkpoint-1', '   ');

    expect(result).toEqual({
      success: false,
      error: 'Title is required',
    });
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('rejects blank checkpoint ids before updating', async () => {
    mockAuth.mockResolvedValue(session);

    const result = await updateCheckpointTitle('   ', 'New title');

    expect(result).toEqual({
      success: false,
      error: 'Invalid checkpoint id',
    });
    expect(mockDb.update).not.toHaveBeenCalled();
  });
});
