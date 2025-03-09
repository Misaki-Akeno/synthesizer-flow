# 合成器流模块设计

## 模块结构设计

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

## 最佳实践

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

## 示例模块

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
