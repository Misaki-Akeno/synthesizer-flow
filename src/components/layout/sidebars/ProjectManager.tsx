'use client';

import { useState } from 'react';
import { usePersistStore, type ProjectConfig } from '@/store/persist-store';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/shadcn/tabs';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { ScrollArea } from '@/components/ui/shadcn/scroll-area';
import { Card, CardContent, CardFooter } from '@/components/ui/shadcn/card';
import { Badge } from '@/components/ui/shadcn/badge';
import { PanelRight, Plus, Save, FileText } from 'lucide-react';

interface ProjectManagerProps {
  onClose: () => void;
}

export function ProjectManager({ onClose }: ProjectManagerProps) {
  const [projectName, setProjectName] = useState('新项目');
  const [projectDesc, setProjectDesc] = useState('');
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
    <div className="w-full h-full flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between p-2 border-b">
        <h2 className="text-sm font-medium pl-1">项目管理器</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7"
        >
          <PanelRight size={15} />
        </Button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* 当前项目信息 */}
        <div className="bg-muted/50 rounded-md p-3 mx-3 mt-3">
          <h3 className="text-sm font-medium">当前项目</h3>
          {currentProject ? (
            <div className="text-xs space-y-1 mt-2">
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
                <span className="font-medium">修改日期:</span>{' '}
                {formatDate(currentProject.lastModified)}
              </div>
              {currentProject.isBuiltIn && (
                <Badge variant="outline" className="text-xs">
                  内置预设
                </Badge>
              )}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground mt-2">
              暂无加载的项目
            </div>
          )}
        </div>

        {/* 保存项目区域 */}
        <div className="border rounded-md p-3 space-y-2 mx-3 mt-3">
          <h3 className="text-sm font-medium">保存项目</h3>

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
                const success = await saveCurrentCanvas(
                  projectName,
                  projectDesc
                );
                if (success) {
                  alert(`项目"${projectName}"已保存成功!`);
                } else {
                  alert('保存失败，请检查控制台日志');
                }
              }}
            >
              <Save className="h-4 w-4 mr-2" />
              保存项目
            </Button>
          </div>
        </div>

        {/* 项目列表和内置预设 - 占剩余空间 */}
        <div className="flex-1 flex flex-col p-3 overflow-hidden">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col"
          >
            <TabsList className="grid grid-cols-2 mb-2">
              <TabsTrigger value="user-projects">
                我的项目 ({recentProjects.length})
              </TabsTrigger>
              <TabsTrigger value="built-in">
                内置预设 ({builtInProjects.length})
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              <TabsContent
                value="user-projects"
                className="h-full mt-0 p-0 data-[state=active]:flex data-[state=active]:flex-col"
              >
                <ScrollArea className="flex-1 border rounded">
                  <div className="p-2 space-y-2">
                    {recentProjects.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-4">
                        <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>暂无保存的项目</p>
                        <p className="text-[10px] mt-1">
                          点击保存项目按钮创建新项目
                        </p>
                      </div>
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

              <TabsContent
                value="built-in"
                className="h-full mt-0 p-0 data-[state=active]:flex data-[state=active]:flex-col"
              >
                <ScrollArea className="flex-1 border rounded">
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
            </div>
          </Tabs>
        </div>
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
      <CardContent className="pb-2 pt-3">
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
      <CardFooter className="pt-0">
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={onLoad}
          >
            <FileText className="h-3.5 w-3.5 mr-1" />
            加载
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={onExport}
          >
            <Save className="h-3.5 w-3.5 mr-1" />
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
