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

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const parts: T[] = [];
  for await (const part of stream) {
    parts.push(part);
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

  it('rejects unauthenticated users before resolving settings', async () => {
    mockAuth.mockResolvedValue(null);

    await expect(
      collect(chatWithAgent(messages, settings, graphState))
    ).rejects.toThrow('Unauthorized');
    expect(mockResolveAISettingsForUser).not.toHaveBeenCalled();
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
      undefined
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
      'approve'
    );
  });
});
