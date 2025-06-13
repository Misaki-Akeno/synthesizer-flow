'use client';

import { useState, memo, useCallback } from 'react';
import { Input } from '@/components/ui/shadcn/input';
import { Switch } from '@/components/ui/shadcn/switch';
import { Slider } from '@/components/ui/shadcn/slider';
import { Separator } from '@/components/ui/shadcn/separator';
import { ScrollArea } from '@/components/ui/shadcn/scroll-area';
import {
  CanvasSettings,
  AISettings,
  useCanvasSettings,
  useAISettings,
  useUpdateSettings,
} from '@/store/settings';
import { Paintbrush, Bot, Lock, Save, Grid3X3 } from 'lucide-react';
import { toast } from 'sonner';

// 定义子组件的属性类型
interface CanvasSettingsPanelProps {
  settings: CanvasSettings;
  onUpdate: (updates: Partial<CanvasSettings>) => void;
}

interface AISettingsPanelProps {
  settings: AISettings;
  onUpdate: (updates: Partial<AISettings>) => void;
}

// 子组件：画布设置面板
const CanvasSettingsPanel = memo(
  ({ settings, onUpdate }: CanvasSettingsPanelProps) => {
    const handleChange = useCallback(
      <K extends keyof CanvasSettings>(key: K, value: CanvasSettings[K]) => {
        onUpdate({ [key]: value });
      },
      [onUpdate]
    );

    return (
      <div className="space-y-6 pb-4">
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
          </div>
          <Switch
            checked={settings.darkMode}
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
          </div>
          <Switch
            checked={settings.autoSave}
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
            checked={settings.snapToGrid}
            onCheckedChange={(checked) => handleChange('snapToGrid', checked)}
          />
        </div>

        {/* 网格大小滑块 */}
        {settings.snapToGrid && (
          <div className="pt-2">
            <label className="text-sm font-medium mb-2 block">
              网格大小: {settings.gridSize}px
            </label>
            <Slider
              min={5}
              max={50}
              step={1}
              value={[settings.gridSize]}
              onValueChange={(value) => handleChange('gridSize', value[0])}
            />
          </div>
        )}
      </div>
    );
  }
);
CanvasSettingsPanel.displayName = 'CanvasSettingsPanel';

// 子组件：AI设置面板
const AISettingsPanel = memo(({ settings, onUpdate }: AISettingsPanelProps) => {
  const handleChange = useCallback(
    <K extends keyof AISettings>(key: K, value: AISettings[K]) => {
      onUpdate({ [key]: value });
    },
    [onUpdate]
  );

  return (
    <div className="space-y-6 pb-4">
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
          value={settings.modelName}
          onChange={(e) => handleChange('modelName', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          指定要使用的AI模型名称
        </p>
      </div>

      {/* API密钥输入 */}
      <div className="space-y-2">
        <label className="text-sm font-medium leading-none flex items-center">
          <Lock className="h-4 w-4 mr-1" />
          API密钥 <span className="text-red-500 ml-1">*</span>
        </label>
        <Input
          placeholder="输入您的API密钥"
          spellCheck="false"
          autoComplete="new-password"
          autoCapitalize="off"
          autoCorrect="off"
          data-lpignore="true"
          data-form-type="other"
          value={settings.apiKey}
          onChange={(e) => handleChange('apiKey', e.target.value)}
          className={settings.apiKey.trim() === '' ? 'border-red-300' : ''}
        />
        {settings.apiKey.trim() === '' && (
          <p className="text-xs text-red-500">API密钥不能为空</p>
        )}
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
          value={settings.apiEndpoint}
          onChange={(e) => handleChange('apiEndpoint', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          如果您使用自定义API端点，请在此处指定
        </p>
      </div>
    </div>
  );
});
AISettingsPanel.displayName = 'AISettingsPanel';

// 主组件
export function SettingsPanels() {
  const canvasSettings = useCanvasSettings();
  const aiSettings = useAISettings();
  const { updateCanvas, updateAI } = useUpdateSettings();

  const [activeTab, setActiveTab] = useState<'canvas' | 'ai'>('canvas');

  const handleCanvasSettingChange = useCallback(
    (updates: Partial<CanvasSettings>) => {
      updateCanvas(updates);
      toast.success('画布设置已更新', { duration: 2000 });
    },
    [updateCanvas]
  );

  const handleAISettingChange = useCallback(
    (updates: Partial<AISettings>) => {
      updateAI(updates);
      toast.success('AI设置已更新', { duration: 2000 });
    },
    [updateAI]
  );

  return (
    <div className="flex flex-row h-[40vh] max-h-[40vh] min-h-[40vh]">
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
      <div className="flex-1">
        <ScrollArea className="h-full">
          <div className="p-4">
            {activeTab === 'canvas' && (
              <CanvasSettingsPanel
                settings={canvasSettings}
                onUpdate={handleCanvasSettingChange}
              />
            )}

            {activeTab === 'ai' && (
              <AISettingsPanel
                settings={aiSettings}
                onUpdate={handleAISettingChange}
              />
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
