import { describe, expect, it } from 'vitest';
import {
  getAutomationValueAtTick,
  normalizeTransportDocument,
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
    expect(document.automationLanes).toEqual([]);
  });
});
