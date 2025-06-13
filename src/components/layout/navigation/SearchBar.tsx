'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/shadcn/input';
import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/utils';
import { usePersistStore } from '@/store/project-store';

interface SearchBarProps {
  className?: string;
}

export function SearchBar({ className }: SearchBarProps) {
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { currentProject } = usePersistStore();

  // 激活搜索
  const activateSearch = () => {
    setIsSearchActive(true);
    setTimeout(() => {
      document.getElementById('search-input')?.focus();
    }, 100);
  };

  // 取消激活搜索
  const deactivateSearch = () => {
    if (!searchQuery) {
      setIsSearchActive(false);
    }
  };

  // 处理搜索
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // 执行搜索逻辑
    console.log('Searching for:', searchQuery);
  };

  // 处理按键事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      deactivateSearch();
    }
  };

  return (
    <div
      className={cn(
        'w-full transition-all duration-300 ease-in-out',
        isSearchActive ? 'flex' : 'flex justify-center',
        className
      )}
    >
      {isSearchActive ? (
        // 展开的搜索框
        <form onSubmit={handleSearch} className="w-full relative">
          <Input
            id="search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onBlur={deactivateSearch}
            onKeyDown={handleKeyDown}
            placeholder="搜索模块..."
            className="pl-4 h-8 w-full pr-10"
          />
          {searchQuery && (
            <Button
              type="submit"
              size="sm"
              variant="ghost"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 px-0"
            >
              <Search className="h-3.5 w-3.5" />
            </Button>
          )}
        </form>
      ) : (
        // 折叠状态 - 显示项目名称和搜索按钮，使用与展开状态一致的框样式
        <div
          onClick={activateSearch}
          className="w-full flex items-center justify-center gap-2 cursor-pointer border rounded-md h-8 px-3 bg-background hover:bg-accent/30 transition-colors mx-auto"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium truncate max-w-[200px] text-muted-foreground">
            {currentProject?.name || 'Synthesizer Flow'}
          </span>
        </div>
      )}
    </div>
  );
}
