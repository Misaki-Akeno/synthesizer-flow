const LEGACY_TOOL_NAMES: Record<string, string> = {
  get_canvas: 'canvas_inspect',
  get_module_details: 'canvas_inspect',
  add_module: 'module_add',
  update_module_parameter: 'module_update',
  delete_module: 'module_delete',
  connect_modules: 'connection_connect',
  disconnect_modules: 'connection_disconnect',
  rag_search: 'knowledge_search',
};

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * 将旧 checkpoint 中的工具调用转换为当前协议。
 * 这些别名不会绑定给模型，仅用于平滑恢复升级前尚未完成的会话。
 */
export function normalizeLegacyToolCall(
  name: string,
  args: unknown
): { name: string; args: Record<string, unknown> } {
  const normalizedName = LEGACY_TOOL_NAMES[name] ?? name;
  const input = toRecord(args);

  switch (name) {
    case 'update_module_parameter':
      return {
        name: normalizedName,
        args: {
          moduleId: input.moduleId,
          parameter: input.paramKey,
          value: input.value,
        },
      };
    case 'connect_modules':
    case 'disconnect_modules':
      return {
        name: normalizedName,
        args: {
          sourceId: input.sourceId,
          targetId: input.targetId,
          sourcePort: input.sourceHandle,
          targetPort: input.targetHandle,
        },
      };
    case 'rag_search':
      return {
        name: normalizedName,
        args: { query: input.query, limit: input.topK },
      };
    default:
      return { name: normalizedName, args: input };
  }
}

export function getCanonicalToolName(name: string): string {
  return LEGACY_TOOL_NAMES[name] ?? name;
}
