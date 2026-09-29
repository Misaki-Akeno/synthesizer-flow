'use server';

import { Agent } from './core/Agent';
import { ChatMessage, GraphStateSnapshot } from './core/types';
import type { AISettings } from '@/store/settings-store';
import { auth } from '@/lib/auth/auth';
import { resolveAISettingsForUser } from '@/lib/ai/server-settings';
import { getAIProvider, isAIProviderId } from '@/lib/ai/providers';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('ChatAction');

/** 校验类错误：消息面向用户，可以原样返回。 */
class ChatRequestError extends Error {}

export type ChatErrorCode = 'invalid_request' | 'provider' | 'internal';

export interface ChatErrorEvent {
  type: 'error';
  code: ChatErrorCode;
  /** internal 错误不返回细节，避免泄露数据库或服务端信息。 */
  message: string;
}

const MAX_ERROR_MESSAGE_LENGTH = 300;

function toChatErrorEvent(error: unknown, apiKey?: string): ChatErrorEvent {
  if (error instanceof ChatRequestError) {
    return { type: 'error', code: 'invalid_request', message: error.message };
  }

  if (error instanceof Error && error.name === 'AISettingsValidationError') {
    return { type: 'error', code: 'invalid_request', message: error.message };
  }

  // 模型服务返回的 HTTP 错误（密钥无效、模型不存在、额度不足等）对用户有诊断价值。
  const status =
    isRecord(error) && typeof error.status === 'number'
      ? error.status
      : undefined;
  if (error instanceof Error && status !== undefined) {
    let message = error.message;
    if (apiKey) {
      message = message.split(apiKey).join('[redacted]');
    }
    message = message.replace(/\b(sk|key)-[A-Za-z0-9_-]{8,}/g, '[redacted]');
    return {
      type: 'error',
      code: 'provider',
      message: `(${status}) ${message}`.slice(0, MAX_ERROR_MESSAGE_LENGTH),
    };
  }

  return { type: 'error', code: 'internal', message: '' };
}

async function resolveSettings(
  userId: string | undefined,
  settings: AISettings
): Promise<AISettings> {
  // 登录用户使用数据库中加密保存的设置；匿名用户只使用本次请求携带的
  // 密钥，不读取或写入任何用户数据。
  return userId
    ? resolveAISettingsForUser(userId, settings)
    : resolveAnonymousSettings(settings);
}

const VALID_MESSAGE_ROLES = new Set(['user', 'assistant', 'system']);
const VALID_ACTIONS = new Set(['approve', 'reject']);
const MAX_MESSAGES = 100;
const MAX_MESSAGE_LENGTH = 50_000;
const MAX_TOTAL_MESSAGE_LENGTH = 200_000;
const MAX_GRAPH_NODES = 500;
const MAX_GRAPH_EDGES = 2_000;
const MAX_THREAD_ID_LENGTH = 128;

const ANONYMOUS_THREAD_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 匿名请求的设置只信任提供商注册表：固定提供商忽略客户端传入的 endpoint，
 * 自定义提供商必须是 http(s) URL。
 */
function resolveAnonymousSettings(settings: AISettings): AISettings {
  if (!isRecord(settings) || !isAIProviderId(settings.providerId)) {
    throw new ChatRequestError('providerId is not supported');
  }

  const provider = getAIProvider(settings.providerId);
  let apiEndpoint = provider.apiEndpoint;

  if (provider.allowsCustomEndpoint) {
    let url: URL;
    try {
      url = new URL(String(settings.apiEndpoint ?? '').trim());
    } catch {
      throw new ChatRequestError('apiEndpoint must be a valid URL');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new ChatRequestError('apiEndpoint must use http or https');
    }
    apiEndpoint = url.toString();
  }

  return {
    providerId: settings.providerId,
    modelName:
      typeof settings.modelName === 'string' && settings.modelName.trim()
        ? settings.modelName.trim()
        : provider.defaultModel,
    apiEndpoint,
    apiKey: typeof settings.apiKey === 'string' ? settings.apiKey.trim() : '',
    hasServerApiKey: false,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertChatMessages(value: unknown): asserts value is ChatMessage[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ChatRequestError('messages must be a non-empty array');
  }

  if (value.length > MAX_MESSAGES) {
    throw new ChatRequestError(
      `messages must contain at most ${MAX_MESSAGES} items`
    );
  }

  let totalLength = 0;

  value.forEach((message, index) => {
    if (!isRecord(message)) {
      throw new ChatRequestError(`messages[${index}] must be an object`);
    }

    if (
      typeof message.role !== 'string' ||
      !VALID_MESSAGE_ROLES.has(message.role)
    ) {
      throw new ChatRequestError(`messages[${index}].role is invalid`);
    }

    if (typeof message.content !== 'string') {
      throw new ChatRequestError(`messages[${index}].content must be a string`);
    }

    if (message.content.length > MAX_MESSAGE_LENGTH) {
      throw new ChatRequestError(`messages[${index}].content is too long`);
    }
    totalLength += message.content.length;
  });

  if (totalLength > MAX_TOTAL_MESSAGE_LENGTH) {
    throw new ChatRequestError('messages total content is too long');
  }
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
    throw new ChatRequestError(`${context} must be an object`);
  }

  Object.entries(value).forEach(([key, parameterValue]) => {
    if (!isGraphParameterValue(parameterValue)) {
      throw new ChatRequestError(`${context}.${key} is invalid`);
    }
  });
}

function assertStringRecord(value: unknown, context: string): void {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    throw new ChatRequestError(`${context} must be an object`);
  }

  Object.entries(value).forEach(([key, recordValue]) => {
    if (typeof recordValue !== 'string') {
      throw new ChatRequestError(`${context}.${key} must be a string`);
    }
  });
}

function assertOptionalStringOrNull(value: unknown, context: string): void {
  if (value === undefined || value === null) {
    return;
  }

  if (typeof value !== 'string') {
    throw new ChatRequestError(`${context} must be a string`);
  }
}

function assertOptionalNonEmptyString(value: unknown, context: string): void {
  if (value === undefined) {
    return;
  }

  if (typeof value !== 'string' || !value.trim()) {
    throw new ChatRequestError(`${context} must be a non-empty string`);
  }

  if (value.length > MAX_THREAD_ID_LENGTH || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new ChatRequestError(`${context} has an invalid format`);
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
    throw new ChatRequestError(
      'initialState must include nodes and edges arrays'
    );
  }

  if (value.nodes.length > MAX_GRAPH_NODES) {
    throw new ChatRequestError(
      `initialState.nodes must contain at most ${MAX_GRAPH_NODES} items`
    );
  }
  if (value.edges.length > MAX_GRAPH_EDGES) {
    throw new ChatRequestError(
      `initialState.edges must contain at most ${MAX_GRAPH_EDGES} items`
    );
  }

  const nodeIds = new Set<string>();

  value.nodes.forEach((node, index) => {
    if (!isRecord(node)) {
      throw new ChatRequestError(
        `initialState.nodes[${index}] must be an object`
      );
    }

    if (typeof node.id !== 'string' || !node.id.trim()) {
      throw new ChatRequestError(`initialState.nodes[${index}].id is invalid`);
    }

    if (nodeIds.has(node.id)) {
      throw new ChatRequestError(
        `initialState.nodes[${index}].id is duplicated`
      );
    }
    nodeIds.add(node.id);

    if (!isRecord(node.position)) {
      throw new ChatRequestError(
        `initialState.nodes[${index}].position is invalid`
      );
    }

    if (!isFiniteNumber(node.position.x) || !isFiniteNumber(node.position.y)) {
      throw new ChatRequestError(
        `initialState.nodes[${index}].position must use finite numbers`
      );
    }

    if (!isRecord(node.data) || typeof node.data.type !== 'string') {
      throw new ChatRequestError(
        `initialState.nodes[${index}].data.type is invalid`
      );
    }

    assertParameterRecord(
      node.data.parameters,
      `initialState.nodes[${index}].data.parameters`
    );

    if (node.data.ports !== undefined) {
      if (!isRecord(node.data.ports)) {
        throw new ChatRequestError(
          `initialState.nodes[${index}].data.ports is invalid`
        );
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
      throw new ChatRequestError(
        `initialState.edges[${index}] must be an object`
      );
    }

    if (typeof edge.source !== 'string' || !edge.source.trim()) {
      throw new ChatRequestError(
        `initialState.edges[${index}].source is invalid`
      );
    }

    if (typeof edge.target !== 'string' || !edge.target.trim()) {
      throw new ChatRequestError(
        `initialState.edges[${index}].target is invalid`
      );
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
      throw new ChatRequestError(
        `initialState.edges[${index}].source is missing`
      );
    }

    if (!nodeIds.has(edge.target)) {
      throw new ChatRequestError(
        `initialState.edges[${index}].target is missing`
      );
    }
  });
}

async function* streamChat(
  messages: ChatMessage[],
  settings: AISettings,
  initialState: GraphStateSnapshot,
  threadId?: string,
  action?: 'approve' | 'reject'
) {
  const session = await auth();
  const userId = session?.user?.id;

  assertChatMessages(messages);
  assertGraphStateSnapshot(initialState);
  assertOptionalNonEmptyString(threadId, 'threadId');
  if (action !== undefined && !VALID_ACTIONS.has(action)) {
    throw new ChatRequestError('action is invalid');
  }
  if (action !== undefined && !threadId?.trim()) {
    throw new ChatRequestError('threadId is required for approval actions');
  }

  if (!userId && threadId && !ANONYMOUS_THREAD_ID_PATTERN.test(threadId)) {
    // 匿名会话的 threadId 就是唯一凭据，必须是不可猜测的 UUID。
    throw new ChatRequestError('threadId has an invalid format');
  }

  // 登录用户使用数据库中加密保存的设置；匿名用户只使用本次请求携带的
  // 密钥，不读取或写入任何用户数据。
  const resolvedSettings = await resolveSettings(userId, settings);
  if (!resolvedSettings.apiKey) {
    throw new ChatRequestError('请先配置AI API密钥');
  }

  const agent = Agent.getInstance();
  // 客户端 threadId 只作为公开会话标识；数据库 key 必须绑定当前用户，
  // 防止仅凭另一个用户的 threadId 恢复或批准其 LangGraph 状态。
  // 匿名会话使用独立的 anon 命名空间，与任何用户 id 不会冲突（用户 id 经过编码且不含该前缀）。
  const checkpointThreadId = threadId
    ? userId
      ? `${encodeURIComponent(userId)}:${threadId}`
      : `anon:${threadId}`
    : undefined;
  const generator = agent.streamMessage(
    messages,
    resolvedSettings,
    initialState,
    threadId,
    action,
    checkpointThreadId
  );

  for await (const part of generator) {
    // Ensure the return value is serializable
    yield JSON.parse(JSON.stringify(part));
  }
}

/**
 * Server Action 抛出的异常在生产环境会被 Next.js 打码为 digest，客户端无从得知原因。
 * 因此所有失败都转换为 `error` 事件返回，详细堆栈只写入服务端日志。
 */
export async function* chatWithAgent(
  messages: ChatMessage[],
  settings: AISettings,
  initialState: GraphStateSnapshot,
  threadId?: string,
  action?: 'approve' | 'reject'
) {
  try {
    yield* streamChat(messages, settings, initialState, threadId, action);
  } catch (error) {
    const apiKey =
      isRecord(settings) && typeof settings.apiKey === 'string'
        ? settings.apiKey.trim()
        : undefined;
    const event = toChatErrorEvent(error, apiKey);
    if (event.code === 'internal') {
      logger.error('Chat request failed', error);
    }
    yield event;
  }
}
