'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/shadcn/button';
import { X } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ChatInterface } from '@/components/workbench/panels/llm/ChatInterface';
import { ModulePropertiesPanel } from '@/components/workbench/panels/ModulePropertiesPanel';
import {
  WorkbenchPanel,
  WorkbenchPanelBody,
  WorkbenchPanelHeader,
} from '@/components/layout/WorkbenchPanel';

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
    <WorkbenchPanel className={cn('border-l', className)}>
      <WorkbenchPanelHeader
        title={activePanel === 'properties' ? '属性面板' : 'Chat'}
        actions={
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={closePanel}
            aria-label="Close side panel"
          >
            <X size={15} />
          </Button>
        }
      />
      <WorkbenchPanelBody className="overflow-auto p-4">
        {activePanel === 'properties' && (
          <ModulePropertiesPanel onRequestClose={closePanel} />
        )}
        {activePanel === 'llm_chat' && <ChatInterface />}
      </WorkbenchPanelBody>
    </WorkbenchPanel>
  );
}
