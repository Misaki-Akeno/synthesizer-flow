import { useState } from 'react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { usePersistStore, type ProjectConfig } from '@/store/project-store';
import { ScrollArea } from '@/components/ui/shadcn/scroll-area';
import { Card, CardContent, CardFooter } from '@/components/ui/shadcn/card';
import { useFlowStore } from '@/store/store';
import { Badge } from '@/components/ui/shadcn/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/shadcn/tabs';
import { createModuleLogger } from '@/lib/logger';

// 创建序列化测试器专用日志记录器
const logger = createModuleLogger('SerializationTester');

export default function SerializationTester() {
  const [projectName, setProjectName] = useState('测试项目');
  const [projectDesc, setProjectDesc] = useState('自动创建的测试项目');
  const [activeTab, setActiveTab] = useState('user-projects');

  const {
    recentProjects,
    builtInProjects,
    currentProject,
    saveCurrentCanvas,
    loadProject,
    deleteProject,
    exportProjectToFile,
  } = usePersistStore();

  // 显示的日期格式化函数
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('zh-CN', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_e) {
      return '无效日期';
    }
  };

  return (
    <div className="space-y-4">
      {/* 当前项目信息 */}
      <div className="bg-muted/50 rounded-md p-2">
        <h3 className="text-sm font-medium">当前项目</h3>
        {currentProject ? (
          <div className="text-xs space-y-1 mt-1">
            <div>
              <span className="font-medium">名称:</span> {currentProject.name}
            </div>
            {currentProject.description && (
              <div>
                <span className="font-medium">描述:</span>{' '}
                {currentProject.description}
              </div>
            )}
            <div>
              <span className="font-medium">创建时间:</span>{' '}
              {formatDate(currentProject.created)}
            </div>
            <div>
              <span className="font-medium">最后修改:</span>{' '}
              {formatDate(currentProject.lastModified)}
            </div>
            {currentProject.isBuiltIn && (
              <Badge variant="outline" className="text-xs">
                内置预设
              </Badge>
            )}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">暂无加载的项目</div>
        )}
      </div>

      {/* 保存新项目区域 */}
      <div className="border rounded-md p-3 space-y-2">
        <h3 className="text-sm font-medium">保存当前画布</h3>

        <div className="grid gap-2">
          <div className="grid grid-cols-[80px_1fr] items-center gap-2">
            <label htmlFor="project-name" className="text-xs">
              项目名称
            </label>
            <Input
              id="project-name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="h-7 text-xs"
              placeholder="输入项目名称"
            />
          </div>

          <div className="grid grid-cols-[80px_1fr] items-center gap-2">
            <label htmlFor="project-desc" className="text-xs">
              项目描述
            </label>
            <Input
              id="project-desc"
              value={projectDesc}
              onChange={(e) => setProjectDesc(e.target.value)}
              className="h-7 text-xs"
              placeholder="输入项目描述(可选)"
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button
            size="sm"
            onClick={async () => {
              if (!projectName.trim()) {
                alert('请输入项目名称');
                return;
              }
              const success = await saveCurrentCanvas(projectName, projectDesc);
              if (success) {
                alert(`项目"${projectName}"已保存成功!`);
              } else {
                alert('保存失败，请检查控制台日志');
              }
            }}
          >
            保存项目
          </Button>
        </div>
      </div>

      {/* 调试功能区 */}
      <div className="border rounded-md p-3 space-y-2">
        <h3 className="text-sm font-medium">调试功能</h3>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const jsonData = useFlowStore.getState().exportCanvasToJson();
              logger.info('画布数据 (JSON):', jsonData);
              try {
                // 尝试复制到剪贴板
                navigator.clipboard
                  .writeText(jsonData)
                  .then(() => alert('JSON 数据已复制到剪贴板!'))
                  .catch((err) => {
                    logger.error('剪贴板复制失败:', err);
                    alert('无法复制到剪贴板，请查看控制台获取数据');
                  });
              } catch (error) {
                logger.error('剪贴板操作错误:', error);
                alert('无法访问剪贴板API，数据已输出到控制台');
              }
            }}
          >
            导出 JSON
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const input = prompt('请粘贴 JSON 数据:');
              if (!input) return;

              try {
                const success = useFlowStore
                  .getState()
                  .importCanvasFromJson(input);
                if (success) {
                  alert('画布数据导入成功!');
                } else {
                  alert('导入失败，格式可能不正确');
                }
              } catch (error) {
                logger.error('导入错误:', error);
                alert('导入出错，查看控制台获取详情');
              }
            }}
          >
            导入 JSON
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              // 创建下载链接来导出画布数据
              const jsonData = useFlowStore.getState().exportCanvasToJson();
              const dataBlob = new Blob([jsonData], {
                type: 'application/json',
              });
              const url = URL.createObjectURL(dataBlob);

              const link = document.createElement('a');
              link.href = url;
              link.download = `synthesizerflow_canvas_${new Date().toISOString().slice(0, 10)}.json`;
              link.click();

              // 清理资源
              URL.revokeObjectURL(url);
            }}
          >
            下载 JSON 文件
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (
                confirm(
                  '确定要清空本地存储(localStorage)吗? 这将删除所有保存的项目和设置。'
                )
              ) {
                localStorage.clear();
                alert('本地存储已清空。应用需要刷新以应用更改。');
                window.location.reload();
              }
            }}
          >
            清空本地存储
          </Button>
        </div>
      </div>

      {/* 项目列表和内置预设 */}
      <div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 mb-2">
            <TabsTrigger value="user-projects">
              用户项目 ({recentProjects.length})
            </TabsTrigger>
            <TabsTrigger value="built-in">
              内置预设 ({builtInProjects.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="user-projects">
            <ScrollArea className="h-52 border rounded">
              <div className="p-2 space-y-2">
                {recentProjects.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    暂无保存的项目
                  </p>
                ) : (
                  recentProjects.map((project) => (
                    <ProjectCard
                      key={project.name}
                      project={project}
                      onLoad={() => loadProject(project)}
                      onExport={() => exportProjectToFile(project.name)}
                      onDelete={() => {
                        if (confirm(`确定要删除项目"${project.name}"吗?`)) {
                          deleteProject(project.name);
                        }
                      }}
                      isActive={currentProject?.name === project.name}
                    />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="built-in">
            <ScrollArea className="h-52 border rounded">
              <div className="p-2 space-y-2">
                {builtInProjects.map((project) => (
                  <ProjectCard
                    key={project.id || project.name}
                    project={project}
                    onLoad={() => loadProject(project)}
                    onExport={() => exportProjectToFile(project.name)}
                    onDelete={() => {}} // 内置预设不允许删除
                    isActive={currentProject?.name === project.name}
                    isBuiltIn
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  onLoad,
  onDelete,
  onExport,
  isActive,
  isBuiltIn,
}: {
  project: ProjectConfig;
  onLoad: () => void;
  onDelete: () => void;
  onExport: () => void;
  isActive: boolean;
  isBuiltIn?: boolean;
}) {
  return (
    <Card className={`text-xs ${isActive ? 'border-primary' : ''}`}>
      <CardContent>
        <div className="font-medium flex items-center gap-2">
          {project.name}
          {isBuiltIn && (
            <Badge variant="outline" className="text-[9px]">
              内置预设
            </Badge>
          )}
        </div>
        {project.description && (
          <div className="text-muted-foreground mt-1 line-clamp-1">
            {project.description}
          </div>
        )}
        <div className="mt-1 text-[10px] text-muted-foreground">
          创建于: {new Date(project.created).toLocaleDateString()}
        </div>
      </CardContent>
      <CardFooter>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={onLoad}
          >
            加载
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={onExport}
          >
            导出
          </Button>
        </div>
        {!isBuiltIn && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            删除
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
