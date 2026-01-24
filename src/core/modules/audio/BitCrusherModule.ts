/* eslint-disable @typescript-eslint/no-explicit-any */
import { AudioInputHandler } from '@/core/audio/AudioInputHandler';
import { AudioModuleBase } from '@/core/base/AudioModuleBase';
import {
    ModuleMetadata,
    ParameterType,
    PortType,
} from '@/core/base/ModuleBase';

/**
 * 降采样/位深破碎效果器模块
 */
export class BitCrusherModule extends AudioModuleBase {
    public static metadata: ModuleMetadata = {
        type: 'bitcrusher',
        label: '复古破碎',
        description: '降低音频采样率和位深，制造复古数字失真效果',
        category: '效果',
        iconType: 'Zap',
    };

    private bitCrusher: any;

    constructor(id: string, name: string = '复古破碎') {
        const moduleType = 'bitcrusher';
        const parameters = {
            bits: {
                type: ParameterType.NUMBER,
                value: 4,
                min: 1.8,
                max: 5,
                step: 0.1, // Allow fractional bits for smoother transitions if Tone supports it, otherwise integer is fine
                uiOptions: {
                    group: '主要参数',
                    label: '位数 (Bits)',
                    describe: '位深度，值越小破碎感越强',
                },
            },
            wet: {
                type: ParameterType.NUMBER,
                value: 1.0,
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

        // Add XY Pad for fun
        this.setCustomUI('XYPad', {
            xParam: {
                paramKey: 'bits',
                label: 'Bits',
                min: 1, // X left = 1 bit (crushed)
                max: 8, // X right = 8 bits (cleaner)
                // Wait, normally we want left to be "low effect" (clean) and right "high effect" (crushed)?
                // For bits, lower is more effect. So maybe max on left?
                // Let's stick to numerical min-max. x=0 -> bits=1.
            },
            yParam: {
                paramKey: 'wet',
                label: 'Wet',
                min: 0,
                max: 1,
            },
            width: 180,
            height: 120,
        });
    }

    protected async initializeAudio(): Promise<void> {
        this.bitCrusher = new this.Tone.BitCrusher({
            bits: this.getParameterValue('bits'),
            wet: this.getParameterValue('wet'),
        });

        this.audioInputHandler = new AudioInputHandler(this.bitCrusher, this.Tone);
        this.updateOutputConnection();
        this.setupBindings();
    }

    private updateOutputConnection(): void {
        if (!this.audioInputHandler || !this.bitCrusher) return;

        if (!this.isEnabled()) {
            this.outputPorts['output'].next(this.audioInputHandler.getMixerOutput());
        } else {
            this.outputPorts['output'].next(this.bitCrusher);
        }
    }

    protected onEnabledStateChanged(_enabled: boolean): void {
        this.updateOutputConnection();
    }

    private setupBindings(): void {
        if (!this.bitCrusher) return;

        const bitsSub = this.parameters['bits'].subscribe(
            (value: number | boolean | string) => {
                if (typeof value === 'number') {
                    this.applyParameterRamp(this.bitCrusher.bits, value, this.smoothTime);
                }
            }
        );

        const wetSub = this.parameters['wet'].subscribe(
            (value: number | boolean | string) => {
                if (typeof value === 'number') {
                    this.applyParameterRamp(this.bitCrusher.wet, value, this.smoothTime);
                }
            }
        );

        this.addInternalSubscriptions([bitsSub, wetSub]);
    }

    public dispose(): void {
        if (this.bitCrusher) {
            this.bitCrusher.dispose();
        }
        super.dispose();
    }
}
