import { ModuleBase, ModuleInterface } from '../ModuleBase';

/**
 * 基本输出模块，接收输入并根据level参数处理
 */
export class OutputModule extends ModuleBase {
    // 存储最近的输入值，用于在level改变时重新计算
    private lastInputValue: number = 0;

    constructor(id: string, name: string = '输出模块') {
        // 初始化基本参数，包含范围定义
        const moduleType = 'output';
        const parameters = { 
            level: { value: 0.5, min: 0, max: 1.0 } 
        };
        const inputPorts = { input: 0 as ModuleInterface };  // 输入接口
        const outputPorts = {};  // 输出模块没有输出接口
        
        super(moduleType, id, name, parameters, inputPorts, outputPorts);
    }
    
    /**
     * 设置模块内部绑定，处理输入信号
     */
    protected setupInternalBindings(): void {
        console.debug(`[OutputModule ${this.id}] Setting up internal bindings`);
        
        // 监听输入端口
        const inputSubscription = this.inputPorts.input.subscribe(inputValue => {
            if (typeof inputValue === 'number') {
                this.lastInputValue = inputValue;
                this.processInput(inputValue);
            }
        });
        this.addInternalSubscription(inputSubscription);
        
        // 监听level参数变化
        const levelSubscription = this.parameters.level.subscribe(_levelValue => {
            // 当level改变时，使用最近的输入值重新处理
            this.processInput(this.lastInputValue);
        });
        this.addInternalSubscription(levelSubscription);
    }
    
    /**
     * 处理输入信号
     */
    private processInput(inputValue: number): void {
        if (typeof inputValue !== 'number') return;
        
        const levelValue = this.getParameterValue('level');
        const _processedValue = inputValue * levelValue;
        
        // 在这里可以添加更多处理逻辑，例如播放音频等
    }
    
    /**
     * 重写更新参数方法，添加调试日志
     */
    updateParameter(paramKey: string, value: number): void {
        super.updateParameter(paramKey, value);
    }
}
