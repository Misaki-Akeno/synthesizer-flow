'use client';

import { AudioModuleBase } from '@/core/base/AudioModuleBase';
import {
    ModuleMetadata,
    ParameterType,
    PortType,
} from '@/core/base/ModuleBase';

// 定义序列步进类型，必须与SequenceEditor中的定义一致
interface SequenceStep {
    note: string;
    velocity: number;
    duration: string;
}

/**
 * 检查是否在浏览器环境中运行
 */
const isBrowser = typeof window !== 'undefined';

/**
 * 音序器模块，自动播放预设的音符序列
 */
export class SequencerModule extends AudioModuleBase {
    // 模块元数据
    public static metadata: ModuleMetadata = {
        type: 'sequencer',
        label: '简单音序器',
        description: '自动播放音符序列，可编辑音高、力度和时长',
        category: '输入',
        iconType: 'ListMusic', // 假设有这个图标，如果没有可能需要替换
    };

    // 使用 Map 存储当前活动的音符及其力度
    private activeNoteVelocities: Map<number, number> = new Map();

    // Tone.js Part 对象
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private sequencePart: any = null;

    constructor(id: string, name: string = '音序器') {
        const moduleType = 'sequencer';
        const parameters = {
            bpm: {
                type: ParameterType.NUMBER,
                value: 120,
                min: 40,
                max: 240,
                step: 1,
                uiOptions: {
                    label: 'BPM',
                    describe: '播放速度 (每分钟拍数)',
                },
            },
            running: {
                type: ParameterType.BOOLEAN,
                value: false,
                uiOptions: {
                    label: '播放中',
                    describe: '开始或停止序列播放',
                    hide: true, // 在普通参数面板隐藏，因为SequenceEditor里有控制
                },
            },
            sequence: {
                type: ParameterType.STRING, // 使用新增的 STRING 类型存储 JSON
                value: '[]',
                uiOptions: {
                    label: '序列数据',
                    hide: true, // 隐藏原始数据，通过SequenceEditor编辑
                },
            },
            transpose: {
                type: ParameterType.NUMBER,
                value: 0,
                min: -24,
                max: 24,
                step: 1,
                uiOptions: {
                    label: '全局转置',
                    describe: '调整输出音高',
                },
            },
        };

        const outputPorts = {
            activeNotes: {
                type: PortType.ARRAY,
                value: [],
            },
            activeVelocities: {
                type: PortType.ARRAY,
                value: [],
            },
            // 添加单音输出以兼容普通振荡器
            frequency: {
                type: PortType.NUMBER,
                value: 0,
            },
            gate: {
                type: PortType.NUMBER, // 0 or 1
                value: 0,
            },
        };

        const inputPorts = {
            // 支持外部 BPM 控制
            bpm: {
                type: PortType.NUMBER,
                value: 0, // 0 means ignored/no input override initially? Or we just take whatever comes.
            },
        };

        super(moduleType, id, name, parameters, inputPorts, outputPorts, true);
    }

    // ... (rest of the file) ...


    /**
     * 初始化音频
     */
    protected async initializeAudio(): Promise<void> {
        if (!isBrowser) return;

        this.setupParameterBindings();

        // Check if input port is already connected/has value (though likely 0 initially)
        // We rely on subscription to input port.

        // 初始化序列
        this.recreateSequence();
    }

    /**
     * 设置参数绑定
     */
    private setupParameterBindings(): void {
        // BPM变化 (Parameter)
        const bpmSubscription = this.parameters['bpm'].subscribe((val) => {
            // Only update transport if NO input is active overriding it?
            // Or usually input overrides parameter. 
            // Let's say: if input is connected, parameter acts as base or is ignored?
            // Standard modular: Input + Offset (Parameter). 
            // For BPM, usually you either set it internally or externally. 
            // Let's implement: Parameter is the value, Input overwrites Parameter if present?
            // "bindInputToParameter" does exactly that: Input updates Parameter.

            if (typeof val === 'number') {
                // Determine if we should set Transport BPM
                // If this module is controlling Transport (it seems to assume so)
                this.Tone.Transport.bpm.value = val;
            }
        });

        // Listen to BPM Input Port and update Parameter
        // This makes the UI slider move if external input changes it, which is nice visual feedback.
        this.bindInputToParameter('bpm', 'bpm');

        // 运行状态变化
        const runningSubscription = this.parameters['running'].subscribe((val) => {
            if (typeof val === 'boolean') {
                if (val) {
                    if (this.Tone.Transport.state !== 'started') {
                        this.Tone.Transport.start();
                    }
                } else {
                    // 停止时，清除所有音符
                    this.allNotesOff();
                    // 不一定要停止Transport，因为可能有其他模块在跑？
                    // 但作为一个简单的音序器，如果只有它在跑，可能希望停止Transport。
                    // 为避免影响全局，这里只控制Part的静音/启动，或者不做额外操作，依赖Part的生命周期
                }

                // 重新创建序列以确保状态正确
                this.recreateSequence();
            }
        });

        // 序列数据变化
        const sequenceSubscription = this.parameters['sequence'].subscribe(() => {
            // 当序列数据变化时，重建 Part
            this.recreateSequence();
        });

        this.addInternalSubscriptions([bpmSubscription, runningSubscription, sequenceSubscription]);
    }

    /**
     * 重建 Tone.Part
     */
    private recreateSequence(): void {
        if (!isBrowser) return;

        // 清理旧的 Part
        if (this.sequencePart) {
            this.sequencePart.dispose();
            this.sequencePart = null;
        }

        const running = this.getParameterValue('running') as boolean;
        if (!running) return;

        try {
            const sequenceDataStr = this.getParameterValue('sequence') as string;
            const steps: SequenceStep[] = JSON.parse(sequenceDataStr);

            if (!Array.isArray(steps) || steps.length === 0) return;

            // Build Tone.Part event array
            // For Tone.Sequence, events are triggered at a regular subdivision.
            // If we want variable durations affecting start times, we need Tone.Part.

            // However, usually "Step Sequencer" implies a grid.
            // If user wants specific durations, maybe Tone.Part is better.
            // Let's use Tone.Part and accumulate time.
            // Wait, 'duration' in Tone.Part object is "how long note lasts", NOT "time until next note".
            // We need a "time" field for start time.
            // Assuming standard step sequencer, let's assume 16th notes or 4th notes grid?
            // But user provided "Duration" input.
            // Let's assume the duration ALSO dictates when the next note starts (legato/sequential).

            // Let's assume all steps are played sequentially without gaps for now.
            // So Note 2 starts when Note 1 ends.

            // Calculate start times
            const partEvents = [];
            let accumulatedTime = new this.Tone.Time(0);

            for (const step of steps) {
                partEvents.push({
                    time: accumulatedTime.toSeconds(), // Store as seconds for Part? Or string.
                    note: step.note,
                    velocity: step.velocity,
                    duration: step.duration
                });

                // Add duration to time
                accumulatedTime = new this.Tone.Time(accumulatedTime.toSeconds() + new this.Tone.Time(step.duration).toSeconds());
            }

            const loopLength = accumulatedTime.toSeconds();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.sequencePart = new this.Tone.Part((time: number, value: any) => {
                this.triggerNote(value.note, value.velocity, value.duration, time);
            }, partEvents).start(0);

            this.sequencePart.loop = true;
            this.sequencePart.loopEnd = loopLength;

            // 确保 Transport 正在运行
            if (this.Tone.Transport.state !== 'started') {
                this.Tone.Transport.start();
            }

        } catch (e) {
            console.warn("Error creating sequence:", e);
        }
    }

    /**
     * 触发单个音符
     */
    private triggerNote(note: string, velocity: number, duration: string, time: number): void {
        // Note On
        // 将音高字符串转为 MIDI 数字
        const midi = this.Tone.Frequency(note).toMidi();
        const transpose = this.getParameterValue('transpose') as number;
        const finalMidi = midi + transpose;

        // 添加到活跃音符
        this.activeNoteVelocities.set(finalMidi, velocity);

        // 这里的 "UI" 更新 (通过 OutputPort) 应该在 Schedule 时间执行吗？
        // Tone.Draw 用于 UI，但是 OutputPorts 是主要的数据流。
        // 问题：Web Audio 调度是预调度。如果此时更新 activeNotes，它会立即生效，而不是在 'time' 生效。
        // 对于控制信号 (CV/Gate)，通常需要 AudioRate 或精准调度。
        // 但我们的架构是用 RxJS BehaviorSubject 传递 "当前" 状态。这意味着不精确的定时 (JS Main Thread)。
        // 这是一个架构限制。
        // 因此，我们只能在当前 JS 帧更新。Tone.Part 的回调是在 "lookAhead" 时间调用的 (默认 100ms 左右)。
        // 如果直接更新 Subject，会提前 100ms 触发。
        // 修正：使用 Tone.Draw.schedule 或 setTimeout 尽量对齐？
        // 或者：既然这是 React/JS 驱动的合成器架构 (Based on nodes logic outside typical AudioWorklet),
        // 我们接受 JS 线程的延迟/抖动。
        // 但是 "Tone.Part" 回调会提前！
        // 我们需要使用 this.Tone.Draw.schedule(() => { ... }, time) 来同步视觉/非音频事件。

        this.Tone.Draw.schedule(() => {
            this.activeNoteVelocities.set(finalMidi, velocity);
            this.updateOutputPorts();
        }, time);

        // Note Off
        const durationSeconds = new this.Tone.Time(duration).toSeconds();
        this.Tone.Draw.schedule(() => {
            this.activeNoteVelocities.delete(finalMidi);
            this.updateOutputPorts();
        }, time + durationSeconds);
    }

    private allNotesOff(): void {
        this.activeNoteVelocities.clear();
        this.updateOutputPorts();
    }

    private updateOutputPorts(): void {
        const notesArray = Array.from(this.activeNoteVelocities.keys());
        const velocitiesArray = Array.from(this.activeNoteVelocities.values());
        this.outputPorts['activeNotes'].next(notesArray);
        this.outputPorts['activeVelocities'].next(velocitiesArray);

        // 更新单音输出 (取最后一个/最新的音符)
        if (notesArray.length > 0) {
            const lastNoteMidi = notesArray[notesArray.length - 1];
            const freq = this.Tone.Frequency(lastNoteMidi, "midi").toFrequency();

            // 检查端口是否存在以免出错
            if (this.outputPorts['frequency']) this.outputPorts['frequency'].next(freq);
            if (this.outputPorts['gate']) this.outputPorts['gate'].next(1);
        } else {
            if (this.outputPorts['gate']) this.outputPorts['gate'].next(0);
        }
    }

    public getCustomUI() {
        return {
            type: 'SequenceEditor',
            props: {
                sequenceParam: 'sequence',
                bpmParam: 'bpm',
                runningParam: 'running',
            },
        };
    }

    public dispose(): void {
        if (this.sequencePart) {
            this.sequencePart.dispose();
        }
        // 不要停止全局 Transport，因为其他东西可能在用
        super.dispose();
    }
}
