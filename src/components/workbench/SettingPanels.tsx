'use client';

import { useState, memo, useCallback, useEffect, useTransition } from 'react';
import { Input } from '@/components/ui/shadcn/input';
import { Button } from '@/components/ui/shadcn/button';
import { Switch } from '@/components/ui/shadcn/switch';
import { Slider } from '@/components/ui/shadcn/slider';
import { Separator } from '@/components/ui/shadcn/separator';
import { ScrollArea } from '@/components/ui/shadcn/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import {
  CanvasSettings,
  AISettings,
  useCanvasSettings,
  useAISettings,
  useUpdateSettings,
} from '@/store/settings-store';
import { Paintbrush, Bot, Lock, Save, Grid3X3, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import {
  getAISettingsAction,
  saveAISettingsAction,
} from '@/actions/ai-settings.actions';

// 定义子组件的属性类型
interface CanvasSettingsPanelProps {
  settings: CanvasSettings;
  onUpdate: (updates: Partial<CanvasSettings>) => void;
}

interface AISettingsPanelProps {
  settings: AISettings;
  onUpdate: (updates: Partial<AISettings>) => void;
  onSave: () => void;
  isSaving: boolean;
}

// 子组件：画布设置面板
const CanvasSettingsPanel = memo(
  ({ settings, onUpdate }: CanvasSettingsPanelProps) => {
    const t = useTranslations('Settings.general');
    const toastT = useTranslations('Settings.toast');
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();

    const handleChange = useCallback(
      <K extends keyof CanvasSettings>(key: K, value: CanvasSettings[K]) => {
        onUpdate({ [key]: value });
      },
      [onUpdate]
    );

    const onLanguageChange = (nextLocale: string) => {
      startTransition(() => {
        router.replace(pathname, { locale: nextLocale });
        toast.success(toastT('languageUpdated'), { duration: 2000 });
      });
    };

    return (
      <div className="space-y-6 pb-4">
        <div>
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Paintbrush className="h-5 w-5" />
            {t('title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>

        <Separator />

        {/* 语言选择器 */}
        <div className="flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <label className="text-sm font-medium leading-none flex items-center gap-1">
              <Globe className="h-4 w-4" />
              {t('language.label')}
            </label>
            <p className="text-xs text-muted-foreground">
              {t('language.description')}
            </p>
          </div>
          <Select
            value={locale}
            onValueChange={onLanguageChange}
            disabled={isPending}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={t('language.en-US')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="zh-CN">{t('language.zh-CN')}</SelectItem>
              <SelectItem value="en-US">{t('language.en-US')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 暗黑模式开关 */}
        <div className="flex flex-row items-center justify-between">
          <div className="space-y-0.5">
            <label className="text-sm font-medium leading-none">
              {t('darkMode.label')}
            </label>
            <p className="text-xs text-muted-foreground">
              {t('darkMode.description')}
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
              {t('autoSave.label')}
            </label>
            <p className="text-xs text-muted-foreground">
              {t('autoSave.description')}
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
              {t('snapToGrid.label')}
            </label>
            <p className="text-xs text-muted-foreground">
              {t('snapToGrid.description')}
            </p>
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
              {t('gridSize', { size: settings.gridSize })}
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
const AISettingsPanel = memo(
  ({ settings, onUpdate, onSave, isSaving }: AISettingsPanelProps) => {
    const t = useTranslations('Settings.ai');

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
            {t('title')}
          </h2>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>

        <Separator />

        {/* 模型名称输入 */}
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">
            {t('modelName.label')}
          </label>
          <Input
            placeholder={t('modelName.placeholder')}
            value={settings.modelName}
            onChange={(e) => handleChange('modelName', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t('modelName.description')}
          </p>
        </div>

        {/* API密钥输入 */}
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none flex items-center">
            <Lock className="h-4 w-4 mr-1" />
            {t('apiKey.label')} <span className="text-red-500 ml-1">*</span>
          </label>
          <Input
            type="password"
            placeholder={
              settings.hasServerApiKey
                ? t('apiKey.placeholderSaved')
                : t('apiKey.placeholder')
            }
            spellCheck="false"
            autoComplete="new-password"
            autoCapitalize="off"
            autoCorrect="off"
            data-lpignore="true"
            data-form-type="other"
            value={settings.apiKey}
            onChange={(e) => handleChange('apiKey', e.target.value)}
            className={
              settings.apiKey.trim() === '' && !settings.hasServerApiKey
                ? 'border-red-300'
                : ''
            }
          />
          {settings.apiKey.trim() === '' && !settings.hasServerApiKey && (
            <p className="text-xs text-red-500">{t('apiKey.errorEmpty')}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {settings.hasServerApiKey && !settings.apiKey.trim()
              ? t('apiKey.descriptionSaved')
              : t('apiKey.description')}
          </p>
        </div>

        {/* API端点输入 */}
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none">
            {t('apiEndpoint.label')}
          </label>
          <Input
            autoComplete="off"
            placeholder={t('apiEndpoint.placeholder')}
            value={settings.apiEndpoint}
            onChange={(e) => handleChange('apiEndpoint', e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t('apiEndpoint.description')}
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? t('saving') : t('save')}
          </Button>
        </div>
      </div>
    );
  }
);
AISettingsPanel.displayName = 'AISettingsPanel';

// 主组件
export function SettingsPanels() {
  const canvasSettings = useCanvasSettings();
  const aiSettings = useAISettings();
  const { updateCanvas, updateAI } = useUpdateSettings();

  const [activeTab, setActiveTab] = useState<'canvas' | 'ai'>('canvas');
  const [isSavingAI, setIsSavingAI] = useState(false);
  const t = useTranslations('Settings.tabs');
  const toastT = useTranslations('Settings.toast');

  useEffect(() => {
    let cancelled = false;

    getAISettingsAction().then((result) => {
      if (cancelled || !result.success || !result.data) {
        return;
      }

      updateAI({
        modelName: result.data.modelName,
        apiEndpoint: result.data.apiEndpoint,
        apiKey: '',
        hasServerApiKey: result.data.hasServerApiKey,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [updateAI]);

  const handleCanvasSettingChange = useCallback(
    (updates: Partial<CanvasSettings>) => {
      updateCanvas(updates);
      toast.success(toastT('generalUpdated'), { duration: 2000 });
    },
    [updateCanvas, toastT]
  );

  const handleAISettingChange = useCallback(
    (updates: Partial<AISettings>) => {
      updateAI(updates);
    },
    [updateAI]
  );

  const handleSaveAISettings = useCallback(async () => {
    setIsSavingAI(true);
    try {
      const result = await saveAISettingsAction({
        modelName: aiSettings.modelName,
        apiEndpoint: aiSettings.apiEndpoint,
        apiKey: aiSettings.apiKey,
      });

      if (!result.success || !result.data) {
        toast.error(result.error || toastT('aiSaveFailed'), {
          duration: 3000,
        });
        return;
      }

      updateAI({
        modelName: result.data.modelName,
        apiEndpoint: result.data.apiEndpoint,
        apiKey: '',
        hasServerApiKey: result.data.hasServerApiKey,
      });
      toast.success(toastT('aiUpdated'), { duration: 2000 });
    } finally {
      setIsSavingAI(false);
    }
  }, [aiSettings, toastT, updateAI]);

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
          <span>{t('general')}</span>
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
          <span>{t('ai')}</span>
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
                onSave={handleSaveAISettings}
                isSaving={isSavingAI}
              />
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
