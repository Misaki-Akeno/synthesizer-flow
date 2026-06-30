import { describe, expect, it } from 'vitest';
import { normalizeAccountExpiresAt } from './drizzle-adapter';

describe('DrizzleAdapter helpers', () => {
  it('normalizes OAuth account expiry values for the integer database column', () => {
    expect(normalizeAccountExpiresAt(1_700_000_000)).toBe(1_700_000_000);
    expect(normalizeAccountExpiresAt(1_700_000_000.9)).toBe(1_700_000_000);
    expect(normalizeAccountExpiresAt(undefined)).toBeNull();
    expect(normalizeAccountExpiresAt(null)).toBeNull();
    expect(normalizeAccountExpiresAt(Number.NaN)).toBeNull();
    expect(normalizeAccountExpiresAt('1700000000')).toBeNull();
  });
});
