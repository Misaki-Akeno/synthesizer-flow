import { ModuleBase, ModuleInterface } from '../ModuleBase';

/**
 * 基本输入模块，生成信号并根据gain参数调整输出
 */
export class InputModule extends ModuleBase {
    constructor(id: string, name: string = '输入模块') {
        // 初始化基本参数，包含范围定义
        const moduleType = 'input';
        const parameters = { 
            gain: { value: 1.0, min: 0, max: 2.0 },
            freq: { value: 1.0, min: 0.1, max: 10.0 }
        };  
        const inputPorts = {};  // 输入模块没有输入接口
        const outputPorts = { output: 0 as ModuleInterface };  // 输出接口
        
        super(moduleType, id, name, parameters, inputPorts, outputPorts);
    }
    
    /**
     * 设置模块内部参数与输出之间的绑定关系
     */
    protected setupInternalBindings(): void {
        // 将gain参数直接绑定到output输出
        this.bindParameterToOutput('gain', 'output');
    }
}
