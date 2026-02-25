import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Plus, Trash2, Play, Square } from 'lucide-react';
import { ModuleBase } from '@/core/base/ModuleBase';

// 定义序列步进类型
export interface SequenceStep {
    note: string;      // 音符 (如 "C4", "D#4")
    velocity: number;  // 力度 (0-1)
    duration: string;  // 持续时间 (如 "4n", "8n", "0.5")
}

interface SequenceEditorProps {
    module?: ModuleBase;
    paramValues: Record<string, number | boolean | string>;
    onParamChange: (paramKey: string, value: number | boolean | string) => void;
    sequenceParam: string; // 存储序列数据的参数名
    bpmParam?: string;     // BPM参数名
    runningParam?: string; // 运行状态参数名
}

const SequenceEditor: React.FC<SequenceEditorProps> = ({
    paramValues,
    onParamChange,
    sequenceParam,
    bpmParam,
    runningParam,
}) => {
    // 本地状态
    const [steps, setSteps] = useState<SequenceStep[]>([]);

    const serializedSeq = paramValues[sequenceParam] as string;

    // 从参数加载序列
    useEffect(() => {
        try {
            if (serializedSeq) {
                const parsed = JSON.parse(serializedSeq);
                if (Array.isArray(parsed)) {
                    setSteps(prev => {
                        // 防止循环更新：如果内容一致则不更新
                        if (JSON.stringify(prev) === JSON.stringify(parsed)) {
                            return prev;
                        }
                        return parsed;
                    });
                }
            } else {
                // 默认初始值
                const initialSteps = [
                    { note: "C4", velocity: 0.8, duration: "4n" },
                    { note: "E4", velocity: 0.8, duration: "4n" },
                    { note: "G4", velocity: 0.8, duration: "4n" },
                    { note: "C5", velocity: 0.8, duration: "4n" },
                ];
                setSteps(initialSteps);
                // 立即保存默认值
                onParamChange(sequenceParam, JSON.stringify(initialSteps));
            }
        } catch (e) {
            console.error("Failed to parse sequence", e);
        }
    }, [serializedSeq, sequenceParam, onParamChange]);

    // 当 updateSteps 被调用时，更新本地状态并同步到参数
    const updateSteps = (newSteps: SequenceStep[]) => {
        setSteps(newSteps);
        onParamChange(sequenceParam, JSON.stringify(newSteps));
    };

    const addStep = () => {
        updateSteps([...steps, { note: "C4", velocity: 0.8, duration: "4n" }]);
    };

    const removeStep = (index: number) => {
        const newSteps = [...steps];
        newSteps.splice(index, 1);
        updateSteps(newSteps);
    };

    const updateStep = (index: number, field: keyof SequenceStep, value: string | number) => {
        const newSteps = [...steps];
        newSteps[index] = { ...newSteps[index], [field]: value };
        updateSteps(newSteps);
    };

    // 播放控制
    const isRunning = runningParam ? (paramValues[runningParam] as boolean) : false;
    const toggleRunning = () => {
        if (runningParam) {
            onParamChange(runningParam, !isRunning);
        }
    };

    return (
        <div className="sequence-editor w-full border rounded-md p-2 bg-gray-50/50">
            <div className="header flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-gray-700">序列编辑器</label>
                <div className="controls flex gap-2">
                    {runningParam && (
                        <Button
                            size="sm"
                            variant={isRunning ? "destructive" : "default"}
                            className="h-6 w-6 p-0"
                            onClick={toggleRunning}
                        >
                            {isRunning ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                        </Button>
                    )}
                    <Button variant="outline" size="sm" className="h-6 w-6 p-0" onClick={addStep}>
                        <Plus size={14} />
                    </Button>
                </div>
            </div>

            {bpmParam && (
                <div className="bpm-control flex items-center gap-2 mb-2 text-xs">
                    <span>BPM:</span>
                    <Input
                        type="number"
                        className="h-6 w-16 text-xs"
                        value={(paramValues[bpmParam] as number) ?? ''}
                        onChange={(e) => onParamChange(bpmParam, parseFloat(e.target.value))}
                    />
                </div>
            )}


            <div className="steps-list max-h-[200px] overflow-y-auto space-y-1">
                {steps.map((step, index) => (
                    <div key={index} className="step-row flex items-center gap-1 text-xs">
                        <span className="w-4 text-gray-400 text-[10px] text-center">{index + 1}</span>
                        <Input
                            value={step.note || ''}
                            onChange={(e) => updateStep(index, 'note', e.target.value)}
                            className="h-6 w-12 px-1 text-xs"
                            placeholder="Note"
                        />
                        <Input
                            type="number"
                            min={0}
                            max={1}
                            step={0.1}
                            value={step.velocity ?? 0}
                            onChange={(e) => updateStep(index, 'velocity', parseFloat(e.target.value))}
                            className="h-6 w-12 px-1 text-xs"
                            placeholder="Vel"
                        />
                        <Input
                            value={step.duration || ''}
                            onChange={(e) => updateStep(index, 'duration', e.target.value)}
                            className="h-6 w-12 px-1 text-xs"
                            placeholder="Dur"
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeStep(index)}
                        >
                            <Trash2 size={12} />
                        </Button>
                    </div>
                ))}
                {steps.length === 0 && (
                    <div className="text-center text-gray-400 text-xs py-4">
                        No steps. Click + to add.
                    </div>
                )}
            </div>
        </div>
    );
};

export default SequenceEditor;
