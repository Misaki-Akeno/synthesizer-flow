import { describe, expect, it } from 'vitest';
import {
  getAutomationValueAtTick,
  normalizeTransportDocument,
  simplifyAutomationDocument,
  upsertAutomationPoint,
} from './automation';
import { createDefaultTransportDocument } from './types';

describe('transport automation', () => {
  it('records and linearly interpolates numeric parameters', () => {
    let document = createDefaultTransportDocument();
    document = upsertAutomationPoint(document, 'osc', 'gain', 0, 0);
    document = upsertAutomationPoint(document, 'osc', 'gain', 1, 480);

    expect(getAutomationValueAtTick(document.automationLanes[0], 240)).toBe(
      0.5
    );
  });

  it('uses step interpolation for non numeric parameters', () => {
    let document = createDefaultTransportDocument();
    document = upsertAutomationPoint(document, 'osc', 'waveform', 'sine', 0);
    document = upsertAutomationPoint(
      document,
      'osc',
      'waveform',
      'square',
      480
    );

    expect(getAutomationValueAtTick(document.automationLanes[0], 240)).toBe(
      'sine'
    );
  });

  it('normalizes malformed persisted transport data safely', () => {
    const document = normalizeTransportDocument({
      version: 99,
      bpm: 999,
      timeSignature: [0, 0],
      loopEnabled: false,
      automationLanes: [{ id: 123 }],
    });

    expect(document.bpm).toBe(320);
    expect(document.timeSignature).toEqual([4, 4]);
    expect(document.loopEnabled).toBe(false);
    expect(document.loopRange).toEqual({ startTick: 0, endTick: 7680 });
    expect(document.automationMode).toBe('touch');
    expect(document.automationLanes).toEqual([]);
  });

  it('normalizes loop ranges and recording modes from persisted data', () => {
    const document = normalizeTransportDocument({
      loopRange: { startTick: 960, endTick: 480 },
      automationMode: 'write',
    });

    expect(document.loopRange).toEqual({ startTick: 960, endTick: 1440 });
    expect(document.automationMode).toBe('write');
  });

  it('removes redundant linear recording points', () => {
    let document = createDefaultTransportDocument();
    document = upsertAutomationPoint(document, 'osc', 'gain', 0, 0);
    document = upsertAutomationPoint(document, 'osc', 'gain', 0.5, 240);
    document = upsertAutomationPoint(document, 'osc', 'gain', 1, 480);

    expect(
      simplifyAutomationDocument(document).automationLanes[0].points
    ).toHaveLength(2);
  });
});
