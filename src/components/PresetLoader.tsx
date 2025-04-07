import { useEffect } from 'react';
import { useFlowStore } from '@/store/store';
import { presetManager } from '@/core/PresetManager';

export function PresetLoader() {
  const { loadPreset, currentPresetId } = useFlowStore();

  useEffect(() => {
    if (!currentPresetId) {
      const defaultPreset = presetManager.getPreset('major-chord');
      if (defaultPreset) {
        loadPreset(defaultPreset.id);
      }
    }
  }, [currentPresetId, loadPreset]);

  return null;
}
