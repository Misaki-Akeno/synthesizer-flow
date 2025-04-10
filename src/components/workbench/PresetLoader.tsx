import React, { useEffect, useRef } from 'react';
import { useFlowStore } from '../../store/store';
import { presetManager } from '../../core/PresetManager';
import { moduleManager } from '../../core/ModuleManager';

const PresetLoader: React.FC = () => {
  const { currentPresetId, loadPreset, edges, nodes } = useFlowStore();
  const presets = presetManager.getPresets();

  // 使用ref记录上一次的edges长度
  const prevEdgesLength = useRef(0);

  // 在组件挂载时，如果没有选择预设则加载默认预设
  useEffect(() => {
    if (!currentPresetId) {
      const defaultPreset = presetManager.getPreset('major-chord');
      if (defaultPreset) {
        loadPreset(defaultPreset.id);
      }
    }
  }, [currentPresetId, loadPreset]);

  useEffect(() => {
    if (edges.length > 0 && nodes.length > 0) {
      if (edges.length !== prevEdgesLength.current) {
        prevEdgesLength.current = edges.length;

        // 使用requestAnimationFrame确保在下一帧渲染时执行，
        // 此时React已完成DOM更新，节点都已添加到状态中
        requestAnimationFrame(() => {
          moduleManager.setupAllEdgeBindings(edges);
        });
      }
    }
  }, [edges, nodes, currentPresetId]);

  return (
    <div
      className="preset-loader"
      style={{
        position: 'absolute',
        top: '10px',
        left: '10px',
        zIndex: 5,
        background: 'white',
        padding: '8px',
        borderRadius: '4px',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
      }}
    >
      <select
        value={currentPresetId}
        onChange={(e) => loadPreset(e.target.value)}
        style={{ padding: '4px 8px' }}
      >
        {presets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default PresetLoader;
