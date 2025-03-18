import { ModuleBase, ModuleInterface } from '../ModuleBase';

/**
 * 基本输入模块，生成信号并根据gain参数调整输出
 */
export class InputModule extends ModuleBase {
    constructor(id: string, name: string = '输入模块') {
        // 初始化基本参数
        const moduleType = 'input';
        const parameters = { gain: 1.0 };  // 增益参数，默认值1.0
        const inputPorts = {};  // 输入模块没有输入接口
        const outputPorts = { output: 0 as ModuleInterface };  // 输出接口
        
        super(moduleType, id, name, parameters, inputPorts, outputPorts);
    }
    
    /**
     * 设置模块内部参数与输出之间的订阅关系
     */
    protected setupInternalSubscriptions(): void {
        // 将gain参数与output输出连接起来
        this.parameters.gain.subscribe(value => {
            this.outputPorts.output.next(value);
        });
    }
}
