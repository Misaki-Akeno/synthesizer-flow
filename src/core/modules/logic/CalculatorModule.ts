import { ModuleBase, ModuleMetadata, ParameterType, PortType } from '@/core/base/ModuleBase';

/**
 * 计算器模块，对两个输入进行算术运算
 */
export class CalculatorModule extends ModuleBase {
    public static metadata: ModuleMetadata = {
        type: 'calculator',
        label: '计算器',
        description: '对两个输入信号进行加减乘除运算',
        category: '逻辑',
        iconType: 'Calculator', // Assuming 'Calculator' icon exists or will default to something generic
    };

    constructor(id: string, name: string = '计算器') {
        const moduleType = 'calculator';
        const parameters = {
            operation: {
                type: ParameterType.LIST,
                value: '+',
                options: ['+', '-', '*', '/'],
                uiOptions: {
                    label: '运算符',
                    describe: '选择要执行的算术运算',
                },
            },
            status: {
                type: ParameterType.STRING,
                value: 'Ready',
                uiOptions: {
                    label: '状态',
                    describe: '显示当前运算状态或错误信息',
                    readonly: true, // Custom property, might need frontend support or is just informational
                },
            },
        };

        const inputPorts = {
            a: {
                type: PortType.NUMBER,
                value: 0,
            },
            b: {
                type: PortType.NUMBER,
                value: 0,
            },
        };

        const outputPorts = {
            output: {
                type: PortType.NUMBER,
                value: 0,
            },
        };

        super(moduleType, id, name, parameters, inputPorts, outputPorts);
    }

    protected setupInternalBindings(): void {
        // 监听输入端口和操作符的变化
        // 我们需要聚合 a, b, 和 operation 的变化来计算输出

        const updateOutput = () => {
            const a = this.getInputValue('a') as number;
            const b = this.getInputValue('b') as number;
            const op = this.getParameterValue('operation') as string;
            let result = 0;
            let status = 'OK';

            try {
                switch (op) {
                    case '+':
                        result = a + b;
                        break;
                    case '-':
                        result = a - b;
                        break;
                    case '*':
                        result = a * b;
                        break;
                    case '/':
                        if (b === 0) {
                            status = 'Error: Div by 0';
                            // 保持上一次的有效值或者设为0？通常设为0或最大值。
                            // 这里设为 0 并报错
                            result = 0;
                        } else {
                            result = a / b;
                        }
                        break;
                    default:
                        result = a + b;
                }
            } catch (e) {
                status = 'Error';
                console.error(e);
            }

            this.updateParameter('status', status);
            this.setOutputValue('output', result);
        };

        // 订阅输入端口变化
        const subA = this.inputPorts['a'].subscribe(updateOutput);
        const subB = this.inputPorts['b'].subscribe(updateOutput);

        // 订阅参数变化 (Operation)
        const subOp = this.parameters['operation'].subscribe(updateOutput);

        this.addInternalSubscriptions([subA, subB, subOp]);
    }
}
