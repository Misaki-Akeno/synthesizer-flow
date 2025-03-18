import { ModuleBase, ModuleInterface } from '../ModuleBase';

/**
 * 基本输出模块，接收输入并根据level参数处理
 */
export class OutputModule extends ModuleBase {
    constructor(id: string, name: string = '输出模块') {
        // 初始化基本参数
        const moduleType = 'output';
        const parameters = { level: 0.5 };  // 输出级别参数，默认值0.5
        const inputPorts = { input: 0 as ModuleInterface };  // 输入接口
        const outputPorts = {};  // 输出模块没有输出接口
        
        super(moduleType, id, name, parameters, inputPorts, outputPorts);
    }
    
    /**
     * 设置模块内部订阅，处理输入信号
     */
    protected setupInternalSubscriptions(): void {
        // 当输入或level参数改变时，处理信号
        this.inputPorts.input.subscribe(inputValue => {
            if (typeof inputValue === 'number') {
                const levelValue = this.getParameterValue('level');
                const processedValue = inputValue * levelValue;
                console.log(`Output module ${this.id} processed: ${processedValue}`);
                
                // 在这里可以添加更多处理逻辑，例如播放音频等
            }
        });
        
        // 另一种实现方式：使用RxJS操作符结合输入和参数
        /* 
        this.inputPorts.input.pipe(
            withLatestFrom(this.parameters.level),
            map(([input, level]) => {
                if (typeof input === 'number') {
                    return input * level;
                }
                return input;
            })
        ).subscribe(processedValue => {
            console.log(`Output module ${this.id} processed: ${processedValue}`);
        });
        */
    }
}
