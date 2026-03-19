'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('Settings');

// ======== 设置类型定义 ========

export interface CanvasSettings {
  darkMode: boolean;
  autoSave: boolean;
  snapToGrid: boolean;
  gridSize: number;
  controlPanelVisible: boolean;
}

export interface AISettings {
  modelName: string;
  apiKey: string;
  apiEndpoint: string;
}

// ======== 默认设置 ========

export const DEFAULT_CANVAS_SETTINGS: CanvasSettings = {
  darkMode: false,
  autoSave: true,
  snapToGrid: true,
  gridSize: 10,
  controlPanelVisible: true,
} as const;

export const DEFAULT_AI_SETTINGS: AISettings = {
  modelName: 'qwen-turbo-2025-04-28',
  apiKey: '',
  apiEndpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
} as const;

// ======== Store 状态接口 ========

export interface SettingsState {
  canvas: CanvasSettings;
  ai: AISettings;
  
  // 更新方法
  updateCanvas: (updates: Partial<CanvasSettings>) => void;
  updateAI: (updates: Partial<AISettings>) => void;
  
  // 重置方法
  resetCanvas: () => void;
  resetAI: () => void;
  resetAll: () => void;
}

// ======== 工具函数 ========

function safeCanvasSettings(settings: unknown): CanvasSettings {
  if (!settings || typeof settings !== 'object') {
    return { ...DEFAULT_CANVAS_SETTINGS };
  }
  
  const obj = settings as Record<string, unknown>;
  
  return {
    darkMode: typeof obj.darkMode === 'boolean' ? obj.darkMode : DEFAULT_CANVAS_SETTINGS.darkMode,
    autoSave: typeof obj.autoSave === 'boolean' ? obj.autoSave : DEFAULT_CANVAS_SETTINGS.autoSave,
    snapToGrid: typeof obj.snapToGrid === 'boolean' ? obj.snapToGrid : DEFAULT_CANVAS_SETTINGS.snapToGrid,
    gridSize: typeof obj.gridSize === 'number' && obj.gridSize > 0 ? obj.gridSize : DEFAULT_CANVAS_SETTINGS.gridSize,
    controlPanelVisible: typeof obj.controlPanelVisible === 'boolean' ? obj.controlPanelVisible : DEFAULT_CANVAS_SETTINGS.controlPanelVisible,
  };
}

function safeAISettings(settings: unknown): AISettings {
  if (!settings || typeof settings !== 'object') {
    return { ...DEFAULT_AI_SETTINGS };
  }
  
  const obj = settings as Record<string, unknown>;
  
  return {
    modelName: typeof obj.modelName === 'string' ? obj.modelName : DEFAULT_AI_SETTINGS.modelName,
    apiKey: typeof obj.apiKey === 'string' ? obj.apiKey : DEFAULT_AI_SETTINGS.apiKey,
    apiEndpoint: typeof obj.apiEndpoint === 'string' ? obj.apiEndpoint : DEFAULT_AI_SETTINGS.apiEndpoint,
  };
}

// ======== Zustand Store ========

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      canvas: { ...DEFAULT_CANVAS_SETTINGS },
      ai: { ...DEFAULT_AI_SETTINGS },

      updateCanvas: (updates) => {
        set((state) => ({
          canvas: { ...state.canvas, ...updates }
        }));
        logger.info('画布设置已更新', updates);
      },

      updateAI: (updates) => {
        set((state) => ({
          ai: { ...state.ai, ...updates }
        }));
        logger.info('AI设置已更新', updates);
      },

      resetCanvas: () => {
        set({ canvas: { ...DEFAULT_CANVAS_SETTINGS } });
        logger.info('画布设置已重置');
      },

      resetAI: () => {
        set({ ai: { ...DEFAULT_AI_SETTINGS } });
        logger.info('AI设置已重置');
      },

      resetAll: () => {
        set({
          canvas: { ...DEFAULT_CANVAS_SETTINGS },
          ai: { ...DEFAULT_AI_SETTINGS }
        });
        logger.info('所有设置已重置');
      },
    }),
    {
      name: 'synthesizerflow-settings',
      // 安全的数据恢复
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            logger.error('设置数据恢复失败', error);
            return;
          }
          
          if (state) {
            // 确保恢复的数据安全有效
            state.canvas = safeCanvasSettings(state.canvas);
            state.ai = safeAISettings(state.ai);
            logger.info('设置数据已安全恢复');
          }
        };
      },
    }
  )
);

// ======== 便捷的 Hook 函数 ========

// 获取画布设置
export const useCanvasSettings = () => useSettings((state) => state.canvas);

// 获取AI设置
export const useAISettings = () => useSettings((state) => state.ai);

// 检查AI设置是否完整
export const useIsAIConfigured = () => {
  const ai = useAISettings();
  return !!(ai.apiKey && ai.apiKey.trim() && ai.modelName && ai.modelName.trim());
};

// 获取更新函数
export const useUpdateSettings = () => ({
  updateCanvas: useSettings((state) => state.updateCanvas),
  updateAI: useSettings((state) => state.updateAI),
  resetCanvas: useSettings((state) => state.resetCanvas),
  resetAI: useSettings((state) => state.resetAI),
  resetAll: useSettings((state) => state.resetAll),
});
