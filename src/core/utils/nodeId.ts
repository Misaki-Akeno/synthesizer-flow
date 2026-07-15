import { nanoid } from 'nanoid';

function createPrefixedId(
  prefix: string,
  existingIds: Iterable<string> = []
): string {
  const existing = new Set(existingIds);

  for (let attempt = 0; attempt < 10; attempt++) {
    const id = `${prefix}_${nanoid(10)}`;
    if (!existing.has(id)) {
      return id;
    }
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    const id = `${prefix}_${nanoid(16)}`;
    if (!existing.has(id)) {
      return id;
    }
  }

  return `${prefix}_${nanoid(24)}`;
}

export function createNodeId(existingIds: Iterable<string> = []): string {
  return createPrefixedId('node', existingIds);
}

export function createModuleId(existingIds: Iterable<string> = []): string {
  return createPrefixedId('module', existingIds);
}

export function createEdgeId(existingIds: Iterable<string> = []): string {
  return createPrefixedId('edge', existingIds);
}
