'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import DevTools from '@/components/workbench/devTools/DevTools';
import { Button } from '@/components/ui/button';
import { 
  Code, 
  Settings, 
  FileText, 
  Cpu, 
  PanelRight 
} from 'lucide-react';

interface SidebarProps {
  className?: string;
}

type PanelType = 'dev-tools' | 'settings' | 'explorer' | 'modules' | null;

export function Sidebar({ className }: SidebarProps) {
  const [activePanel, setActivePanel] = useState<PanelType>(null);

  const togglePanel = (panel: PanelType) => {
    setActivePanel(activePanel === panel ? null : panel);
  };

  return (
    <div className={cn('flex h-full', className)}>
      {/* 固定的窄图标栏 */}
      <div className="w-12 flex flex-col border-r bg-background">
        <ActivityBarButton 
          icon={<FileText size={22} />} 
          active={activePanel === 'explorer'}
          tooltip="资源管理器" 
          onClick={() => togglePanel('explorer')}
        />
        <ActivityBarButton 
          icon={<Cpu size={22} />} 
          active={activePanel === 'modules'}
          tooltip="模块库" 
          onClick={() => togglePanel('modules')}
        />
        <ActivityBarButton 
          icon={<Code size={22} />} 
          active={activePanel === 'dev-tools'}
          tooltip="开发工具" 
          onClick={() => togglePanel('dev-tools')}
        />
        <div className="mt-auto">
          <ActivityBarButton 
            icon={<Settings size={22} />} 
            active={activePanel === 'settings'}
            tooltip="设置" 
            onClick={() => togglePanel('settings')}
          />
        </div>
      </div>

      {/* 可展开的面板 */}
      {activePanel && (
        <div className="w-[320px] border-r bg-background flex flex-col">
          <div className="flex items-center justify-between p-2 border-b">
            <h2 className="text-sm font-medium">
              {activePanel === 'dev-tools' && '开发工具'}
              {activePanel === 'settings' && '设置'}
              {activePanel === 'explorer' && '资源管理器'}
              {activePanel === 'modules' && '模块库'}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActivePanel(null)}
              className="h-6 w-6"
            >
              <PanelRight size={16} />
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 vscode-scrollbar">
            {activePanel === 'dev-tools' && <DevTools inSidebar />}
            {activePanel === 'settings' && <div>设置面板内容（待实现）</div>}
            {activePanel === 'explorer' && <div>资源管理器内容（待实现）</div>}
            {activePanel === 'modules' && <div>模块库内容（待实现）</div>}
          </div>
        </div>
      )}
    </div>
  );
}

interface ActivityBarButtonProps {
  icon: React.ReactNode;
  active: boolean;
  tooltip: string;
  onClick: () => void;
}

function ActivityBarButton({ icon, active, tooltip, onClick }: ActivityBarButtonProps) {
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "h-12 w-12 rounded-none",
          active && "bg-accent border-l-2 border-primary"
        )}
        onClick={onClick}
        title={tooltip}
      >
        <span className={cn("opacity-70", active && "opacity-100")}>{icon}</span>
      </Button>
    </div>
  );
}