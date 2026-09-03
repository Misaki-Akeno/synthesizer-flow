'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/shadcn/button';
import { X } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  WorkbenchPanel,
  WorkbenchPanelBody,
  WorkbenchPanelHeader,
} from '@/components/layout/WorkbenchPanel';

const ChatInterface = dynamic(
  () =>
    import('@/components/workbench/panels/llm/ChatInterface').then(
      (module) => module.ChatInterface
    ),
  { loading: () => <div className="h-full animate-pulse bg-muted/20" /> }
);
const ModulePropertiesPanel = dynamic(
  () =>
    import('@/components/workbench/panels/ModulePropertiesPanel').then(
      (module) => module.ModulePropertiesPanel
    ),
  { loading: () => <div className="h-full animate-pulse bg-muted/20" /> }
);

interface AuxiliarySidebarProps {
  className?: string;
}

// 右侧栏面板类型
type RightPanelType = 'properties' | 'llm_chat' | null;

export function AuxiliarySidebar({ className }: AuxiliarySidebarProps) {
  const t = useTranslations('Workbench');
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
      {activePanel === 'properties' && (
        <>
          <WorkbenchPanelHeader
            title={t('panels.properties')}
            actions={
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={closePanel}
                aria-label={t('panels.close')}
              >
                <X size={15} />
              </Button>
            }
          />
          <WorkbenchPanelBody className="overflow-auto p-4">
            <ModulePropertiesPanel onRequestClose={closePanel} />
          </WorkbenchPanelBody>
        </>
      )}
      {activePanel === 'llm_chat' && (
        <ChatInterface onRequestClose={closePanel} />
      )}
    </WorkbenchPanel>
  );
}
