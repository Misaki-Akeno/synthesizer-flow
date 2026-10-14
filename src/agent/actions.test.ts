import { beforeEach, describe, expect, it, vi } from 'vitest';
import { chatWithAgent } from './actions';
import { auth } from '@/lib/auth/auth';
import { resolveAISettingsForUser } from '@/lib/ai/server-settings';
import { Agent } from './core/Agent';
import type { AISettings } from '@/store/settings-store';
import type { ChatMessage, GraphStateSnapshot } from './core/types';

const mockStreamMessage = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/ai/server-settings', () => ({
  resolveAISettingsForUser: vi.fn(),
}));

vi.mock('./core/Agent', () => ({
  Agent: {
    getInstance: vi.fn(() => ({
      streamMessage: mockStreamMessage,
    })),
  },
}));

const mockAuth = vi.mocked(auth);
const mockResolveAISettingsForUser = vi.mocked(resolveAISettingsForUser);
const mockAgent = vi.mocked(Agent);

const session = {
  user: {
    id: 'user-1',
    role: 'user',
    name: null,
    email: null,
    image: null,
  },
  expires: new Date(Date.now() + 60_000).toISOString(),
};

const settings: AISettings = {
  providerId: 'custom',
  modelName: 'qwen',
  apiEndpoint: 'https://example.com/v1',
  apiKey: 'sk-test',
  hasServerApiKey: false,
};

const messages: ChatMessage[] = [{ role: 'user', content: 'Add oscillator' }];

const graphState: GraphStateSnapshot = {
  nodes: [
    {
      id: 'node-1',
      type: 'default',
      position: { x: 0, y: 0 },
      data: {
        type: 'oscillator',
        label: 'Oscillator',
      },
    },
  ],
  edges: [],
};

async function collectRaw<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const parts: T[] = [];
  for await (const part of stream) {
    parts.push(part);
  }
  return parts;
}

/** 与客户端一致：error 事件会中断流并抛出其 message。 */
async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const parts = await collectRaw(stream);
  const failure = parts.find(
    (part) => (part as { type?: string }).type === 'error'
  ) as { message: string } | undefined;
  if (failure) {
    throw new Error(failure.message);
  }
  return parts;
}

async function* createAgentStream() {
  yield { type: 'chunk', content: 'ok' };
  yield {
    type: 'done',
    response: {
      message: { role: 'assistant', content: 'Done' },
      hasToolUse: false,
    },
  };
}

describe('chatWithAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(session);
    mockResolveAISettingsForUser.mockResolvedValue(settings);
    mockStreamMessage.mockReturnValue(createAgentStream());
  });

  describe('anonymous users', () => {
    const anonThreadId = '123e4567-e89b-42d3-a456-426614174000';

    beforeEach(() => {
      mockAuth.mockResolvedValue(null);
    });

    it('uses the request API key without reading stored settings', async () => {
      await collect(chatWithAgent(messages, settings, graphState));

      expect(mockResolveAISettingsForUser).not.toHaveBeenCalled();
      expect(mockStreamMessage).toHaveBeenCalledWith(
        messages,
        expect.objectContaining({
          providerId: 'custom',
          apiKey: 'sk-test',
          apiEndpoint: 'https://example.com/v1',
          hasServerApiKey: false,
        }),
        graphState,
        undefined,
        undefined,
        undefined
      );
    });

    it('ignores client endpoints for fixed providers', async () => {
      await collect(
        chatWithAgent(
          messages,
          {
            ...settings,
            providerId: 'openrouter',
            apiEndpoint: 'http://169.254.169.254/',
          },
          graphState
        )
      );

      const resolved = mockStreamMessage.mock.calls[0][1];
      expect(resolved.apiEndpoint).not.toContain('169.254.169.254');
    });

    it('rejects non-http custom endpoints', async () => {
      await expect(
        collect(
          chatWithAgent(
            messages,
            { ...settings, apiEndpoint: 'file:///etc/passwd' },
            graphState
          )
        )
      ).rejects.toThrow(/http or https/);
    });

    it('scopes checkpoints to an anon namespace with UUID thread ids', async () => {
      await collect(
        chatWithAgent(messages, settings, graphState, anonThreadId)
      );

      expect(mockStreamMessage).toHaveBeenCalledWith(
        messages,
        expect.anything(),
        graphState,
        anonThreadId,
        undefined,
        `anon:${anonThreadId}`
      );
    });

    it('rejects guessable thread ids', async () => {
      await expect(
        collect(chatWithAgent(messages, settings, graphState, 'thread_abc'))
      ).rejects.toThrow('threadId has an invalid format');
    });
  });

  it('rejects malformed messages before creating the agent', async () => {
    await expect(
      collect(
        chatWithAgent(
          [{ role: 'tool', content: 'bad' }] as unknown as ChatMessage[],
          settings,
          graphState
        )
      )
    ).rejects.toThrow(/messages\[0\].role/);

    expect(mockResolveAISettingsForUser).not.toHaveBeenCalled();
    expect(mockAgent.getInstance).not.toHaveBeenCalled();
  });

  it('rejects malformed graph state before creating the agent', async () => {
    await expect(
      collect(
        chatWithAgent(messages, settings, {
          nodes: [
            {
              id: 'node-1',
              position: { x: Number.NaN, y: 0 },
              data: { type: 'oscillator' },
            },
          ],
          edges: [],
        } as unknown as GraphStateSnapshot)
      )
    ).rejects.toThrow(/position must use finite numbers/);

    expect(mockResolveAISettingsForUser).not.toHaveBeenCalled();
    expect(mockAgent.getInstance).not.toHaveBeenCalled();
  });

  it('rejects non-finite parameter values before creating the agent', async () => {
    await expect(
      collect(
        chatWithAgent(messages, settings, {
          nodes: [
            {
              id: 'node-1',
              position: { x: 0, y: 0 },
              data: {
                type: 'oscillator',
                parameters: {
                  frequency: Number.POSITIVE_INFINITY,
                },
              },
            },
          ],
          edges: [],
        } as unknown as GraphStateSnapshot)
      )
    ).rejects.toThrow(/parameters\.frequency/);

    expect(mockResolveAISettingsForUser).not.toHaveBeenCalled();
    expect(mockAgent.getInstance).not.toHaveBeenCalled();
  });

  it('rejects duplicate node ids before creating the agent', async () => {
    await expect(
      collect(
        chatWithAgent(messages, settings, {
          nodes: [
            {
              id: 'node-1',
              position: { x: 0, y: 0 },
              data: { type: 'oscillator' },
            },
            {
              id: 'node-1',
              position: { x: 100, y: 0 },
              data: { type: 'speaker' },
            },
          ],
          edges: [],
        } as unknown as GraphStateSnapshot)
      )
    ).rejects.toThrow(/duplicated/);

    expect(mockResolveAISettingsForUser).not.toHaveBeenCalled();
    expect(mockAgent.getInstance).not.toHaveBeenCalled();
  });

  it('rejects edges that reference missing nodes before creating the agent', async () => {
    await expect(
      collect(
        chatWithAgent(messages, settings, {
          nodes: [
            {
              id: 'node-1',
              position: { x: 0, y: 0 },
              data: { type: 'oscillator' },
            },
          ],
          edges: [
            {
              source: 'node-1',
              target: 'missing-node',
            },
          ],
        } as unknown as GraphStateSnapshot)
      )
    ).rejects.toThrow(/target is missing/);

    expect(mockResolveAISettingsForUser).not.toHaveBeenCalled();
    expect(mockAgent.getInstance).not.toHaveBeenCalled();
  });

  it('rejects non-string port records before creating the agent', async () => {
    await expect(
      collect(
        chatWithAgent(messages, settings, {
          nodes: [
            {
              id: 'node-1',
              position: { x: 0, y: 0 },
              data: {
                type: 'oscillator',
                ports: {
                  inputs: { frequency: 123 },
                },
              },
            },
          ],
          edges: [],
        } as unknown as GraphStateSnapshot)
      )
    ).rejects.toThrow(/ports\.inputs\.frequency/);

    expect(mockResolveAISettingsForUser).not.toHaveBeenCalled();
    expect(mockAgent.getInstance).not.toHaveBeenCalled();
  });

  it('rejects non-string edge handles before creating the agent', async () => {
    await expect(
      collect(
        chatWithAgent(messages, settings, {
          nodes: [
            {
              id: 'node-1',
              position: { x: 0, y: 0 },
              data: { type: 'oscillator' },
            },
            {
              id: 'node-2',
              position: { x: 100, y: 0 },
              data: { type: 'speaker' },
            },
          ],
          edges: [
            {
              source: 'node-1',
              target: 'node-2',
              sourceHandle: 42,
            },
          ],
        } as unknown as GraphStateSnapshot)
      )
    ).rejects.toThrow(/sourceHandle/);

    expect(mockResolveAISettingsForUser).not.toHaveBeenCalled();
    expect(mockAgent.getInstance).not.toHaveBeenCalled();
  });

  it('rejects blank thread ids before creating the agent', async () => {
    await expect(
      collect(chatWithAgent(messages, settings, graphState, '   '))
    ).rejects.toThrow(/threadId/);

    expect(mockResolveAISettingsForUser).not.toHaveBeenCalled();
    expect(mockAgent.getInstance).not.toHaveBeenCalled();
  });

  it('requires a thread id for approval actions', async () => {
    await expect(
      collect(
        chatWithAgent(messages, settings, graphState, undefined, 'approve')
      )
    ).rejects.toThrow(/threadId is required/);

    expect(mockResolveAISettingsForUser).not.toHaveBeenCalled();
    expect(mockAgent.getInstance).not.toHaveBeenCalled();
  });

  it('streams serializable agent events for valid requests', async () => {
    const result = await collect(
      chatWithAgent(messages, settings, graphState, 'thread-1')
    );

    expect(result).toEqual([
      { type: 'chunk', content: 'ok' },
      {
        type: 'done',
        response: {
          message: { role: 'assistant', content: 'Done' },
          hasToolUse: false,
        },
      },
    ]);
    expect(mockResolveAISettingsForUser).toHaveBeenCalledWith(
      'user-1',
      settings
    );
    expect(mockStreamMessage).toHaveBeenCalledWith(
      messages,
      settings,
      graphState,
      'thread-1',
      undefined,
      'user-1:thread-1'
    );
  });

  it('passes approval actions through when a valid thread id is provided', async () => {
    const result = await collect(
      chatWithAgent(messages, settings, graphState, 'thread-1', 'approve')
    );

    expect(result[0]).toEqual({ type: 'chunk', content: 'ok' });
    expect(mockStreamMessage).toHaveBeenCalledWith(
      messages,
      settings,
      graphState,
      'thread-1',
      'approve',
      'user-1:thread-1'
    );
  });

  it('rejects oversized chat requests before resolving settings', async () => {
    await expect(
      collect(
        chatWithAgent(
          [{ role: 'user', content: 'x'.repeat(50_001) }],
          settings,
          graphState
        )
      )
    ).rejects.toThrow(/too long/);

    expect(mockResolveAISettingsForUser).not.toHaveBeenCalled();
  });

  it('uses a different checkpoint namespace for each authenticated user', async () => {
    mockAuth.mockResolvedValue({
      ...session,
      user: { ...session.user, id: 'user-2' },
    });

    await collect(chatWithAgent(messages, settings, graphState, 'thread-1'));

    expect(mockStreamMessage).toHaveBeenCalledWith(
      messages,
      settings,
      graphState,
      'thread-1',
      undefined,
      'user-2:thread-1'
    );
  });
});

describe('chatWithAgent error events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue(session);
    mockResolveAISettingsForUser.mockResolvedValue(settings);
  });

  it('returns validation failures as invalid_request events', async () => {
    const parts = await collectRaw(
      chatWithAgent(
        [{ role: 'tool', content: 'bad' }] as unknown as ChatMessage[],
        settings,
        graphState
      )
    );

    expect(parts).toEqual([
      {
        type: 'error',
        code: 'invalid_request',
        message: expect.stringMatching(/messages\[0\]\.role/),
      },
    ]);
  });

  it('asks for an API key before creating the agent', async () => {
    mockResolveAISettingsForUser.mockResolvedValue({
      ...settings,
      apiKey: '',
    });

    const parts = await collectRaw(
      chatWithAgent(messages, settings, graphState)
    );

    expect(parts).toEqual([
      expect.objectContaining({ type: 'error', code: 'invalid_request' }),
    ]);
    expect(mockStreamMessage).not.toHaveBeenCalled();
  });

  it('surfaces provider HTTP errors with the API key redacted', async () => {
    mockStreamMessage.mockImplementation(async function* () {
      throw Object.assign(new Error('401 bad key sk-test / sk-abcdefgh12345'), {
        status: 401,
      });
    });

    const parts = await collectRaw(
      chatWithAgent(messages, settings, graphState)
    );

    expect(parts).toEqual([
      {
        type: 'error',
        code: 'provider',
        message: '(401) 401 bad key [redacted] / [redacted]',
      },
    ]);
  });

  it('hides internal error details from the client', async () => {
    mockStreamMessage.mockImplementation(async function* () {
      yield { type: 'chunk', content: 'partial' };
      throw new Error('Failed query: select * from langgraph_checkpoints');
    });

    const parts = await collectRaw(
      chatWithAgent(messages, settings, graphState)
    );

    expect(parts).toEqual([
      { type: 'chunk', content: 'partial' },
      { type: 'error', code: 'internal', message: '' },
    ]);
  });

  it('hides unexpected failures while resolving stored settings', async () => {
    mockResolveAISettingsForUser.mockRejectedValue(
      new Error('connect ECONNREFUSED 10.0.0.5:5432')
    );

    const parts = await collectRaw(
      chatWithAgent(messages, settings, graphState)
    );

    expect(parts).toEqual([{ type: 'error', code: 'internal', message: '' }]);
  });
});
