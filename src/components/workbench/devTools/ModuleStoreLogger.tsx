import { useEffect, useState } from 'react';
import { useModulesStore } from '@/core/store/useModulesStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function ModuleStoreLogger() {
  // 从模块存储中获取数据
  const modules = useModulesStore((state) => state.modules);
  const positions = useModulesStore((state) => state.positions);
  const connections = useModulesStore((state) => state.connections);
  const selectedModuleId = useModulesStore((state) => state.selectedModuleId);

  // 计算统计信息
  const moduleCount = Object.keys(modules).length;
  const connectionCount = Object.keys(connections).length;

  // 用于显示的数据
  const [displayData, setDisplayData] = useState({
    moduleCount: 0,
    connectionCount: 0,
    selectedModuleId: null as string | null,
    modulesSummary: [] as Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
    }>,
    connectionsSummary: [] as Array<{
      id: string;
      sourceId: string;
      targetId: string;
      sourceHandle?: string;
      targetHandle?: string;
    }>,
  });

  // 当store变化时更新显示数据
  useEffect(() => {
    const modulesSummary = Object.values(modules).map((module) => ({
      id: module.id,
      type: module.typeId || 'unknown',
      position: positions[module.id] || { x: 0, y: 0 },
    }));

    const connectionsSummary = Object.values(connections).map((connection) => ({
      id: connection.id,
      sourceId: connection.sourceId,
      targetId: connection.targetId,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
    }));

    setDisplayData({
      moduleCount,
      connectionCount,
      selectedModuleId,
      modulesSummary,
      connectionsSummary,
    });
  }, [
    modules,
    positions,
    connections,
    selectedModuleId,
    moduleCount,
    connectionCount,
  ]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Card>
          <CardContent className="p-2 text-center">
            <div className="text-sm text-muted-foreground">模块数量</div>
            <div className="text-2xl font-bold">{displayData.moduleCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2 text-center">
            <div className="text-sm text-muted-foreground">连接数量</div>
            <div className="text-2xl font-bold">
              {displayData.connectionCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {displayData.selectedModuleId && (
        <div className="bg-muted/30 p-2 rounded-md">
          <span className="text-sm">当前选中: </span>
          <Badge variant="outline">{displayData.selectedModuleId}</Badge>
        </div>
      )}

      <div className="border rounded-md">
        <div className="border-b px-3 py-2 font-medium">模块列表</div>
        <div className="max-h-[200px] overflow-y-auto">
          {displayData.modulesSummary.map((module) => (
            <div
              key={module.id}
              className="border-b px-3 py-2 last:border-0 text-sm"
            >
              <div>
                <span className="font-medium">ID:</span>{' '}
                {module.id.substring(0, 8)}...
              </div>
              <div>
                <span className="font-medium">类型:</span> {module.type}
              </div>
              <div>
                <span className="font-medium">位置:</span> (
                {Math.round(module.position.x)}, {Math.round(module.position.y)}
                )
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border rounded-md">
        <div className="border-b px-3 py-2 font-medium">连接列表</div>
        <div className="max-h-[200px] overflow-y-auto">
          {displayData.connectionsSummary.map((connection) => (
            <div
              key={connection.id}
              className="border-b px-3 py-2 last:border-0 text-sm"
            >
              <div>
                <span className="font-medium">ID:</span>{' '}
                {connection.id.substring(0, 8)}...
              </div>
              <div>
                <span className="font-medium">源模块:</span>{' '}
                {connection.sourceId.substring(0, 8)}...
                {connection.sourceHandle && ` (${connection.sourceHandle})`}
              </div>
              <div>
                <span className="font-medium">目标模块:</span>{' '}
                {connection.targetId.substring(0, 8)}...
                {connection.targetHandle && ` (${connection.targetHandle})`}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
