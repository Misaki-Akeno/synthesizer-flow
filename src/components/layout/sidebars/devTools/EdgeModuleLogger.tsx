import { useFlowStore } from '@/store/store';
import { ScrollArea } from '@/components/ui/shadcn/scroll-area';

export default function EdgeModuleLogger() {
  const { nodes, edges } = useFlowStore();

  // 计算基本统计数据
  const stats = {
    totalNodes: nodes.length,
    totalEdges: edges.length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <div className="border rounded p-2 text-center">
          <div className="text-2xl font-bold">{stats.totalNodes}</div>
          <div className="text-xs text-muted-foreground">模块总数</div>
        </div>
        <div className="border rounded p-2 text-center">
          <div className="text-2xl font-bold">{stats.totalEdges}</div>
          <div className="text-xs text-muted-foreground">连接总数</div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">连接列表</h3>
        <ScrollArea className="h-40 border rounded p-2">
          <div className="space-y-1">
            {edges.map((edge) => (
              <div
                key={edge.id}
                className="text-xs border-b pb-1 last:border-b-0"
              >
                <span className="font-medium">#{edge.id}</span>:
                <span className="text-blue-500"> {edge.source}</span> →
                <span className="text-green-500"> {edge.target}</span>
                {edge.sourceHandle && (
                  <span className="text-xs text-muted-foreground">
                    {' '}
                    (出口: {edge.sourceHandle})
                  </span>
                )}
                {edge.targetHandle && (
                  <span className="text-xs text-muted-foreground">
                    {' '}
                    (入口: {edge.targetHandle})
                  </span>
                )}
              </div>
            ))}
            {edges.length === 0 && (
              <div className="text-xs text-muted-foreground">暂无连接</div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">模块列表</h3>
        <ScrollArea className="h-40 border rounded p-2">
          <div className="space-y-1">
            {nodes.map((node) => (
              <div
                key={node.id}
                className="text-xs border-b pb-1 last:border-b-0"
              >
                <span className="font-medium">#{node.id}</span>:
                <span className="ml-1">
                  {node.data?.label?.toString() || '未命名'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {' '}
                  ({node.type || node.data?.module?.type || '未知类型'})
                </span>
              </div>
            ))}
            {nodes.length === 0 && (
              <div className="text-xs text-muted-foreground">暂无模块</div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
