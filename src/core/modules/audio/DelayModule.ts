/* eslint-disable @typescript-eslint/no-explicit-any */
import { AudioInputHandler } from '@/core/audio/AudioInputHandler';
import { AudioModuleBase } from '@/core/base/AudioModuleBase';
import {
    ModuleMetadata,
    ParameterType,
    PortType,
} from '@/core/base/ModuleBase';

/**
 * 延迟效果器模块 (Feedback Delay)
 */
export class DelayModule extends AudioModuleBase {
    public static metadata: ModuleMetadata = {
        type: 'delay',
        label: '回声延迟',
        description: '添加带有反馈的回声效果',
        category: '效果',
        iconType: 'Activity', // Use 'Activity' or similar if 'Clock' not ideal
    };

    private delay: any;

    constructor(id: string, name: string = '回声延迟') {
        const moduleType = 'delay';
        const parameters = {
            delayTime: {
                type: ParameterType.NUMBER,
                value: 0.25,
                min: 0,
                max: 1.0,
                step: 0.01,
                uiOptions: {
                    group: '主要参数',
                    label: '延迟时间',
                    describe: '两次回声之间的时间间隔 (秒)',
                },
            },
            feedback: {
                type: ParameterType.NUMBER,
                value: 0.5,
                min: 0,
                max: 0.95, // Limit to prevent infinite feedback
                step: 0.01,
                uiOptions: {
                    group: '主要参数',
                    label: '反馈',
                    describe: '回声的反馈量 (重复次数)',
                },
            },
            wet: {
                type: ParameterType.NUMBER,
                value: 0.5,
                min: 0,
                max: 1.0,
                step: 0.01,
                uiOptions: {
                    group: '主要参数',
                    label: '干湿比',
                    describe: '混合原始信号与效果信号的比例',
                },
            },
        };

        const inputPorts = {
            input: {
                type: PortType.AUDIO,
                value: null,
            },
        };

        const outputPorts = {
            output: {
                type: PortType.AUDIO,
                value: null,
            },
        };

        super(moduleType, id, name, parameters, inputPorts, outputPorts, true);

        this.setCustomUI('XYPad', {
            xParam: {
                paramKey: 'delayTime',
                label: 'Time',
                min: 0,
                max: 1.0,
            },
            yParam: {
                paramKey: 'feedback',
                label: 'Fbk',
                min: 0,
                max: 0.95,
            },
            width: 180,
            height: 120,
        });
    }

    protected async initializeAudio(): Promise<void> {
        this.delay = new this.Tone.FeedbackDelay({
            delayTime: this.getParameterValue('delayTime'),
            feedback: this.getParameterValue('feedback'),
            wet: this.getParameterValue('wet'),
        });

        this.audioInputHandler = new AudioInputHandler(this.delay, this.Tone);
        this.updateOutputConnection();
        this.setupDelayBindings();
    }

    private updateOutputConnection(): void {
        if (!this.audioInputHandler || !this.delay) return;

        if (!this.isEnabled()) {
            this.outputPorts['output'].next(this.audioInputHandler.getMixerOutput());
        } else {
            this.outputPorts['output'].next(this.delay);
        }
    }

    protected onEnabledStateChanged(_enabled: boolean): void {
        this.updateOutputConnection();
    }

    private setupDelayBindings(): void {
        if (!this.delay) return;

        const delayTimeSub = this.parameters['delayTime'].subscribe(
            (value: number | boolean | string) => {
                if (typeof value === 'number') {
                    this.applyParameterRamp(this.delay.delayTime, value, this.smoothTime);
                }
            }
        );

        const feedbackSub = this.parameters['feedback'].subscribe(
            (value: number | boolean | string) => {
                if (typeof value === 'number') {
                    this.applyParameterRamp(this.delay.feedback, value, this.smoothTime);
                }
            }
        );

        const wetSub = this.parameters['wet'].subscribe(
            (value: number | boolean | string) => {
                if (typeof value === 'number') {
                    this.applyParameterRamp(this.delay.wet, value, this.smoothTime);
                }
            }
        );

        this.addInternalSubscriptions([delayTimeSub, feedbackSub, wetSub]);
    }

    public dispose(): void {
        if (this.delay) {
            this.delay.dispose();
        }
        super.dispose();
    }
}
