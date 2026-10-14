import { describe, expect, it } from 'vitest';
import { diagnoseAudioGraph } from './audioGraphDiagnostics';

const oscillator = {
  id: 'osc',
  type: 'default',
  data: {
    type: 'simpleoscillator',
    label: 'Oscillator',
    ports: { outputs: { audioOut: 'audio' } },
  },
};

const speaker = {
  id: 'speaker',
  type: 'default',
  data: {
    type: 'speaker',
    label: 'Speaker',
    ports: {
      inputs: { audioInLeft: 'audio', audioInRight: 'audio' },
      outputs: {},
    },
  },
};

describe('audio graph diagnostics', () => {
  it('suggests a complete safe output chain when no Speaker exists', () => {
    const report = diagnoseAudioGraph([oscillator], []);

    expect(report.health).toBe('attention');
    expect(report.findings).toEqual([
      expect.objectContaining({
        code: 'missing-output',
        fix: expect.objectContaining({
          kind: 'create-safe-output',
          sourceId: 'osc',
          sourcePort: 'audioOut',
        }),
      }),
    ]);
  });

  it('flags a silent Speaker and produces a stable fix id', () => {
    const first = diagnoseAudioGraph([oscillator, speaker], []);
    const second = diagnoseAudioGraph([oscillator, speaker], []);

    expect(first.health).toBe('critical');
    const finding = first.findings.find(
      (item) => item.code === 'silent-output'
    );
    expect(finding?.fix).toEqual(
      expect.objectContaining({
        kind: 'route-to-output',
        speakerId: 'speaker',
        speakerPort: 'audioInLeft',
      })
    );
    expect(finding?.fix?.id).toBe(
      second.findings.find((item) => item.code === 'silent-output')?.fix?.id
    );
  });

  it('detects direct unprotected output and audio feedback', () => {
    const effect = {
      id: 'effect',
      type: 'default',
      data: {
        type: 'reverb',
        label: 'Reverb',
        ports: {
          inputs: { input: 'audio' },
          outputs: { output: 'audio' },
        },
      },
    };
    const report = diagnoseAudioGraph(
      [oscillator, effect, speaker],
      [
        {
          id: 'to-effect',
          source: 'osc',
          target: 'effect',
          sourceHandle: 'audioOut',
          targetHandle: 'input',
        },
        {
          id: 'feedback',
          source: 'effect',
          target: 'effect',
          sourceHandle: 'output',
          targetHandle: 'input',
        },
        {
          id: 'direct-output',
          source: 'effect',
          target: 'speaker',
          sourceHandle: 'output',
          targetHandle: 'audioInLeft',
        },
      ]
    );

    expect(report.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(['unprotected-output', 'audio-feedback'])
    );
  });
});
