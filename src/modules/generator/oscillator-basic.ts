// 基础振荡器模块定义
// 包含元数据、接口、参数和预设

import * as Tone from 'tone';
import { Module, ModuleParams, Port } from '@/core/domain/Module';
import { ParameterValue } from '@/types/event';
import { eventBus } from '@/core/events/EventBus';

// 将BaseModule改为Module，或者在项目中添加BaseModule的定义
export class OscillatorBasic extends Module {
  // 振荡器和增益器实例
  private oscillator: Tone.Oscillator | null = null;
  private outputGain: Tone.Gain | null = null;

  constructor(params: ModuleParams) {
    super({
      ...params,
      typeId: 'oscillator-basic'
    });
  }

  // 定义输入端口
  getInputPorts(): Port[] {
    return [{
      id: 'sync',
      type: 'input',
      dataType: 'trigger',
      label: '同步'
    }];
  }

  // 定义输出端口
  getOutputPorts(): Port[] {
    return [{
      id: 'audio_out',
      type: 'output',
      dataType: 'audio',
      label: '音频输出'
    }];
  }

  // 参数定义
  getParameterDefinitions(): Record<string, { type: string; default: ParameterValue; min?: number; max?: number; }> {
    return {
      frequency: {
        type: 'NUMBER',
        default: 440,
        min: 20,
        max: 20000,
      },
      waveform: {
        type: 'ENUM',
        default: 'sine'
      },
      amplitude: {
        type: 'NUMBER',
        default: 0.8,
        min: 0,
        max: 1
      },
      detune: {
        type: 'NUMBER',
        default: 0,
        min: -1200,
        max: 1200
      }
    };
  }

  // 创建音频节点
  protected async createAudioNodes(): Promise<void> {
    // 创建振荡器 - 修复类型问题，分开设置参数
    this.oscillator = new Tone.Oscillator();
    this.oscillator.frequency.value = this.getParameterValue('frequency') as number;
    this.oscillator.detune.value = this.getParameterValue('detune') as number;
    
    // 设置波形类型
    const waveform = this.getParameterValue('waveform') as string;
    if (this.isValidWaveform(waveform)) {
      this.oscillator.type = waveform as Tone.ToneOscillatorType;
    }
    
    // 启动振荡器
    this.oscillator.start();

    // 创建增益节点控制音量
    this.outputGain = new Tone.Gain(this.getParameterValue('amplitude') as number);

    // 连接振荡器到增益节点
    this.oscillator.connect(this.outputGain);

    // 存储音频节点引用
    this._audioNodes = {
      oscillator: this.oscillator,
      audio_out: this.outputGain
    };

    // 为同步输入配置事件处理
    this.setupSyncHandler();

    console.log(`[OscillatorBasic] 创建音频节点: typeId=${this.typeId}, id=${this.id}`);
  }

  // 设置同步处理
  private setupSyncHandler(): void {
    if (this.oscillator) {
      // 监听同步触发事件
      eventBus.on('TRIGGER.SYNC', (event: unknown) => {
        const syncEvent = event as { targetId: string };
        if (syncEvent.targetId === this.id && this.oscillator) {
          // 重启振荡器以重置相位
          this.oscillator.stop().start();
        }
      });
    }
  }

  // 将参数应用到音频节点
  protected applyParameterToAudioNode(paramId: string, value: ParameterValue): void {
    if (!this.oscillator || !this.outputGain) return;

    switch (paramId) {
      case 'frequency':
        if (typeof value === 'number') {
          this.oscillator.frequency.value = value;
        }
        break;
        
      case 'waveform':
        if (typeof value === 'string' && this.isValidWaveform(value)) {
          this.oscillator.type = value as Tone.ToneOscillatorType;
        }
        break;
        
      case 'amplitude':
        if (typeof value === 'number') {
          this.outputGain.gain.value = value;
        }
        break;
        
      case 'detune':
        if (typeof value === 'number') {
          this.oscillator.detune.value = value;
        }
        break;
        
      default:
        console.warn(`[OscillatorBasic] 未知参数: ${paramId}`);
    }
  }

  // 验证波形值是否有效
  private isValidWaveform(value: string): boolean {
    // 基本波形类型
    const validWaveforms = ['sine', 'square', 'triangle', 'sawtooth'];
    
    // 检查是否是基本波形或带有分量数字的格式(如"sine2", "triangle4"等)
    const basicTypeValid = validWaveforms.includes(value);
    const typeWithPartialsValid = validWaveforms.some(type => {
      return value.startsWith(type) && /^\d+$/.test(value.substring(type.length));
    });
    
    return basicTypeValid || typeWithPartialsValid;
  }

  // 获取与指定端口关联的音频节点
  getAudioNodeForPort(portId: string, portType: 'input' | 'output'): Tone.ToneAudioNode | null {
    if (portType === 'output' && portId === 'audio_out' && this.outputGain) {
      return this.outputGain;
    }
    
    // 同步端口不直接返回音频节点，因为它是触发类型
    return null;
  }

  // 销毁模块时的清理工作
  async dispose(): Promise<void> {
    if (this.oscillator) {
      this.oscillator.stop();
      this.oscillator.dispose();
      this.oscillator = null;
    }
    
    if (this.outputGain) {
      this.outputGain.dispose();
      this.outputGain = null;
    }
    
    this._audioNodes = {};
    
    // 调用父类的dispose方法
    await super.dispose();
  }
}

// 导出模块创建函数，用于模块工厂
export function createOscillatorBasic(params: ModuleParams): OscillatorBasic {
  return new OscillatorBasic(params);
}
