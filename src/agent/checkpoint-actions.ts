'use server';

import { db } from '@/db/client';
import { checkpoints, NewCheckpoint } from '@/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { ChatMessage, GraphStateSnapshot } from './core/types';
import { nanoid } from 'nanoid';
import { auth } from '@/lib/auth/auth';
import { resolveAISettingsForUser } from '@/lib/ai/server-settings';

import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage } from '@langchain/core/messages';
import type { AISettings } from '@/store/settings-store';

const chatMessageRoles = new Set(['user', 'assistant', 'system']);
const approvalStatuses = new Set(['pending', 'approved', 'rejected']);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRestorableToolCall(value: unknown): boolean {
  if (!isPlainRecord(value)) {
    return false;
  }

  if (
    typeof value.id !== 'string' ||
    value.type !== 'function' ||
    !isPlainRecord(value.function)
  ) {
    return false;
  }

  const fn = value.function;
  return (
    typeof fn.name === 'string' &&
    typeof fn.arguments === 'string' &&
    (value.result === undefined || typeof value.result === 'string')
  );
}

function isRestorableChatMessage(value: unknown): value is ChatMessage {
  if (!isPlainRecord(value)) {
    return false;
  }

  const toolCallsAreValid =
    value.toolCalls === undefined ||
    (Array.isArray(value.toolCalls) &&
      value.toolCalls.every(isRestorableToolCall));

  const approvalIsValid =
    value.approval === undefined ||
    (isPlainRecord(value.approval) &&
      typeof value.approval.status === 'string' &&
      approvalStatuses.has(value.approval.status));

  return (
    typeof value.role === 'string' &&
    chatMessageRoles.has(value.role) &&
    typeof value.content === 'string' &&
    toolCallsAreValid &&
    approvalIsValid
  );
}

function areRestorableChatMessages(
  messages: unknown
): messages is ChatMessage[] {
  return Array.isArray(messages) && messages.every(isRestorableChatMessage);
}

function isSerializableParameterMap(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every(
    (entry) =>
      typeof entry === 'number' ||
      typeof entry === 'boolean' ||
      typeof entry === 'string'
  );
}

function isRestorableGraphState(graphState: GraphStateSnapshot): boolean {
  if (!Array.isArray(graphState.nodes) || !Array.isArray(graphState.edges)) {
    return false;
  }

  const nodesAreValid = graphState.nodes.every((node) => {
    const record = node as {
      id?: unknown;
      position?: { x?: unknown; y?: unknown };
      data?: { type?: unknown; parameters?: unknown };
    };

    return (
      typeof record.id === 'string' &&
      record.id.trim().length > 0 &&
      typeof record.position?.x === 'number' &&
      typeof record.position?.y === 'number' &&
      typeof record.data?.type === 'string' &&
      record.data.type.trim().length > 0 &&
      isSerializableParameterMap(record.data.parameters)
    );
  });

  if (!nodesAreValid) {
    return false;
  }

  return graphState.edges.every((edge) => {
    const record = edge as {
      source?: unknown;
      target?: unknown;
      sourceHandle?: unknown;
      targetHandle?: unknown;
    };

    return (
      typeof record.source === 'string' &&
      record.source.trim().length > 0 &&
      typeof record.target === 'string' &&
      record.target.trim().length > 0 &&
      (record.sourceHandle === undefined ||
        record.sourceHandle === null ||
        typeof record.sourceHandle === 'string') &&
      (record.targetHandle === undefined ||
        record.targetHandle === null ||
        typeof record.targetHandle === 'string')
    );
  });
}

async function generateTitle(
  messages: ChatMessage[],
  settings?: AISettings
): Promise<string> {
  if (!settings || !settings.apiKey || messages.length === 0) {
    return 'Saved Chat';
  }

  try {
    const model = new ChatOpenAI({
      apiKey: settings.apiKey,
      configuration: { baseURL: settings.apiEndpoint },
      modelName: settings.modelName,
      temperature: 0,
    });

    const conversation = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n')
      .slice(-2000); // Limit context
    const response = await model.invoke([
      new HumanMessage(
        `总结上下文，生成一个标题，长度小于12个字符。基于对话语言.\n\n${conversation}`
      ),
    ]);

    const content =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);
    let generatedTitle = content.trim();
    // Remove quotes if present
    generatedTitle = generatedTitle.replace(/^"|"$/g, '');

    if (!generatedTitle) {
      return 'New Chat';
    }
    return generatedTitle;
  } catch (e) {
    console.error('Title generation failed:', e);
    // Fallback to "New Chat" instead of long date string if generation fails
    return 'New Chat';
  }
}

export async function saveCheckpoint(
  title: string,
  messages: ChatMessage[],
  graphState: GraphStateSnapshot,
  aiSettings?: AISettings
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    if (!areRestorableChatMessages(messages)) {
      return { success: false, error: 'Invalid checkpoint messages' };
    }

    if (!isRestorableGraphState(graphState)) {
      return { success: false, error: 'Invalid checkpoint graph state' };
    }

    let finalTitle = title.trim();
    if (!finalTitle) {
      const resolvedAISettings = await resolveAISettingsForUser(
        session.user.id,
        aiSettings
      );
      finalTitle = (await generateTitle(messages, resolvedAISettings)).trim();
    }

    const newCheckpoint: NewCheckpoint = {
      id: nanoid(),
      userId: session.user.id,
      title: finalTitle,
      messages: JSON.parse(JSON.stringify(messages)), // Ensure serializable
      graphState: JSON.parse(JSON.stringify(graphState)), // Ensure serializable
    };

    await db.insert(checkpoints).values(newCheckpoint);
    revalidatePath('/'); // Revalidate to refresh lists if needed
    return { success: true, id: newCheckpoint.id };
  } catch (error) {
    console.error('Failed to save checkpoint:', error);
    return { success: false, error: 'Failed to save checkpoint' };
  }
}

export async function getCheckpoints() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const results = await db
      .select()
      .from(checkpoints)
      .where(eq(checkpoints.userId, session.user.id))
      .orderBy(desc(checkpoints.createdAt));
    return { success: true, data: results };
  } catch (error) {
    console.error('Failed to get checkpoints:', error);
    return { success: false, error: 'Failed to get checkpoints' };
  }
}

export async function deleteCheckpoint(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const checkpointId = id.trim();
    if (!checkpointId) {
      return { success: false, error: 'Invalid checkpoint id' };
    }

    await db
      .delete(checkpoints)
      .where(
        and(
          eq(checkpoints.id, checkpointId),
          eq(checkpoints.userId, session.user.id)
        )
      );
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete checkpoint:', error);
    return { success: false, error: 'Failed to delete checkpoint' };
  }
}

export async function updateCheckpointTitle(id: string, title: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: 'Unauthorized' };
    }

    const checkpointId = id.trim();
    if (!checkpointId) {
      return { success: false, error: 'Invalid checkpoint id' };
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return { success: false, error: 'Title is required' };
    }

    await db
      .update(checkpoints)
      .set({ title: trimmedTitle })
      .where(
        and(
          eq(checkpoints.id, checkpointId),
          eq(checkpoints.userId, session.user.id)
        )
      );
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to update checkpoint title:', error);
    return { success: false, error: 'Failed to update checkpoint title' };
  }
}
