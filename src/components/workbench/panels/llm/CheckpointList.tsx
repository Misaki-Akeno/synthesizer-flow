'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/shadcn/button';
import { ScrollArea } from '@/components/ui/shadcn/scroll-area';
import { Checkpoint } from '@/db/schema';
import { deleteCheckpoint, getCheckpoints, updateCheckpointTitle } from '@/agent/checkpoint-actions';
import { Loader2, Trash2, Edit2, Check, X, Play } from 'lucide-react';
import { Input } from '@/components/ui/shadcn/input';
import { toast } from 'sonner';

interface CheckpointListProps {
    userId: string;
    onRestore: (checkpoint: Checkpoint) => void;
}

export function CheckpointList({ userId, onRestore }: CheckpointListProps) {
    const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');

    const loadCheckpoints = async () => {
        setIsLoading(true);
        const res = await getCheckpoints(userId);
        if (res.success && res.data) {
            setCheckpoints(res.data);
        } else {
            toast.error('无法加载存档列表');
        }
        setIsLoading(false);
    };

    useEffect(() => {
        loadCheckpoints();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    const handleDelete = async (id: string) => {
        if (!confirm('确定要删除这个存档吗？')) return;
        const res = await deleteCheckpoint(id, userId);
        if (res.success) {
            toast.success('存档已删除');
            loadCheckpoints();
        } else {
            toast.error('删除失败');
        }
    };

    const handleStartEdit = (checkpoint: Checkpoint) => {
        setEditingId(checkpoint.id);
        setEditTitle(checkpoint.title);
    };

    const handleSaveTitle = async (id: string) => {
        if (!editTitle.trim()) return;
        const res = await updateCheckpointTitle(id, userId, editTitle);
        if (res.success) {
            toast.success('标题已更新');
            setEditingId(null);
            loadCheckpoints();
        } else {
            toast.error('更新失败');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">历史存档</h3>
                <Button variant="outline" size="sm" onClick={loadCheckpoints} disabled={isLoading}>
                    刷新
                </Button>
            </div>

            <ScrollArea className="h-[300px] pr-4">
                {isLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : checkpoints.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        暂无存档
                    </div>
                ) : (
                    <div className="space-y-3">
                        {checkpoints.map((cp) => (
                            <div
                                key={cp.id}
                                className="flex items-center justify-between p-3 rounded-lg border bg-card text-card-foreground shadow-sm hover:bg-accent/50 transition-colors"
                            >
                                <div className="flex-1 min-w-0 mr-2">
                                    {editingId === cp.id ? (
                                        <div className="flex items-center gap-2">
                                            <Input
                                                value={editTitle}
                                                onChange={(e) => setEditTitle(e.target.value)}
                                                className="h-8 text-sm"
                                                autoFocus
                                            />
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleSaveTitle(cp.id)}>
                                                <Check className="h-4 w-4 text-green-500" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}>
                                                <X className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium break-all" title={cp.title}>
                                                    {cp.title}
                                                </span>
                                                <button
                                                    onClick={() => handleStartEdit(cp)}
                                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                                >
                                                    <Edit2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(cp.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="default"
                                        size="sm"
                                        className="h-8 text-xs"
                                        onClick={() => {
                                            if (confirm('确定载入此对话历史吗？当前画布状态将保持不变。')) {
                                                onRestore(cp);
                                            }
                                        }}
                                    >
                                        <Play className="h-3 w-3 mr-1" /> 载入
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                        onClick={() => handleDelete(cp.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}
