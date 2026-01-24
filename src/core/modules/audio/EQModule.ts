/* eslint-disable @typescript-eslint/no-explicit-any */
import { AudioInputHandler } from '@/core/audio/AudioInputHandler';
import { AudioModuleBase } from '@/core/base/AudioModuleBase';
import {
    ModuleMetadata,
    ParameterType,
    PortType,
} from '@/core/base/ModuleBase';

/**
 * 均衡器模块 (3-Band EQ)
 */
export class EQModule extends AudioModuleBase {
    public static metadata: ModuleMetadata = {
        type: 'eq',
        label: '均衡器',
        description: '3频段均衡器 (Low, Mid, High)',
        category: '效果',
        iconType: 'Sliders', // Suggesting Sliders icon
    };

    private eq: any;

    constructor(id: string, name: string = '均衡器') {
        const moduleType = 'eq';
        const parameters = {
            low: {
                type: ParameterType.NUMBER,
                value: 0,
                min: -24,
                max: 24,
                step: 0.1,
                uiOptions: {
                    group: '频段',
                    label: '低频',
                    describe: '低频增益 (dB)',
                    unit: 'dB',
                },
            },
            mid: {
                type: ParameterType.NUMBER,
                value: 0,
                min: -24,
                max: 24,
                step: 0.1,
                uiOptions: {
                    group: '频段',
                    label: '中频',
                    describe: '中频增益 (dB)',
                    unit: 'dB',
                },
            },
            high: {
                type: ParameterType.NUMBER,
                value: 0,
                min: -24,
                max: 24,
                step: 0.1,
                uiOptions: {
                    group: '频段',
                    label: '高频',
                    describe: '高频增益 (dB)',
                    unit: 'dB',
                },
            },
            lowFrequency: {
                type: ParameterType.NUMBER,
                value: 400,
                min: 50,
                max: 1000,
                step: 10,
                uiOptions: {
                    group: '分频点',
                    label: '低频分频点',
                    describe: '低频与中频的分界频率 (Hz)',
                    unit: 'Hz',
                },
            },
            highFrequency: {
                type: ParameterType.NUMBER,
                value: 2500,
                min: 1000,
                max: 10000,
                step: 100,
                uiOptions: {
                    group: '分频点',
                    label: '高频分频点',
                    describe: '中频与高频的分界频率 (Hz)',
                    unit: 'Hz',
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
    }

    protected async initializeAudio(): Promise<void> {
        this.eq = new this.Tone.EQ3({
            low: this.getParameterValue('low'),
            mid: this.getParameterValue('mid'),
            high: this.getParameterValue('high'),
            lowFrequency: this.getParameterValue('lowFrequency'),
            highFrequency: this.getParameterValue('highFrequency'),
        });

        this.audioInputHandler = new AudioInputHandler(this.eq, this.Tone);
        this.updateOutputConnection();
        this.setupBindings();
    }

    private updateOutputConnection(): void {
        if (!this.audioInputHandler || !this.eq) return;

        if (!this.isEnabled()) {
            this.outputPorts['output'].next(this.audioInputHandler.getMixerOutput());
        } else {
            this.outputPorts['output'].next(this.eq);
        }
    }

    protected onEnabledStateChanged(_enabled: boolean): void {
        this.updateOutputConnection();
    }

    private setupBindings(): void {
        if (!this.eq) return;

        const lowSub = this.parameters['low'].subscribe(
            (value: number | boolean | string) => {
                if (typeof value === 'number') {
                    this.applyParameterRamp(this.eq.low, value, this.smoothTime);
                }
            }
        );

        const midSub = this.parameters['mid'].subscribe(
            (value: number | boolean | string) => {
                if (typeof value === 'number') {
                    this.applyParameterRamp(this.eq.mid, value, this.smoothTime);
                }
            }
        );

        const highSub = this.parameters['high'].subscribe(
            (value: number | boolean | string) => {
                if (typeof value === 'number') {
                    this.applyParameterRamp(this.eq.high, value, this.smoothTime);
                }
            }
        );

        const lowFreqSub = this.parameters['lowFrequency'].subscribe(
            (value: number | boolean | string) => {
                if (typeof value === 'number') {
                    // Frequency usually doesn't need ramp or can use it too
                    this.applyParameterRamp(this.eq.lowFrequency, value, this.smoothTime);
                }
            }
        );

        const highFreqSub = this.parameters['highFrequency'].subscribe(
            (value: number | boolean | string) => {
                if (typeof value === 'number') {
                    this.applyParameterRamp(this.eq.highFrequency, value, this.smoothTime);
                }
            }
        );

        this.addInternalSubscriptions([lowSub, midSub, highSub, lowFreqSub, highFreqSub]);
    }

    public dispose(): void {
        if (this.eq) {
            this.eq.dispose();
        }
        super.dispose();
    }
}
