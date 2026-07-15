'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Plus, Sparkles } from 'lucide-react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { usePersistStore } from '@/store/projects-store';
import { useTranslations } from 'next-intl';

interface WelcomeWindowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WelcomeWindow({ open, onOpenChange }: WelcomeWindowProps) {
  const t = useTranslations('Workbench.welcome');
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const fetchProjects = usePersistStore((state) => state.fetchProjects);

  useEffect(() => {
    if (open) {
      fetchProjects();
    }
  }, [open, fetchProjects]);

  const handleAction = (panelAction?: string) => {
    onOpenChange(false);

    // 如果需要打开特定面板，更新 URL 参数
    if (panelAction) {
      const params = new URLSearchParams(searchParams);
      if (panelAction === 'example-projects') {
        params.set('panel', 'project-manager');
        params.set('projectTab', 'built-in');
      }
      router.replace(`${pathname}?${params.toString()}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl">{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 mt-2">
          <Button
            className="flex items-center justify-start gap-3 h-14 text-base"
            variant="default"
            onClick={() => handleAction()}
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-foreground/20">
              <Plus className="h-5 w-5" />
            </div>
            <div className="flex flex-col items-start">
              <span>{t('newProject')}</span>
              <span className="text-xs opacity-80 font-normal">
                {t('newProjectDescription')}
              </span>
            </div>
          </Button>

          <Button
            className="flex items-center justify-start gap-3 h-14 text-base bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20"
            variant="outline"
            onClick={() => handleAction('example-projects')}
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex flex-col items-start">
              <span>{t('loadExample')}</span>
              <span className="text-xs opacity-80 font-normal">
                {t('loadExampleDescription')}
              </span>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
