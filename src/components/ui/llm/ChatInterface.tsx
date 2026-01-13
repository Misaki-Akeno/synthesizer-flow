'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { ScrollArea } from '@/components/ui/shadcn/scroll-area';
import { Switch } from '@/components/ui/shadcn/switch';
import {
  Loader2,
  Send,
  Wrench,
  Plus,
  ChevronDown,
  ChevronRight,
  Terminal,
  History,
  Save,
} from 'lucide-react';
import { useAISettings, useIsAIConfigured } from '@/store/settings';
import { useFlowStore } from '@/store/store';
import { ChatMessage, ClientOperation, ToolCall } from '@/agent';
import { getSystemPrompt } from '@/agent/prompts/system';
import { chatWithAgent } from '@/agent/actions';
import { saveCheckpoint } from '@/agent/checkpoint-actions';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/shadcn/dialog';
import { CheckpointList } from './CheckpointList';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

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
      switch (op.type) {
        case 'ADD_MODULE':
          addNode(op.data.type, op.data.label, op.data.position, op.data.id);
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
      // 捕获当前状态快照 (sanitize to remove non-serializable data)
      const currentNodes = useFlowStore.getState().nodes.map(n => {
        // 提取最新参数值
        const parameters: Record<string, unknown> = { ...(n.data.parameters || {}) };
        if (n.data.module && n.data.module.parameters) {
          Object.entries(n.data.module.parameters).forEach(([key, param]) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (param && typeof (param as any).getValue === 'function') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              parameters[key] = (param as any).getValue();
            }
          });
        }

        // 提取端口信息
        const ports = {
          inputs: n.data.module?.inputPortTypes || {},
          outputs: n.data.module?.outputPortTypes || {}
        };

        return {
          ...n,
          data: {
            ...n.data,
            parameters,
            ports, // 添加端口信息
            module: undefined // 移除不可序列化的 module 实例
          }
        };
      });
      const currentEdgesSnapshot = useFlowStore.getState().edges;

      const response = await chatWithAgent(
        [...messages, userMessage],
        aiSettings,
        { nodes: currentNodes, edges: currentEdgesSnapshot },
        useTools
      );

      // 添加AI的响应
      setMessages((prev) => [
        ...prev,
        {
          ...response.message,
          toolCalls: response.hasToolUse ? response.toolCalls : undefined,
        },
      ]);

      // 如果有工具调用，可以显示额外信息
      if (response.hasToolUse && response.toolCalls) {
        console.log('AI使用了工具:', response.toolCalls);
      }

      // 执行客户端操作
      if (response.clientOperations && response.clientOperations.length > 0) {
        executeClientOperations(response.clientOperations);

        // 立即从 store 获取真实节点数据并更新工具调用结果
        if (response.toolCalls && response.toolCalls.length > 0) {
          response.toolCalls.forEach((toolCall: ToolCall) => {
            if (toolCall.function.name === 'add_module') {
              try {
                // 解析工具调用的结果
                const resultObj = JSON.parse(toolCall.result || '{}');
                const moduleId = resultObj.data?.moduleId;

                if (moduleId) {
                  // 从 store 获取真实节点
                  const nodes = useFlowStore.getState().nodes;
                  const node = nodes.find(n => n.id === moduleId);

                  if (node?.data?.module) {
                    // 提取完整的参数信息
                    const parameters: Record<string, unknown> = {};
                    if (node.data.module.parameters) {
                      Object.entries(node.data.module.parameters).forEach(([key, param]) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        if (param && typeof (param as any).getValue === 'function') {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          parameters[key] = (param as any).getValue();
                        }
                      });
                    }

                    // 提取端口信息
                    const ports = {
                      inputs: node.data.module.inputPortTypes || {},
                      outputs: node.data.module.outputPortTypes || {}
                    };

                    // 提取连接信息
                    const currentEdges = useFlowStore.getState().edges;
                    const incomingConnections = currentEdges.filter((edge) => edge.target === moduleId);
                    const outgoingConnections = currentEdges.filter((edge) => edge.source === moduleId);

                    // 更新工具调用结果中的 moduleDetails
                    resultObj.data.moduleDetails = {
                      module: {
                        id: moduleId,
                        type: node.data.type,
                        label: node.data.label,
                        position: node.position,
                        parameters,
                        selected: node.selected || false,
                        ports
                      },
                      connections: {
                        incoming: incomingConnections.map((edge) => ({
                          fromModule: edge.source,
                          fromHandle: edge.sourceHandle,
                          toHandle: edge.targetHandle,
                        })),
                        outgoing: outgoingConnections.map((edge) => ({
                          toModule: edge.target,
                          fromHandle: edge.sourceHandle,
                          toHandle: edge.targetHandle,
                        })),
                      }
                    };

                    // 更新工具调用的结果
                    toolCall.result = JSON.stringify(resultObj);
                  }
                }
              } catch (e) {
                console.error('Failed to enhance add_module tool result:', e);
              }
            }

            // 为 update_module_parameter 增强结果
            if (toolCall.function.name === 'update_module_parameter') {
              try {
                const resultObj = JSON.parse(toolCall.result || '{}');
                const moduleId = resultObj.data?.moduleDetails?.module?.id;

                if (moduleId) {
                  const nodes = useFlowStore.getState().nodes;
                  const node = nodes.find(n => n.id === moduleId);

                  if (node?.data?.module) {
                    // 更新参数信息
                    const parameters: Record<string, unknown> = {};
                    if (node.data.module.parameters) {
                      Object.entries(node.data.module.parameters).forEach(([key, param]) => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        if (param && typeof (param as any).getValue === 'function') {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          parameters[key] = (param as any).getValue();
                        }
                      });
                    }

                    // 更新 moduleDetails 中的参数
                    if (resultObj.data.moduleDetails?.module) {
                      resultObj.data.moduleDetails.module.parameters = parameters;
                    }

                    toolCall.result = JSON.stringify(resultObj);
                  }
                }
              } catch (e) {
                console.error('Failed to enhance update_module_parameter tool result:', e);
              }
            }

            // 为 connect_modules 增强结果
            if (toolCall.function.name === 'connect_modules') {
              try {
                const resultObj = JSON.parse(toolCall.result || '{}');
                const sourceId = resultObj.data?.sourceModuleDetails?.module?.id;
                const targetId = resultObj.data?.targetModuleDetails?.module?.id;

                if (sourceId || targetId) {
                  const currentEdges = useFlowStore.getState().edges;

                  // 更新源模块的连接信息
                  if (sourceId && resultObj.data.sourceModuleDetails) {
                    const outgoingConnections = currentEdges.filter((edge) => edge.source === sourceId);
                    resultObj.data.sourceModuleDetails.connections = {
                      ...resultObj.data.sourceModuleDetails.connections,
                      outgoing: outgoingConnections.map((edge) => ({
                        toModule: edge.target,
                        fromHandle: edge.sourceHandle,
                        toHandle: edge.targetHandle,
                      })),
                    };
                  }

                  // 更新目标模块的连接信息
                  if (targetId && resultObj.data.targetModuleDetails) {
                    const incomingConnections = currentEdges.filter((edge) => edge.target === targetId);
                    resultObj.data.targetModuleDetails.connections = {
                      ...resultObj.data.targetModuleDetails.connections,
                      incoming: incomingConnections.map((edge) => ({
                        fromModule: edge.source,
                        fromHandle: edge.sourceHandle,
                        toHandle: edge.targetHandle,
                      })),
                    };
                  }

                  toolCall.result = JSON.stringify(resultObj);
                }
              } catch (e) {
                console.error('Failed to enhance connect_modules tool result:', e);
              }
            }
          });
        }
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
  const resetConversation = async () => {
    // Auto-save if there are user/assistant messages
    const hasHistory = messages.some(m => m.role !== 'system');
    if (hasHistory && session?.user?.id) {
      try {
        toast.info('正在自动保存...');
        const currentNodes = useFlowStore.getState().nodes.map(n => ({
          ...n,
          data: { ...n.data, module: undefined }
        }));
        const currentEdges = useFlowStore.getState().edges;
        await saveCheckpoint(
          session.user.id,
          '',
          messages,
          { nodes: currentNodes, edges: currentEdges },
          aiSettings
        );
        toast.success('已自动保存上一次对话');
      } catch (e) {
        console.error('Auto-save failed', e);
        toast.error('自动保存失败');
      }
    }

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

  // Checkpoint related
  const { data: session } = useSession();
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveCheckpoint = async () => {
    if (!session?.user?.id) {
      toast.error('请先登录');
      return;
    }

    setIsSaving(true);
    try {
      const currentNodes = useFlowStore.getState().nodes.map(n => ({
        ...n,
        data: { ...n.data, module: undefined }
      }));
      const currentEdges = useFlowStore.getState().edges;

      const res = await saveCheckpoint(
        session.user.id,
        '', // server will generate a default name
        messages,
        { nodes: currentNodes, edges: currentEdges },
        aiSettings // Pass settings for auto-naming
      );

      if (res.success) {
        toast.success('存档已保存');
      } else {
        toast.error('保存失败');
      }
    } catch (e) {
      console.error(e);
      toast.error('保存出错');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreCheckpoint = (checkpoint: import('@/db/schema').Checkpoint) => {
    try {
      // Only Restore Chat
      const restoredMessages = checkpoint.messages as ChatMessage[];
      setMessages(restoredMessages);
      toast.success('对话历史已加载');
      setIsHistoryOpen(false);
    } catch (e) {
      console.error(e);
      toast.error('恢复出错');
    }
  };

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
                  className={`p-3 rounded-lg max-w-full ${msg.role === 'user'
                    ? 'bg-blue-100 dark:bg-blue-900 ml-8'
                    : 'bg-gray-100 dark:bg-gray-800 mr-8'
                    }`}
                >
                  <div className="prose dark:prose-invert prose-sm max-w-none break-words overflow-x-hidden">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ inline, className, children, ...props }: React.ComponentPropsWithoutRef<'code'> & { inline?: boolean }) {
                          const match = /language-(\w+)/.exec(className || '');
                          return !inline && match ? (
                            <div className="w-full overflow-x-auto rounded-md">
                              <SyntaxHighlighter
                                {...props}
                                style={oneDark}
                                language={match[1]}
                                PreTag="div"
                                customStyle={{ margin: 0, borderRadius: 0 }}
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            </div>
                          ) : (
                            <code {...props} className={className}>
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <ToolCallsDisplay toolCalls={msg.toolCalls} />
                    )}
                  </div>
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
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetConversation}>
              <Plus className="h-4 w-4 mr-1" /> 新建对话
            </Button>
            {session?.user && (
              <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <History className="h-4 w-4 mr-1" /> 历史
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[350px]">
                  <DialogHeader>
                    <DialogTitle>对话存档</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4">
                    <Button onClick={handleSaveCheckpoint} disabled={isSaving} className="w-full">
                      {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      保存当前状态
                    </Button>
                    <div className="border-t my-2" />
                    <CheckpointList userId={session.user.id} onRestore={handleRestoreCheckpoint} />
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Wrench className="h-4 w-4" />
            <span className="text-sm">MCP</span>
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

function ToolCallsDisplay({ toolCalls }: { toolCalls: ToolCall[] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!toolCalls || toolCalls.length === 0) return null;

  const formatJson = (str: string) => {
    try {
      const parsed = JSON.parse(str);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return str;
    }
  };

  return (
    <div className="mt-2 rounded-md border bg-muted/50 text-sm w-full block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-2 p-2 hover:bg-muted/60 transition-colors text-muted-foreground"
      >
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <Terminal className="h-4 w-4" />
        <span className="font-medium">工具调用 ({toolCalls.length})</span>
      </button>

      {isOpen && (
        <div className="border-t p-2 space-y-2 w-full grid grid-cols-1">
          {toolCalls.map((call) => (
            <div key={call.id} className="text-xs space-y-1 w-full min-w-0">
              <div className="font-semibold text-primary">
                {call.function.name}
              </div>
              <div className="w-full p-2 rounded border bg-background font-mono text-muted-foreground whitespace-pre overflow-auto max-h-60 text-[10px] leading-tight">
                {formatJson(call.function.arguments)}
              </div>
              {call.result && (
                <div className="mt-1 w-full min-w-0">
                  <div className="font-semibold text-primary/80 text-[10px] uppercase">Result</div>
                  <div className="w-full p-2 rounded border bg-muted font-mono text-muted-foreground whitespace-pre overflow-auto max-h-60 text-[10px] leading-tight">
                    {formatJson(call.result)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
