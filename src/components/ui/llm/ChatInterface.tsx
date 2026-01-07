'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { ScrollArea } from '@/components/ui/shadcn/scroll-area';
import { Switch } from '@/components/ui/shadcn/switch';
import { Loader2, Send, Wrench, Plus } from 'lucide-react';
import { useAISettings, useIsAIConfigured } from '@/store/settings';
import { useFlowStore } from '@/store/store';
import { ChatMessage, ClientOperation } from '@/agent';
import { getSystemPrompt } from '@/agent/prompts/system';
import { chatWithAgent } from '@/agent/actions';

export function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 获取AI设置
  const aiSettings = useAISettings();
  const isAIConfigured = useIsAIConfigured();
  
  // 获取Store操作方法
  const { 
    addNode, 
    deleteNode, 
    updateModuleParameter, 
    onConnect, 
    onEdgesChange,
    edges: currentEdges 
  } = useFlowStore();

  // 是否启用工具功能
  const [useTools, setUseTools] = useState(true);

  // 当组件首次加载时，添加系统提示
  useEffect(() => {
    setMessages([
      {
        role: 'system',
        content: getSystemPrompt(useTools),
      },
    ]);
    // 仅首次加载
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ... (useTools effect remains same)
  // 当 useTools 切换时，仅更新系统提示内容，不清空历史
  useEffect(() => {
    setMessages((prev) => {
      if (!prev || prev.length === 0) {
        return [
          {
            role: 'system',
            content: getSystemPrompt(useTools),
          },
        ];
      }
      const first = prev[0];
      if (first.role === 'system') {
        const updated = [...prev];
        updated[0] = { ...first, content: getSystemPrompt(useTools) };
        return updated;
      }
      return [
        { role: 'system', content: getSystemPrompt(useTools) },
        ...prev,
      ];
    });
  }, [useTools]);

  // 消息添加后自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const executeClientOperations = (operations: ClientOperation[]) => {
    operations.forEach(op => {
      console.log('执行操作:', op);
      switch(op.type) {
        case 'ADD_MODULE':
          addNode(op.data.type, op.data.label, op.data.position);
          break;
        case 'DELETE_MODULE':
          deleteNode(op.data.id);
          break;
        case 'UPDATE_MODULE_PARAM':
          updateModuleParameter(op.data.id, op.data.key, op.data.value as string | number | boolean);
          break;
        case 'CONNECT_MODULES':
          onConnect({
            source: op.data.source,
            target: op.data.target,
            sourceHandle: op.data.sourceHandle || null,
            targetHandle: op.data.targetHandle || null
          });
          break;
        case 'DISCONNECT_MODULES': 
        {
          const edge = currentEdges.find(e => 
            e.source === op.data.source && 
            e.target === op.data.target &&
            (!op.data.sourceHandle || e.sourceHandle === op.data.sourceHandle) &&
            (!op.data.targetHandle || e.targetHandle === op.data.targetHandle)
          );
          if (edge) {
            onEdgesChange([{ type: 'remove', id: edge.id }]);
          }
          break;
        }
      }
    });
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !isAIConfigured) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // 捕获当前状态快照 (sanitize to remove non-serializable data)
      const currentNodes = useFlowStore.getState().nodes.map(n => ({
        ...n,
        data: {
          ...n.data,
          module: undefined // 移除不可序列化的 module 实例
        }
      }));
      const currentEdgesSnapshot = useFlowStore.getState().edges;

      const response = await chatWithAgent(
        [...messages, userMessage],
        aiSettings,
        { nodes: currentNodes, edges: currentEdgesSnapshot },
        useTools
      );

      // 添加AI的响应
      setMessages((prev) => [...prev, response.message]);

      // 如果有工具调用，可以显示额外信息
      if (response.hasToolUse && response.toolCalls) {
        console.log('AI使用了工具:', response.toolCalls);
      }

      // 执行客户端操作
      if (response.clientOperations && response.clientOperations.length > 0) {
        executeClientOperations(response.clientOperations);
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

  // 新建对话：重置为仅包含当前 useTools 的系统提示
  const resetConversation = () => {
    setMessages([
      {
        role: 'system',
        content: getSystemPrompt(useTools),
      },
    ]);
    setInput('');
    setIsLoading(false);
  };

  // 检查是否已设置API密钥
  const hasApiKey = isAIConfigured;

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
                  '开始与AI助手聊天吧！可以问问我画布上有什么模块。'
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
        <div className="flex justify-between items-center mb-2">
          <Button variant="outline" size="sm" onClick={resetConversation}>
            <Plus className="h-4 w-4 mr-1" /> 新建对话
          </Button>
          <div className="flex items-center space-x-2">
            <Wrench className="h-4 w-4" />
            <span className="text-sm">启用MCP工具</span>
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
