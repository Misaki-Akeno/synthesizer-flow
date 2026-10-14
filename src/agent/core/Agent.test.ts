import { AIMessage, BaseMessage, ToolMessage } from '@langchain/core/messages';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import { describe, expect, it, vi } from 'vitest';
import { Agent } from './Agent';
import { ToolExecutor } from '../tools/executor';
import type { GraphStateSnapshot } from './types';
import type { AISettings } from '@/store/settings-store';

vi.mock('@/lib/logger', () => ({
  createModuleLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn() }),
}));

const settings: AISettings = {
  providerId: 'openai',
  modelName: 'mock',
  apiKey: 'test-key',
  apiEndpoint: '',
};

const emptyCanvas: GraphStateSnapshot = { nodes: [], edges: [] };

function latestHuman(messages: BaseMessage[]): string {
  return [...messages]
    .reverse()
    .find((message) => message._getType() === 'human')?.content as string;
}

function toolCall(id: string, name: string, args: Record<string, unknown>) {
  return { id, name, args, type: 'tool_call' as const };
}

/** Minimal deterministic model: enough LangChain surface for the compiled graph. */
function createMockModel(responder: (messages: BaseMessage[]) => AIMessage) {
  const model = {
    bindTools: () => model,
    invoke: async (messages: BaseMessage[]) => responder(messages),
  };
  return model;
}

function createTestAgent(model: ReturnType<typeof createMockModel>) {
  const saver = new MemorySaver();
  return Agent.create({
    createModel: async () => model as never,
    createCheckpointer: () => saver,
    createExecutor: (state) =>
      new ToolExecutor(state, {
        searchDocuments: async () => ({ matches: [] }),
      }),
  });
}

describe('Agent checkpoint execution context', () => {
  it('keeps a three-turn history once when the client submits only stable new message IDs', async () => {
    const model = createMockModel(
      (messages) => new AIMessage(`reply:${latestHuman(messages)}`)
    );
    const agent = createTestAgent(model);

    for (const content of ['one', 'two', 'three']) {
      const response = await agent.sendMessage(
        [{ id: `user-${content}`, role: 'user', content }],
        settings,
        emptyCanvas,
        'three-turn'
      );
      expect(response.message.content).toBe(`reply:${content}`);
    }

    // A network retry for the last stable ID must not append another human turn.
    const retry = await agent.sendMessage(
      [{ id: 'user-three', role: 'user', content: 'three' }],
      settings,
      emptyCanvas,
      'three-turn'
    );
    expect(retry.message.content).toBe('reply:three');
  });

  it('resumes safe add plus destructive delete with persisted shadow canvas and skills', async () => {
    const model = createMockModel((messages) => {
      const last = messages[messages.length - 1];
      if (
        latestHuman(messages) === 'replace it' &&
        last._getType() === 'human'
      ) {
        return new AIMessage({
          content: '',
          tool_calls: [
            toolCall('load', 'skill_load', { skillId: 'module:numberinput' }),
          ],
        });
      }
      if (last instanceof ToolMessage && last.tool_call_id === 'load') {
        return new AIMessage({
          content: '',
          tool_calls: [
            toolCall('add', 'module_add', {
              type: 'numberinput',
              label: 'temporary',
              position: { x: 0, y: 0 },
            }),
          ],
        });
      }
      if (last instanceof ToolMessage && last.tool_call_id === 'add') {
        const result = JSON.parse(String(last.content));
        return new AIMessage({
          content: '',
          tool_calls: [
            toolCall('delete', 'module_delete', {
              moduleId: result.data.moduleId,
            }),
          ],
        });
      }
      return new AIMessage('completed');
    });
    const agent = createTestAgent(model);

    const pending = await agent.sendMessage(
      [{ id: 'replace', role: 'user', content: 'replace it' }],
      settings,
      emptyCanvas,
      'approval'
    );
    expect(pending.approvalRequired).toBe(true);
    expect(
      pending.clientOperations?.map((operation) => operation.type)
    ).toEqual(['ADD_MODULE']);

    const approved = await agent.sendMessage(
      [],
      settings,
      emptyCanvas,
      'approval',
      'approve'
    );
    expect(approved.approvalRequired).toBe(false);
    expect(
      approved.clientOperations?.map((operation) => operation.type)
    ).toEqual(['ADD_MODULE', 'DELETE_MODULE']);
    expect(approved.message.content).toBe('completed');
  });

  it('reject clears an interrupted checkpoint so its pending operations cannot resume', async () => {
    const model = createMockModel(
      (_messages) =>
        new AIMessage({
          content: '',
          tool_calls: [
            toolCall('delete', 'module_delete', { moduleId: 'missing' }),
          ],
        })
    );
    const agent = createTestAgent(model);
    const pending = await agent.sendMessage(
      [{ id: 'delete', role: 'user', content: 'delete' }],
      settings,
      emptyCanvas,
      'reject'
    );
    expect(pending.approvalRequired).toBe(true);

    await agent.sendMessage([], settings, emptyCanvas, 'reject', 'reject');
    const afterReject = await agent.sendMessage(
      [{ id: 'fresh', role: 'user', content: 'fresh' }],
      settings,
      emptyCanvas,
      'reject'
    );
    expect(afterReject.approvalRequired).toBe(true);
    expect(afterReject.clientOperations).toEqual([]);
  });
});
