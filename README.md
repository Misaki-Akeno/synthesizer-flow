# Synthesizer Flow

致力于构建模块化合成器


## 目录架构
```
/components
├── ui/                  # 基础 UI 组件 (基于 Shadcn)
│   ├── button.tsx
│   ├── slider.tsx
│   ├── dropdown.tsx
│   └── ...
├── workbench/           # 工作区组件
│   ├── Canvas.tsx       # 主画布组件
│   ├── Toolbar.tsx      # 工具栏
│   ├── ModulePanel.tsx  # 模块面板
│   ├── StatusBar.tsx    # 状态栏
│   └── ...
├── modules/             # 模块 UI 组件
│   ├── ModuleNode.tsx   # 基础模块节点
│   ├── ConnectionLine.tsx  # 连接线组件
│   ├── PortHandle.tsx   # 端口组件
/core
├── audio/               # 音频引擎层
│   ├── AudioEngine.ts   # 音频引擎主类
│   ├── ToneNodeFactory.ts # Tone.js 节点工厂
│   ├── AudioConnectionManager.ts # 音频连接管理
│   ├── ModulationProcessor.ts # 调制信号处理
│   └── AudioRegistry.ts # 音频节点注册表
├── domain/              # 领域模型层
│   ├── Module.ts        # 模块基类
│   ├── ModuleInstance.ts # 模块实例类
│   ├── Connection.ts    # 连接基类
│   ├── AudioConnection.ts # 音频连接
│   ├── ModulationConnection.ts # 调制连接
│   ├── Parameter.ts     # 参数基类
│   ├── ParameterInstance.ts # 参数实例
│   └── Port.ts          # 端口类
├── services/            # 业务逻辑层
│   ├── FlowService.ts   # 负责转换数据格式成reactflow
│   ├── ModuleService.ts # 模块管理服务
│   ├── ConnectionService.ts # 连接管理服务
│   ├── ParameterService.ts # 参数管理服务
│   ├── ModulationService.ts # 调制管理服务
│   ├── PresetService.ts # 预设管理服务
│   └── SerializationService.ts # 序列化服务
├── events/              # 事件系统
│   ├── EventBus.ts      # 事件总线
│   ├── EventTypes.ts    # 事件类型定义
│   ├── EventHandlers.ts # 事件处理器
│   └── EventLogger.ts   # 事件日志
└── store/               # 状态管理
    ├── useModulesStore.ts # 模块状态存储，全部存储在这里
/lib
├── utils/               # 通用工具函数
│   ├── id.ts            # ID 生成器
│   ├── throttle.ts      # 节流函数
│   ├── debounce.ts      # 防抖函数
│   ├── validation.ts    # 验证函数
│   └── ...
├── hooks/               # React 自定义 hooks
│   ├── useAudioNode.ts  # 音频节点 hook
│   ├── useModuleLifecycle.ts # 模块生命周期 hook
│   ├── useParameter.ts  # 参数管理 hook
│   └── ...
└── constants/           # 常量定义
    ├── ModuleTypes.ts     # 节点类型
    ├── dataTypes.ts     # 数据类型
    ├── parameterTypes.ts # 参数类型
    └── ...
/modules
├── generators/          # 信号生成器
│   ├── oscillator-basic.ts  # 基础振荡器
│   ├── noise-generator.ts  # 噪声生成器
│   └── ...
├── effects/             # 效果处理器
│   ├── reverb.ts        # 混响效果
│   ├── delay.ts         # 延迟效果
│   └── ...
├── filters/             # 滤波器
│   ├── lowpass.ts       # 低通滤波器
│   └── ...
├── modulators/          # 调制器
│   ├── lfo.ts           # 低频振荡器
│   ├── envelope.ts      # 包络生成器
│   └── ...
├── midi/                # MIDI 模块
│   ├── keyboard.ts      # 虚拟键盘
│   ├── sequencer.ts     # 音序器
│   └── ...
└── utility/             # 工具模块
    ├── mixer.ts         # 混音器
    ├── output.ts        # 输出模块
    └── ...

/types
├── module.d.ts          # 模块类型
├── connection.d.ts      # 连接类型
├── parameter.d.ts       # 参数类型
├── event.d.ts           # 事件类型
├── audio.d.ts           # 音频类型
└── flow.d.ts            # ReactFlow 类型扩展

```
## TODO:

### 短期目标

- 设计引入事件总线，减少组件和服务间的直接依赖。
- 优化状态存储系统，使得工作区内的所有状态都被统一管理。特别是参数，我觉得模块的创建使用等操作需要更加oop
- 优化数据流：User Input → Store Action → State Update → UI Render → Audio Engine Update
- 提供基础声音支持

### 长期目标

- 添加持久化
- 添加可视化模块
- 模块的调制UI改进，存储格式改进，所有参数都应该可以被调制以实现自动化
- 提供时序端口，可以控制节拍，节拍可以控制音序器或者piano roll，并自动输出midi信号，也可以控制自动化模块，提供调制
