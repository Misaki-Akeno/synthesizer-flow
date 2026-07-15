'use client';

import {
  useState,
  memo,
  useCallback,
  useEffect,
  useTransition,
  useRef,
} from 'react';
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
import {
  Paintbrush,
  Bot,
  Lock,
  Save,
  Grid3X3,
  Globe,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  KeyRound,
  Loader2,
  RadioTower,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import {
  getAISettingsAction,
  saveAISettingsAction,
} from '@/actions/ai-settings.actions';
import {
  AI_PROVIDER_IDS,
  getAIProvider,
  type AIProviderId,
} from '@/lib/ai/providers';
import { cn } from '@/lib/utils';

// 定义子组件的属性类型
interface CanvasSettingsPanelProps {
  settings: CanvasSettings;
  onUpdate: (updates: Partial<CanvasSettings>) => void;
}

interface AISettingsPanelProps {
  settings: AISettings;
  onUpdate: (updates: Partial<AISettings>) => void;
  onProviderChange: (providerId: AIProviderId) => void;
  onClearKey: () => void;
  onSave: () => void;
  isSaving: boolean;
  isLoadingProvider: boolean;
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
  ({
    settings,
    onUpdate,
    onProviderChange,
    onClearKey,
    onSave,
    isSaving,
    isLoadingProvider,
  }: AISettingsPanelProps) => {
    const t = useTranslations('Settings.ai');
    const provider = getAIProvider(settings.providerId);
    const hasCuratedModel = provider.models.some(
      (model) => model.id === settings.modelName
    );
    const modelSelectValue = hasCuratedModel
      ? settings.modelName
      : '__custom__';

    const handleChange = useCallback(
      <K extends keyof AISettings>(key: K, value: AISettings[K]) => {
        onUpdate({ [key]: value });
      },
      [onUpdate]
    );

    return (
      <div className="space-y-5 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <RadioTower className="h-3.5 w-3.5" />
              {t('eyebrow')}
            </div>
            <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              {t('title')}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {t('description')}
            </p>
          </div>
          <div
            className={cn(
              'mt-1 flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
              settings.hasServerApiKey
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'border-border bg-muted/60 text-muted-foreground'
            )}
          >
            {settings.hasServerApiKey ? (
              <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
              <CircleDashed className="h-3.5 w-3.5" />
            )}
            {settings.hasServerApiKey
              ? t('status.connected')
              : t('status.notConnected')}
          </div>
        </div>

        <Separator />

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <label className="text-sm font-medium">
                {t('provider.label')}
              </label>
              <p className="text-xs text-muted-foreground">
                {t('provider.description')}
              </p>
            </div>
            {isLoadingProvider && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('provider.loading')}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {AI_PROVIDER_IDS.map((providerId) => {
              const item = getAIProvider(providerId);
              const isActive = settings.providerId === providerId;
              return (
                <button
                  key={providerId}
                  type="button"
                  aria-pressed={isActive}
                  disabled={isLoadingProvider}
                  onClick={() => onProviderChange(providerId)}
                  className={cn(
                    'group relative min-h-20 overflow-hidden rounded-lg border p-3 text-left transition-colors',
                    'hover:border-foreground/25 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'border-foreground/35 bg-foreground/[0.04] shadow-[inset_3px_0_0_0_var(--foreground)]'
                      : 'border-border/80 bg-background'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      {String(AI_PROVIDER_IDS.indexOf(providerId) + 1).padStart(
                        2,
                        '0'
                      )}
                    </span>
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        isActive ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                      )}
                    />
                  </div>
                  <div className="mt-2 text-sm font-semibold">{item.name}</div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {t(`providers.${providerId}`)}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="rounded-xl border bg-muted/20 p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3 border-b pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md border bg-background font-mono text-xs font-semibold">
                {provider.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold">{provider.name}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {provider.kind}
                </div>
              </div>
            </div>
            {provider.consoleUrl && (
              <a
                href={provider.consoleUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {t('apiKey.getKey')}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">
                {t('modelName.label')}
              </label>
              {provider.models.length > 0 && (
                <Select
                  value={modelSelectValue}
                  onValueChange={(value) =>
                    handleChange(
                      'modelName',
                      value === '__custom__' ? '' : value
                    )
                  }
                >
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {provider.models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <span>{model.label}</span>
                        <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {t(`profiles.${model.profile}`)}
                        </span>
                      </SelectItem>
                    ))}
                    <SelectItem value="__custom__">
                      {t('modelName.custom')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
              {(!hasCuratedModel || provider.models.length === 0) && (
                <Input
                  className="bg-background font-mono text-xs"
                  placeholder={t('modelName.placeholder')}
                  value={settings.modelName}
                  onChange={(event) =>
                    handleChange('modelName', event.target.value)
                  }
                />
              )}
              <p className="text-xs text-muted-foreground">
                {t('modelName.description')}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center text-sm font-medium leading-none">
                  <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                  {t('apiKey.label')}
                </label>
                {settings.hasServerApiKey && (
                  <button
                    type="button"
                    onClick={onClearKey}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                    {t('apiKey.remove')}
                  </button>
                )}
              </div>
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
                onChange={(event) => handleChange('apiKey', event.target.value)}
                className="bg-background font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                {settings.hasServerApiKey && !settings.apiKey.trim()
                  ? t('apiKey.descriptionSaved')
                  : t('apiKey.description')}
              </p>
            </div>
          </div>

          {provider.allowsCustomEndpoint && (
            <div className="mt-5 space-y-2 border-t pt-4">
              <label className="text-sm font-medium leading-none">
                {t('apiEndpoint.label')}
              </label>
              <Input
                autoComplete="off"
                className="bg-background font-mono text-xs"
                placeholder={t('apiEndpoint.placeholder')}
                value={settings.apiEndpoint}
                onChange={(event) =>
                  handleChange('apiEndpoint', event.target.value)
                }
              />
              <p className="text-xs text-muted-foreground">
                {t('apiEndpoint.description')}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-dashed px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              {t('securityNote')}
            </div>
            <Button
              onClick={onSave}
              disabled={
                isSaving ||
                isLoadingProvider ||
                !settings.modelName.trim() ||
                (provider.allowsCustomEndpoint && !settings.apiEndpoint.trim())
              }
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? t('saving') : t('save')}
            </Button>
          </div>
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
  const [isLoadingProvider, setIsLoadingProvider] = useState(false);
  const providerRequestId = useRef(0);
  const t = useTranslations('Settings.tabs');
  const toastT = useTranslations('Settings.toast');

  useEffect(() => {
    let cancelled = false;
    const requestId = ++providerRequestId.current;

    getAISettingsAction().then((result) => {
      if (
        cancelled ||
        requestId !== providerRequestId.current ||
        !result.success ||
        !result.data
      ) {
        return;
      }

      updateAI({
        providerId: result.data.providerId,
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

  const handleProviderChange = useCallback(
    async (providerId: AIProviderId) => {
      const requestId = ++providerRequestId.current;
      const provider = getAIProvider(providerId);
      updateAI({
        providerId,
        modelName: provider.defaultModel,
        apiEndpoint: provider.apiEndpoint,
        apiKey: '',
        hasServerApiKey: false,
      });

      setIsLoadingProvider(true);
      try {
        const result = await getAISettingsAction(providerId);
        if (
          requestId !== providerRequestId.current ||
          !result.success ||
          !result.data
        ) {
          return;
        }

        updateAI({
          providerId: result.data.providerId,
          modelName: result.data.modelName,
          apiEndpoint: result.data.apiEndpoint,
          apiKey: '',
          hasServerApiKey: result.data.hasServerApiKey,
        });
      } finally {
        if (requestId === providerRequestId.current) {
          setIsLoadingProvider(false);
        }
      }
    },
    [updateAI]
  );

  const handleSaveAISettings = useCallback(async () => {
    setIsSavingAI(true);
    try {
      const result = await saveAISettingsAction({
        providerId: aiSettings.providerId,
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
        providerId: result.data.providerId,
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

  const handleClearAIKey = useCallback(async () => {
    setIsSavingAI(true);
    try {
      const result = await saveAISettingsAction({
        providerId: aiSettings.providerId,
        modelName: aiSettings.modelName,
        apiEndpoint: aiSettings.apiEndpoint,
        clearApiKey: true,
      });

      if (!result.success || !result.data) {
        toast.error(result.error || toastT('aiSaveFailed'), {
          duration: 3000,
        });
        return;
      }

      updateAI({
        apiKey: '',
        hasServerApiKey: false,
      });
      toast.success(toastT('aiKeyRemoved'), { duration: 2000 });
    } finally {
      setIsSavingAI(false);
    }
  }, [aiSettings, toastT, updateAI]);

  return (
    <div className="flex h-[min(70vh,700px)] min-h-[560px] flex-row">
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
                onProviderChange={handleProviderChange}
                onClearKey={handleClearAIKey}
                onSave={handleSaveAISettings}
                isSaving={isSavingAI}
                isLoadingProvider={isLoadingProvider}
              />
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
