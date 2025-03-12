/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OscillatorBasic, oscillatorBasicConfig } from '../oscillator-basic';
import { ModuleParams } from '@/core/domain/Module';

// 模拟必要的依赖，避免真实调用Tone.js
vi.mock('tone', () => {
  return {
    Oscillator: vi.fn().mockImplementation(() => ({
      set: vi.fn(),
      start: vi.fn(),
      connect: vi.fn(),
      frequency: { value: 440 },
      detune: { value: 0 },
      type: 'sine',
      stop: vi.fn(),
      dispose: vi.fn(),
    })),
    Gain: vi.fn().mockImplementation(() => ({
      gain: { value: 0.8 },
      connect: vi.fn(),
      dispose: vi.fn(),
    })),
  };
});

describe('OscillatorBasic 模块', () => {
  let moduleParams: ModuleParams;

  beforeEach(() => {
    // 准备模块初始化参数
    moduleParams = {
      id: 'test-oscillator',
      typeId: 'oscillator-basic', // 添加必需的typeId
      metadata: oscillatorBasicConfig.metadata, // 直接使用已导入的配置中的metadata
      position: { x: 0, y: 0 },
    };
  });

  it('应该能正确创建实例', () => {
    const oscillator = new OscillatorBasic(moduleParams);
    expect(oscillator).toBeDefined();
    expect(oscillator).toBeInstanceOf(OscillatorBasic);
  });

  it('应该具有正确的模块ID和配置', () => {
    const oscillator = new OscillatorBasic(moduleParams);
    expect(oscillator.typeId).toBe('oscillator-basic');
    expect(oscillatorBasicConfig.metadata.id).toBe('oscillator-basic');
    expect(oscillatorBasicConfig.metadata.name).toBe('基础振荡器');
  });

  it('应该返回正确的输出端口列表', () => {
    const oscillator = new OscillatorBasic(moduleParams);
    const outputPorts = oscillator.getOutputPorts();

    expect(outputPorts).toHaveLength(1);
    expect(outputPorts[0].id).toBe('audio_out');
    expect(outputPorts[0].dataType).toBe('audio');
  });

  it('应该返回正确的参数定义', () => {
    const oscillator = new OscillatorBasic(moduleParams);
    const paramDefs = oscillator.getParameterDefinitions();

    expect(paramDefs.frequency).toBeDefined();
    expect(paramDefs.waveform).toBeDefined();
    expect(paramDefs.amplitude).toBeDefined();
    expect(paramDefs.detune).toBeDefined();

    expect(paramDefs.frequency.default).toBe(440);
    expect(paramDefs.waveform.default).toBe('sine');
  });

  it('应该能够正确创建和清理音频节点', async () => {
    const oscillator = new OscillatorBasic(moduleParams);

    // 调用非公开方法，需要使用类型断言
    await (oscillator as any).createAudioNodes();

    // 验证内部属性是否已设置
    expect((oscillator as any).oscillator).toBeDefined();
    expect((oscillator as any).outputGain).toBeDefined();

    // 测试销毁方法
    await oscillator.dispose();
    expect((oscillator as any).oscillator).toBeNull();
    expect((oscillator as any).outputGain).toBeNull();
  });
});
