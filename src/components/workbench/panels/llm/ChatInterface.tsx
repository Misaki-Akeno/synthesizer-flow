'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { ScrollArea } from '@/components/ui/shadcn/scroll-area';
import {
  Loader2,
  Send,
  Plus,
  ChevronDown,
  ChevronRight,
  Terminal,
  History,
  Save,
  Check,
  X,
} from 'lucide-react';
import {
  useAISettings,
  useIsAIConfigured,
  useUpdateSettings,
} from '@/store/settings-store';
import { useFlowStore } from '@/store/canvas-store';
import { useShallow } from 'zustand/react/shallow';
import type {
  ChatMessage,
  ClientOperation,
  ToolCall,
  ChatResponse,
} from '@/agent/core/types';
import { chatWithAgent } from '@/agent/actions';
import { saveCheckpoint } from '@/agent/checkpoint-actions';
import { getAISettingsAction } from '@/actions/ai-settings.actions';
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
import { getDisconnectEdgeChanges } from './clientOperations';
import { graphStateToSerializedCanvas } from './checkpointRestore';
import { createSerializableCanvasSnapshot } from './canvasSnapshot';
import { audioGraphRuntime } from '@/core/runtime/AudioGraphRuntime';
import { createThreadId } from './threadId';
import { useTranslations } from 'next-intl';
import { WorkbenchPanelHeader } from '@/components/layout/WorkbenchPanel';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/shadcn/tooltip';

function getCurrentCanvasSnapshot() {
  const state = useFlowStore.getState();
  return createSerializableCanvasSnapshot(state.nodes, state.edges);
}

interface ChatInterfaceProps {
  onRequestClose: () => void;
}

export function ChatInterface({ onRequestClose }: ChatInterfaceProps) {
  const t = useTranslations('Workbench.chat');
  const tWorkbench = useTranslations('Workbench');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 获取AI设置
  const aiSettings = useAISettings();
  const isAIConfigured = useIsAIConfigured();
  const { updateAI } = useUpdateSettings();

  // 精确订阅：只选取所需方法和 edges，避免 nodes 参数更新导致的无关重渲染
  const {
    addNode,
    deleteNode,
    updateModuleParameter,
    onConnect,
    onEdgesChange,
    importCanvasFromJson,
  } = useFlowStore(
    useShallow((s) => ({
      addNode: s.addNode,
      deleteNode: s.deleteNode,
      updateModuleParameter: s.updateModuleParameter,
      onConnect: s.onConnect,
      onEdgesChange: s.onEdgesChange,
      importCanvasFromJson: s.importCanvasFromJson,
    }))
  );

  useEffect(() => {
    let cancelled = false;

    getAISettingsAction().then((result) => {
      if (cancelled || !result.success || !result.data) {
        return;
      }

      updateAI({
        providerId: result.data.providerId,
        modelName: result.data.modelName,
        apiEndpoint: result.data.apiEndpoint,
        apiKey: '',
        hasServerApiKey: result.data.hasServerApiKey,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [updateAI]);

  // 消息添加后自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 会话ID (基于 LangGraph 线程)
  const [threadId, setThreadId] = useState<string | undefined>();

  // Helper to determine if input should be disabled
  const isApprovalPending =
    messages.length > 0 &&
    messages[messages.length - 1].approval?.status === 'pending';

  // 初始化 Thread ID
  useEffect(() => {
    setThreadId(createThreadId(window.crypto));
  }, []);

  const executeClientOperations = (operations: ClientOperation[]) => {
    operations.forEach((op) => {
      switch (op.type) {
        case 'ADD_MODULE':
          addNode(op.data.type, op.data.label, op.data.position, op.data.id);
          break;
        case 'DELETE_MODULE':
          deleteNode(op.data.id);
          break;
        case 'UPDATE_MODULE_PARAM':
          updateModuleParameter(
            op.data.id,
            op.data.key,
            op.data.value as string | number | boolean
          );
          break;
        case 'CONNECT_MODULES':
          onConnect({
            source: op.data.source,
            target: op.data.target,
            sourceHandle: op.data.sourceHandle || null,
            targetHandle: op.data.targetHandle || null,
          });
          break;
        case 'DISCONNECT_MODULES': {
          const edgeChanges = getDisconnectEdgeChanges(
            useFlowStore.getState().edges,
            op.data
          );
          if (edgeChanges.length > 0) {
            onEdgesChange(edgeChanges);
          }
          break;
        }
      }
    });
  };

  const handleFinalResponse = (
    response: ChatResponse,
    currentAssistantMessage: string
  ) => {
    let toolCalls = response.hasToolUse ? response.toolCalls : undefined;

    // 执行客户端操作后，再增强工具结果，确保写入消息 state 的是最新画布状态
    if (response.clientOperations && response.clientOperations.length > 0) {
      executeClientOperations(response.clientOperations);

      if (toolCalls && toolCalls.length > 0) {
        toolCalls = toolCalls.map((toolCall) => enhanceToolResult(toolCall));
      }
    }

    // Handle Approval Requirement
    if (response.approvalRequired) {
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        newMessages[lastIndex] = {
          role: 'assistant',
          content:
            response.message.content ||
            currentAssistantMessage ||
            t('requiresApproval'),
          toolCalls,
          approval: { status: 'pending' },
        };
        return newMessages;
      });
    } else {
      // Normal Response final update
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        newMessages[lastIndex] = {
          ...response.message,
          content: response.message.content || currentAssistantMessage,
          toolCalls,
        };
        return newMessages;
      });
    }
  };

  const sendMessage = async (
    action?: 'approve' | 'reject',
    targetMessageIndex?: number
  ) => {
    // If action is provided, we skip input check.
    // If normal send, we need input.
    if (!action && (!input.trim() || isLoading || !isAIConfigured)) return;

    if (!action) {
      // Normal message
      const userMessage: ChatMessage = {
        role: 'user',
        content: input,
      };
      setMessages((prev) => [...prev, userMessage]);
      setInput('');
    } else if (typeof targetMessageIndex === 'number') {
      // Update local state to show decision
      setMessages((prev) => {
        const newMessages = [...prev];
        if (
          newMessages[targetMessageIndex] &&
          newMessages[targetMessageIndex].approval
        ) {
          newMessages[targetMessageIndex] = {
            ...newMessages[targetMessageIndex],
            approval: {
              ...newMessages[targetMessageIndex].approval!,
              status: action === 'approve' ? 'approved' : 'rejected',
            },
          };
        }
        return newMessages;
      });
    }

    setIsLoading(true);
    // 标记是否已预插入占位符消息，以便 catch 中正确替换而非 append
    let assistantPlaceholderAdded = false;
    let pendingAnimationFrame: number | null = null;

    try {
      // 捕获当前状态快照 (sanitize to remove non-serializable data)
      const graphSnapshot = getCurrentCanvasSnapshot();

      // Pass Thread ID and Action
      const history: ChatMessage[] = action
        ? messages
        : [...messages, { role: 'user', content: input } as ChatMessage];
      const stream = await chatWithAgent(
        history,
        aiSettings,
        graphSnapshot,
        threadId,
        action
      );

      if (!stream) {
        throw new Error('Agent call failed to start');
      }

      let currentAssistantMessage = '';

      // 拒绝操作只需要清理服务端中断点，不额外创建空白助手消息。
      if (action !== 'reject') {
        setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
        assistantPlaceholderAdded = true;
      }

      // Check if it's a generator/iterable
      if (
        stream &&
        typeof (stream as AsyncIterable<unknown>)[Symbol.asyncIterator] ===
          'function'
      ) {
        const asyncIterable = stream as AsyncIterable<{
          type: string;
          content?: string;
          response?: ChatResponse;
        }>;
        for await (const part of asyncIterable) {
          if (part.type === 'chunk' && part.content) {
            currentAssistantMessage += part.content;
            if (pendingAnimationFrame === null) {
              pendingAnimationFrame = window.requestAnimationFrame(() => {
                pendingAnimationFrame = null;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastIndex = newMessages.length - 1;
                  if (
                    lastIndex >= 0 &&
                    newMessages[lastIndex].role === 'assistant'
                  ) {
                    newMessages[lastIndex] = {
                      ...newMessages[lastIndex],
                      content: currentAssistantMessage,
                    };
                  }
                  return newMessages;
                });
              });
            }
          } else if (part.type === 'done' && part.response) {
            if (pendingAnimationFrame !== null) {
              window.cancelAnimationFrame(pendingAnimationFrame);
              pendingAnimationFrame = null;
            }
            if (action === 'reject') {
              setThreadId(createThreadId(window.crypto));
            } else {
              handleFinalResponse(part.response, currentAssistantMessage);
            }
          }
        }
      } else {
        // Fallback for non-generator response (if any)
        const response = stream as unknown as
          | { type: string; response: ChatResponse }
          | ChatResponse;
        // In case it's a direct ChatResponse or wrapped in {type:'done'}
        if ('type' in response && response.type === 'done') {
          handleFinalResponse(response.response, '');
        } else {
          handleFinalResponse(response as ChatResponse, '');
        }
      }
    } catch (error) {
      console.error('聊天请求失败:', error);
      const errorMessage =
        error instanceof Error ? error.message : t('unknownError');
      const errorContent = t('requestError', { message: errorMessage });
      if (assistantPlaceholderAdded) {
        // 替换流中途失败留下的空占位符，而非 append 新消息
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastIndex = newMessages.length - 1;
          if (lastIndex >= 0 && newMessages[lastIndex].role === 'assistant') {
            newMessages[lastIndex] = {
              role: 'assistant',
              content: errorContent,
            };
          }
          return newMessages;
        });
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: errorContent },
        ]);
      }
    } finally {
      if (pendingAnimationFrame !== null) {
        window.cancelAnimationFrame(pendingAnimationFrame);
      }
      setIsLoading(false);
    }
  };

  // Helper to reuse the enhancement logic which is long.
  // Actually, I can define `enhanceToolResult` outside or inside.
  const enhanceToolResult = (toolCall: ToolCall): ToolCall => {
    const enhancedToolCall: ToolCall = { ...toolCall };

    if (
      toolCall.function.name === 'module_add' ||
      toolCall.function.name === 'add_module'
    ) {
      try {
        const resultObj = JSON.parse(enhancedToolCall.result || '{}');
        const moduleId = resultObj.data?.moduleId;

        if (moduleId) {
          const nodes = useFlowStore.getState().nodes;
          const node = nodes.find((n) => n.id === moduleId);

          if (node) {
            const runtimeSnapshot =
              audioGraphRuntime.getModuleSnapshot(moduleId);
            const parameters =
              runtimeSnapshot?.parameters ?? node.data.parameters;

            const ports = {
              inputs: runtimeSnapshot?.inputPortTypes ?? {},
              outputs: runtimeSnapshot?.outputPortTypes ?? {},
            };

            const currentEdges = useFlowStore.getState().edges;
            const incomingConnections = currentEdges.filter(
              (edge) => edge.target === moduleId
            );
            const outgoingConnections = currentEdges.filter(
              (edge) => edge.source === moduleId
            );

            resultObj.data.moduleDetails = {
              module: {
                id: moduleId,
                type: node.data.type,
                label: node.data.label,
                position: node.position,
                parameters,
                selected: node.selected || false,
                ports,
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
              },
            };

            enhancedToolCall.result = JSON.stringify(resultObj);
          }
        }
      } catch (e) {
        console.error('Failed to enhance add_module tool result:', e);
      }
    }

    if (
      toolCall.function.name === 'module_update' ||
      toolCall.function.name === 'update_module_parameter'
    ) {
      try {
        const resultObj = JSON.parse(enhancedToolCall.result || '{}');
        const moduleId = resultObj.data?.moduleDetails?.module?.id;

        if (moduleId) {
          const nodes = useFlowStore.getState().nodes;
          const node = nodes.find((n) => n.id === moduleId);

          if (node) {
            const parameters =
              audioGraphRuntime.getModuleSnapshot(moduleId)?.parameters ??
              node.data.parameters;

            if (resultObj.data.moduleDetails?.module) {
              resultObj.data.moduleDetails.module.parameters = parameters;
            }

            enhancedToolCall.result = JSON.stringify(resultObj);
          }
        }
      } catch (e) {
        console.error(
          'Failed to enhance update_module_parameter tool result:',
          e
        );
      }
    }

    if (
      toolCall.function.name === 'connection_connect' ||
      toolCall.function.name === 'connect_modules'
    ) {
      try {
        const resultObj = JSON.parse(enhancedToolCall.result || '{}');
        const sourceId = resultObj.data?.sourceModuleDetails?.module?.id;
        const targetId = resultObj.data?.targetModuleDetails?.module?.id;

        if (sourceId || targetId) {
          const currentEdges = useFlowStore.getState().edges;

          if (sourceId && resultObj.data.sourceModuleDetails) {
            const outgoingConnections = currentEdges.filter(
              (edge) => edge.source === sourceId
            );
            resultObj.data.sourceModuleDetails.connections = {
              ...resultObj.data.sourceModuleDetails.connections,
              outgoing: outgoingConnections.map((edge) => ({
                toModule: edge.target,
                fromHandle: edge.sourceHandle,
                toHandle: edge.targetHandle,
              })),
            };
          }

          if (targetId && resultObj.data.targetModuleDetails) {
            const incomingConnections = currentEdges.filter(
              (edge) => edge.target === targetId
            );
            resultObj.data.targetModuleDetails.connections = {
              ...resultObj.data.targetModuleDetails.connections,
              incoming: incomingConnections.map((edge) => ({
                fromModule: edge.source,
                fromHandle: edge.sourceHandle,
                toHandle: edge.targetHandle,
              })),
            };
          }

          enhancedToolCall.result = JSON.stringify(resultObj);
        }
      } catch (e) {
        console.error('Failed to enhance connect_modules tool result:', e);
      }
    }

    return enhancedToolCall;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 新建对话：保存旧状态，并切换到全新的 LangGraph 线程。
  const resetConversation = async () => {
    // Auto-save if there are user/assistant messages
    const hasHistory = messages.some((m) => m.role !== 'system');
    if (hasHistory && session?.user?.id) {
      try {
        toast.info(t('autoSaving'));
        const graphSnapshot = getCurrentCanvasSnapshot();
        await saveCheckpoint('', messages, graphSnapshot, aiSettings);
        toast.success(t('autoSaved'));
      } catch (e) {
        console.error('Auto-save failed', e);
        toast.error(t('autoSaveFailed'));
      }
    }

    setMessages([]);
    setInput('');
    setIsLoading(false);
    setThreadId(createThreadId(window.crypto));
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
      toast.error(t('loginRequired'));
      return;
    }

    setIsSaving(true);
    try {
      const graphSnapshot = getCurrentCanvasSnapshot();

      const res = await saveCheckpoint(
        '', // server will generate a default name
        messages,
        graphSnapshot,
        aiSettings // Pass settings for auto-naming
      );

      if (res.success) {
        toast.success(t('checkpointSaved'));
      } else {
        toast.error(t('checkpointSaveFailed'));
      }
    } catch (e) {
      console.error(e);
      toast.error(t('checkpointSaveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreCheckpoint = (
    checkpoint: import('@/db/schema').Checkpoint
  ) => {
    try {
      const restoredMessages = checkpoint.messages as ChatMessage[];
      const restoredCanvas = graphStateToSerializedCanvas(
        checkpoint.graphState as import('@/agent/core/types').GraphStateSnapshot
      );

      if (!restoredCanvas) {
        toast.error(t('invalidCheckpoint'));
        return;
      }

      const currentProjectId = useFlowStore.getState().currentProjectId;
      const imported = importCanvasFromJson(
        JSON.stringify(restoredCanvas),
        currentProjectId || `checkpoint-${checkpoint.id}`
      );

      if (!imported) {
        toast.error(t('restoreCanvasFailed'));
        return;
      }

      setMessages(restoredMessages);
      toast.success(t('checkpointLoaded'));
      setIsHistoryOpen(false);
    } catch (e) {
      console.error(e);
      toast.error(t('checkpointRestoreError'));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <WorkbenchPanelHeader
        title={tWorkbench('panels.chat')}
        actions={
          <div
            className="flex items-center gap-0.5"
            data-testid="chat-header-actions"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={resetConversation}
                  aria-label={t('newConversation')}
                >
                  <Plus size={15} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {t('newConversation')}
              </TooltipContent>
            </Tooltip>

            {session?.user && (
              <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        aria-label={t('history')}
                      >
                        <History size={15} />
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{t('history')}</TooltipContent>
                </Tooltip>
                <DialogContent className="sm:max-w-[350px]">
                  <DialogHeader>
                    <DialogTitle>{t('archiveTitle')}</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4">
                    <Button
                      onClick={handleSaveCheckpoint}
                      disabled={isSaving}
                      className="w-full"
                    >
                      {isSaving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {t('saveCurrent')}
                    </Button>
                    <div className="my-2 border-t" />
                    <CheckpointList onRestore={handleRestoreCheckpoint} />
                  </div>
                </DialogContent>
              </Dialog>
            )}

            <div className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={onRequestClose}
                  aria-label={tWorkbench('panels.close')}
                >
                  <X size={15} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {tWorkbench('panels.close')}
              </TooltipContent>
            </Tooltip>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col p-4">
        {/* 聊天记录区域 */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="space-y-4 p-4">
              {displayMessages.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400">
                  {hasApiKey ? (
                    t('start')
                  ) : (
                    <div>
                      <p>{t('configureApi')}</p>
                      <p className="text-xs mt-2">{t('settingsPath')}</p>
                    </div>
                  )}
                </div>
              ) : (
                displayMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg max-w-full ${
                      msg.role === 'user'
                        ? 'bg-blue-100 dark:bg-blue-900 ml-8'
                        : 'bg-gray-100 dark:bg-gray-800 mr-8'
                    }`}
                  >
                    <div className="prose dark:prose-invert prose-sm max-w-none break-words overflow-x-hidden">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({
                            inline,
                            className,
                            children,
                            ...props
                          }: React.ComponentPropsWithoutRef<'code'> & {
                            inline?: boolean;
                          }) {
                            const match = /language-(\w+)/.exec(
                              className || ''
                            );
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
                      {/* Approval UI */}
                      {msg.approval && (
                        <div className="mt-2 p-3 border rounded-md bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                          {msg.approval.status === 'pending' && (
                            <div className="flex flex-col gap-2">
                              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 flex items-center">
                                <Loader2 className="h-3 w-3 mr-2 animate-pulse" />
                                {t('approvalRequired')}
                              </p>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    sendMessage('reject', messages.indexOf(msg))
                                  }
                                  disabled={isLoading}
                                >
                                  {t('reject')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() =>
                                    sendMessage(
                                      'approve',
                                      messages.indexOf(msg)
                                    )
                                  }
                                  disabled={isLoading}
                                >
                                  {t('approve')}
                                </Button>
                              </div>
                            </div>
                          )}
                          {msg.approval.status === 'approved' && (
                            <div className="flex items-center text-green-600 dark:text-green-400 font-medium text-sm">
                              <Check className="w-4 h-4 mr-2" />
                              <span>{t('approved')}</span>
                            </div>
                          )}
                          {msg.approval.status === 'rejected' && (
                            <div className="flex items-center text-red-600 dark:text-red-400 font-medium text-sm">
                              <X className="w-4 h-4 mr-2" />
                              <span>{t('rejected')}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div className="flex items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2 text-sm text-gray-500">
                    {t('thinking')}
                  </span>
                </div>
              )}
              {/* 用于自动滚动到底部的空白元素 */}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* 输入区域 - 固定在底部，不随滚动区域滚动 */}
        <div
          className="flex flex-col gap-2 border-t pt-4"
          data-testid="chat-composer"
        >
          <div className="flex items-center space-x-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={
                hasApiKey ? t('inputPlaceholder') : t('configurePlaceholder')
              }
              disabled={isLoading || !hasApiKey || isApprovalPending} // Disable input during approval?
              className="flex-1"
            />
            <Button
              onClick={() => sendMessage()}
              disabled={
                isLoading || !input.trim() || !hasApiKey || isApprovalPending
              }
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
    </div>
  );
}

function ToolCallsDisplay({ toolCalls }: { toolCalls: ToolCall[] }) {
  const t = useTranslations('Workbench.chat');
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
        <span className="font-medium">
          {t('toolCalls', { count: toolCalls.length })}
        </span>
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
                  <div className="font-semibold text-primary/80 text-[10px] uppercase">
                    {t('result')}
                  </div>
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
