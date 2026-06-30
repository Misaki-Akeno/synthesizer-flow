'use server';

import { Agent } from './core/Agent';
import { ChatMessage, GraphStateSnapshot } from './core/types';
import type { AISettings } from '@/store/settings-store';
import { auth } from '@/lib/auth/auth';
import { resolveAISettingsForUser } from '@/lib/ai/server-settings';

const VALID_MESSAGE_ROLES = new Set(['user', 'assistant', 'system']);
const VALID_ACTIONS = new Set(['approve', 'reject']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertChatMessages(value: unknown): asserts value is ChatMessage[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('messages must be a non-empty array');
  }

  value.forEach((message, index) => {
    if (!isRecord(message)) {
      throw new Error(`messages[${index}] must be an object`);
    }

    if (
      typeof message.role !== 'string' ||
      !VALID_MESSAGE_ROLES.has(message.role)
    ) {
      throw new Error(`messages[${index}].role is invalid`);
    }

    if (typeof message.content !== 'string') {
      throw new Error(`messages[${index}].content must be a string`);
    }
  });
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isGraphParameterValue(value: unknown): boolean {
  return (
    typeof value === 'boolean' ||
    typeof value === 'string' ||
    isFiniteNumber(value)
  );
}

function assertParameterRecord(value: unknown, context: string): void {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    throw new Error(`${context} must be an object`);
  }

  Object.entries(value).forEach(([key, parameterValue]) => {
    if (!isGraphParameterValue(parameterValue)) {
      throw new Error(`${context}.${key} is invalid`);
    }
  });
}

function assertStringRecord(value: unknown, context: string): void {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    throw new Error(`${context} must be an object`);
  }

  Object.entries(value).forEach(([key, recordValue]) => {
    if (typeof recordValue !== 'string') {
      throw new Error(`${context}.${key} must be a string`);
    }
  });
}

function assertOptionalStringOrNull(value: unknown, context: string): void {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== 'string') {
    throw new Error(`${context} must be a string`);
  }
}

function assertOptionalNonEmptyString(value: unknown, context: string): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${context} must be a non-empty string`);
  }
}

function assertGraphStateSnapshot(
  value: unknown
): asserts value is GraphStateSnapshot {
  if (
    !isRecord(value) ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges)
  ) {
    throw new Error('initialState must include nodes and edges arrays');
  }

  const nodeIds = new Set<string>();

  value.nodes.forEach((node, index) => {
    if (!isRecord(node)) {
      throw new Error(`initialState.nodes[${index}] must be an object`);
    }

    if (typeof node.id !== 'string' || !node.id.trim()) {
      throw new Error(`initialState.nodes[${index}].id is invalid`);
    }

    if (nodeIds.has(node.id)) {
      throw new Error(`initialState.nodes[${index}].id is duplicated`);
    }
    nodeIds.add(node.id);

    if (!isRecord(node.position)) {
      throw new Error(`initialState.nodes[${index}].position is invalid`);
    }

    if (!isFiniteNumber(node.position.x) || !isFiniteNumber(node.position.y)) {
      throw new Error(
        `initialState.nodes[${index}].position must use finite numbers`
      );
    }

    if (!isRecord(node.data) || typeof node.data.type !== 'string') {
      throw new Error(`initialState.nodes[${index}].data.type is invalid`);
    }

    assertParameterRecord(
      node.data.parameters,
      `initialState.nodes[${index}].data.parameters`
    );

    if (node.data.ports !== undefined) {
      if (!isRecord(node.data.ports)) {
        throw new Error(`initialState.nodes[${index}].data.ports is invalid`);
      }

      assertStringRecord(
        node.data.ports.inputs,
        `initialState.nodes[${index}].data.ports.inputs`
      );
      assertStringRecord(
        node.data.ports.outputs,
        `initialState.nodes[${index}].data.ports.outputs`
      );
    }
  });

  value.edges.forEach((edge, index) => {
    if (!isRecord(edge)) {
      throw new Error(`initialState.edges[${index}] must be an object`);
    }

    if (typeof edge.source !== 'string' || !edge.source.trim()) {
      throw new Error(`initialState.edges[${index}].source is invalid`);
    }

    if (typeof edge.target !== 'string' || !edge.target.trim()) {
      throw new Error(`initialState.edges[${index}].target is invalid`);
    }

    assertOptionalStringOrNull(
      edge.sourceHandle,
      `initialState.edges[${index}].sourceHandle`
    );
    assertOptionalStringOrNull(
      edge.targetHandle,
      `initialState.edges[${index}].targetHandle`
    );

    if (!nodeIds.has(edge.source)) {
      throw new Error(`initialState.edges[${index}].source is missing`);
    }

    if (!nodeIds.has(edge.target)) {
      throw new Error(`initialState.edges[${index}].target is missing`);
    }
  });
}

export async function* chatWithAgent(
  messages: ChatMessage[],
  settings: AISettings,
  initialState: GraphStateSnapshot,
  threadId?: string,
  action?: 'approve' | 'reject'
) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  assertChatMessages(messages);
  assertGraphStateSnapshot(initialState);
  assertOptionalNonEmptyString(threadId, 'threadId');
  if (action !== undefined && !VALID_ACTIONS.has(action)) {
    throw new Error('action is invalid');
  }
  if (action !== undefined && !threadId?.trim()) {
    throw new Error('threadId is required for approval actions');
  }

  const resolvedSettings = await resolveAISettingsForUser(
    session.user.id,
    settings
  );

  const agent = Agent.getInstance();
  const generator = agent.streamMessage(
    messages,
    resolvedSettings,
    initialState,
    threadId,
    action
  );

  for await (const part of generator) {
    // Ensure the return value is serializable
    yield JSON.parse(JSON.stringify(part));
  }
}
