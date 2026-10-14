/**
 * 节点卡片在切换细节档位时会卸载/重新挂载，这里保存需要跨档保留的视图状态。
 * 均为纯 UI 状态，不进入画布文档、历史或项目 JSON。
 */

export interface NodeSize {
  width: number;
  height: number;
}

/**
 * 每个节点在完整档位下的尺寸。低档位按同样尺寸渲染占位卡片，
 * 端口 Handle 位置也不变，切换档位时连线不会跳动。
 */
const measuredNodeSizes = new Map<string, NodeSize>();
/** 完整卡片中参数分组（Accordion）的展开项。 */
const openParameterGroups = new Map<string, string>();

export function rememberNodeSize(id: string, size: NodeSize): void {
  if (size.width > 0 && size.height > 0) measuredNodeSizes.set(id, size);
}

export function getRememberedNodeSize(id: string): NodeSize | undefined {
  return measuredNodeSizes.get(id);
}

export function getOpenParameterGroup(id: string): string {
  return openParameterGroups.get(id) ?? '';
}

export function setOpenParameterGroup(id: string, group: string): void {
  if (group) openParameterGroups.set(id, group);
  else openParameterGroups.delete(id);
}

/** 丢弃已不在画布上的节点状态，避免删除节点或切换项目后缓存只增不减。 */
export function pruneNodeViewCache(activeIds: Set<string>): void {
  [measuredNodeSizes, openParameterGroups].forEach((cache) => {
    cache.forEach((_, id) => {
      if (!activeIds.has(id)) cache.delete(id);
    });
  });
}
