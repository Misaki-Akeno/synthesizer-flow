# 功能设计

Synthesizer Flow 致力于构建模块化合成器。可以通过菜单来添加不同的音频模块，然后用接口相互连接，可以制造想要的任何声音。可以用虚拟midi键盘模块，连接到振荡器，再用调制器来控制振荡器波形，并把信号输出到调音台和扬声器模块，实现音乐生成！还可以用音序器来自动化播放音乐，通过时序器模块来控制拍子和歌曲进度，音序器根据时序来自动输出midi！

# 架构设计

## 技术栈

- **Next.js**：提供服务端渲染和静态站点生成能力。
- **ReactFlow**：实现模块化流程图的交互式界面。
- **Zustand**：轻量级状态管理。
- **Mitt**：事件总线实现。
- **Tone.js**：音频处理和合成引擎。
- **Shadcn/Tailwind**：高效的 UI 组件和样式管理。

## 系统分层结构

### 四层架构

纵向切分
用户界面层 │ React组件、ReactFlow视图、参数控件等
↓ (事件触发)
业务逻辑层 │ 服务、控制器、验证器等
↓ (状态更新)
领域模型层 │ 模块、参数、连接等领域对象
↓ (音频处理)
音频引擎层 │ Tone.js封装、音频节点管理
横向切分
│ 模块系统 │ 连接系统 │ 调制系统 │ 参数系统 │ 序列化系统│

# 核心领域模型

## 基础设计

系统采用高模块化设计，确保可扩展性。以下是核心领域模型的结构：

### 模块注册与元数据管理

模块注册表(ModuleRegistry)：系统初始化时加载所有模块定义，不再是单例而是作为领域服务
元数据索引：按类别、标签、功能建立多维索引，支持高效查询
延迟加载：模块实现代码按需加载，减少初始化开销

### 模块实例化流程

注册阶段：系统启动时扫描并加载所有模块元数据
实例化请求：用户添加模块 → 触发MODULE.INSTANTIATE_REQUESTED事件
实例创建：ModuleService创建模块实例并分配唯一ID
音频节点创建：延迟到实际需要时创建Tone.js音频节点
状态注册：模块实例状态注册到统一状态管理系统
可视化节点创建：创建ReactFlow节点表示

## 领域服务

- ModuleService：模块定义加载、实例创建和销毁
- ConnectionService：端口兼容性验证、连接创建和管理
- ParameterService：参数更新、验证和调制应用
- AudioEngineService：音频节点创建、连接和参数映射

# 事件总线设计

## 事件分类

### 事件分类与命名规范

请求事件：{DOMAIN}.{ACTION}\_REQUESTED (用户意图)
状态事件：STATE.{ENTITY}.{ACTION} (状态变化)
结果事件：{DOMAIN}.{ACTION}\_COMPLETED/FAILED (操作结果)


## 事件流程

UI.CONNECTION.REQUESTED
→ 验证连接有效性
→ STATE.CONNECTION.ADD
→ DOMAIN.CONNECTION.ESTABLISHED
→ AUDIO.CONNECTION.CREATED
→ UI.CONNECTION.COMPLETED

# 数据流程

## 数据流

用户交互->发布事件->业务逻辑处理->状态更新->领域模型更新->音频引擎更新->回到状态更新

## 参数更新流程

1. 用户调整参数滑块→debouncing → UI.PARAMETER.CHANGE_REQUESTED
2. 参数服务验证 → STATE.PARAMETER.UPDATE
3. 业务逻辑处理 → DOMAIN.PARAMETER.CHANGED
4. 领域模型更新 → AUDIO.PARAMETER.UPDATE
5. 音频引擎更新参数 → UI.PARAMETER.CHANGE_COMPLETED

# 模块系统

## 模块结构

每个模块包含：

- **元数据**：ID、名称、版本、分类、标签等
- **接口**：输入输出端口定义
- **参数**：可调节参数定义
- **预设**：预设配置集合
- **UI配置**：界面呈现相关配置

## 模块生命周期

1. 模块定义加载 → 注册到ModuleRegistry
2. 模块实例化 → 创建ModuleInstance
3. 参数初始化 → 应用默认值或预设
4. 音频节点创建 → 实例化Tone.js对象
5. 连接建立 → 与其他模块建立连接
6. 参数调节 → 处理用户输入和调制信号
7. 实例销毁 → 释放资源和断开连接

# 状态管理

## 状态分层

模块注册状态：所有可用模块定义(只读、全局)
模块实例状态：当前工作区中的模块实例及其参数
连接状态：音频连接、调制连接和其他类型连接
UI状态：ReactFlow节点位置、选择状态等(派生自核心状态)

### 状态更新流程

事件触发：用户操作触发事件
状态验证：业务服务层验证操作有效性
中央状态更新：更新Zustand存储的状态
派生更新：ReactFlow状态作为派生状态自动更新
副作用处理：音频引擎操作作为状态更新的副作用执行

# 连接机制

## 连接类型

- 音频连接：处理音频信号流
- 调制连接：控制信号调制目标参数
- MIDI连接：传递MIDI控制信号
- 触发连接：发送触发信号
- 时序连接：传递当前节拍数和速度等

## 连接流程

1. **连接请求**：UI层发起连接请求
2. **有效性验证**：验证数据类型兼容、循环引用等
3. **状态更新**：更新连接状态
4. **领域模型处理**：创建连接对象
5. **音频引擎连接**：执行Tone.js连接操作
6. **通知UI**：更新连接视觉显示

## 具体连接示例（振荡器→输出）

1. 用户在UI上从振荡器输出拖拽到输出模块输入
2. 发布CONNECTION.REQUESTED事件，带源和目标信息
3. ConnectionService验证连接有效性
4. 更新flowStore中的edges状态
5. 发布CONNECTION.CREATED事件
6. AudioConnectionService获取两个模块实例
7. 从振荡器ModuleInstance获取toneNode
8. 从输出ModuleInstance获取toneNode(Tone.Destination)
9. 执行toneNode.connect()操作
10. 注册连接到AudioConnectionRegistry
11. 发布AUDIO.CONNECTION.ESTABLISHED事件
12. UI更新显示活跃连接

# 参数系统优化

## 统一参数模型

参数对象：参数作为一等公民，具有类型、默认值、范围等属性
参数实例：每个模块实例拥有独立的参数实例
历史记录：参数变更历史支持撤销/重做

## 调制系统集成

调制源注册：调制源模块在ModulationRegistry中注册
调制目标注册：可调制参数在ParameterRegistry中注册
调制连接：调制源到参数的连接由专门的ModulationConnectionService管理
调制处理：调制计算在音频引擎层执行，结果应用到目标参数

# 连接系统优化

## 统一连接模型

连接类型层次：基础Connection抽象类，AudioConnection、ModulationConnection等子类
端口类型系统：强类型的端口定义，保证连接兼容性
连接约束：数据类型检查、循环依赖检测、多连接规则

## 连接生命周期优化

连接请求：用户拖拽创建连接请求
类型解析：ConnectionService识别连接类型(音频/调制/MIDI等)
有效性验证：验证连接兼容性
连接创建：创建相应类型的连接对象
委派处理：根据类型委派给专门服务(AudioConnectionService/ModulationService等)
音频引擎连接：执行实际的Tone.js连接
状态更新：更新连接状态
UI反馈：更新连接视觉表示

# 参数设计
## 连接类型
1. 音频连接 (Audio Signal)
用途: 音频流传输
特点: 采样率级别运算，通常为 44.1kHz 或 48kHz
应用: 振荡器输出、滤波器链、效果处理链
2. 数字连接 (Control Signal / Number)
用途: 参数控制、调制、自动化
特点: 通常为低频率信号，但在 Tone.js 中依然以音频采样率处理
应用场景:
LFO 调制
参数自动化曲线
MIDI 音符/力度值 (0-127 的数字)
包络输出 (ADSR)
调制轮、弯音轮数据
3. 触发/布尔连接 (Trigger/Boolean)
用途: 触发事件、开关状态
特点: 表示二进制状态或瞬时触发
应用场景:
序列器触发信号
按键按下/释放状态
门限信号 (Gate)
触发包络的信号


# 合成器流模块设计

## 模块模板结构设计

### 基本结构

每个模块采用JSON格式定义，包含以下核心部分：

```json
{
  "metadata": {
    /* 模块基本信息 */
  },
  "interfaces": {
    /* 模块连接点定义 */
  },
  "parameters": {
    /* 可调节参数 */
  },
  "presets": [
    /* 预设配置 */
  ],
  "ui": {
    /* UI相关配置 */
  }
}
```

### 详细字段说明

#### 元数据 (metadata)

```json
"metadata": {
  "id": "oscillator-basic",       // 唯一标识符，用于系统内部引用
  "name": "Basic Oscillator",     // 显示名称
  "version": "1.2.0",             // 语义化版本号
  "category": "GENERATOR",        // 主分类
  "tags": ["oscillator", "audio generator"], // 搜索和分类标签
  "description": "基础波形发生器，支持多种波形类型", // 详细描述
  "author": "SynthTeam",          // 作者信息
  "created": "2025-02-01",        // 创建日期
  "updated": "2025-03-05"         // 最后更新日期
}
```

#### 接口 (interfaces)

```json
"interfaces": {
  "inputs": [
    {
      "id": "freq_mod",          // 接口唯一ID
      "label": "频率调制",        // 显示名称
      "dataType": "CONTROL",     // 数据类型：CONTROL/AUDIO/MIDI
      "controlTarget": "frequency", // 控制目标参数（仅CONTROL类型有效）
      "multiConnection": false,   // 是否支持多连接
      "optional": true,          // 是否可选接口
      "description": "频率调制输入，接受-1到1的控制信号" // 详细描述
    },
    {
      "id": "sync",
      "label": "同步",
      "dataType": "TRIGGER",
      "description": "重置振荡器相位"
    }
  ],
  "outputs": [
    {
      "id": "main_out",
      "label": "主输出",
      "dataType": "AUDIO",
      "description": "振荡器音频输出"
    }
  ]
}
```

#### 参数 (parameters)

```json
"parameters": {
  "frequency": {
    "type": "NUMBER",           // 参数类型
    "default": 440,             // 默认值
    "min": 20,                  // 最小值
    "max": 20000,               // 最大值
    "step": 0.01,               // 步进值
    "unit": "Hz",               // 单位
    "label": "频率",            // 显示名称
    "description": "振荡器的基础频率", // 描述
    "modulatable": true         // 是否可被调制
  },
  "waveform": {
    "type": "ENUM",
    "default": "sine",
    "options": ["sine", "square", "triangle", "sawtooth", "noise"],
    "label": "波形",
    "description": "振荡器波形类型"
  },
  "detune": {
    "type": "NUMBER",
    "default": 0,
    "min": -1200,
    "max": 1200,
    "step": 0.01,
    "unit": "cents",
    "label": "微调",
    "modulatable": true,
    "visible": true              // 是否在UI中可见
  },
  "pulseWidth": {
    "type": "NUMBER",
    "default": 0.5,
    "min": 0.01,
    "max": 0.99,
    "step": 0.01,
    "label": "脉冲宽度",
    "description": "方波的脉冲宽度",
    "modulatable": true,
    "visibleWhen": {            // 条件可见性
      "parameter": "waveform",
      "equals": "square"
    }
  }
}
```

#### 预设 (presets)

```json
"presets": [
  {
    "id": "a440",                   // 预设唯一ID
    "name": "标准A音",              // 显示名称
    "author": "SynthTeam",          // 创建者
    "description": "标准音高A的设置", // 描述
    "values": {
      "frequency": 440,
      "waveform": "sine",
      "detune": 0
    },
    "tags": ["standard", "tuning"]  // 预设标签
  },
  {
    "id": "fm-bass",
    "name": "FM低音",
    "author": "BassDesigner",
    "description": "适合FM合成的低频设置",
    "values": {
      "frequency": 55,
      "waveform": "triangle",
      "detune": -5
    },
    "tags": ["bass", "fm"]
  }
]
```

#### UI配置 (ui)

```json
"ui": {
  "color": "#3498db",           // 模块颜色
  "icon": "wave-sine",          // 模块图标
  "width": 180,                 // 默认宽度
  "height": "auto",             // 默认高度
  "customView": "oscilloscope", // 自定义视图组件(可选)
  "category": "generators",     // UI分类
  "helpUrl": "/docs/oscillator" // 帮助文档链接
}
```

### 数据类型定义

#### 分类枚举 (Category)

```javascript
enum Category {
  GENERATOR,    // 信号生成器
  EFFECT,       // 效果处理
  FILTER,       // 滤波器
  MODULATOR,    // 调制器
  UTILITY,      // 工具类
  MIDI,         // MIDI处理
  ANALYZER,     // 分析工具
  CUSTOM        // 自定义类型
}
```

#### 数据类型枚举 (DataType)

```javascript
enum DataType {
  AUDIO,        // 音频信号
  CONTROL,      // 控制信号(-1到1)
  TRIGGER,      // 触发信号
  MIDI,         // MIDI数据
  CLOCK,        // 时钟信号
  CUSTOM        // 自定义类型
}
```

#### 参数类型枚举 (ParameterType)

```javascript
enum ParameterType {
  NUMBER,       // 数字
  INTEGER,      // 整数
  BOOLEAN,      // 布尔值
  ENUM,         // 枚举选项
  STRING,       // 字符串
  ARRAY,        // 数组
  OBJECT,       // 对象
  COLOR         // 颜色
}
```

### 最佳实践

- 模块命名：使用描述性名称，遵循类别-功能格式，如filter-lowpass
- 接口设计：
  输入输出接口命名要清晰描述其功能
  为每个接口提供详细描述
  明确标注可选接口
  参数设计：

- 提供合理的默认值和范围
  使用条件可见性减少UI复杂度
  为数值参数提供适当的步进值和单位
  预设设计：

- 提供至少一个"默认"预设
  预设应覆盖模块的典型使用场景
  为预设添加有意义的标签，便于搜索
  版本控制：

- 遵循语义化版本规范(SemVer)
  在更新模块时提供变更日志

### 示例模块

基础振荡器模块完整示例

```json
{
  "metadata": {
    "id": "oscillator-basic",
    "name": "基础振荡器",
    "version": "1.0.0",
    "category": "GENERATOR",
    "tags": ["oscillator", "generator", "audio"],
    "description": "产生基本波形的振荡器模块",
    "author": "SynthTeam"
  },
  "interfaces": {
    "inputs": [
      {
        "id": "freq_mod",
        "label": "频率调制",
        "dataType": "CONTROL",
        "controlTarget": "frequency",
        "multiConnection": false,
        "description": "频率调制输入"
      },
      {
        "id": "amp_mod",
        "label": "振幅调制",
        "dataType": "CONTROL",
        "controlTarget": "amplitude",
        "multiConnection": false,
        "description": "振幅调制输入"
      }
    ],
    "outputs": [
      {
        "id": "audio_out",
        "label": "音频输出",
        "dataType": "AUDIO",
        "description": "振荡器的音频信号输出"
      }
    ]
  },
  "parameters": {
    "frequency": {
      "type": "NUMBER",
      "default": 440,
      "min": 20,
      "max": 20000,
      "step": 0.01,
      "unit": "Hz",
      "label": "频率",
      "description": "振荡器的基础频率",
      "modulatable": true
    },
    "waveform": {
      "type": "ENUM",
      "default": "sine",
      "options": ["sine", "square", "triangle", "sawtooth"],
      "label": "波形",
      "description": "振荡器波形类型"
    },
    "amplitude": {
      "type": "NUMBER",
      "default": 0.8,
      "min": 0,
      "max": 1,
      "step": 0.01,
      "label": "音量",
      "description": "振荡器输出音量",
      "modulatable": true
    }
  },
  "presets": [
    {
      "id": "default",
      "name": "默认设置",
      "author": "System",
      "description": "默认振荡器设置",
      "values": {
        "frequency": 440,
        "waveform": "sine",
        "amplitude": 0.8
      }
    },
    {
      "id": "bass_tone",
      "name": "低音音色",
      "author": "BassDesigner",
      "description": "适合低音部分的设置",
      "values": {
        "frequency": 110,
        "waveform": "triangle",
        "amplitude": 0.9
      },
      "tags": ["bass", "low"]
    }
  ],
  "ui": {
    "color": "#e74c3c",
    "icon": "wave-sine",
    "width": 220,
    "height": "auto"
  }
}
```
