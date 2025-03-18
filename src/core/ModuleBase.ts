// 定义一个音频类型，这里假设使用 Tone.js 的音频类，为了简单起见可以用 any 替代，也可以换成具体类型
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Audio = any;

// 允许接口的数据类型是 number 或 audio
export type ModuleInterface = number | Audio;

// 模块抽象类
export abstract class ModuleBase {
    // 模块类型标识
    public readonly moduleType: string;

    public readonly id: string;

    public readonly name: string;

    // 模块参数，只支持 number 类型
    public parameters: { [key: string]: number };

    // 输入接口，支持 number 或 audio
    public inputPorts: { [key: string]: ModuleInterface };

    // 输出接口，支持 number 或 audio
    public outputPorts: { [key: string]: ModuleInterface };

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
        this.parameters = parameters;
        this.inputPorts = inputPorts;
        this.outputPorts = outputPorts;
    }
}