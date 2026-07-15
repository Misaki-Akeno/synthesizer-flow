import { describe, expect, it, vi } from 'vitest';

const mockNanoid = vi.hoisted(() => vi.fn());

vi.mock('nanoid', () => ({
  nanoid: mockNanoid,
}));

describe('createNodeId', () => {
  it('prefixes generated ids with node', async () => {
    mockNanoid.mockReturnValueOnce('abc123');
    const { createNodeId } = await import('./nodeId');

    expect(createNodeId()).toBe('node_abc123');
    expect(mockNanoid).toHaveBeenCalledWith(10);
  });

  it('skips generated ids that already exist', async () => {
    mockNanoid.mockReset();
    mockNanoid.mockReturnValueOnce('taken').mockReturnValueOnce('fresh');
    const { createNodeId } = await import('./nodeId');

    expect(createNodeId(['node_taken'])).toBe('node_fresh');
  });
});

describe('prefixed id helpers', () => {
  it('creates module and edge ids with shared collision handling', async () => {
    mockNanoid.mockReset();
    mockNanoid
      .mockReturnValueOnce('module-taken')
      .mockReturnValueOnce('module-fresh')
      .mockReturnValueOnce('edge-fresh');
    const { createModuleId, createEdgeId } = await import('./nodeId');

    expect(createModuleId(['module_module-taken'])).toBe('module_module-fresh');
    expect(createEdgeId()).toBe('edge_edge-fresh');
  });

  it('checks longer fallback ids after repeated collisions', async () => {
    mockNanoid.mockReset();
    mockNanoid.mockReturnValueOnce('taken');
    mockNanoid.mockReturnValueOnce('taken');
    mockNanoid.mockReturnValueOnce('taken');
    mockNanoid.mockReturnValueOnce('taken');
    mockNanoid.mockReturnValueOnce('taken');
    mockNanoid.mockReturnValueOnce('taken');
    mockNanoid.mockReturnValueOnce('taken');
    mockNanoid.mockReturnValueOnce('taken');
    mockNanoid.mockReturnValueOnce('taken');
    mockNanoid.mockReturnValueOnce('taken');
    mockNanoid.mockReturnValueOnce('long-fresh');
    const { createEdgeId } = await import('./nodeId');

    expect(createEdgeId(['edge_taken'])).toBe('edge_long-fresh');
    expect(mockNanoid).toHaveBeenLastCalledWith(16);
  });
});
