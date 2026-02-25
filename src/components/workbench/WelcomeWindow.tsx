import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Plus, FolderOpen, Sparkles } from 'lucide-react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

interface WelcomeWindowProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function WelcomeWindow({ open, onOpenChange }: WelcomeWindowProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const handleAction = (panelAction?: string) => {
        onOpenChange(false);

        // 如果需要打开特定面板，更新 URL 参数
        if (panelAction) {
            const params = new URLSearchParams(searchParams);
            if (panelAction === 'past-projects') {
                params.set('panel', 'project-manager');
                // 可选：添加参数以选择特定的 Tab
                // params.set('projectTab', 'user-projects');
            } else if (panelAction === 'example-projects') {
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
                    <DialogTitle className="text-xl">欢迎来到 SynthesizerFlow</DialogTitle>
                    <DialogDescription>
                        开始你的模块化音频合成之旅。请选择一个操作：
                    </DialogDescription>
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
                            <span>新建项目</span>
                            <span className="text-xs opacity-80 font-normal">从空白画布开始创作</span>
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
                            <span>加载示例项目</span>
                            <span className="text-xs opacity-80 font-normal">体验预设的神奇声音</span>
                        </div>
                    </Button>

                    <Button
                        className="flex items-center justify-start gap-3 h-14 text-base"
                        variant="outline"
                        onClick={() => handleAction('past-projects')}
                    >
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                            <FolderOpen className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col items-start">
                            <span>加载以往项目</span>
                            <span className="text-xs opacity-80 font-normal">继续之前的工作</span>
                        </div>
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
