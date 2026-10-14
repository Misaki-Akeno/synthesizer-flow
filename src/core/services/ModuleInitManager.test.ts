import { beforeEach, describe, expect, it, vi } from 'vitest';
import { moduleInitManager } from './ModuleInitManager';

describe('ModuleInitManager', () => {
  beforeEach(() => moduleInitManager.reset());

  it('settles a graph when one module fails so healthy modules do not remain blocked', () => {
    const ready = vi.fn();
    const healthyGeneration = moduleInitManager.registerPendingModule('healthy');
    const failedGeneration = moduleInitManager.registerPendingModule('failed');
    moduleInitManager.onAllModulesReady(ready);

    moduleInitManager.markModuleAsInitialized('healthy', healthyGeneration);
    expect(ready).not.toHaveBeenCalled();
    moduleInitManager.markModuleAsFailed('failed', new Error('Tone import failed'), failedGeneration);

    expect(ready).toHaveBeenCalledOnce();
    expect(moduleInitManager.getModuleStatus('healthy')).toBe('initialized');
    expect(moduleInitManager.getModuleStatus('failed')).toBe('failed');
    expect(moduleInitManager.getPendingModules()).toEqual([]);
  });

  it('rejects waiters on failure and disposal instead of leaving them pending', async () => {
    const failedGeneration = moduleInitManager.registerPendingModule('failed-waiter');
    const failedWaiter = moduleInitManager.waitForModuleInit('failed-waiter');
    moduleInitManager.markModuleAsFailed('failed-waiter', new Error('boom'), failedGeneration);
    await expect(failedWaiter).rejects.toThrow('boom');

    const disposedGeneration = moduleInitManager.registerPendingModule('disposed-waiter');
    const disposedWaiter = moduleInitManager.waitForModuleInit('disposed-waiter');
    moduleInitManager.recordDisposal('disposed-waiter', disposedGeneration);
    await expect(disposedWaiter).rejects.toThrow('disposed');
  });

  it('ignores a stale same-id initialization result after replacement', () => {
    const firstGeneration = moduleInitManager.registerPendingModule('reused-id');
    const replacementGeneration = moduleInitManager.registerPendingModule('reused-id');
    moduleInitManager.markModuleAsInitialized('reused-id', firstGeneration);

    expect(moduleInitManager.getModuleStatus('reused-id')).toBe('pending');
    moduleInitManager.markModuleAsInitialized('reused-id', replacementGeneration);
    expect(moduleInitManager.getModuleStatus('reused-id')).toBe('initialized');
  });

  it('turns a timed-out wait into a terminal failure that releases graph readiness', async () => {
    vi.useFakeTimers();
    const ready = vi.fn();
    moduleInitManager.registerPendingModule('slow-module');
    moduleInitManager.onAllModulesReady(ready);
    const waiter = moduleInitManager.waitForModuleInit('slow-module', { timeoutMs: 25 });
    const rejection = expect(waiter).rejects.toThrow('Timed out');

    await vi.advanceTimersByTimeAsync(25);
    await rejection;
    expect(moduleInitManager.getModuleStatus('slow-module')).toBe('failed');
    expect(ready).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('fails a registration that never receives an initialization result', async () => {
    vi.useFakeTimers();
    const ready = vi.fn();
    moduleInitManager.registerPendingModule('hung-module');
    moduleInitManager.onAllModulesReady(ready);

    await vi.advanceTimersByTimeAsync(15_000);

    expect(moduleInitManager.getModuleStatus('hung-module')).toBe('failed');
    expect(moduleInitManager.getModuleFailure('hung-module')?.message).toContain('Timed out');
    expect(ready).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
