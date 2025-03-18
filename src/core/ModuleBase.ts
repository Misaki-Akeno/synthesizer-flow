import { BehaviorSubject, Subscription } from 'rxjs';

// 允许接口的数据类型是 number 或 audio
export type ModuleInterface = number | Audio;

// 定义一个音频类型
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Audio = any;

// 模块抽象类
export abstract class ModuleBase {
    // 模块类型标识
    public readonly moduleType: string;
    public readonly id: string;
    public readonly name: string;

    // 模块参数，使用BehaviorSubject
    public parameters: { [key: string]: BehaviorSubject<number> };

    // 输入接口，使用BehaviorSubject
    public inputPorts: { [key: string]: BehaviorSubject<ModuleInterface> };

    // 输出接口，使用BehaviorSubject
    public outputPorts: { [key: string]: BehaviorSubject<ModuleInterface> };
    
    // 存储订阅关系以便取消订阅
    private subscriptions: { [key: string]: Subscription } = {};

    // 存储内部订阅关系
    private internalSubscriptions: Subscription[] = [];

    constructor(
        moduleType: string,
        id: string,
        name: string,
        parameters: { [key: string]: number } = {},
        inputPorts: { [key: string]: ModuleInterface } = {},
        outputPorts: { [key: string]: ModuleInterface } = {}
    ) {
        this.moduleType = moduleType;
        this.id = id;
        this.name = name;
        
        console.debug(`[ModuleBase] Creating module: ${id} (${moduleType})`);
        
        // 转换参数为BehaviorSubject
        this.parameters = {};
        for (const [key, value] of Object.entries(parameters)) {
            this.parameters[key] = new BehaviorSubject<number>(value);
        }
        
        // 转换输入端口为BehaviorSubject
        this.inputPorts = {};
        for (const [key, value] of Object.entries(inputPorts)) {
            this.inputPorts[key] = new BehaviorSubject<ModuleInterface>(value);
        }
        
        // 转换输出端口为BehaviorSubject
        this.outputPorts = {};
        for (const [key, value] of Object.entries(outputPorts)) {
            this.outputPorts[key] = new BehaviorSubject<ModuleInterface>(value);
        }
        
        // 设置内部绑定
        console.debug(`[ModuleBase] Setting up internal bindings for: ${id}`);
        this.setupInternalBindings();
    }
    
    /**
     * 设置模块内部订阅关系，子类必须重写此方法
     */
    protected setupInternalBindings(): void {
        console.debug(`[ModuleBase] Base setupInternalBindings called for ${this.id}`);
        // 子类应该重写此方法
    }
    
    /**
     * 绑定参数到输出端口
     * @param paramKey 参数名
     * @param outputPortName 输出端口名
     */
    protected bindParameterToOutput(paramKey: string, outputPortName: string): void {
        if (!this.parameters[paramKey]) {
            throw new Error(`Parameter '${paramKey}' not found on module ${this.id}`);
        }
        if (!this.outputPorts[outputPortName]) {
            throw new Error(`Output port '${outputPortName}' not found on module ${this.id}`);
        }
        
        const subscription = this.parameters[paramKey].subscribe(value => {
            this.outputPorts[outputPortName].next(value);
        });
        
        this.internalSubscriptions.push(subscription);
    }
    
    /**
     * 绑定输入端口到参数
     * @param inputPortName 输入端口名
     * @param paramKey 参数名
     */
    protected bindInputToParameter(inputPortName: string, paramKey: string): void {
        if (!this.inputPorts[inputPortName]) {
            throw new Error(`Input port '${inputPortName}' not found on module ${this.id}`);
        }
        if (!this.parameters[paramKey]) {
            throw new Error(`Parameter '${paramKey}' not found on module ${this.id}`);
        }
        
        const subscription = this.inputPorts[inputPortName].subscribe(value => {
            if (typeof value === 'number') {
                this.parameters[paramKey].next(value);
            }
        });
        
        this.internalSubscriptions.push(subscription);
    }
    
    /**
     * 绑定输入端口到输出端口，可以添加处理函数
     * @param inputPortName 输入端口名
     * @param outputPortName 输出端口名
     * @param processor 可选的处理函数
     */
    protected bindInputToOutputPort(
        inputPortName: string, 
        outputPortName: string, 
        processor?: (input: ModuleInterface) => ModuleInterface
    ): void {
        if (!this.inputPorts[inputPortName]) {
            throw new Error(`Input port '${inputPortName}' not found on module ${this.id}`);
        }
        if (!this.outputPorts[outputPortName]) {
            throw new Error(`Output port '${outputPortName}' not found on module ${this.id}`);
        }
        
        const subscription = this.inputPorts[inputPortName].subscribe(value => {
            if (processor) {
                this.outputPorts[outputPortName].next(processor(value));
            } else {
                this.outputPorts[outputPortName].next(value);
            }
        });
        
        this.internalSubscriptions.push(subscription);
    }
    
    /**
     * 获取参数当前值
     * @param paramKey 参数名
     */
    getParameterValue(paramKey: string): number {
        return this.parameters[paramKey].getValue();
    }
    
    /**
     * 更新参数值
     * @param paramKey 参数名
     * @param value 新值
     */
    updateParameter(paramKey: string, value: number): void {
        if (this.parameters[paramKey]) {
            this.parameters[paramKey].next(value);
        }
    }
    
    /**
     * 获取输入端口当前值
     * @param portName 端口名
     */
    getInputValue(portName: string): ModuleInterface {
        return this.inputPorts[portName].getValue();
    }
    
    /**
     * 获取输出端口当前值
     * @param portName 端口名
     */
    getOutputValue(portName: string): ModuleInterface {
        return this.outputPorts[portName].getValue();
    }
    
    /**
     * 更新输出端口值
     * @param portName 端口名
     * @param value 新值
     */
    protected setOutputValue(portName: string, value: ModuleInterface): void {
        if (this.outputPorts[portName]) {
            this.outputPorts[portName].next(value);
        }
    }
    
    /**
     * 绑定此模块的输入端口到另一个模块的输出端口
     * @param inputPortName 输入端口名
     * @param sourceModule 源模块
     * @param sourcePortName 源模块输出端口名
     */
    bindInputToOutput(inputPortName: string, sourceModule: ModuleBase, sourcePortName: string): void {
        // 检查端口是否存在
        if (!this.inputPorts[inputPortName]) {
            throw new Error(`Input port '${inputPortName}' not found on module ${this.id}`);
        }
        if (!sourceModule.outputPorts[sourcePortName]) {
            throw new Error(`Output port '${sourcePortName}' not found on module ${sourceModule.id}`);
        }
        
        // 如果已有订阅，先取消
        this.unbindInput(inputPortName);
        
        // 创建新的订阅
        const bindingKey = `input_${inputPortName}`;
        this.subscriptions[bindingKey] = sourceModule.outputPorts[sourcePortName].subscribe(value => {
            this.inputPorts[inputPortName].next(value);
        });
    }
    
    /**
     * 解除输入端口绑定
     * @param inputPortName 输入端口名
     */
    unbindInput(inputPortName: string): void {
        const bindingKey = `input_${inputPortName}`;
        if (this.subscriptions[bindingKey]) {
            this.subscriptions[bindingKey].unsubscribe();
            delete this.subscriptions[bindingKey];
        }
    }
    
    /**
     * 销毁此模块，清理所有订阅
     */
    destroy(): void {
        // 取消所有订阅
        Object.values(this.subscriptions).forEach(subscription => {
            subscription.unsubscribe();
        });
        this.subscriptions = {};
        
        // 取消内部订阅
        this.internalSubscriptions.forEach(subscription => {
            subscription.unsubscribe();
        });
        this.internalSubscriptions = [];
    }

    /**
     * 添加内部订阅到管理列表
     * @param subscription 要添加的订阅
     */
    protected addInternalSubscription(subscription: Subscription): void {
        this.internalSubscriptions.push(subscription);
    }
    
    /**
     * 添加多个内部订阅到管理列表
     * @param subscriptions 要添加的订阅列表
     */
    protected addInternalSubscriptions(subscriptions: Subscription[]): void {
        subscriptions.forEach(sub => this.internalSubscriptions.push(sub));
    }
}