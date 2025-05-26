'use client';

import { useState, memo, useCallback } from 'react';
import { Input } from '@/components/ui/shadcn/input';
import { Switch } from '@/components/ui/shadcn/switch';
import { Slider } from '@/components/ui/shadcn/slider';
import { Separator } from '@/components/ui/shadcn/separator';
import {
  CanvsSettings,
  AIModelSettings,
  usePersistStore,
} from '@/store/persist-store';
import { Paintbrush, Bot, Lock, Save, Grid3X3 } from 'lucide-react';
import { toast } from 'sonner';

// 定义子组件的属性类型
interface CanvasSettingsPanelProps {
  canvsSettings: CanvsSettings;
  handleCanvasSettingChange: <T extends keyof CanvsSettings>(
    key: T,
    value: CanvsSettings[T]
  ) => void;
}

interface AIModelSettingsPanelProps {
  aiModelSettings: AIModelSettings;
  handleAIModelSettingChange: <T extends keyof AIModelSettings>(
    key: T,
    value: AIModelSettings[T]
  ) => void;
}

// 子组件：CanvasSettingsPanel
const CanvasSettingsPanel = memo(
  ({ canvsSettings, handleCanvasSettingChange }: CanvasSettingsPanelProps) => {
    const handleChange = useCallback(
      <T extends keyof CanvsSettings>(key: T, value: CanvsSettings[T]) => {
        handleCanvasSettingChange(key, value);
      },
      [handleCanvasSettingChange]
    );

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Paintbrush className="h-5 w-5" />
            画布设置
          </h2>
          <p className="text-sm text-muted-foreground">
            调整画布显示和交互的相关设置
          </p>
        </div>

        <Separator />

        {/* 暗黑模式开关 */}
        <div className="flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <label className="text-sm font-medium leading-none">暗黑模式</label>
            <p className="text-xs text-muted-foreground">
              启用应用的暗黑模式主题
            </p>
          </div>{' '}
          <Switch
            checked={canvsSettings.darkMode}
            onCheckedChange={(checked) => handleChange('darkMode', checked)}
          />
        </div>

        {/* 自动保存开关 */}
        <div className="flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <label className="text-sm font-medium leading-none">
              <Save className="h-4 w-4 inline-block mr-1" />
              自动保存
            </label>
            <p className="text-xs text-muted-foreground">
              自动保存画布状态的更改
            </p>
          </div>{' '}
          <Switch
            checked={canvsSettings.autoSave}
            onCheckedChange={(checked) => handleChange('autoSave', checked)}
          />
        </div>
        {/* 网格对齐开关 */}
        <div className="flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <label className="text-sm font-medium leading-none">
              <Grid3X3 className="h-4 w-4 inline-block mr-1" />
              网格对齐
            </label>
            <p className="text-xs text-muted-foreground">将模块对齐到网格</p>
          </div>
          <Switch
            checked={canvsSettings.snapToGrid}
            onCheckedChange={(checked) => handleChange('snapToGrid', checked)}
          />
        </div>

        {/* 网格大小滑块，当snapToGrid为true时可用 */}
        {canvsSettings.snapToGrid && (
          <div className="pt-2">
            <label className="text-sm font-medium mb-2 block">
              网格大小: {canvsSettings.gridSize}px
            </label>
            <Slider
              min={5}
              max={50}
              step={1}
              value={[canvsSettings.gridSize]}
              onValueChange={(value) => handleChange('gridSize', value[0])}
            />
          </div>
        )}
      </div>
    );
  }
);
CanvasSettingsPanel.displayName = 'CanvasSettingsPanel';

// 子组件：AIModelSettingsPanel
const AIModelSettingsPanel = memo(
  ({
    aiModelSettings,
    handleAIModelSettingChange,
  }: AIModelSettingsPanelProps) => {
    const handleChange = useCallback(
      <T extends keyof AIModelSettings>(key: T, value: AIModelSettings[T]) => {
        handleAIModelSettingChange(key, value);
      },
      [handleAIModelSettingChange]
    );

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI 模型设置
          </h2>
          <p className="text-sm text-muted-foreground">
            配置AI模型连接以增强应用功能
          </p>
        </div>

        <Separator />
        {/* 模型名称输入 */}
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">模型名称</label>
          <Input
            placeholder="例如: gpt-4, claude-3"
            value={aiModelSettings.modelName}
            onChange={(e) => handleChange('modelName', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            指定要使用的AI模型名称
          </p>
        </div>

        {/* API密钥输入 - 避免浏览器自动填充 */}
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none flex items-center">
            <Lock className="h-4 w-4 mr-1" />
            API密钥
          </label>
          <Input
            placeholder="输入您的API密钥"
            spellCheck="false"
            autoComplete="new-password"
            autoCapitalize="off"
            autoCorrect="off"
            data-lpignore="true"
            data-form-type="other"
            value={aiModelSettings.apiKey}
            onChange={(e) => handleChange('apiKey', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            您的API密钥将安全地存储在本地
          </p>
        </div>

        {/* API端点输入 */}
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">
            API端点（可选）
          </label>
          <Input
            autoComplete="off"
            placeholder="https://api.example.com/v1"
            value={aiModelSettings.apiEndpoint}
            onChange={(e) => handleChange('apiEndpoint', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            如果您使用自定义API端点，请在此处指定
          </p>
        </div>
      </div>
    );
  }
);
AIModelSettingsPanel.displayName = 'AIModelSettingsPanel';

export function SettingsPanels() {
  const canvsSettings = usePersistStore(
    (state) => state.preferences.canvsSettings
  );
  const aiModelSettings = usePersistStore(
    (state) => state.preferences.aiModelSettings
  );
  const updatePreferences = usePersistStore((state) => state.updatePreferences);

  const [activeTab, setActiveTab] = useState<'canvas' | 'ai'>('canvas');

  const handleCanvasSettingChange = useCallback(
    <T extends keyof CanvsSettings>(key: T, value: CanvsSettings[T]) => {
      updatePreferences({
        canvsSettings: {
          ...canvsSettings,
          [key]: value,
        },
      });

      toast.success('已更新设置', { duration: 2000 });
    },
    [canvsSettings, updatePreferences]
  );

  const handleAIModelSettingChange = useCallback(
    <T extends keyof AIModelSettings>(key: T, value: AIModelSettings[T]) => {
      updatePreferences({
        aiModelSettings: {
          ...aiModelSettings,
          [key]: value,
        },
      });

      toast.success('已更新设置', { duration: 2000 });
    },
    [aiModelSettings, updatePreferences]
  );

  return (
    <div className="flex flex-row h-full">
      {/* 左侧选项卡菜单 */}
      <div className="w-48 border-r p-2 flex flex-col">
        <button
          onClick={() => setActiveTab('canvas')}
          className={`flex items-center gap-2 p-2 mb-2 rounded-md text-left ${
            activeTab === 'canvas'
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'
          }`}
        >
          <Paintbrush className="h-5 w-5" />
          <span>画布设置</span>
        </button>

        <button
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-2 p-2 mb-2 rounded-md text-left ${
            activeTab === 'ai'
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'
          }`}
        >
          <Bot className="h-5 w-5" />
          <span>AI 模型设置</span>
        </button>
      </div>

      {/* 右侧内容面板 */}
      <div className="flex-1 p-4 overflow-auto">
        {/* 画布设置面板 */}
        {activeTab === 'canvas' && (
          <CanvasSettingsPanel
            canvsSettings={canvsSettings}
            handleCanvasSettingChange={handleCanvasSettingChange}
          />
        )}

        {/* AI模型设置面板 */}
        {activeTab === 'ai' && (
          <AIModelSettingsPanel
            aiModelSettings={aiModelSettings}
            handleAIModelSettingChange={handleAIModelSettingChange}
          />
        )}
      </div>
    </div>
  );
}
