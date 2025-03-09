export enum Category {
  GENERATOR, // 信号生成器
  EFFECT, // 效果处理
  FILTER, // 滤波器
  MODULATOR, // 调制器
  UTILITY, // 工具类
  MIDI, // MIDI处理
  ANALYZER, // 分析工具
  CUSTOM, // 自定义类型
}

export enum DataType {
  AUDIO, // 音频信号
  CONTROL, // 控制信号(-1到1)
  TRIGGER, // 触发信号
  MIDI, // MIDI数据
  CLOCK, // 时钟信号
  CUSTOM, // 自定义类型
}

export enum ParameterType {
  NUMBER, // 数字
  INTEGER, // 整数
  BOOLEAN, // 布尔值
  ENUM, // 枚举选项
  STRING, // 字符串
  ARRAY, // 数组
  OBJECT, // 对象
  COLOR, // 颜色
}
