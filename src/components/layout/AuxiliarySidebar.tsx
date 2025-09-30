'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { SidebarProvider } from '@/components/ui/shadcn/sidebar';
import { TooltipProvider } from '@/components/ui/shadcn/tooltip';
import { Button } from '@/components/ui/shadcn/button';
import { X } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChatInterface } from '@/components/ui/llm/ChatInterface';
import { ModulePropertiesPanel } from '@/components/layout/sidebars/ModulePropertiesPanel';

interface AuxiliarySidebarProps {
  className?: string;
}

// 右侧栏面板类型
type RightPanelType = 'properties' | 'llm_chat' | null;

export function AuxiliarySidebar({ className }: AuxiliarySidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auxiliarySidebarFromUrl = searchParams.get(
    'auxPanel'
  ) as RightPanelType;
  const [activePanel, setActivePanel] = useState<RightPanelType>(
    auxiliarySidebarFromUrl
  );

  useEffect(() => {
    // 当 URL 中的 rightPanel 参数变化时，更新 activePanel
    setActivePanel(auxiliarySidebarFromUrl);
  }, [auxiliarySidebarFromUrl]);

  const closePanel = () => {
    setActivePanel(null);
    const params = new URLSearchParams(searchParams);
    params.delete('auxPanel');
    router.replace(`?${params.toString()}`);
  };

  // 如果没有活动面板，则不渲染右侧栏
  if (!activePanel) return null;

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className={cn('flex h-full', className)}>
          {/* 右侧面板内容 - 保持 #FAFAFA 背景 */}
          <div className="w-[320px] border-l bg-[#FAFAFA] dark:bg-gray-900 flex flex-col">
            <div className="flex items-center justify-between p-3 border-b">
              <h3 className="text-sm font-medium">
                {activePanel === 'properties' && '属性面板'}
                {activePanel === 'llm_chat' && 'Chat'}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={closePanel}
              >
                <X size={16} />
              </Button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              {/* 根据活动面板类型显示不同内容 */}
              {activePanel === 'properties' && (
                <ModulePropertiesPanel onRequestClose={closePanel} />
              )}
              {activePanel === 'llm_chat' && <ChatInterface />}
            </div>
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
