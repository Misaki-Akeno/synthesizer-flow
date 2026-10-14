import { afterEach, describe, expect, it, vi } from 'vitest';
import { audioGraphRuntime } from '@/core/runtime/AudioGraphRuntime';
import { createSerializableCanvasSnapshot } from './canvasSnapshot';

afterEach(() => vi.restoreAllMocks());

describe('canvas snapshot helpers', () => {
  it('使用可序列化运行时快照增强参数和端口，不泄漏模块实例', () => {
    vi.spyOn(audioGraphRuntime, 'getModuleSnapshot').mockReturnValue({
      parameters: { frequency: 220 },
      inputPortTypes: { frequency: 'number' },
      outputPortTypes: { out: 'audio' },
    } as never);

    const snapshot = createSerializableCanvasSnapshot(
      [
        {
          id: 'osc-1',
          position: { x: 10, y: 20 },
          data: {
            type: 'oscillator',
            label: 'Oscillator',
            parameters: { frequency: 440 },
          },
        },
      ],
      [{ id: 'edge-1', source: 'osc-1', target: 'speaker-1' }]
    );

    expect(snapshot.nodes[0].data).toEqual(
      expect.objectContaining({
        parameters: { frequency: 220 },
        ports: {
          inputs: { frequency: 'number' },
          outputs: { out: 'audio' },
        },
        module: undefined,
      })
    );
  });

  it('运行时尚未创建时使用纯图文档参数', () => {
    vi.spyOn(audioGraphRuntime, 'getModuleSnapshot').mockReturnValue(undefined);
    const snapshot = createSerializableCanvasSnapshot(
      [
        {
          id: 'logic-1',
          position: { x: 0, y: 0 },
          data: {
            type: 'calculator',
            parameters: { operation: 'add' },
          },
        },
      ],
      []
    );

    expect(snapshot.nodes[0].data.parameters).toEqual({ operation: 'add' });
  });
});
