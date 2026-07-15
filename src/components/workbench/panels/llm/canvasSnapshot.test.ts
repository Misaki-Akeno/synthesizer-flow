import { describe, expect, it } from 'vitest';
import {
  createSerializableCanvasSnapshot,
  readRuntimeParameters,
} from './canvasSnapshot';

describe('canvas snapshot helpers', () => {
  it('reads the latest runtime parameter values over stale fallback values', () => {
    const parameters = readRuntimeParameters(
      {
        frequency: { getValue: () => 880 },
        enabled: { getValue: () => false },
        ignored: 123,
      },
      {
        frequency: 440,
        detune: 0,
      }
    );

    expect(parameters).toEqual({
      frequency: 880,
      enabled: false,
      detune: 0,
      ignored: 123,
    });
  });

  it('creates a serializable canvas snapshot with ports and without module instances', () => {
    const snapshot = createSerializableCanvasSnapshot(
      [
        {
          id: 'osc-1',
          position: { x: 10, y: 20 },
          data: {
            type: 'oscillator',
            label: 'Oscillator',
            parameters: { frequency: 440 },
            module: {
              parameters: {
                frequency: { getValue: () => 220 },
              },
              inputPortTypes: { frequency: 'number' },
              outputPortTypes: { out: 'audio' },
            },
          },
        },
      ],
      [
        {
          id: 'edge-1',
          source: 'osc-1',
          target: 'speaker-1',
        },
      ]
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
    expect(snapshot.edges).toEqual([
      {
        id: 'edge-1',
        source: 'osc-1',
        target: 'speaker-1',
      },
    ]);
  });

  it('omits parameters that cannot be restored from a checkpoint graph state', () => {
    const snapshot = createSerializableCanvasSnapshot(
      [
        {
          id: 'logic-1',
          position: { x: 0, y: 0 },
          data: {
            type: 'calculator',
            parameters: {
              operation: 'add',
              nested: { value: 1 },
            },
            module: {
              parameters: {
                output: { getValue: () => [1, 2, 3] },
                enabled: { getValue: () => true },
              },
            },
          },
        },
      ],
      []
    );

    expect(snapshot.nodes[0].data.parameters).toEqual({
      operation: 'add',
      enabled: true,
    });
  });

  it('omits non-finite numeric parameter values from snapshots', () => {
    const parameters = readRuntimeParameters(
      {
        frequency: { getValue: () => Number.NaN },
        gain: { getValue: () => Number.POSITIVE_INFINITY },
        enabled: { getValue: () => true },
      },
      {
        detune: Number.NEGATIVE_INFINITY,
        waveform: 'sine',
      }
    );

    expect(parameters).toEqual({
      enabled: true,
      waveform: 'sine',
    });
  });
});
