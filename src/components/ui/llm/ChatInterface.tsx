'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { ScrollArea } from '@/components/ui/shadcn/scroll-area';
import { Loader2, Send } from 'lucide-react';
import { usePersistStore } from '@/store/persist-store';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // 当消息更新时，滚动到底部
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // 从持久化存储中获取AI模型设置
  const aiModelSettings = usePersistStore(
    (state) => state.preferences.aiModelSettings
  );

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          // 传递AI模型设置
          apiKey: aiModelSettings.apiKey,
          apiEndpoint: aiModelSettings.apiEndpoint || undefined,
          modelName: aiModelSettings.modelName || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '服务器响应错误');
      }

      const data = await response.json();
      setMessages((prev) => [...prev, data.message]);
    } catch (error) {
      console.error('聊天请求失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `抱歉，请求处理过程中出现了错误: ${errorMessage}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 检查是否已设置API密钥（必须是非空字符串）
  const hasApiKey = !!aiModelSettings.apiKey && aiModelSettings.apiKey.trim() !== '';

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-gray-400">
              {hasApiKey ? (
                "开始与AI助手聊天吧"
              ) : (
                <div>
                  <p>请先在<strong>设置</strong>中配置AI模型的API密钥</p>
                  <p className="text-xs mt-2">进入设置 &gt; AI模型设置</p>
                </div>
              )}
            </div>
          ) : (
            messages.map((msg, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-100 dark:bg-blue-900 ml-8'
                    : 'bg-gray-100 dark:bg-gray-800 mr-8'
                }`}
              >
                <div className="text-sm">
                  {msg.role === 'user' ? '你' : 'AI助手'}:
                </div>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="ml-2 text-sm text-gray-500">AI思考中...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        <div className="flex items-center space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={hasApiKey ? "输入消息..." : "请先在设置中配置API密钥"}
            disabled={isLoading || !hasApiKey}
            className="flex-1"
          />
          <Button
            onClick={sendMessage}
            disabled={isLoading || !input.trim() || !hasApiKey}
            size="icon"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
