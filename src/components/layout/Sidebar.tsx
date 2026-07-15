'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { SidebarProvider } from '@/components/ui/shadcn/sidebar';
import { NavUser } from '@/components/workbench/NavUser';
import { Button } from '@/components/ui/shadcn/button';
import { Code, Cpu, FileText, Settings, HelpCircle } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { isAdmin } from '@/lib/auth/rbac';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/shadcn/tooltip';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';

const PanelLoading = () => (
  <div
    className="h-full animate-pulse bg-muted/20"
    aria-label="Loading panel"
  />
);

const ProjectManager = dynamic(
  () =>
    import('@/components/workbench/panels/ProjectManager').then(
      (module) => module.ProjectManager
    ),
  { loading: PanelLoading }
);
const ModuleBrowser = dynamic(
  () =>
    import('@/components/workbench/panels/ModuleBrowser').then(
      (module) => module.ModuleBrowser
    ),
  { loading: PanelLoading }
);
const DevTools = dynamic(
  () => import('@/components/workbench/panels/devTools/DevTools'),
  { loading: PanelLoading }
);
const SettingsPanels = dynamic(
  () =>
    import('@/components/workbench/SettingPanels').then(
      (module) => module.SettingsPanels
    ),
  { loading: PanelLoading }
);

interface SidebarProps {
  className?: string;
}

// 侧边栏面板类型
type PanelType = 'project-manager' | 'module-browser' | 'dev-tools' | null;

export function Sidebar({ className }: SidebarProps) {
  const t = useTranslations('Workbench');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const activePanelFromUrl = searchParams.get('panel') as PanelType;
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  const isUserAdmin = isAdmin(session);
  const activePanel =
    !isUserAdmin && activePanelFromUrl === 'dev-tools'
      ? null
      : activePanelFromUrl;

  useEffect(() => {
    // 如果不是管理员，且当前面板是开发工具，则重置
    if (!isUserAdmin && activePanelFromUrl === 'dev-tools') {
      const params = new URLSearchParams(searchParams);
      params.delete('panel');
      router.replace(`?${params.toString()}`);
      return;
    }
  }, [activePanelFromUrl, isUserAdmin, router, searchParams]);

  const togglePanel = (panel: PanelType) => {
    const newPanel = activePanel === panel ? null : panel;

    const params = new URLSearchParams(searchParams);
    if (newPanel) {
      params.set('panel', newPanel);
    } else {
      params.delete('panel');
    }
    router.replace(`?${params.toString()}`);
  };

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className={cn('flex h-full min-h-0', className)}>
          {/* 左侧图标栏 */}
          <div className="flex w-[48px] flex-col border-r bg-card">
            {/* 顶部图标 - 触发侧面板的选项 */}
            <div className="flex flex-col">
              <ActivityBarButton
                icon={<FileText size={20} />}
                active={activePanel === 'project-manager'}
                tooltip={t('navigation.projects')}
                onClick={() => togglePanel('project-manager')}
              />
              <ActivityBarButton
                icon={<Cpu size={20} />}
                active={activePanel === 'module-browser'}
                tooltip={t('navigation.modules')}
                onClick={() => togglePanel('module-browser')}
              />
              {isUserAdmin && (
                <ActivityBarButton
                  icon={<Code size={20} />}
                  active={activePanel === 'dev-tools'}
                  tooltip={t('navigation.devTools')}
                  onClick={() => togglePanel('dev-tools')}
                />
              )}
            </div>

            {/* 底部图标 - 下拉菜单选项 */}
            <div className="mt-auto flex flex-col border-t">
              <NavUser />

              <MenuBarButton
                icon={<Settings size={20} />}
                tooltip={t('navigation.settings')}
                onClick={() => setSettingsDialogOpen(true)}
              />

              <MenuBarButton
                icon={<HelpCircle size={20} />}
                tooltip={t('navigation.help')}
                onClick={() => setHelpDialogOpen(true)}
              />
            </div>
          </div>
          {/* 左侧工作台面板 */}
          {activePanel && (
            <div className="flex min-h-0 w-[360px] flex-col border-r bg-background">
              <div className="min-h-0 flex-1 overflow-hidden">
                {activePanel === 'project-manager' && (
                  <ProjectManager onClose={() => togglePanel(null)} />
                )}
                {activePanel === 'module-browser' && (
                  <ModuleBrowser onClose={() => togglePanel(null)} />
                )}
                {activePanel === 'dev-tools' && isUserAdmin && (
                  <DevTools onClose={() => togglePanel(null)} />
                )}
              </div>
            </div>
          )}
          {/* 将Dialog移到组件结构外部，直接在Sidebar组件中渲染 */}
          <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{t('about.title')}</DialogTitle>
                <DialogDescription>{t('about.description')}</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className="mb-2">{t('about.body')}</p>
                <p className="mb-2">
                  {t('about.source')}：
                  <a
                    href="https://github.com/Misaki-Akeno/synthesizer-flow"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {t('about.repository')}
                  </a>
                </p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setHelpDialogOpen(false)}
                >
                  {t('about.close')}
                </Button>
                <Button
                  onClick={() =>
                    window.open(
                      'https://github.com/Misaki-Akeno/synthesizer-flow',
                      '_blank'
                    )
                  }
                >
                  {t('about.visit')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>{' '}
          {/* 设置对话框 */}
          <Dialog
            open={settingsDialogOpen}
            onOpenChange={setSettingsDialogOpen}
          >
            <DialogContent className="sm:max-w-[900px] sm:max-h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>{t('settings.title')}</DialogTitle>
                <DialogDescription>
                  {t('settings.description')}
                </DialogDescription>
              </DialogHeader>
              <SettingsPanels />
            </DialogContent>
          </Dialog>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}

// 顶部活动栏按钮组件 - 触发侧面板
interface ActivityBarButtonProps {
  icon: React.ReactNode;
  active: boolean;
  tooltip: string;
  onClick: () => void;
}

function ActivityBarButton({
  icon,
  active,
  tooltip,
  onClick,
}: ActivityBarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'relative flex h-12 w-full items-center justify-center rounded-none text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            active &&
              'bg-chart-5/10 text-foreground before:absolute before:bottom-2 before:left-0 before:top-2 before:w-px before:bg-chart-5'
          )}
          aria-label={tooltip}
          aria-pressed={active}
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={4}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

// 修改 MenuBarButton 组件，删除不再需要的 menu 参数
interface MenuBarButtonProps {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
}

function MenuBarButton({ icon, tooltip, onClick }: MenuBarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="flex h-12 w-full items-center justify-center rounded-none text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={tooltip}
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={4}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
