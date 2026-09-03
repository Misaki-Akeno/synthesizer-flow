import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioGraphRuntime } from './AudioGraphRuntime';

const runtime = new AudioGraphRuntime();

afterEach(() => {
  runtime.dispose();
  vi.restoreAllMocks();
});

describe('AudioGraphRuntime', () => {
  it('publishes serializable snapshots and emits one update per parameter patch', () => {
    runtime.applyPatches([
      {
        type: 'createModule',
        module: {
          id: 'number',
          type: 'numberinput',
          name: 'Number',
          enabled: true,
          parameters: {},
        },
      },
    ]);
    const listener = vi.fn();
    const unsubscribe = runtime.subscribeModule('number', listener);

    runtime.applyPatches([
      {
        type: 'setParameter',
        moduleId: 'number',
        key: 'value',
        value: 440,
      },
    ]);

    const snapshot = runtime.getModuleSnapshot('number');
    expect(snapshot?.parameters.value).toBe(440);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(() => JSON.stringify(snapshot)).not.toThrow();
    expect(JSON.stringify(snapshot)).not.toContain('BehaviorSubject');
    unsubscribe();
  });

  it('keeps runtime action callbacks out of public snapshots', () => {
    runtime.applyPatches([
      {
        type: 'createModule',
        module: {
          id: 'speaker',
          type: 'speaker',
          name: 'Speaker',
          enabled: false,
          parameters: {},
        },
      },
    ]);

    const customUI = runtime.getModuleSnapshot('speaker')?.customUI;
    expect(customUI?.actions).toContain('onClick');
    expect(customUI?.props).not.toHaveProperty('onClick');
    expect(() => JSON.stringify(customUI)).not.toThrow();
  });

  it('notifies only the module whose snapshot changed', () => {
    runtime.applyPatches(
      ['number-a', 'number-b'].map((id) => ({
        type: 'createModule' as const,
        module: {
          id,
          type: 'numberinput',
          name: id,
          enabled: true,
          parameters: {},
        },
      }))
    );
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    runtime.subscribeModule('number-a', listenerA);
    runtime.subscribeModule('number-b', listenerB);

    runtime.applyPatches([
      {
        type: 'setParameter',
        moduleId: 'number-a',
        key: 'value',
        value: 220,
      },
    ]);

    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).not.toHaveBeenCalled();
  });

  it('refreshes after a rejected async action without creating a rejected chain', async () => {
    const rejection = Promise.reject(new Error('recording failed'));
    const internals = runtime as unknown as {
      actions: Map<string, Map<string, () => Promise<never>>>;
      refreshSnapshot: (moduleId: string) => void;
    };
    const refreshSnapshot = vi.spyOn(internals, 'refreshSnapshot');
    internals.actions.set(
      'async-module',
      new Map([['startRecording', () => rejection]])
    );

    const returned = runtime.invokeAction('async-module', 'startRecording');

    expect(returned).toBe(rejection);
    await expect(returned).rejects.toThrow('recording failed');
    await Promise.resolve();
    expect(refreshSnapshot).toHaveBeenCalledTimes(2);
  });
});
