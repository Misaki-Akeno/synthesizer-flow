import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioModuleBase } from './AudioModuleBase';
import { ModuleBase, ModuleInterface, PortType } from './ModuleBase';
import { moduleInitManager } from '../services/ModuleInitManager';

class Source extends ModuleBase {
  constructor(id: string) {
    super('source', id, id, {}, {}, {
      output: { type: PortType.AUDIO, value: { id } },
    });
  }
}

class RetryInput extends AudioModuleBase {
  private attempts = 0;
  public received: Array<[string, ModuleInterface, string, string]> = [];

  constructor() {
    super('retry', 'retry', 'Retry', {}, {
      left: { type: PortType.AUDIO, value: null },
      right: { type: PortType.AUDIO, value: null },
    });
  }

  protected async initializeAudio(): Promise<void> {
    if (++this.attempts === 1) throw new Error('setup failed');
  }

  protected handleAudioInput(
    port: string, value: ModuleInterface, source: string, sourcePort: string
  ): void {
    if (this.initialized) this.received.push([port, value, source, sourcePort]);
    super.handleAudioInput(port, value, source, sourcePort);
  }
}

describe('AudioModuleBase retry input restoration', () => {
  beforeEach(() => moduleInitManager.reset());

  it('cleans late setup resources after disposal without calling dispose twice', async () => {
    let finishSetup!: () => void;
    let markStarted!: () => void;
    const gate = new Promise<void>((resolve) => { finishSetup = resolve; });
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const disposeNode = vi.fn();
    class LateAudio extends AudioModuleBase {
      private hasNode = false;
      public disposeCalls = 0;
      constructor() { super('late', 'late', 'Late'); }
      protected async initializeAudio(): Promise<void> {
        markStarted();
        await gate;
        this.hasNode = true;
      }
      protected cleanupFailedAudioInitialization(): void {
        if (this.hasNode) disposeNode();
        this.hasNode = false;
        super.cleanupFailedAudioInitialization();
      }
      public dispose(): void {
        ++this.disposeCalls;
        super.dispose();
      }
    }
    const target = new LateAudio();
    await started;
    target.dispose();
    finishSetup();
    await gate;
    await Promise.resolve();
    expect(disposeNode).toHaveBeenCalledOnce();
    expect(target.disposeCalls).toBe(1);
    expect(target.enabled.observed).toBe(false);
    expect(moduleInitManager.getModuleStatus(target.id)).toBe('disposed');
  });

  it('restores multiple live sources using current outputs and excludes disconnected sources', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const target = new RetryInput();
    const left = new Source('left');
    const right = new Source('right');
    const removed = new Source('removed');
    try {
      target.bindInputToOutput('left', left, 'output');
      target.bindInputToOutput('left', removed, 'output');
      target.bindInputToOutput('right', right, 'output');
      await expect(moduleInitManager.waitForModuleInit(target.id)).rejects.toThrow('setup failed');
      target.unbindInput('left', removed.id, 'output');
      const replacement = { id: 'latest-left-node' };
      left.outputPorts.output.next(replacement);
      await target.retryModuleInitialization();
      expect(target.received).toEqual([
        ['left', replacement, 'left', 'output'],
        ['right', right.getOutputValue('output'), 'right', 'output'],
      ]);
    } finally {
      target.dispose();
      left.dispose();
      right.dispose();
      removed.dispose();
      errorLog.mockRestore();
    }
  });
});
