import {
    BaseCheckpointSaver,
    Checkpoint,
    CheckpointMetadata,
    CheckpointTuple,
    PendingWrite,
    CheckpointListOptions
} from "@langchain/langgraph-checkpoint";
import { RunnableConfig } from "@langchain/core/runnables";
import { load } from "@langchain/core/load";
import { db } from "@/db/client";
import { langgraphCheckpoints, langgraphWrites } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export class DrizzleCheckpointer extends BaseCheckpointSaver {
    constructor() {
        super();
    }

    async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
        const thread_id = config.configurable?.thread_id;
        const checkpoint_id = config.configurable?.checkpoint_id;

        if (!thread_id) {
            return undefined;
        }

        if (checkpoint_id) {
            const [row] = await db
                .select()
                .from(langgraphCheckpoints)
                .where(
                    and(
                        eq(langgraphCheckpoints.thread_id, thread_id),
                        eq(langgraphCheckpoints.checkpoint_id, checkpoint_id)
                    )
                );

            if (row) {
                return {
                    config,
                    checkpoint: (await load(JSON.stringify(row.checkpoint))) as Checkpoint,
                    metadata: (await load(JSON.stringify(row.metadata))) as CheckpointMetadata,
                    parentConfig: row.parent_checkpoint_id
                        ? {
                            configurable: {
                                thread_id,
                                checkpoint_id: row.parent_checkpoint_id,
                            },
                        }
                        : undefined,
                };
            }
        } else {
            const [row] = await db
                .select()
                .from(langgraphCheckpoints)
                .where(eq(langgraphCheckpoints.thread_id, thread_id))
                .orderBy(desc(langgraphCheckpoints.checkpoint_id)) // Assuming Lexicographical ordering works for IDs
                .limit(1);

            if (row) {
                return {
                    config: {
                        configurable: {
                            thread_id,
                            checkpoint_id: row.checkpoint_id,
                        },
                    },
                    checkpoint: (await load(JSON.stringify(row.checkpoint))) as Checkpoint,
                    metadata: (await load(JSON.stringify(row.metadata))) as CheckpointMetadata,
                    parentConfig: row.parent_checkpoint_id
                        ? {
                            configurable: {
                                thread_id,
                                checkpoint_id: row.parent_checkpoint_id,
                            },
                        }
                        : undefined,
                };
            }
        }

        return undefined;
    }

    async put(
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        newVersions: Record<string, string | number> // eslint-disable-line @typescript-eslint/no-unused-vars
    ): Promise<RunnableConfig> {
        const thread_id = config.configurable?.thread_id;
        const checkpoint_id = checkpoint.id;
        const parent_checkpoint_id = config.configurable?.checkpoint_id;

        if (!thread_id) {
            return config;
        }

        const checkpointJson = JSON.stringify(checkpoint);
        const metadataJson = JSON.stringify(metadata);

        await db
            .insert(langgraphCheckpoints)
            .values({
                thread_id,
                checkpoint_id,
                parent_checkpoint_id,
                checkpoint: JSON.parse(checkpointJson),
                metadata: JSON.parse(metadataJson),
            })
            .onConflictDoUpdate({
                target: [langgraphCheckpoints.thread_id, langgraphCheckpoints.checkpoint_id],
                set: {
                    checkpoint: JSON.parse(checkpointJson),
                    metadata: JSON.parse(metadataJson),
                },
            });

        return {
            configurable: {
                thread_id,
                checkpoint_id,
            },
        };
    }

    async putWrites(
        config: RunnableConfig,
        writes: PendingWrite[],
        taskId: string
    ): Promise<void> {
        const thread_id = config.configurable?.thread_id;
        const checkpoint_id = config.configurable?.checkpoint_id;

        if (!thread_id || !checkpoint_id) {
            return;
        }

        await db.transaction(async (tx) => {
            for (const [idx, write] of writes.entries()) {
                const valueJson = JSON.stringify(write[1]);
                await tx.insert(langgraphWrites).values({
                    thread_id,
                    checkpoint_id,
                    task_id: taskId,
                    idx,
                    channel: write[0],
                    value: write[1] === undefined ? null : JSON.parse(valueJson),
                });
            }
        });
    }

    async deleteThread(threadId: string): Promise<void> {
        if (!threadId) {
            return;
        }
        await db.delete(langgraphCheckpoints).where(eq(langgraphCheckpoints.thread_id, threadId));
        await db.delete(langgraphWrites).where(eq(langgraphWrites.thread_id, threadId));
    }

    async *list(
        config: RunnableConfig,
        options?: CheckpointListOptions
    ): AsyncGenerator<CheckpointTuple> {
        const thread_id = config.configurable?.thread_id;
        const limit = options?.limit ?? 10;
        const before = options?.before;

        if (!thread_id) {
            return;
        }

        const query = db
            .select()
            .from(langgraphCheckpoints)
            .where(eq(langgraphCheckpoints.thread_id, thread_id))
            .orderBy(desc(langgraphCheckpoints.checkpoint_id))
            .limit(limit);

        if (before && before.configurable?.checkpoint_id) {
            // Simple string comparison for before... might fail if IDs assume complex ordering
            // But for standard usage where we just want "latest", this list logic is secondary.
            // We leave it basic for now.
        }

        const rows = await query;

        for (const row of rows) {
            yield {
                config: {
                    configurable: {
                        thread_id,
                        checkpoint_id: row.checkpoint_id,
                    },
                },
                checkpoint: row.checkpoint as Checkpoint,
                metadata: row.metadata as CheckpointMetadata,
                parentConfig: row.parent_checkpoint_id
                    ? {
                        configurable: {
                            thread_id,
                            checkpoint_id: row.parent_checkpoint_id,
                        },
                    }
                    : undefined,
            };
        }
    }
}
