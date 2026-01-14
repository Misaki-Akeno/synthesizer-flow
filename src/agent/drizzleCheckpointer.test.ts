
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DrizzleCheckpointer } from './drizzleCheckpointer';
// import { db } from '@/db/client';

// Mock the db client
vi.mock('@/db/client', () => ({
    db: {
        select: vi.fn(),
        insert: vi.fn(),
        transaction: vi.fn(),
    },
}));

describe('DrizzleCheckpointer', () => {
    let checkpointer: DrizzleCheckpointer;

    beforeEach(() => {
        checkpointer = new DrizzleCheckpointer();
        vi.clearAllMocks();
    });

    it('should be defined', () => {
        expect(checkpointer).toBeDefined();
    });

    it('should return undefined if no thread_id in config', async () => {
        const config = { configurable: {} };
        const result = await checkpointer.getTuple(config);
        expect(result).toBeUndefined();
    });

    // Add more tests for put, list, etc. as needed
    // This is a basic sanity check
});
