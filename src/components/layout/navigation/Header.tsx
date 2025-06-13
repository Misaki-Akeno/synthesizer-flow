'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import { SearchBar } from './SearchBar';
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

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [devNoticeOpen, setDevNoticeOpen] = useState(false);
  const [devNoticeTitle, setDevNoticeTitle] = useState('');
  const [devNoticeDescription, setDevNoticeDescription] = useState('');

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
              文件
            </MenubarTrigger>
            <MenubarContent className="min-w-[12rem]">
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick('新建项目', '创建一个新的合成器项目')
                }
              >
                <FilePlus2 className="mr-2 h-4 w-4" />
                <span>新建项目</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+N
                </div>
              </MenubarItem>
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick('打开项目', '打开已有的合成器项目')
                }
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                <span>打开项目</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+O
                </div>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                onClick={() => handleMenuItemClick('保存项目', '保存当前项目')}
              >
                <Save className="mr-2 h-4 w-4" />
                <span>保存</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+S
                </div>
              </MenubarItem>
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick('另存为', '将当前项目另存为新文件')
                }
              >
                <FileSymlink className="mr-2 h-4 w-4" />
                <span>另存为</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+Shift+S
                </div>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                onClick={() => handleMenuItemClick('退出', '退出应用程序')}
              >
                <FileX className="mr-2 h-4 w-4" />
                <span>退出</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Alt+F4
                </div>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          {/* 编辑菜单 */}
          <MenubarMenu>
            <MenubarTrigger className="font-medium text-xs">
              编辑
            </MenubarTrigger>
            <MenubarContent className="min-w-[12rem]">
              <MenubarItem
                onClick={() => handleMenuItemClick('撤销', '撤销上一步操作')}
              >
                <Undo2 className="mr-2 h-4 w-4" />
                <span>撤销</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+Z
                </div>
              </MenubarItem>
              <MenubarItem
                onClick={() => handleMenuItemClick('重做', '重做上一步操作')}
              >
                <Redo2 className="mr-2 h-4 w-4" />
                <span>重做</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+Y
                </div>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick('剪切', '将选中内容剪切到剪贴板')
                }
              >
                <Scissors className="mr-2 h-4 w-4" />
                <span>剪切</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+X
                </div>
              </MenubarItem>
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick('复制', '将选中内容复制到剪贴板')
                }
              >
                <Copy className="mr-2 h-4 w-4" />
                <span>复制</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+C
                </div>
              </MenubarItem>
              <MenubarItem
                onClick={() => handleMenuItemClick('粘贴', '从剪贴板粘贴内容')}
              >
                <ClipboardPaste className="mr-2 h-4 w-4" />
                <span>粘贴</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+V
                </div>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                onClick={() => handleMenuItemClick('选择全部', '选择所有模块')}
              >
                <MousePointer className="mr-2 h-4 w-4" />
                <span>选择全部</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+A
                </div>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          {/* 视图菜单 */}
          <MenubarMenu>
            <MenubarTrigger className="font-medium text-xs">
              视图
            </MenubarTrigger>
            <MenubarContent className="min-w-[12rem]">
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick('缩放适配', '缩放视图以适应所有模块')
                }
              >
                <ZoomIn className="mr-2 h-4 w-4" />
                <span>缩放适配</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+0
                </div>
              </MenubarItem>
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick('重置缩放', '将缩放级别重置为默认值')
                }
              >
                <ZoomOut className="mr-2 h-4 w-4" />
                <span>重置缩放</span>
                <div className="ml-auto text-xs text-muted-foreground">
                  Ctrl+R
                </div>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => toggleRightPanel('properties')}>
                <LayoutPanelTop className="mr-2 h-4 w-4" />
                <span>属性面板</span>
              </MenubarItem>
              <MenubarItem onClick={() => toggleRightPanel('llm_chat')}>
                <MessageCircle className="mr-2 h-4 w-4" />
                <span>大模型面板</span>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem
                onClick={() => handleMenuItemClick('深色模式', '切换深色模式')}
              >
                <Moon className="mr-2 h-4 w-4" />
                <span>深色模式</span>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>

          {/* 帮助菜单 */}
          <MenubarMenu>
            <MenubarTrigger className="font-medium text-xs">
              帮助
            </MenubarTrigger>
            <MenubarContent className="min-w-[12rem]">
              <MenubarItem
                onClick={() => handleMenuItemClick('文档', '查看使用文档')}
              >
                <BookOpen className="mr-2 h-4 w-4" />
                <span>文档</span>
                <div className="ml-auto text-xs text-muted-foreground">F1</div>
              </MenubarItem>
              <MenubarItem
                onClick={() => handleMenuItemClick('教程', '查看入门教程')}
              >
                <FileQuestion className="mr-2 h-4 w-4" />
                <span>教程</span>
              </MenubarItem>
              <MenubarItem
                onClick={() => handleMenuItemClick('快捷键', '查看快捷键列表')}
              >
                <Keyboard className="mr-2 h-4 w-4" />
                <span>快捷键</span>
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
                <span>GitHub 仓库</span>
              </MenubarItem>
              <MenubarItem
                onClick={() =>
                  handleMenuItemClick('关于', '关于 SynthesizerFlow')
                }
              >
                <Info className="mr-2 h-4 w-4" />
                <span>关于</span>
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
                <span className="sr-only">菜单</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[12rem]">
              <DropdownMenuItem
                onClick={() =>
                  handleMenuItemClick('新建项目', '创建一个新的合成器项目')
                }
              >
                <FilePlus2 className="mr-2 h-4 w-4" />
                <span>新建项目</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  handleMenuItemClick('打开项目', '打开已有的合成器项目')
                }
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                <span>打开项目</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleMenuItemClick('保存项目', '保存当前项目')}
              >
                <Save className="mr-2 h-4 w-4" />
                <span>保存</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  handleMenuItemClick('撤销/重做', '撤销或重做操作')
                }
              >
                <Undo2 className="mr-2 h-4 w-4" />
                <span>撤销/重做</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => toggleRightPanel('properties')}>
                <LayoutPanelTop className="mr-2 h-4 w-4" />
                <span>属性面板</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleRightPanel('llm_chat')}>
                <MessageCircle className="mr-2 h-4 w-4" />
                <span>大模型面板</span>
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
                <span>GitHub 仓库</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleMenuItemClick('设置', '应用程序设置')}
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>设置</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 中间区域：搜索栏 */}
      <div className="flex justify-center px-4 max-w-md w-full">
        <SearchBar className="w-full" />
      </div>

      {/* 右侧区域：按钮 */}
      <div className="flex justify-end items-center gap-2 flex-1">
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
                <span className="sr-only">属性</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>属性面板</p>
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
                <span className="sr-only">大模型面板</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>大模型面板</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* 功能开发中对话框 */}
      <Dialog open={devNoticeOpen} onOpenChange={setDevNoticeOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{devNoticeTitle}</DialogTitle>
            <DialogDescription>功能开发中</DialogDescription>
          </DialogHeader>
          <div className="py-4 flex flex-col items-center justify-center">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-700 text-center">
              <p className="text-yellow-800 dark:text-yellow-200 font-medium">
                功能开发中
              </p>
              <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                {devNoticeDescription || '此功能正在开发中，敬请期待！'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDevNoticeOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
