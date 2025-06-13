'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { ScrollArea } from '@/components/ui/shadcn/scroll-area';
import { Switch } from '@/components/ui/shadcn/switch';
import { Loader2, Send, Wrench } from 'lucide-react';
import { usePersistStore } from '@/store/persist-store';
import { getSystemPrompt } from '@/lib/llm/systemPrompt';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 当组件加载时，添加系统提示
  useEffect(() => {
    setMessages([
      {
        role: 'system',
        content: getSystemPrompt(true),
      },
    ]);
  }, []);

  // 从持久化存储中获取AI模型设置
  const aiModelSettings = usePersistStore(
    (state) => state.preferences.aiModelSettings
  );

  // 是否启用工具功能
  const [useTools, setUseTools] = useState(true);

  // 消息添加后自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
          // 传递是否启用工具
          useTools,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '服务器响应错误');
      }

      const data = await response.json();

      // 检查响应是否包含工具调用
      if (data.hasToolUse) {
        // 添加带有工具调用的AI响应
        setMessages((prev) => [...prev, data.message]);

        // 也可以在这里添加代码，以可视化方式显示工具调用过程
        // 例如：显示"AI使用了工具：get_all_modules"
      } else {
        // 普通响应，直接添加
        setMessages((prev) => [...prev, data.message]);
      }
    } catch (error) {
      console.error('聊天请求失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `抱歉，请求处理过程中出现了错误: ${errorMessage}`,
        },
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
  const hasApiKey =
    !!aiModelSettings.apiKey && aiModelSettings.apiKey.trim() !== '';

  // 获取可显示的消息（过滤掉系统消息）
  const displayMessages = messages.filter((msg) => msg.role !== 'system');

  return (
    <div className="flex flex-col h-full">
      {/* 聊天记录区域 */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-4">
            {displayMessages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400">
                {hasApiKey ? (
                  '开始与AI助手聊天吧'
                ) : (
                  <div>
                    <p>
                      请先在<strong>设置</strong>中配置AI模型的API密钥
                    </p>
                    <p className="text-xs mt-2">进入设置 &gt; AI模型设置</p>
                  </div>
                )}
              </div>
            ) : (
              displayMessages.map((msg, index) => (
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
            {/* 用于自动滚动到底部的空白元素 */}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </div>

      {/* 输入区域 - 固定在底部，不随滚动区域滚动 */}
      <div className="border-t p-4 flex flex-col gap-2">
        {/* 工具开关控制 */}
        <div className="flex justify-end items-center mb-2">
          <div className="flex items-center space-x-2">
            <Wrench className="h-4 w-4" />
            <span className="text-sm">启用工具</span>
            <Switch
              checked={useTools}
              onCheckedChange={setUseTools}
              disabled={!hasApiKey}
            />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={hasApiKey ? '输入消息...' : '请先在设置中配置API密钥'}
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
