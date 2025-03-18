/* eslint-disable @typescript-eslint/no-explicit-any */
import { ModuleBase, ModuleInterface, ParameterType, PortType } from '../ModuleBase';

/**
 * 基本输出模块，接收输入并根据level参数处理
 */
export class OutputModule extends ModuleBase {
    // 存储最近的输入值，用于在level改变时重新计算
    private lastInputValue: number = 0;
    private lastAudioInput: any = null;
    private gain: any = null;
    private Tone: any;

    constructor(id: string, name: string = '输出模块') {
        // 初始化基本参数，使用新的参数定义格式
        const moduleType = 'output';
        const parameters = { 
            level: { 
                type: ParameterType.NUMBER, 
                value: -12, 
                min: -60, 
                max: 0 
            },
            enabled: {
                type: ParameterType.BOOLEAN,
                value: false
            }
        };
        
        // 使用新的端口定义格式
        const inputPorts = { 
            input: { 
                type: PortType.NUMBER, 
                value: 0 
            },
            audioIn: {
                type: PortType.AUDIO,
                value: null
            }
        };
        
        const outputPorts = {}; // 输出模块没有输出接口
        
        super(moduleType, id, name, parameters, inputPorts, outputPorts);

        // 初始化音频处理
        if (typeof window !== 'undefined') {
            this.initializeAudio();
        }
    }
    
    /**
     * 初始化音频处理组件
     */
    private async initializeAudio(): Promise<void> {
        try {
            const ToneModule = await import('tone');
            this.Tone = ToneModule;
            
            // 创建增益节点用于音量控制，将dB值转换为线性值
            const levelDB = this.getParameterValue('level') as number;
            const gainValue = this.dbToLinear(levelDB);
            this.gain = new this.Tone.Gain(gainValue).toDestination();
            
            // 设置启用状态
            if (!(this.getParameterValue('enabled') as boolean)) {
                this.gain.gain.value = 0;
            }
        } catch (error) {
            console.error('Failed to initialize Tone.js:', error);
        }
    }
    
    /**
     * 启动音频上下文
     */
    private startAudioContext(): void {
        if (this.Tone && this.Tone.context.state !== "running") {
            try {
                this.Tone.start();
                console.debug(`[OutputModule ${this.id}] Audio context started`);
            } catch (error) {
                console.warn(`[OutputModule ${this.id}] Error starting audio context:`, error);
            }
        }
    }
    
    /**
     * 将分贝值转换为线性增益值
     */
    private dbToLinear(dbValue: number): number {
        return Math.pow(10, dbValue / 20);
    }
    
    /**
     * 设置模块内部绑定，处理输入信号
     */
    protected setupInternalBindings(): void {
        console.debug(`[OutputModule ${this.id}] Setting up internal bindings`);
        
        // 监听数字输入端口
        const inputSubscription = this.inputPorts.input.subscribe((inputValue: ModuleInterface) => {
            if (typeof inputValue === 'number') {
                this.lastInputValue = inputValue;
                this.processInput(inputValue);
            }
        });
        this.addInternalSubscription(inputSubscription);
        
        // 监听音频输入端口
        const audioSubscription = this.inputPorts.audioIn.subscribe((audioInput: ModuleInterface) => {
            // 先断开上一个音频连接
            if (this.lastAudioInput) {
                try {
                    this.lastAudioInput.disconnect(this.gain);
                    console.debug(`[OutputModule ${this.id}] Disconnected previous audio input`);
                } catch (error) {
                    console.warn(`[OutputModule ${this.id}] Error disconnecting previous audio:`, error);
                }
            }
            
            // 如果有新的音频输入，则进行连接
            if (audioInput) {
                this.processAudioInput(audioInput);
                this.lastAudioInput = audioInput;
                console.debug(`[OutputModule ${this.id}] Connected new audio input`);
            } else {
                // 如果输入为null，清空lastAudioInput
                this.lastAudioInput = null;
                console.debug(`[OutputModule ${this.id}] Audio input removed`);
            }
        });
        this.addInternalSubscription(audioSubscription);
        
        // 监听level参数变化
        const levelSubscription = this.parameters.level.subscribe((levelValue: number | boolean | string) => {
            if (typeof levelValue === 'number') {
                // 更新音频增益，将dB值转换为线性值
                if (this.gain) {
                    const gainValue = this.getParameterValue('enabled') ? this.dbToLinear(levelValue) : 0;
                    this.gain.gain.value = gainValue;
                }
                
                // 重新处理数值输入
                this.processInput(this.lastInputValue);
            }
        });
        this.addInternalSubscription(levelSubscription);
        
        // 监听enabled参数变化
        const enabledSubscription = this.parameters.enabled.subscribe((enabledValue: number | boolean | string) => {
            if (typeof enabledValue === 'boolean' && this.gain) {
                if (enabledValue) {
                    // 当启用时，尝试启动音频上下文
                    this.startAudioContext();
                    
                    // 恢复音量
                    const levelDB = this.getParameterValue('level') as number;
                    this.gain.gain.value = this.dbToLinear(levelDB);
                } else {
                    // 当禁用时，将音量设置为0
                    this.gain.gain.value = 0;
                }
            }
        });
        this.addInternalSubscription(enabledSubscription);
    }
    
    /**
     * 处理数值输入信号
     */
    private processInput(inputValue: number): void {
        if (typeof inputValue !== 'number') return;
        
        const levelDB = this.getParameterValue('level') as number;
        const gainValue = this.dbToLinear(levelDB);
        const isEnabled = this.getParameterValue('enabled') as boolean;
        const processedValue = isEnabled ? inputValue * gainValue : 0;
        
        if (this.gain) {
            this.gain.gain.value = processedValue;
        }
    }
    
    /**
     * 处理音频输入信号
     */
    private processAudioInput(audioInput: any): void {
        if (!audioInput || !this.gain) return;
        
        try {
            // 检查是否已经连接到此gain节点，避免重复连接
            audioInput.connect(this.gain);
            
            // 如果有音频输入并且已启用，尝试启动音频上下文
            if (this.getParameterValue('enabled') as boolean) {
                this.startAudioContext();
            }
            
            console.debug(`[OutputModule ${this.id}] Connected audio input to gain node`);
        } catch (error) {
            console.error(`[OutputModule ${this.id}] Error connecting audio:`, error);
        }
    }
    
    /**
     * 释放资源
     */
    public dispose(): void {
        if (this.gain) {
            try {
                this.gain.dispose();
            } catch (error) {
                console.warn('Error disposing gain node', error);
            }
        }
        
        // 断开音频连接
        if (this.lastAudioInput) {
            try {
                this.lastAudioInput.disconnect();
            } catch (error) {
                console.warn('Error disconnecting audio input', error);
            }
        }
        
        super.dispose();
    }
}
