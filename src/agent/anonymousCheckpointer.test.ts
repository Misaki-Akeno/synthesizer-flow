import { emptyCheckpoint } from '@langchain/langgraph-checkpoint';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnonymousCheckpointer } from './anonymousCheckpointer';

const metadata = { source: 'input' as const, step: 0, parents: {} };

describe('anonymous checkpoint limits', () => {
  afterEach(() => vi.useRealTimers());

  it('expires anonymous conversation data after thirty minutes', async () => {
    vi.useFakeTimers();
    const saver = new AnonymousCheckpointer();
    const config = { configurable: { thread_id: 'anon:one' } };
    await saver.put(config, emptyCheckpoint(), metadata);
    expect(await saver.getTuple(config)).toBeDefined();
    vi.advanceTimersByTime(30 * 60_000);
    expect(await saver.getTuple(config)).toBeUndefined();
  });

  it('rejects oversized checkpoints and releases their memory', async () => {
    const saver = new AnonymousCheckpointer();
    const checkpoint = emptyCheckpoint();
    checkpoint.channel_values = { oversized: 'x'.repeat(1_000_001) };
    await expect(saver.put(
      { configurable: { thread_id: 'anon:large' } }, checkpoint, metadata
    )).rejects.toThrow(/容量上限/);
    expect(saver.storage['anon:large']).toBeUndefined();
  });

  it('bounds concurrent session count and reuses capacity after deletion', async () => {
    const saver = new AnonymousCheckpointer();
    for (let i = 0; i < 32; ++i) {
      await saver.put({ configurable: { thread_id: `anon:${i}` } }, emptyCheckpoint(), metadata);
    }
    const extra = { configurable: { thread_id: 'anon:extra' } };
    await expect(saver.put(extra, emptyCheckpoint(), metadata)).rejects.toThrow(/数量已达上限/);
    await saver.deleteThread('anon:0');
    await expect(saver.put(extra, emptyCheckpoint(), metadata)).resolves.toBeDefined();
  });
});
