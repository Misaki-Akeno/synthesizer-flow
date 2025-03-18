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
        const outputInterfaces = {};  // 输出模块没有输出接口
        
        super(moduleType, id, name, parameters, inputPorts, outputInterfaces);
    }
    
    // 这里可以添加处理输入信号的方法
    // processSignal() { ... }
}
