'use client';

import { useState, useEffect } from 'react';
import {
  BadgeCheck,
  Bell,
  CreditCard,
  LogOut,
  Sparkles,
  User,
  Loader2,
} from 'lucide-react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/shadcn/button';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/shadcn/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/shadcn/dropdown-menu';
import { useSidebar } from '@/components/ui/shadcn/sidebar';
import { useRouter } from 'next/navigation';
// 替换 toast 导入为 sonner
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/shadcn/tooltip';
// 导入 logger 系统
import { createModuleLogger } from '@/lib/logger';

// 创建 AuthUser 专用 logger
const logger = createModuleLogger('AuthUser');

export function NavUser() {
  const { isMobile } = useSidebar();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [avatarLoaded, setAvatarLoaded] = useState(false);

  // 在会话状态变更时重置头像加载状态
  useEffect(() => {
    if (status === 'authenticated') {
      setAvatarLoaded(false);
    }
  }, [status]);

  // 处理登录按钮点击
  const handleLogin = async () => {
    try {
      setIsActionLoading(true);
      setIsMenuOpen(false);

      // 记录登录尝试
      logger.info('用户尝试登录', { provider: 'github' });

      // 使用 toast 提示用户
      toast.loading('正在准备登录', {
        description: '请稍候，正在跳转到登录页面...',
      });

      // 尝试登录
      await signIn('github');

      // 由于重定向，下面的代码通常不会执行
      logger.info('登录重定向已发起');
    } catch (error) {
      // 记录错误
      logger.error('登录过程中发生错误', error);

      // 使用 toast 提示用户
      toast.error('登录失败', {
        description: '无法连接到认证服务，请稍后再试。',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // 处理登出按钮点击
  const handleLogout = async () => {
    try {
      setIsActionLoading(true);
      setIsMenuOpen(false);

      // 记录登出尝试
      logger.info('用户尝试登出');

      // 使用 toast 显示加载状态
      const toastId = toast.loading('正在退出', {
        description: '正在处理退出登录...',
      });

      // 尝试登出
      await signOut({ redirect: false });

      // 记录登出成功
      logger.success('用户已成功登出');

      // 重定向到首页
      router.push('/');

      // 成功后更新 toast
      toast.success('已退出登录', {
        id: toastId,
        description: '您已成功退出登录。',
      });
    } catch (error) {
      // 记录错误
      logger.error('登出过程中发生错误', error);

      // 错误 toast
      toast.error('退出失败', {
        description: '退出登录时发生错误，请重试。',
      });
    } finally {
      setIsActionLoading(false);
    }
  };

  // 用于头像加载完成的处理函数
  const handleAvatarLoad = () => {
    setAvatarLoaded(true);
  };

  // 用于头像加载失败的处理函数
  const handleAvatarError = () => {
    setAvatarLoaded(false);
  };

  // 获取用户显示名
  const getUserDisplayName = () => {
    return session?.user?.name || '用户';
  };

  // 获取用户头像初始字母
  const getUserInitial = () => {
    const name = session?.user?.name || '';
    return name ? name.charAt(0).toUpperCase() : 'U';
  };

  // 渲染用户头像
  const renderAvatar = () => {
    if (status === 'authenticated' && session?.user?.image) {
      return (
        <Avatar className="h-6 w-6 rounded relative">
          {!avatarLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted rounded">
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
          )}
          <AvatarImage
            src={session.user.image}
            alt={getUserDisplayName()}
            onLoad={handleAvatarLoad}
            onError={handleAvatarError}
            className={avatarLoaded ? 'opacity-100' : 'opacity-0'}
          />
          <AvatarFallback className="rounded" delayMs={600}>
            {getUserInitial()}
          </AvatarFallback>
        </Avatar>
      );
    }

    return (
      <Avatar className="h-6 w-6 rounded flex items-center justify-center bg-muted">
        <User className="h-4 w-4" />
      </Avatar>
    );
  };

  return (
    <TooltipProvider>
      <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild disabled={isActionLoading}>
              <Button
                variant="ghost"
                size="icon"
                className="w-full h-12 rounded-none relative"
              >
                {renderAvatar()}
                {status === 'loading' && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end">
            {status === 'authenticated'
              ? `已登录为 ${getUserDisplayName()}`
              : status === 'loading'
                ? '加载中...'
                : '点击登录'}
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent
          className="w-56 rounded-lg"
          side={isMobile ? 'bottom' : 'right'}
          align="end"
          sideOffset={4}
        >
          {status === 'loading' ? (
            <div className="p-4 text-center">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">身份验证中...</p>
            </div>
          ) : status === 'authenticated' && session?.user ? (
            <>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage
                      src={session.user.image || ''}
                      alt={getUserDisplayName()}
                    />
                    <AvatarFallback className="rounded-lg bg-primary/10">
                      {getUserInitial()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-none gap-1">
                    <span className="truncate font-semibold">
                      {getUserDisplayName()}
                    </span>
                    {session.user.email && (
                      <span className="truncate text-xs text-muted-foreground">
                        {session.user.email}
                      </span>
                    )}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <Sparkles className="mr-2 h-4 w-4" />
                  升级到专业版
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem>
                  <BadgeCheck className="mr-2 h-4 w-4" />
                  账户
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <CreditCard className="mr-2 h-4 w-4" />
                  结算
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Bell className="mr-2 h-4 w-4" />
                  通知
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                disabled={isActionLoading}
                className="text-red-500 focus:text-red-500"
              >
                {isActionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="mr-2 h-4 w-4" />
                )}
                退出登录
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuLabel className="font-normal">
                <div className="text-left">
                  <p className="text-sm font-medium">未登录</p>
                  <p className="text-xs text-muted-foreground">
                    登录以保存您的项目
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogin}
                disabled={isActionLoading}
              >
                {isActionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <User className="mr-2 h-4 w-4" />
                )}
                登录
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
