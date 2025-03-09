/**
 * 合成器流模块配置
 * 基于 Tone.js 实现
 */

export const moduleConfigurations = [
  // 振荡器模块
  {
    metadata: {
      id: 'oscillator-basic',
      name: '基础振荡器',
      version: '1.0.0',
      category: 'GENERATOR',
      tags: ['oscillator', 'generator', 'audio'],
      description: '基本波形发生器，支持多种波形类型',
      author: 'SynthTeam',
      created: '2025-03-01',
      updated: '2025-03-09',
    },
    interfaces: {
      inputs: [
        {
          id: 'freq_mod',
          label: '频率调制',
          dataType: 'CONTROL',
          controlTarget: 'frequency',
          multiConnection: false,
          optional: true,
          description: '频率调制输入，接受-1到1的控制信号',
        },
        {
          id: 'amp_mod',
          label: '振幅调制',
          dataType: 'CONTROL',
          controlTarget: 'amplitude',
          multiConnection: false,
          optional: true,
          description: '振幅调制输入',
        },
        {
          id: 'sync',
          label: '同步',
          dataType: 'TRIGGER',
          optional: true,
          description: '重置振荡器相位',
        },
      ],
      outputs: [
        {
          id: 'audio_out',
          label: '音频输出',
          dataType: 'AUDIO',
          description: '振荡器的音频信号输出',
        },
      ],
    },
    parameters: {
      frequency: {
        type: 'NUMBER',
        default: 440,
        min: 20,
        max: 20000,
        step: 0.01,
        unit: 'Hz',
        label: '频率',
        description: '振荡器的基础频率',
        modulatable: true,
      },
      waveform: {
        type: 'ENUM',
        default: 'sine',
        options: ['sine', 'square', 'triangle', 'sawtooth', 'noise'],
        label: '波形',
        description: '振荡器波形类型',
      },
      amplitude: {
        type: 'NUMBER',
        default: 0.8,
        min: 0,
        max: 1,
        step: 0.01,
        label: '音量',
        description: '振荡器输出音量',
        modulatable: true,
      },
      detune: {
        type: 'NUMBER',
        default: 0,
        min: -1200,
        max: 1200,
        step: 1,
        unit: 'cents',
        label: '微调',
        description: '频率微调，单位为音分',
        modulatable: true,
      },
    },
    presets: [
      {
        id: 'default',
        name: '默认设置',
        author: 'System',
        description: '默认振荡器设置',
        values: {
          frequency: 440,
          waveform: 'sine',
          amplitude: 0.8,
          detune: 0,
        },
      },
      {
        id: 'bass_tone',
        name: '低音音色',
        author: 'SynthTeam',
        description: '适合低音部分的设置',
        values: {
          frequency: 110,
          waveform: 'triangle',
          amplitude: 0.9,
          detune: 0,
        },
        tags: ['bass', 'low'],
      },
    ],
    ui: {
      color: '#fee5f1',
      icon: 'wave-sine',
      width: 220,
      height: 'auto',
    },
    // Tone.js 特定配置
    toneComponent: 'Oscillator',
    toneConfiguration: {
      setup: (params) => ({
        frequency: params.frequency,
        type: params.waveform,
        volume: Tone.gainToDb(params.amplitude),
      }),
    },
  },

  // 滤波器模块
  {
    metadata: {
      id: 'filter-basic',
      name: '基础滤波器',
      version: '1.0.0',
      category: 'FILTER',
      tags: ['filter', 'effect'],
      description: '基础滤波器模块，支持多种滤波类型',
      author: 'SynthTeam',
      created: '2025-03-01',
      updated: '2025-03-09',
    },
    interfaces: {
      inputs: [
        {
          id: 'audio_in',
          label: '音频输入',
          dataType: 'AUDIO',
          multiConnection: false,
          optional: false,
          description: '滤波器的音频输入',
        },
        {
          id: 'cutoff_mod',
          label: '截止频率调制',
          dataType: 'CONTROL',
          controlTarget: 'frequency',
          multiConnection: false,
          optional: true,
          description: '截止频率调制输入',
        },
        {
          id: 'q_mod',
          label: 'Q值调制',
          dataType: 'CONTROL',
          controlTarget: 'Q',
          multiConnection: false,
          optional: true,
          description: 'Q值调制输入',
        },
      ],
      outputs: [
        {
          id: 'audio_out',
          label: '音频输出',
          dataType: 'AUDIO',
          description: '滤波后的音频信号输出',
        },
      ],
    },
    parameters: {
      frequency: {
        type: 'NUMBER',
        default: 1000,
        min: 20,
        max: 20000,
        step: 1,
        unit: 'Hz',
        label: '截止频率',
        description: '滤波器的截止频率',
        modulatable: true,
      },
      type: {
        type: 'ENUM',
        default: 'lowpass',
        options: ['lowpass', 'highpass', 'bandpass', 'notch', 'allpass'],
        label: '滤波类型',
        description: '滤波器类型',
      },
      Q: {
        type: 'NUMBER',
        default: 1,
        min: 0.1,
        max: 20,
        step: 0.1,
        label: 'Q值',
        description: '滤波器的Q值（共振）',
        modulatable: true,
      },
      gain: {
        type: 'NUMBER',
        default: 0,
        min: -40,
        max: 40,
        step: 0.1,
        unit: 'dB',
        label: '增益',
        description: '滤波器增益（仅适用于某些滤波类型）',
        modulatable: true,
        visibleWhen: {
          parameter: 'type',
          equals: ['lowshelf', 'highshelf', 'peaking'],
        },
      },
    },
    presets: [
      {
        id: 'default',
        name: '默认设置',
        author: 'System',
        description: '默认滤波器设置',
        values: {
          frequency: 1000,
          type: 'lowpass',
          Q: 1,
          gain: 0,
        },
      },
      {
        id: 'warm_lowpass',
        name: '温暖低通',
        author: 'SynthTeam',
        description: '温暖的低通滤波器设置',
        values: {
          frequency: 800,
          type: 'lowpass',
          Q: 0.7,
          gain: 0,
        },
        tags: ['warm', 'smooth'],
      },
    ],
    ui: {
      color: '#bdc7d2',
      icon: 'filter',
      width: 240,
      height: 'auto',
    },
    // Tone.js 特定配置
    toneComponent: 'Filter',
    toneConfiguration: {
      setup: (params) => ({
        frequency: params.frequency,
        type: params.type,
        Q: params.Q,
        gain: params.gain,
      }),
    },
  },

  // 包络发生器模块
  {
    metadata: {
      id: 'envelope-adsr',
      name: 'ADSR包络',
      version: '1.0.0',
      category: 'MODULATOR',
      tags: ['envelope', 'modulator'],
      description: 'ADSR（攻击、衰减、延音、释放）包络发生器',
      author: 'SynthTeam',
      created: '2025-03-01',
      updated: '2025-03-09',
    },
    interfaces: {
      inputs: [
        {
          id: 'trigger',
          label: '触发',
          dataType: 'TRIGGER',
          multiConnection: false,
          optional: false,
          description: '触发包络开始',
        },
        {
          id: 'release',
          label: '释放',
          dataType: 'TRIGGER',
          multiConnection: false,
          optional: true,
          description: '触发包络释放阶段',
        },
      ],
      outputs: [
        {
          id: 'env_out',
          label: '包络输出',
          dataType: 'CONTROL',
          description: '包络控制信号输出',
        },
      ],
    },
    parameters: {
      attack: {
        type: 'NUMBER',
        default: 0.01,
        min: 0.001,
        max: 10,
        step: 0.001,
        unit: 's',
        label: '攻击时间',
        description: '从零到峰值的时间',
        modulatable: false,
      },
      decay: {
        type: 'NUMBER',
        default: 0.2,
        min: 0.001,
        max: 10,
        step: 0.001,
        unit: 's',
        label: '衰减时间',
        description: '从峰值到延音电平的时间',
        modulatable: false,
      },
      sustain: {
        type: 'NUMBER',
        default: 0.7,
        min: 0,
        max: 1,
        step: 0.01,
        label: '延音电平',
        description: '持续阶段的电平',
        modulatable: false,
      },
      release: {
        type: 'NUMBER',
        default: 0.5,
        min: 0.001,
        max: 10,
        step: 0.001,
        unit: 's',
        label: '释放时间',
        description: '从延音电平到零的时间',
        modulatable: false,
      },
    },
    presets: [
      {
        id: 'default',
        name: '默认设置',
        author: 'System',
        description: '默认ADSR设置',
        values: {
          attack: 0.01,
          decay: 0.2,
          sustain: 0.7,
          release: 0.5,
        },
      },
      {
        id: 'pluck',
        name: '拨弦',
        author: 'SynthTeam',
        description: '模拟拨弦的包络设置',
        values: {
          attack: 0.005,
          decay: 0.1,
          sustain: 0,
          release: 0.1,
        },
        tags: ['pluck', 'short'],
      },
      {
        id: 'pad',
        name: '柔和垫音',
        author: 'SynthTeam',
        description: '柔和垫音的包络设置',
        values: {
          attack: 0.5,
          decay: 1,
          sustain: 0.8,
          release: 2,
        },
        tags: ['pad', 'slow'],
      },
    ],
    ui: {
      color: '#f9e8d4',
      icon: 'envelope',
      width: 240,
      height: 'auto',
      customView: 'envelopeGraph',
    },
    // Tone.js 特定配置
    toneComponent: 'Envelope',
    toneConfiguration: {
      setup: (params) => ({
        attack: params.attack,
        decay: params.decay,
        sustain: params.sustain,
        release: params.release,
      }),
    },
  },

  // 输出模块
  {
    metadata: {
      id: 'output-main',
      name: '主输出',
      version: '1.0.0',
      category: 'UTILITY',
      tags: ['output', 'master'],
      description: '主音频输出模块，连接到系统音频输出',
      author: 'SynthTeam',
      created: '2025-03-01',
      updated: '2025-03-09',
    },
    interfaces: {
      inputs: [
        {
          id: 'audio_in',
          label: '音频输入',
          dataType: 'AUDIO',
          multiConnection: true,
          optional: false,
          description: '音频输入，连接到系统音频输出',
        },
      ],
      outputs: [], // 无输出接口，是终端模块
    },
    parameters: {
      volume: {
        type: 'NUMBER',
        default: 0,
        min: -60,
        max: 6,
        step: 0.1,
        unit: 'dB',
        label: '音量',
        description: '主输出音量',
        modulatable: true,
      },
      mute: {
        type: 'BOOLEAN',
        default: false,
        label: '静音',
        description: '静音开关',
      },
    },
    presets: [
      {
        id: 'default',
        name: '默认设置',
        author: 'System',
        description: '默认输出设置',
        values: {
          volume: 0,
          mute: false,
        },
      },
    ],
    ui: {
      color: '#ecedf1',
      icon: 'speaker',
      width: 180,
      height: 'auto',
    },
    // Tone.js 特定配置
    toneComponent: 'Destination',
    toneConfiguration: {
      setup: (params) => ({
        volume: params.volume,
        mute: params.mute,
      }),
    },
  },
];
