import React, { useEffect } from 'react';
import { useFlowStore } from '../../store/store';
import { presetManager } from '../../core/PresetManager';
import { moduleManager } from '../../core/ModuleManager';

const PresetLoader: React.FC = () => {
  const { currentPresetId, loadPreset, edges } = useFlowStore();
  const presets = presetManager.getPresets();
  
  // 在预设加载后或edges变化时，重新建立模块间绑定
  useEffect(() => {
    if (edges.length > 0) {
      // 稍微延迟执行，确保节点已经完全渲染
      const timer = setTimeout(() => {
        moduleManager.setupAllEdgeBindings(edges);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [edges, currentPresetId]);

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
