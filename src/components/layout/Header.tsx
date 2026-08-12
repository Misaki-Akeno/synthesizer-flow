'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import { SearchBar } from '../workbench/SearchBar';
import {
  Menu,
  LayoutPanelTop,
  Save,
  FolderOpen,
  Settings,
  FileSymlink,
  FilePlus2,
  FileX,
  Undo2,
  Redo2,
  Scissors,
  Copy,
  ClipboardPaste,
  MousePointer,
  ZoomIn,
  ZoomOut,
  Moon,
  FileQuestion,
  BookOpen,
  Keyboard,
  Github,
  MessageCircle,
  Info,
} from 'lucide-react';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
} from '@/components/ui/shadcn/menubar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/shadcn/dropdown-menu';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/shadcn/tooltip';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { useFlowStore } from '@/store/canvas-store';
import { useTranslations } from 'next-intl';
import { useShallow } from 'zustand/react/shallow';
import { TransportBar } from '@/components/workbench/TransportBar';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const t = useTranslations('Workbench.header');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [devNoticeOpen, setDevNoticeOpen] = useState(false);
  const [devNoticeTitle, setDevNoticeTitle] = useState('');
  const [devNoticeDescription, setDevNoticeDescription] = useState('');
  const { undo, redo, canUndo, canRedo } = useFlowStore(
    useShallow((state) => ({
      undo: state.undo,
      redo: state.redo,
      canUndo: state.canUndo,
      canRedo: state.canRedo,
    }))
  );

  const toggleRightPanel = (panel: string) => {
    const currentPanel = searchParams.get('auxPanel');
    const params = new URLSearchParams(searchParams);

    if (currentPanel === panel) {
      params.delete('auxPanel');
    } else {
      params.set('auxPanel', panel);
    }
    router.replace(`?${params.toString()}`);
  };

  const handleMenuItemClick = (title: string, description: string) => {
    setDevNoticeTitle(title);
    setDevNoticeDescription(description);
    setDevNoticeOpen(true);
  };

  return (
    <header
      className={cn(
        'flex h-12 items-center border-b px-2 bg-background',
        className
      )}
    >
      {/* 左侧区域：图标和菜单 */}
      <div className="flex items-center flex-1">
        <div className="flex items-center mr-2">
          <Image
            src="/file.svg"
            alt="Synthesizer Flow"
            width={24}
            height={24}
            className="dark:invert"
          />
          <span className="font-medium text-sm ml-2 hidden sm:inline-block">
            Synthesizer Flow
          </span>
        </div>

        {/* 桌面视图的菜单栏 - 使用Menubar组件 */}
        <Menubar className="hidden lg:flex border-none bg-transparent">
          {/* 文件菜单 */}
          <MenubarMenu>
            <MenubarTrigger className="font-medium text-xs">
              {t('file')}
            </MenubarTrigger>
            <MenubarContent className="min-w-[12rem]">
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick(
                    t('newProject'),
                    t('descriptions.newProject')
                  )
                }
              >
                <FilePlus2 className="mr-2 h-4 w-4" />
                <span>{t('newProject')}</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+N
                </div>
              </MenubarItem>
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick(
                    t('openProject'),
                    t('descriptions.openProject')
                  )
                }
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                <span>{t('openProject')}</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+O
                </div>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick(t('save'), t('descriptions.save'))
                }
              >
                <Save className="mr-2 h-4 w-4" />
                <span>{t('save')}</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+S
                </div>
              </MenubarItem>
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick(t('saveAs'), t('descriptions.saveAs'))
                }
              >
                <FileSymlink className="mr-2 h-4 w-4" />
                <span>{t('saveAs')}</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+Shift+S
                </div>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick(t('exit'), t('descriptions.exit'))
                }
              >
                <FileX className="mr-2 h-4 w-4" />
                <span>{t('exit')}</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Alt+F4
                </div>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          {/* 编辑菜单 */}
          <MenubarMenu>
            <MenubarTrigger className="font-medium text-xs">
              {t('edit')}
            </MenubarTrigger>
            <MenubarContent className="min-w-[12rem]">
              <MenubarItem disabled={!canUndo} onClick={undo}>
                <Undo2 className="mr-2 h-4 w-4" />
                <span>{t('undo')}</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+Z
                </div>
              </MenubarItem>
              <MenubarItem disabled={!canRedo} onClick={redo}>
                <Redo2 className="mr-2 h-4 w-4" />
                <span>{t('redo')}</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+Y
                </div>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick(t('cut'), t('descriptions.cut'))
                }
              >
                <Scissors className="mr-2 h-4 w-4" />
                <span>{t('cut')}</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+X
                </div>
              </MenubarItem>
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick(t('copy'), t('descriptions.copy'))
                }
              >
                <Copy className="mr-2 h-4 w-4" />
                <span>{t('copy')}</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+C
                </div>
              </MenubarItem>
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick(t('paste'), t('descriptions.paste'))
                }
              >
                <ClipboardPaste className="mr-2 h-4 w-4" />
                <span>{t('paste')}</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+V
                </div>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick(
                    t('selectAll'),
                    t('descriptions.selectAll')
                  )
                }
              >
                <MousePointer className="mr-2 h-4 w-4" />
                <span>{t('selectAll')}</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+A
                </div>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          {/* 视图菜单 */}
          <MenubarMenu>
            <MenubarTrigger className="font-medium text-xs">
              {t('view')}
            </MenubarTrigger>
            <MenubarContent className="min-w-[12rem]">
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick(t('fitView'), t('descriptions.fitView'))
                }
              >
                <ZoomIn className="mr-2 h-4 w-4" />
                <span>{t('fitView')}</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+0
                </div>
              </MenubarItem>
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick(
                    t('resetZoom'),
                    t('descriptions.resetZoom')
                  )
                }
              >
                <ZoomOut className="mr-2 h-4 w-4" />
                <span>{t('resetZoom')}</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+R
                </div>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => toggleRightPanel('properties')}>
                <LayoutPanelTop className="mr-2 h-4 w-4" />
                <span>{t('properties')}</span>
              </MenubarItem>
              <MenubarItem onClick={() => toggleRightPanel('llm_chat')}>
                <MessageCircle className="mr-2 h-4 w-4" />
                <span>{t('aiPanel')}</span>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick(t('darkMode'), t('descriptions.darkMode'))
                }
              >
                <Moon className="mr-2 h-4 w-4" />
                <span>{t('darkMode')}</span>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          {/* 帮助菜单 */}
          <MenubarMenu>
            <MenubarTrigger className="font-medium text-xs">
              {t('help')}
            </MenubarTrigger>
            <MenubarContent className="min-w-[12rem]">
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick(
                    t('documentation'),
                    t('descriptions.documentation')
                  )
                }
              >
                <BookOpen className="mr-2 h-4 w-4" />
                <span>{t('documentation')}</span>
                <div className="ml-auto text-xs text-muted-foreground">F1</div>
              </MenubarItem>
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick(t('tutorial'), t('descriptions.tutorial'))
                }
              >
                <FileQuestion className="mr-2 h-4 w-4" />
                <span>{t('tutorial')}</span>
              </MenubarItem>
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick(
                    t('shortcuts'),
                    t('descriptions.shortcuts')
                  )
                }
              >
                <Keyboard className="mr-2 h-4 w-4" />
                <span>{t('shortcuts')}</span>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                onClick={() =>
                  window.open(
                    'https://github.com/Misaki-Akeno/synthesizer-flow',
                    '_blank'
                  )
                }
              >
                <Github className="mr-2 h-4 w-4" />
                <span>{t('repository')}</span>
              </MenubarItem>
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick(t('about'), t('descriptions.about'))
                }
              >
                <Info className="mr-2 h-4 w-4" />
                <span>{t('about')}</span>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>

        {/* 移动视图的折叠菜单 */}
        <div className="lg:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Menu className="h-4 w-4" />
                <span className="sr-only">{t('menu')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[12rem]">
              <DropdownMenuItem
                onClick={() =>
                  handleMenuItemClick(
                    t('newProject'),
                    t('descriptions.newProject')
                  )
                }
              >
                <FilePlus2 className="mr-2 h-4 w-4" />
                <span>{t('newProject')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  handleMenuItemClick(
                    t('openProject'),
                    t('descriptions.openProject')
                  )
                }
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                <span>{t('openProject')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  handleMenuItemClick(t('save'), t('descriptions.save'))
                }
              >
                <Save className="mr-2 h-4 w-4" />
                <span>{t('save')}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!canUndo} onClick={undo}>
                <Undo2 className="mr-2 h-4 w-4" />
                <span>{t('undo')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!canRedo} onClick={redo}>
                <Redo2 className="mr-2 h-4 w-4" />
                <span>{t('redo')}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => toggleRightPanel('properties')}>
                <LayoutPanelTop className="mr-2 h-4 w-4" />
                <span>{t('properties')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleRightPanel('llm_chat')}>
                <MessageCircle className="mr-2 h-4 w-4" />
                <span>{t('aiPanel')}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  window.open(
                    'https://github.com/Misaki-Akeno/synthesizer-flow',
                    '_blank'
                  )
                }
              >
                <Github className="mr-2 h-4 w-4" />
                <span>{t('repository')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  handleMenuItemClick(t('settings'), t('descriptions.settings'))
                }
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>{t('settings')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 中间区域：全局 Transport */}
      <div className="flex min-w-0 flex-[1.35] justify-center px-3">
        <TransportBar />
      </div>

      {/* 右侧区域：按钮 */}
      <div className="flex justify-end items-center gap-2 flex-1">
        <SearchBar className="hidden w-44 xl:flex 2xl:w-56" />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => toggleRightPanel('properties')}
              >
                <LayoutPanelTop className="h-4 w-4" />
                <span className="sr-only">{t('properties')}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t('properties')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => toggleRightPanel('llm_chat')}
              >
                <MessageCircle className="h-4 w-4" />
                <span className="sr-only">{t('aiPanel')}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t('aiPanel')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* 功能开发中对话框 */}
      <Dialog open={devNoticeOpen} onOpenChange={setDevNoticeOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{devNoticeTitle}</DialogTitle>
            <DialogDescription>{t('comingSoon')}</DialogDescription>
          </DialogHeader>
          <div className="py-4 flex flex-col items-center justify-center">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-700 text-center">
              <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                {t('comingSoon')}
              </p>
              <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                {devNoticeDescription || t('comingSoonDescription')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDevNoticeOpen(false)}>
              {t('close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
