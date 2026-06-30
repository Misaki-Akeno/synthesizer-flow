import { describe, expect, it, vi } from 'vitest';
import { authConfig } from './auth.config';

vi.mock('@/lib/env', () => ({
  env: {
    GITHUB_ID: 'github-id',
    GITHUB_SECRET: 'github-secret',
  },
}));

describe('authConfig callbacks', () => {
  it('copies database user id and role into the session', async () => {
    const result = await authConfig.callbacks!.session!({
      session: {
        user: {
          id: '',
          role: '',
          name: 'User',
          email: 'user@example.com',
          image: null,
        },
        expires: new Date(Date.now() + 60_000).toISOString(),
      },
      user: {
        id: 'user-1',
        role: 'admin',
        name: 'User',
        email: 'user@example.com',
        image: null,
        emailVerified: null,
      },
      token: {},
      newSession: undefined,
      trigger: 'update',
    });

    expect(result.user).toMatchObject({ id: 'user-1', role: 'admin' });
  });

  it('falls back to JWT id and role when no database user is provided', async () => {
    const result = await authConfig.callbacks!.session!({
      session: {
        user: {
          id: '',
          role: '',
          name: 'User',
          email: 'user@example.com',
          image: null,
        },
        expires: new Date(Date.now() + 60_000).toISOString(),
      },
      token: {
        sub: 'user-2',
        role: 'user',
      },
      user: undefined as never,
      newSession: undefined,
      trigger: 'update',
    });

    expect(result.user).toMatchObject({ id: 'user-2', role: 'user' });
  });

  it('copies user role into JWT on sign-in', async () => {
    const result = await authConfig.callbacks!.jwt!({
      token: {},
      user: {
        id: 'user-3',
        role: 'admin',
        name: 'User',
        email: 'user@example.com',
        image: null,
        emailVerified: null,
      },
      account: null,
      profile: undefined,
      isNewUser: false,
      trigger: 'signIn',
    });

    expect(result.id).toBe('user-3');
    expect(result.role).toBe('admin');
  });
});
