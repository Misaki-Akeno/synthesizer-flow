'use server';

import { auth } from '@/lib/auth/auth';
import {
  getPublicAISettings,
  saveAISettingsForUser,
  SaveAISettingsInput,
} from '@/lib/ai/server-settings';

export async function getAISettingsAction() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const data = await getPublicAISettings(session.user.id);
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
