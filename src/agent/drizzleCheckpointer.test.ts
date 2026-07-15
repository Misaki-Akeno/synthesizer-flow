
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DrizzleCheckpointer } from './drizzleCheckpointer';
import { db } from '@/db/client';
import { langgraphCheckpoints, langgraphWrites } from '@/db/schema';

const mockDbState = vi.hoisted(() => ({
    deleteTargets: [] as unknown[],
    writeValues: [] as unknown[],
    writeConflicts: [] as unknown[],
}));

// Mock the db client
vi.mock('@/db/client', () => ({
    db: {
        select: vi.fn(),
        insert: vi.fn(),
        delete: vi.fn((target: unknown) => ({
            where: vi.fn(async () => {
                mockDbState.deleteTargets.push(target);
            }),
        })),
        transaction: vi.fn(async (callback: (tx: unknown) => Promise<void>) => {
            const tx = {
                insert: vi.fn(() => ({
                    values: vi.fn((value: unknown) => {
                        mockDbState.writeValues.push(value);
                        return {
                            onConflictDoUpdate: vi.fn(async (conflict: unknown) => {
                                mockDbState.writeConflicts.push(conflict);
                            }),
                        };
                    }),
                })),
            };

            await callback(tx);
        }),
    },
}));

describe('DrizzleCheckpointer', () => {
    let checkpointer: DrizzleCheckpointer;

    beforeEach(() => {
        checkpointer = new DrizzleCheckpointer();
        vi.clearAllMocks();
        mockDbState.deleteTargets = [];
        mockDbState.writeValues = [];
        mockDbState.writeConflicts = [];
    });

    it('should be defined', () => {
        expect(checkpointer).toBeDefined();
    });

    it('should return undefined if no thread_id in config', async () => {
        const config = { configurable: {} };
        const result = await checkpointer.getTuple(config);
        expect(result).toBeUndefined();
    });

    it('upserts pending writes to tolerate repeated graph retries', async () => {
        await checkpointer.putWrites(
            {
                configurable: {
                    thread_id: 'thread-1',
                    checkpoint_id: 'checkpoint-1',
                },
            },
            [['messages', { value: 'hello' }]],
            'task-1'
        );

        expect(db.transaction).toHaveBeenCalledTimes(1);
        expect(mockDbState.writeValues).toEqual([
            {
                thread_id: 'thread-1',
                checkpoint_id: 'checkpoint-1',
                task_id: 'task-1',
                idx: 0,
                channel: 'messages',
                value: { value: 'hello' },
            },
        ]);
        expect(mockDbState.writeConflicts).toEqual([
            expect.objectContaining({
                target: [
                    langgraphWrites.thread_id,
                    langgraphWrites.checkpoint_id,
                    langgraphWrites.task_id,
                    langgraphWrites.idx,
                ],
                set: {
                    channel: 'messages',
                    value: { value: 'hello' },
                },
            }),
        ]);
    });

    it('deletes writes before checkpoints when deleting a thread', async () => {
        await checkpointer.deleteThread('thread-1');

        expect(mockDbState.deleteTargets).toEqual([
            langgraphWrites,
            langgraphCheckpoints,
        ]);
    });
});
