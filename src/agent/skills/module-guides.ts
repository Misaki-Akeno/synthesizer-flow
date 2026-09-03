interface ModuleGuideContent {
  useWhen: string[];
  setup: string[];
  cautions: string[];
  tags: string[];
}

/**
 * 模块 Skill 的人工经验层。参数和端口由真实模块实现动态提取，
 * 这里只保留不能从类型系统直接推导的声音设计建议。
 */
export const MODULE_GUIDES: Record<string, ModuleGuideContent> = {
  simpleoscillator: {
    useWhen: ['需要固定音高的基础音源', '搭建减法合成或调制实验'],
    setup: [
      '先选择波形，再设置基频与音量',
      '需要动态音高时，将 NUMBER 信号连接到 frequencyMod 输入',
      '将 audioout 接入效果器或 speaker',
    ],
    cautions: ['它不是 MIDI 音源；演奏型场景优先使用高级振荡器或小号'],
    tags: ['oscillator', 'source', 'subtractive', 'audio'],
  },
  advancedoscillator: {
    useWhen: ['需要复音 MIDI/MPE 演奏', '需要包络、力度和逐音符表达'],
    setup: [
      '将 MIDI 输入或 MIDI Clip 的 midi 端口连接到本模块',
      '先设置 waveform、voiceCount 与 ADSR，再微调表现力参数',
      '将 audioout 接入效果链或 speaker',
    ],
    cautions: ['MIDI 与旧版 notes/velocities 端口不要重复连接同一数据源'],
    tags: ['oscillator', 'polyphonic', 'midi', 'mpe', 'source'],
  },
  lfo: {
    useWhen: ['需要周期性控制参数', '制作颤音、震音或缓慢自动化'],
    setup: [
      '设置低频 rate、depth 和 waveform',
      '将 NUMBER 输出连接到支持 NUMBER 调制的输入端口',
    ],
    cautions: ['LFO 输出不是音频，不能直接连接 AUDIO 端口'],
    tags: ['modulation', 'lfo', 'number'],
  },
  midiinput: {
    useWhen: ['接入外部 MIDI 键盘', '使用 MPE 控制器进行逐音符表达'],
    setup: [
      '选择输入设备和监听通道',
      '普通键盘使用 standard；MPE 控制器使用 mpe 并检查成员通道范围',
      '优先将 midi 端口连接到支持 MIDI 的音源',
      '延音踏板使用 CC64；参数 MIDI Learn 会监听下一条 CC 消息',
    ],
    cautions: ['浏览器需要用户授权 MIDI 设备；服务端 Agent 无法代替用户授权'],
    tags: ['input', 'midi', 'mpe', 'performance'],
  },
  keyboardinput: {
    useWhen: ['没有外部 MIDI 设备时进行演奏', '用计算机键盘快速试听音色'],
    setup: [
      '设置起始音符、键盘范围和转置',
      '将 midi 输出连接到高级振荡器或小号',
    ],
    cautions: ['需要先启用键盘输入；焦点位于文本框时避免触发演奏快捷键'],
    tags: ['input', 'keyboard', 'midi', 'performance'],
  },
  sequencer: {
    useWhen: ['循环播放 MIDI 片段', '编排复音或 MPE 音符'],
    setup: [
      '使用界面中的 MIDI Clip 编辑器维护 clip 数据',
      '设置 BPM 与全局转置，再将 midi 输出连接到音源',
      '通过 playing 参数控制播放状态',
      '录制前启用 recordArmed，并用 quantizeStrength 保留或修正演奏律动',
    ],
    cautions: ['clipData 是结构化 JSON，不要在不了解格式时直接覆写'],
    tags: ['input', 'sequencer', 'midi', 'clip'],
  },
  reverb: {
    useWhen: ['增加空间感和尾音', '把干燥音源放入虚拟空间'],
    setup: [
      '将音源 AUDIO 输出连接到 audioin',
      '先用较低 wet 调整空间比例，再调 decay 与 preDelay',
      '将 audioout 继续连接到输出或后级效果',
    ],
    cautions: ['较长 decay 与高 wet 会掩盖瞬态并造成混浊'],
    tags: ['effect', 'reverb', 'space', 'audio'],
  },
  delay: {
    useWhen: ['制作回声、节奏重复或加宽效果'],
    setup: [
      '将 AUDIO 信号接入 input',
      '设置 delayTime 后缓慢增加 feedback',
      '用 wet 控制原声与回声比例',
    ],
    cautions: ['feedback 接近上限时可能产生持续堆积，先保持较低输出音量'],
    tags: ['effect', 'delay', 'echo', 'audio'],
  },
  eq: {
    useWhen: ['修正频率平衡', '在进入空间效果或输出前塑形音色'],
    setup: [
      '将 AUDIO 信号接入 input',
      '先小幅调整 low/mid/high，再按需要移动分频点',
    ],
    cautions: ['避免多个频段同时大幅提升，以免削波并损失余量'],
    tags: ['effect', 'eq', 'tone', 'audio'],
  },
  bitcrusher: {
    useWhen: ['制作低保真、芯片或数字破碎质感'],
    setup: ['将 AUDIO 信号接入 input', '先降低 wet 试听，再调整 bits 强度'],
    cautions: ['高 wet 与激进位深会产生尖锐高频，注意监听音量'],
    tags: ['effect', 'lofi', 'distortion', 'audio'],
  },
  vca: {
    useWhen: ['用包络控制音量', '制作震音或自动淡入淡出'],
    setup: [
      '将音频连接到 input',
      '将包络或 LFO 连接到 cv',
      '用 gain 和 cvAmount 设置基础电平与调制深度',
    ],
    cautions: ['CV 会与基础增益相乘；没有 CV 时保持默认值 1'],
    tags: ['audio', 'amplifier', 'vca', 'modulation'],
  },
  filter: {
    useWhen: ['进行减法合成音色塑形', '制作扫频、哇音或共振效果'],
    setup: [
      '将音频接入 input 并选择滤波模式',
      '设置 cutoff 与 resonance',
      '可将 LFO 或包络接到 cutoffMod',
    ],
    cautions: ['高共振可能显著提高峰值，后级建议接主限幅器'],
    tags: ['audio', 'filter', 'subtractive', 'modulation'],
  },
  mixer: {
    useWhen: ['合并多个音源或并行效果返回', '统一控制主输出电平'],
    setup: [
      '将最多四路 AUDIO 信号接到 input1..input4',
      '分别设置通道电平，再调整 master',
    ],
    cautions: ['多路高电平相加容易削波，保留主输出余量'],
    tags: ['audio', 'mixer', 'routing', 'gain'],
  },
  noise: {
    useWhen: ['制作鼓噪声、风声、气息和纹理', '为减法合成提供宽频信号源'],
    setup: [
      '选择 white、pink 或 brown',
      '先降低 level，再接入滤波器、VCA 或效果器',
    ],
    cautions: ['白噪声高频能量强，首次监听保持较低电平'],
    tags: ['audio', 'noise', 'source', 'texture'],
  },
  masterlimiter: {
    useWhen: ['在 Speaker 前保护最终输出', '控制复杂混音的瞬时峰值'],
    setup: [
      '将最终混音接到 input',
      '设置输入增益与 ceiling，再把 output 接到 Speaker',
    ],
    cautions: ['限幅器是安全网，不应依赖它修复长期过载的通道增益'],
    tags: ['audio', 'output', 'limiter', 'mastering'],
  },
  masterrecorder: {
    useWhen: ['导出主总线演奏或编曲', '快速生成可分享的 WAV 文件'],
    setup: [
      '将最终混音接到 input，并把 output 继续接到主限幅器或 Speaker',
      '设置文件名后点击开始录音',
      '演奏完成后点击停止并导出',
    ],
    cautions: ['录音数据只存在于运行时，停止后请保存浏览器下载的 WAV 文件'],
    tags: ['audio', 'output', 'recorder', 'wav', 'export'],
  },
  speaker: {
    useWhen: ['把最终音频送到系统输出', '作为音频链的终点'],
    setup: [
      '单声道信号可接入左或右 AUDIO 输入；立体声链分别连接左右端口',
      '先降低 volume，再由用户启动浏览器音频上下文',
    ],
    cautions: ['speaker 没有输出端口，不能作为中间处理节点'],
    tags: ['output', 'speaker', 'audio'],
  },
  trumpet: {
    useWhen: ['需要带滑音和颤音的单音铜管音色', '用 MIDI/MPE 演奏表现性旋律'],
    setup: [
      '将 MIDI 输入或 MIDI Clip 连接到 midi 端口',
      '用 brightness、vibrato 和 portamento 塑造演奏表现',
      '将 audioout 接入效果器或 speaker',
    ],
    cautions: ['这是单音音源；同时输入多音时只适合旋律优先的演奏'],
    tags: ['source', 'physical-modeling', 'midi', 'expressive'],
  },
  numberinput: {
    useWhen: ['提供固定 NUMBER 控制值', '测试参数调制或逻辑链'],
    setup: ['设置 value', '将 output 连接到 NUMBER 类型输入'],
    cautions: ['它不生成音频，不能直接连接 AUDIO 端口'],
    tags: ['logic', 'number', 'control'],
  },
  calculator: {
    useWhen: ['组合或缩放两个 NUMBER 控制信号', '构建简单控制逻辑'],
    setup: ['分别连接 a 与 b', '选择 operation，再把 output 接到目标控制端口'],
    cautions: ['除法时注意第二输入为零；status 参数是只读状态信息'],
    tags: ['logic', 'math', 'number', 'control'],
  },
  oscilloscope: {
    useWhen: ['观察 NUMBER 控制信号随时间变化', '调试 LFO 或逻辑输出'],
    setup: ['将 NUMBER 信号连接到 input', '通过可视化确认变化范围和速度'],
    cautions: ['当前示波器观察 NUMBER 信号，不接收 AUDIO 波形'],
    tags: ['logic', 'visualization', 'debug', 'number'],
  },
};

export function getModuleGuide(type: string): ModuleGuideContent {
  return (
    MODULE_GUIDES[type] ?? {
      useWhen: ['需要使用该模块提供的能力'],
      setup: ['加载模块详情后，根据真实端口类型完成连接'],
      cautions: ['修改参数前检查参数范围，连接前检查端口类型'],
      tags: [],
    }
  );
}
