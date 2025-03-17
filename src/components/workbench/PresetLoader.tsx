import React from 'react';
import { useFlowStore } from '../../store/store';
import { presetManager } from '../../core/PresetManager';

const PresetLoader: React.FC = () => {
  const { currentPresetId, loadPreset } = useFlowStore();
  const presets = presetManager.getPresets();

  return (
    <div className="preset-loader" style={{ 
      position: 'absolute',
      top: '10px',
      left: '10px',
      zIndex: 5,
      background: 'white',
      padding: '8px',
      borderRadius: '4px',
      boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
    }}>
      <select 
        value={currentPresetId}
        onChange={(e) => loadPreset(e.target.value)}
        style={{ padding: '4px 8px' }}
      >
        {presets.map(preset => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default PresetLoader;
