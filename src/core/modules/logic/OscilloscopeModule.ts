import { ModuleBase, ModuleMetadata, PortType } from '../../base/ModuleBase';

export class OscilloscopeModule extends ModuleBase {
    public static readonly metadata: ModuleMetadata = {
        type: 'oscilloscope',
        label: '示波器',
        description: '可视化显示NUMBER信号随时间的变化',
        category: '逻辑',
    };

    constructor(id: string) {
        super(OscilloscopeModule.metadata.type, id, OscilloscopeModule.metadata.label, {}, {
            input: { type: PortType.NUMBER, value: 0 },
        }, {});
    }

    protected setupInternalBindings(): void {
        // 示波器不需要内部绑定，主要是前端订阅输入
    }

    // 获取自定义 UI 配置
    public getCustomUI(): { type: string; props?: Record<string, unknown> } | undefined {
        return {
            type: 'oscilloscope',
            props: {
                moduleId: this.id, // 传递模块ID供前端订阅
            },
        };
    }
}
