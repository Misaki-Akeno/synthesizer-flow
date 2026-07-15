import { describe, expect, it } from 'vitest';
import { getCanonicalToolName, normalizeLegacyToolCall } from './legacy';

describe('legacy Agent tool protocol', () => {
  it('keeps current tool calls unchanged', () => {
    expect(
      normalizeLegacyToolCall('module_update', {
        moduleId: 'node-1',
        parameter: 'value',
        value: 440,
      })
    ).toEqual({
      name: 'module_update',
      args: { moduleId: 'node-1', parameter: 'value', value: 440 },
    });
  });

  it('maps legacy parameter and connection arguments', () => {
    expect(
      normalizeLegacyToolCall('update_module_parameter', {
        moduleId: 'node-1',
        paramKey: 'value',
        value: 880,
      })
    ).toEqual({
      name: 'module_update',
      args: { moduleId: 'node-1', parameter: 'value', value: 880 },
    });

    expect(
      normalizeLegacyToolCall('disconnect_modules', {
        sourceId: 'node-1',
        targetId: 'node-2',
        sourceHandle: 'output',
        targetHandle: 'input',
      })
    ).toEqual({
      name: 'connection_disconnect',
      args: {
        sourceId: 'node-1',
        targetId: 'node-2',
        sourcePort: 'output',
        targetPort: 'input',
      },
    });
  });

  it('maps old destructive names to the current approval policy names', () => {
    expect(getCanonicalToolName('delete_module')).toBe('module_delete');
    expect(getCanonicalToolName('disconnect_modules')).toBe(
      'connection_disconnect'
    );
  });
});
