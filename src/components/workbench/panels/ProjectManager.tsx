'use client';

import { useState, useEffect } from 'react';
import {
  usePersistStore,
  type ProjectConfig,
  type ProjectListErrorCode,
} from '@/store/projects-store';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/shadcn/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { ScrollArea } from '@/components/ui/shadcn/scroll-area';
import { Badge } from '@/components/ui/shadcn/badge';
import {
  Save,
  FileText,
  Trash2,
  FolderOpen,
  PanelLeftClose,
  Sparkles,
  FolderSync,
  RefreshCcw,
  Info,
  AlertTriangle,
  History,
} from 'lucide-react';
import { WorkbenchPanelHeader } from '@/components/layout/WorkbenchPanel';

import { useSearchParams } from 'next/navigation';

interface ProjectManagerProps {
  onClose: () => void;
}

export function ProjectManager({ onClose }: ProjectManagerProps) {
  const [projectName, setProjectName] = useState('新项目');
  const [projectDesc, setProjectDesc] = useState('');

  const searchParams = useSearchParams();
  const initialTab =
    searchParams.get('projectTab') === 'built-in'
      ? 'built-in'
      : 'user-projects';
  const [activeTab, setActiveTab] = useState(initialTab);

  const {
    userProjects,
    builtInProjects,
    currentProject,
    saveCurrentCanvas,
    loadProject,
    deleteProject,
    exportProjectToFile,
    isLoading,
    isProjectListLoading,
    hasHydratedProjects,
    projectsLastFetchedAt,
    projectListError,
    fetchProjects,
    draftHistory,
    restoreLocalDraft,
    saveStatus,
    lastLocalSaveAt,
  } = usePersistStore();

  const currentDraftHistory = currentProject
    ? draftHistory
        .filter((draft) => draft.projectId === currentProject.id)
        .slice(-5)
        .reverse()
    : [];

  useEffect(() => {
    if (hasHydratedProjects) {
      fetchProjects();
    }
  }, [fetchProjects, hasHydratedProjects]);

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

  const hasCache = userProjects.length > 0 || builtInProjects.length > 0;
  const hasFetchedProjects = Boolean(projectsLastFetchedAt);
  const isColdLoading =
    isProjectListLoading && !hasFetchedProjects && !hasCache;
  const isRefreshingList = isProjectListLoading && !isColdLoading;
  const listStatusText = isProjectListLoading ? '同步中' : undefined;
  const userProjectsUnavailable =
    projectListError === 'database-migration-required' ||
    projectListError === 'projects-unavailable' ||
    projectListError === 'user-projects-unavailable';
  const builtInProjectsUnavailable =
    projectListError === 'database-migration-required' ||
    projectListError === 'projects-unavailable' ||
    projectListError === 'built-in-projects-unavailable';

  return (
    <div className="w-full h-full flex flex-col relative">
      <WorkbenchPanelHeader
        title="项目管理器"
        subtitle={listStatusText}
        actions={
          <>
            {/* Refresh Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchProjects({ force: true })}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title="刷新云端数据"
              aria-label="刷新云端数据"
              disabled={isProjectListLoading}
            >
              <RefreshCcw
                size={15}
                className={isProjectListLoading ? 'animate-spin' : ''}
              />
            </Button>

            {/* Current Project Info Dialog */}
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="当前项目信息"
                  aria-label="当前项目信息"
                >
                  <Info size={15} />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>当前项目详情</DialogTitle>
                  <DialogDescription className="sr-only">
                    显示当前已加载的工作区项目详情
                  </DialogDescription>
                </DialogHeader>
                {currentProject ? (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-lg text-foreground flex items-center gap-2">
                        {currentProject.name}
                        {currentProject.isBuiltIn && (
                          <Sparkles className="h-4 w-4 text-amber-500" />
                        )}
                      </span>
                      {currentProject.isBuiltIn && (
                        <Badge
                          variant="secondary"
                          className="bg-amber-500/10 text-amber-600 border-none"
                        >
                          内置预设
                        </Badge>
                      )}
                    </div>
                    {currentProject.description && (
                      <div className="text-sm text-muted-foreground leading-relaxed">
                        {currentProject.description}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 border-t pt-4 text-xs text-muted-foreground/70">
                      <span>
                        云端 revision {currentProject.revision ?? '—'}
                      </span>
                      <span className="text-right">
                        {saveStatus === 'dirty'
                          ? `草稿 ${lastLocalSaveAt ? formatDate(lastLocalSaveAt) : '待保存'}`
                          : '画布已同步'}
                      </span>
                      <span className="col-span-2 font-mono text-[10px] opacity-70">
                        上次修改: {formatDate(currentProject.lastModified)}
                      </span>
                    </div>
                    {currentDraftHistory.length > 0 && (
                      <div className="space-y-2 border-t pt-3">
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          <History className="size-3.5 text-violet-500" />
                          本地版本
                        </div>
                        <div className="grid max-h-36 gap-1.5 overflow-y-auto">
                          {currentDraftHistory.map((draft) => (
                            <button
                              key={draft.id}
                              type="button"
                              onClick={() => restoreLocalDraft(draft.id)}
                              className="flex items-center justify-between rounded-lg border bg-muted/25 px-2.5 py-2 text-left text-[11px] transition-colors hover:border-violet-400/40 hover:bg-violet-500/5"
                            >
                              <span>{formatDate(draft.savedAt)}</span>
                              <span className="text-violet-600 dark:text-violet-400">
                                恢复
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground/60 italic flex flex-col items-center justify-center py-8 gap-2">
                    <FolderOpen className="h-8 w-8 opacity-50" />
                    <span>当前暂未加载任何项目</span>
                  </div>
                )}
                <DialogFooter className="sm:justify-end mt-4">
                  <DialogClose asChild>
                    <Button variant="secondary">关闭</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Save Project Dialog */}
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="保存到云端"
                  aria-label="保存到云端"
                >
                  <Save size={15} />
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>保存当前工作区</DialogTitle>
                  <DialogDescription className="text-xs mt-1.5 line-clamp-2">
                    将当前画布的所有节点和连接保存到云端项目。本地也会缓存一份以供快速加载。
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 mt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      项目名称
                    </label>
                    <Input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="bg-background/50 focus-visible:ring-primary/30"
                      placeholder="输入一个易于识别的名称..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      项目描述 (可选)
                    </label>
                    <Input
                      value={projectDesc}
                      onChange={(e) => setProjectDesc(e.target.value)}
                      className="bg-background/50 focus-visible:ring-primary/30"
                      placeholder="简短说明..."
                    />
                  </div>
                </div>
                <DialogFooter className="mt-2">
                  <DialogClose asChild>
                    <Button variant="ghost" className="text-xs">
                      取消
                    </Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button
                      className="text-xs px-6"
                      disabled={isLoading && !hasCache && !hasFetchedProjects}
                      onClick={async () => {
                        if (!projectName.trim()) {
                          alert('请输入项目名称');
                          return;
                        }
                        const success = await saveCurrentCanvas(
                          projectName,
                          projectDesc
                        );
                        if (!success) {
                          alert('保存失败，请检查网络或权限');
                        }
                      }}
                    >
                      确认保存
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="mx-1 h-4 w-px bg-border/70" />

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title="关闭面板"
              aria-label="关闭项目管理器"
            >
              <PanelLeftClose size={15} />
            </Button>
          </>
        }
      />

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden flex flex-col p-0">
        {/* iOS-like Pull to Refresh Top Indicator */}
        <div
          className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-center bg-primary/5 text-primary text-xs backdrop-blur-md transition-all duration-500 overflow-hidden ${
            isRefreshingList
              ? 'h-8 border-b opacity-100'
              : 'h-0 opacity-0 border-transparent'
          }`}
        >
          <FolderSync className="h-3 w-3 animate-spin mr-2" />
          正在同步云端数据...
        </div>

        {projectListError && !isProjectListLoading && (
          <ProjectSyncError
            error={projectListError}
            onRetry={() => fetchProjects({ force: true })}
          />
        )}

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 flex flex-col mt-2 px-2 pb-2"
        >
          <TabsList className="grid grid-cols-2 bg-muted/50 rounded-lg p-1 h-9 mx-2 mb-3">
            <TabsTrigger
              value="user-projects"
              className="text-xs rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              我的项目{' '}
              <span className="ml-1.5 opacity-60 text-[10px] bg-primary/10 px-1.5 rounded-full">
                {userProjects.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="built-in"
              className="text-xs rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
            >
              内置预设{' '}
              <span className="ml-1.5 opacity-60 text-[10px] bg-primary/10 px-1.5 rounded-full">
                {builtInProjects.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden relative">
            <TabsContent
              value="user-projects"
              className="h-full mt-0 focus-visible:outline-none data-[state=active]:flex data-[state=active]:flex-col"
            >
              <ScrollArea className="flex-1 h-full pr-3 pl-2 pb-2">
                <div
                  className={`space-y-3 transition-transform duration-500 ${isRefreshingList ? 'pt-8' : 'pt-1'}`}
                >
                  {isColdLoading ? (
                    <ProjectListSkeleton />
                  ) : userProjects.length === 0 && userProjectsUnavailable ? (
                    <ProjectListUnavailable label="个人项目暂时无法同步" />
                  ) : userProjects.length === 0 ? (
                    <EmptyProjectState label="云端没有保存的项目" />
                  ) : (
                    userProjects.map((project) => (
                      <ProjectItem
                        key={project.id}
                        project={project}
                        onLoad={() => loadProject(project)}
                        onExport={() => exportProjectToFile(project.id)}
                        onDelete={() => {
                          if (confirm(`确定要删除项目 "${project.name}" 吗?`)) {
                            deleteProject(project.id);
                          }
                        }}
                        isActive={currentProject?.id === project.id}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent
              value="built-in"
              className="h-full mt-0 focus-visible:outline-none data-[state=active]:flex data-[state=active]:flex-col"
            >
              <ScrollArea className="flex-1 h-full pr-3 pl-2 pb-2">
                <div
                  className={`space-y-3 transition-transform duration-500 ${isRefreshingList ? 'pt-8' : 'pt-1'}`}
                >
                  {isColdLoading ? (
                    <ProjectListSkeleton />
                  ) : builtInProjects.length === 0 &&
                    builtInProjectsUnavailable ? (
                    <ProjectListUnavailable label="内置预设暂时无法同步" />
                  ) : builtInProjects.length === 0 ? (
                    <EmptyProjectState label="暂无内置预设" />
                  ) : (
                    builtInProjects.map((project) => (
                      <ProjectItem
                        key={project.id || project.name}
                        project={project}
                        onLoad={() => loadProject(project)}
                        onExport={() => exportProjectToFile(project.name)}
                        isActive={currentProject?.name === project.name}
                        isBuiltIn
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

function ProjectSyncError({
  error,
  onRetry,
}: {
  error: ProjectListErrorCode;
  onRetry: () => void;
}) {
  const isMigrationRequired = error === 'database-migration-required';

  return (
    <div
      role="alert"
      className="mx-4 mt-3 flex items-start gap-2.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2.5 text-amber-950 dark:text-amber-100"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium">
          {isMigrationRequired
            ? '云端项目服务需要更新'
            : '暂时无法同步全部项目'}
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          {isMigrationRequired
            ? '当前数据结构与应用版本不一致，完成数据库升级后即可恢复。'
            : '已保留本地数据，你可以稍后重试。'}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 px-2 text-[11px]"
        onClick={onRetry}
        aria-label="重试同步项目"
      >
        重试
      </Button>
    </div>
  );
}

function ProjectListSkeleton() {
  return (
    <div className="space-y-3" aria-label="正在加载项目列表">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-xl border bg-card/60 p-3 shadow-sm">
          <div className="animate-pulse space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="h-4 w-2/3 rounded bg-muted" />
              <div className="h-2 w-2 rounded-full bg-muted" />
            </div>
            <div className="space-y-2">
              <div className="h-2.5 w-full rounded bg-muted/80" />
              <div className="h-2.5 w-1/2 rounded bg-muted/70" />
            </div>
            <div className="h-2.5 w-20 rounded bg-muted/60" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyProjectState({ label }: { label: string }) {
  return (
    <div className="flex h-32 flex-col items-center justify-center text-xs text-muted-foreground/70">
      <FolderOpen className="mb-3 h-10 w-10 stroke-[1]" />
      <p>{label}</p>
    </div>
  );
}

function ProjectListUnavailable({ label }: { label: string }) {
  return (
    <div className="flex h-32 flex-col items-center justify-center px-6 text-center text-xs text-muted-foreground/75">
      <AlertTriangle className="mb-3 h-9 w-9 stroke-[1] text-amber-500/80" />
      <p>{label}</p>
    </div>
  );
}

function ProjectItem({
  project,
  onLoad,
  onDelete,
  onExport,
  isActive,
  isBuiltIn,
}: {
  project: ProjectConfig;
  onLoad: () => void;
  onDelete?: () => void;
  onExport: () => void;
  isActive: boolean;
  isBuiltIn?: boolean;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-xl border bg-card/60 p-3 text-xs shadow-sm transition-all duration-300 hover:shadow-md hover:border-primary/40 
      ${isActive ? 'border-primary/60 ring-1 ring-primary/20 bg-primary/[0.03]' : ''}`}
    >
      <div className="flex justify-between items-start mb-1.5 gap-2 pr-2">
        <div className="font-semibold text-foreground/90 flex-1 truncate text-sm">
          {project.name}
        </div>
        {isActive && (
          <span className="flex h-1.5 w-1.5 mt-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)]" />
        )}
      </div>

      {project.description && (
        <div className="text-muted-foreground/80 line-clamp-2 leading-relaxed mb-3 text-[11px]">
          {project.description}
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-muted-foreground/50 font-mono mt-auto">
        <span>{new Date(project.created).toLocaleDateString()}</span>
      </div>

      {/* 悬浮操作面板 (现代毛玻璃效果) */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background via-background/95 to-transparent h-[44%] flex items-end justify-end p-2 gap-1.5 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 ease-out">
        <Button
          size="icon"
          variant="secondary"
          className="h-7 w-7 rounded-lg bg-background shadow-sm hover:bg-primary hover:text-primary-foreground transition-colors"
          onClick={onLoad}
          title="加载项目"
        >
          <FolderOpen className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          className="h-7 w-7 rounded-lg bg-background shadow-sm hover:bg-primary hover:text-primary-foreground transition-colors"
          onClick={onExport}
          title="导出项目"
        >
          <FileText className="h-3.5 w-3.5" />
        </Button>
        {!isBuiltIn && onDelete && (
          <Button
            size="icon"
            variant="destructive"
            className="h-7 w-7 rounded-lg shadow-sm opacity-90 hover:opacity-100"
            onClick={onDelete}
            title="删除项目"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
