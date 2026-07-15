'use server';

import { auth } from '@/lib/auth/auth';
import {
  getPublicAISettings,
  saveAISettingsForUser,
  SaveAISettingsInput,
} from '@/lib/ai/server-settings';
import type { AIProviderId } from '@/lib/ai/providers';
import { isAIProviderId } from '@/lib/ai/providers';

export async function getAISettingsAction(providerId?: AIProviderId) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }
  if (providerId !== undefined && !isAIProviderId(providerId)) {
    return { success: false, error: 'Invalid provider' };
  }

  try {
    const data = await getPublicAISettings(session.user.id, providerId);
    return { success: true, data };
  } catch (error) {
    console.error('Failed to get AI settings:', error);
    return { success: false, error: 'Failed to get AI settings' };
  }
}

export async function saveAISettingsAction(input: SaveAISettingsInput) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const data = await saveAISettingsForUser(session.user.id, input);
    return { success: true, data };
  } catch (error) {
    if (error instanceof Error && error.name === 'AISettingsValidationError') {
      return { success: false, error: error.message };
    }

    console.error('Failed to save AI settings:', error);
    return { success: false, error: 'Failed to save AI settings' };
  }
}
