'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/shadcn/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/shadcn/card';
import { signIn } from 'next-auth/react';
import { Github } from 'lucide-react';
// 导入 logger 和 toast
import { createModuleLogger } from '@/lib/logger';
import { toast } from 'sonner';

// 创建登录页面专用 logger
const logger = createModuleLogger('LoginPage');

// 使用客户端组件专门处理 useSearchParams
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get('callbackUrl') || '/';
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGitHubLogin() {
    try {
      setIsLoading(true);
      setError(null);

      // 记录登录尝试
      logger.info('用户在登录页面尝试 GitHub 登录', { callbackUrl });

      // 显示 toast 登录中提示
      toast.loading('正在连接 GitHub', {
        description: '正在建立安全连接，请稍候...',
        duration: 10000, // 延长显示时间，因为重定向可能需要时间
      });

      // 使用正确的 signIn 选项
      await signIn('github', {
        callbackUrl,
        redirect: true,
      });

      // 由于重定向，下面的代码通常不会执行，但仍保留以防需要
      logger.info('GitHub 登录重定向已发起', { callbackUrl });
    } catch (error) {
      // 记录登录错误
      logger.error('GitHub 登录失败', error);

      // 显示错误提示
      toast.error('登录失败', {
        description: '连接到 GitHub 时出现问题，请稍后再试。',
      });

      setError('登录过程中出现错误，请稍后再试');
      setIsLoading(false);
    }
  }

  return (
    <>
      {error && (
        <div className="p-3 rounded-md bg-destructive/15 text-destructive text-sm">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-6">
        <Button
          variant="outline"
          onClick={handleGitHubLogin}
          disabled={isLoading}
          className="bg-[#24292e] text-white hover:bg-[#24292e]/90"
        >
          <Github className="mr-2 h-4 w-4" />
          {isLoading ? '正在登录...' : '使用 GitHub 登录'}
        </Button>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">或者</span>
        </div>
      </div>

      <div className="text-center text-sm text-muted-foreground">
        我们目前只支持GitHub登录
      </div>

      <div className="flex justify-center mt-4">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          onClick={() => router.push('/')}
        >
          返回首页
        </Button>
      </div>
    </>
  );
}

// 主页面组件
export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">登录</CardTitle>
          <CardDescription className="text-center">
            继续登录 Synthesizer Flow
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Suspense
            fallback={
              <div className="text-center py-4">
                <div className="animate-pulse">加载中...</div>
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
