import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getAISettingsAction,
  saveAISettingsAction,
} from './ai-settings.actions';
import { auth } from '@/lib/auth/auth';
import {
  getPublicAISettings,
  saveAISettingsForUser,
} from '@/lib/ai/server-settings';

vi.mock('@/lib/auth/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/ai/server-settings', () => ({
  getPublicAISettings: vi.fn(),
  saveAISettingsForUser: vi.fn(),
}));

const mockAuth = vi.mocked(auth);
const mockGetPublicAISettings = vi.mocked(getPublicAISettings);
const mockSaveAISettingsForUser = vi.mocked(saveAISettingsForUser);

const session = {
  user: {
    id: 'user-1',
    role: 'user',
    name: null,
    email: null,
    image: null,
  },
  expires: new Date(Date.now() + 60_000).toISOString(),
};

describe('AI settings actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated reads', async () => {
    mockAuth.mockResolvedValue(null);

    const result = await getAISettingsAction();

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(mockGetPublicAISettings).not.toHaveBeenCalled();
  });

  it('returns only public settings for authenticated users', async () => {
    mockAuth.mockResolvedValue(session);
    mockGetPublicAISettings.mockResolvedValue({
      modelName: 'qwen',
      apiEndpoint: 'https://example.com/v1',
      hasServerApiKey: true,
    });

    const result = await getAISettingsAction();

    expect(result).toEqual({
      success: true,
      data: {
        modelName: 'qwen',
        apiEndpoint: 'https://example.com/v1',
        hasServerApiKey: true,
      },
    });
    expect(mockGetPublicAISettings).toHaveBeenCalledWith('user-1');
  });

  it('saves settings for the authenticated user only', async () => {
    mockAuth.mockResolvedValue(session);
    mockSaveAISettingsForUser.mockResolvedValue({
      modelName: 'qwen-plus',
      apiEndpoint: 'https://example.com/v1',
      hasServerApiKey: true,
    });

    const result = await saveAISettingsAction({
      modelName: 'qwen-plus',
      apiEndpoint: 'https://example.com/v1',
      apiKey: 'secret',
    });

    expect(result.success).toBe(true);
    expect(mockSaveAISettingsForUser).toHaveBeenCalledWith('user-1', {
      modelName: 'qwen-plus',
      apiEndpoint: 'https://example.com/v1',
      apiKey: 'secret',
    });
  });

  it('returns validation errors from server-side settings checks', async () => {
    mockAuth.mockResolvedValue(session);
    const error = new Error('apiEndpoint must be a valid URL');
    error.name = 'AISettingsValidationError';
    mockSaveAISettingsForUser.mockRejectedValue(error);

    const result = await saveAISettingsAction({
      apiEndpoint: 'not a url',
    });

    expect(result).toEqual({
      success: false,
      error: 'apiEndpoint must be a valid URL',
    });
  });

  it('does not expose unexpected save errors to the client', async () => {
    mockAuth.mockResolvedValue(session);
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockSaveAISettingsForUser.mockRejectedValue(
      new Error('database connection string')
    );

    const result = await saveAISettingsAction({
      apiEndpoint: 'https://example.com/v1',
    });

    expect(result).toEqual({
      success: false,
      error: 'Failed to save AI settings',
    });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
