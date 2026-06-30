export function normalizeTopK(value: unknown, fallback = 5): number {
  const numeric = Number(value);
  const base = Number.isFinite(numeric) ? numeric : fallback;
  return Math.max(1, Math.min(Math.floor(base), 20));
}
