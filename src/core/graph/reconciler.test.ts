import { describe, expect, it } from 'vitest';
import { reconcileAudioGraph } from './reconciler';
import type { AudioGraphDocument } from './types';

function document(
  overrides: Partial<AudioGraphDocument> = {}
): AudioGraphDocument {
  return {
    revision: 1,
    modules: [],
    connections: [],
    ...overrides,
  };
}

const oscillator = {
  id: 'osc',
  type: 'simpleoscillator',
  name: 'Oscillator',
  enabled: true,
  parameters: { freq: 440, gain: 1 },
};

describe('reconcileAudioGraph', () => {
  it('参数变化只生成一个 setParameter，不重建模块', () => {
    const patches = reconcileAudioGraph(
      document({ modules: [oscillator] }),
      document({
        revision: 2,
        modules: [
          {
            ...oscillator,
            parameters: { ...oscillator.parameters, freq: 880 },
          },
        ],
      })
    );

    expect(patches).toEqual([
      {
        type: 'setParameter',
        moduleId: 'osc',
        key: 'freq',
        value: 880,
      },
    ]);
  });

  it('新增连接只生成 connect，不更新无关模块', () => {
    const speaker = {
      id: 'speaker',
      type: 'speaker',
      name: 'Speaker',
      enabled: true,
      parameters: {},
    };
    const connection = {
      source: 'osc',
      sourcePort: 'audioout',
      target: 'speaker',
      targetPort: 'audioInLeft',
    };

    const patches = reconcileAudioGraph(
      document({ modules: [oscillator, speaker] }),
      document({
        revision: 2,
        modules: [oscillator, speaker],
        connections: [connection],
      })
    );

    expect(patches).toEqual([{ type: 'connect', connection }]);
  });

  it('替换模块时先断开和销毁，再创建和连接', () => {
    const previousConnection = {
      source: 'osc',
      sourcePort: 'audioout',
      target: 'effect',
      targetPort: 'input',
    };
    const previousEffect = {
      id: 'effect',
      type: 'reverb',
      name: 'Effect',
      enabled: true,
      parameters: {},
    };
    const nextEffect = { ...previousEffect, type: 'delay' };

    const patches = reconcileAudioGraph(
      document({
        modules: [oscillator, previousEffect],
        connections: [previousConnection],
      }),
      document({
        revision: 2,
        modules: [oscillator, nextEffect],
        connections: [previousConnection],
      })
    );

    expect(patches.map((patch) => patch.type)).toEqual([
      'disconnect',
      'disposeModule',
      'createModule',
      'connect',
    ]);
  });
});
