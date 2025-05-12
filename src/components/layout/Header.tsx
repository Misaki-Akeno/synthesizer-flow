'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SearchBar } from './SearchBar';
import { Menu, LayoutPanelTop, Gauge } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const toggleRightPanel = (panel: string) => {
    const currentPanel = searchParams.get('rightPanel');
    const params = new URLSearchParams(searchParams);
    
    if (currentPanel === panel) {
      params.delete('rightPanel');
    } else {
      params.set('rightPanel', panel);
    }
    router.replace(`?${params.toString()}`);
  };
  
  return (
    <header
      className={cn(
        'grid grid-cols-3 h-12 items-center border-b px-4 bg-background',
        className
      )}
    >
      {/* 左侧区域：图标和菜单 - 自适应处理 */}
      <div className="flex items-center gap-2">
        <div className="flex items-center">
          <Image
            src="/file.svg"
            alt="Synthesizer Flow"
            width={24}
            height={24}
            className="dark:invert"
          />
          {/* 优先隐藏 Synthesizer Flow 文字 */}
          <span className="font-medium text-sm ml-2 hidden sm:inline-block">
            Synthesizer Flow
          </span>
        </div>

        {/* 桌面视图的普通菜单 */}
        <div className="hidden lg:flex items-center gap-2 ml-4">
          <Button variant="ghost" size="sm" className="text-xs">
            文件
          </Button>
          <Button variant="ghost" size="sm" className="text-xs">
            编辑
          </Button>
          <Button variant="ghost" size="sm" className="text-xs">
            视图
          </Button>
          <Button variant="ghost" size="sm" className="text-xs">
            帮助
          </Button>
        </div>

        {/* 移动视图的折叠菜单 */}
        <div className="lg:hidden ml-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Menu className="h-4 w-4" />
                <span className="sr-only">菜单</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem>文件</DropdownMenuItem>
              <DropdownMenuItem>编辑</DropdownMenuItem>
              <DropdownMenuItem>视图</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>帮助</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 中间区域：搜索栏 */}
      <div className="flex justify-center">
        <SearchBar className="w-full" />
      </div>      {/* 右侧区域：按钮 */}
      <div className="flex justify-end items-center gap-2">
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
                onClick={() => toggleRightPanel('inspector')}
              >
                <Gauge className="h-4 w-4" />
                <span className="sr-only">检查器</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>检查器</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </header>
  );
}
