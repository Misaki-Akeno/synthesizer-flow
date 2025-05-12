'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { SidebarProvider } from '@/components/ui/shadcn/sidebar';
import { ProjectManager } from './sidebars/ProjectManager';
import { ModuleBrowser } from './sidebars/ModuleBrowser';
import DevTools from '@/components/layout/sidebars/devTools/DevTools';
import { NavUser } from './navigation/NavUser';
import { Button } from '@/components/ui/shadcn/button';
import { Code, Cpu, FileText, Settings, HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/shadcn/tooltip';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';

interface SidebarProps {
  className?: string;
}

// 侧边栏面板类型
type PanelType = 'project-manager' | 'module-browser' | 'dev-tools' | null;

export function Sidebar({ className }: SidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activePanelFromUrl = searchParams.get('panel') as PanelType;
  const [activePanel, setActivePanel] = useState<PanelType>(activePanelFromUrl);
  const [helpDialogOpen, setHelpDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  useEffect(() => {
    // 当 URL 中的 panel 参数变化时，更新 activePanel
    setActivePanel(activePanelFromUrl);
  }, [activePanelFromUrl]);

  const togglePanel = (panel: PanelType) => {
    const newPanel = activePanel === panel ? null : panel;
    setActivePanel(newPanel);

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
        <div className={cn('flex h-full', className)}>
          {/* 左侧图标栏 - 使用纯白背景，固定 48px 宽度 */}
          <div className="w-[48px] flex flex-col border-r bg-white dark:bg-gray-900">
            {/* 顶部图标 - 触发侧面板的选项 */}
            <div className="flex flex-col">
              <ActivityBarButton
                icon={<FileText size={20} />}
                active={activePanel === 'project-manager'}
                tooltip="项目管理器"
                onClick={() => togglePanel('project-manager')}
              />
              <ActivityBarButton
                icon={<Cpu size={20} />}
                active={activePanel === 'module-browser'}
                tooltip="模块浏览器"
                onClick={() => togglePanel('module-browser')}
              />
              <ActivityBarButton
                icon={<Code size={20} />}
                active={activePanel === 'dev-tools'}
                tooltip="开发工具"
                onClick={() => togglePanel('dev-tools')}
              />
            </div>

            {/* 底部图标 - 下拉菜单选项 */}
            <div className="mt-auto flex flex-col border-t">
              <NavUser />

              <MenuBarButton
                icon={<Settings size={20} />}
                tooltip="设置"
                onClick={() => setSettingsDialogOpen(true)}
              />

              <MenuBarButton
                icon={<HelpCircle size={20} />}
                tooltip="帮助"
                onClick={() => setHelpDialogOpen(true)}
              />
            </div>
          </div>

          {/* 右侧面板内容 - 保持 #FAFAFA 背景 */}
          {activePanel && (
            <div className="w-[320px] border-r bg-[#FAFAFA] dark:bg-gray-900 flex flex-col">
              <div className="flex-1 overflow-hidden">
                {activePanel === 'project-manager' && (
                  <ProjectManager onClose={() => togglePanel(null)} />
                )}
                {activePanel === 'module-browser' && (
                  <ModuleBrowser onClose={() => togglePanel(null)} />
                )}
                {activePanel === 'dev-tools' && (
                  <DevTools onClose={() => togglePanel(null)} />
                )}
              </div>
            </div>
          )}

          {/* 将Dialog移到组件结构外部，直接在Sidebar组件中渲染 */}
          <Dialog open={helpDialogOpen} onOpenChange={setHelpDialogOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>关于 SynthesizerFlow</DialogTitle>
                <DialogDescription>
                  一个基于Web的模块化音频合成器应用
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <p className="mb-2">
                  SynthesizerFlow 是一个使用 Next.js
                  构建的模块化音频合成应用，通过可视化连接不同音频模块实现声音合成。
                </p>
                <p className="mb-2">
                  项目源码：
                  <a
                    href="https://github.com/Misaki-Akeno/synthesizer-flow"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    GitHub 仓库
                  </a>
                </p>
                <p>如果您喜欢这个项目，欢迎前往 GitHub 给我们一个 star！</p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setHelpDialogOpen(false)}
                >
                  关闭
                </Button>
                <Button
                  onClick={() =>
                    window.open(
                      'https://github.com/Misaki-Akeno/synthesizer-flow',
                      '_blank'
                    )
                  }
                >
                  访问 GitHub
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* 设置对话框 */}
          <Dialog
            open={settingsDialogOpen}
            onOpenChange={setSettingsDialogOpen}
          >
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>设置</DialogTitle>
                <DialogDescription>SynthesizerFlow 应用设置</DialogDescription>
              </DialogHeader>
              <div className="py-4 flex flex-col items-center justify-center">
                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-700 text-center">
                  <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                    功能开发中
                  </p>
                  <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                    设置功能正在开发中，敬请期待！
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setSettingsDialogOpen(false)}
                >
                  关闭
                </Button>
              </DialogFooter>
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
            'w-full h-12 rounded-none relative flex items-center justify-center',
            active &&
              'bg-accent text-accent-foreground before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-primary'
          )}
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
          className="w-full h-12 rounded-none flex items-center justify-center"
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
