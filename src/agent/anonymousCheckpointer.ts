import {
  MemorySaver,
  type Checkpoint,
  type CheckpointMetadata,
  type PendingWrite,
} from '@langchain/langgraph-checkpoint';
import type { RunnableConfig } from '@langchain/core/runnables';

const SESSION_TTL_MS = 30 * 60_000;
const MAX_SESSIONS = 32;
const MAX_CHECKPOINTS = 128;
const MAX_SESSION_BYTES = 1_000_000;

export class AnonymousSessionError extends Error {
  override name = 'AnonymousSessionError';
}

/** 匿名 checkpoint 不写数据库；会话数量、寿命和单会话体积均有上限。 */
export class AnonymousCheckpointer extends MemorySaver {
  private createdAt = new Map<string, number>();

  private async prepare(threadId: string): Promise<void> {
    for (const [id, created] of this.createdAt) {
      if (Date.now() - created >= SESSION_TTL_MS) await this.deleteThread(id);
    }
    if (threadId && !this.createdAt.has(threadId)) {
      if (this.createdAt.size >= MAX_SESSIONS) {
        throw new AnonymousSessionError('匿名会话数量已达上限，请登录后重试');
      }
      this.createdAt.set(threadId, Date.now());
    }
  }

  private async checkBudget(threadId: string): Promise<void> {
    let checkpoints = 0;
    let bytes = 0;
    for (const namespace of Object.values(this.storage[threadId] ?? {})) {
      for (const [checkpoint, metadata] of Object.values(namespace)) {
        ++checkpoints;
        bytes += checkpoint.byteLength + metadata.byteLength;
      }
    }
    for (const [key, writes] of Object.entries(this.writes)) {
      // MemorySaver 用 JSON([threadId, namespace, checkpointId]) 作 writes key。
      if ((JSON.parse(key) as string[])[0] !== threadId) continue;
      for (const [, , value] of Object.values(writes)) bytes += value.byteLength;
    }
    if (checkpoints > MAX_CHECKPOINTS || bytes > MAX_SESSION_BYTES) {
      await this.deleteThread(threadId);
      throw new AnonymousSessionError('匿名会话已达容量上限，请新建会话或登录');
    }
  }

  override async getTuple(config: RunnableConfig) {
    await this.prepare(config.configurable?.thread_id ?? '');
    return super.getTuple(config);
  }

  override async put(config: RunnableConfig, checkpoint: Checkpoint, metadata: CheckpointMetadata) {
    const threadId = config.configurable?.thread_id ?? '';
    await this.prepare(threadId);
    const result = await super.put(config, checkpoint, metadata);
    await this.checkBudget(threadId);
    return result;
  }

  override async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string) {
    const threadId = config.configurable?.thread_id ?? '';
    await this.prepare(threadId);
    await super.putWrites(config, writes, taskId);
    await this.checkBudget(threadId);
  }

  override async deleteThread(threadId: string) {
    await super.deleteThread(threadId);
    this.createdAt.delete(threadId);
  }
}

export const anonymousCheckpointer = new AnonymousCheckpointer();
