'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { SidebarProvider } from '@/components/ui/sidebar';
import { ProjectManager } from './ProjectManager';
import { ModuleBrowser } from './ModuleBrowser';
import DevTools from '@/components/workbench/devTools/DevTools';
import { NavUser } from './NavUser';
import { Button } from '@/components/ui/button';
import { Code, Cpu, FileText, Settings, HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface SidebarProps {
  className?: string;
}

// 侧边栏面板类型
type PanelType = 'project-manager' | 'module-browser' | 'dev-tools' | null;

export function Sidebar({ className }: SidebarProps) {
  const [activePanel, setActivePanel] = useState<PanelType>('dev-tools');

  const togglePanel = (panel: PanelType) => {
    setActivePanel(activePanel === panel ? null : panel);
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
                onClick={() => {}}
              />
              <MenuBarButton
                icon={<HelpCircle size={20} />}
                tooltip="帮助"
                onClick={() => {}}
              />
            </div>
          </div>

          {/* 右侧面板内容 - 保持 #FAFAFA 背景 */}
          {activePanel && (
            <div className="w-[320px] border-r bg-[#FAFAFA] dark:bg-gray-900 flex flex-col">
              <div className="flex-1 overflow-hidden">
                {activePanel === 'project-manager' && (
                  <ProjectManager onClose={() => setActivePanel(null)} />
                )}
                {activePanel === 'module-browser' && (
                  <ModuleBrowser onClose={() => setActivePanel(null)} />
                )}
                {activePanel === 'dev-tools' && (
                  <DevTools onClose={() => setActivePanel(null)} />
                )}
              </div>
            </div>
          )}
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
