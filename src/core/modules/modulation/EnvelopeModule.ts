import {
  ModuleBase,
  ModuleMetadata,
  ParameterType,
  PortType,
} from '@/core/base/ModuleBase';

type EnvelopeStage = 'idle' | 'attack' | 'decay' | 'sustain' | 'release';

/** 控制速率 ADSR，可连接到 VCA、滤波器等 NUMBER 输入。 */
export class EnvelopeModule extends ModuleBase {
  public static metadata: ModuleMetadata = {
    type: 'envelope',
    label: 'ADSR 包络',
    description: '根据门信号生成可复用的 Attack/Decay/Sustain/Release 控制曲线',
    category: '调制',
    iconType: 'Sliders',
  };

  private timer: ReturnType<typeof setInterval> | null = null;
  private stage: EnvelopeStage = 'idle';
  private stageStartedAt = 0;
  private stageStartValue = 0;
  private currentValue = 0;

  constructor(id: string, name = 'ADSR 包络') {
    super(
      'envelope',
      id,
      name,
      {
        attack: {
          type: ParameterType.NUMBER,
          value: 0.01,
          min: 0.001,
          max: 10,
          step: 0.001,
          uiOptions: { label: 'Attack', unit: 's' },
        },
        decay: {
          type: ParameterType.NUMBER,
          value: 0.2,
          min: 0.001,
          max: 10,
          step: 0.001,
          uiOptions: { label: 'Decay', unit: 's' },
        },
        sustain: {
          type: ParameterType.NUMBER,
          value: 0.7,
          min: 0,
          max: 1,
          step: 0.01,
          uiOptions: { label: 'Sustain' },
        },
        release: {
          type: ParameterType.NUMBER,
          value: 0.5,
          min: 0.001,
          max: 20,
          step: 0.001,
          uiOptions: { label: 'Release', unit: 's' },
        },
        amount: {
          type: ParameterType.NUMBER,
          value: 1,
          min: 0,
          max: 1,
          step: 0.01,
          uiOptions: { label: '输出深度' },
        },
      },
      { gate: { type: PortType.NUMBER, value: 0 } },
      { envelope: { type: PortType.NUMBER, value: 0 } }
    );

    this.addInternalSubscription(
      this.inputPorts.gate.subscribe((value) =>
        this.handleGate(typeof value === 'number' && value >= 0.5)
      )
    );
    this.timer = setInterval(() => this.tick(), 16);
  }

  private handleGate(open: boolean): void {
    if (
      open &&
      this.stage !== 'attack' &&
      this.stage !== 'decay' &&
      this.stage !== 'sustain'
    ) {
      this.enterStage('attack');
    } else if (!open && this.stage !== 'idle' && this.stage !== 'release') {
      this.enterStage('release');
    }
  }

  private enterStage(stage: EnvelopeStage): void {
    this.stage = stage;
    this.stageStartedAt = Date.now();
    this.stageStartValue = this.currentValue;
  }

  private tick(): void {
    const elapsed = (Date.now() - this.stageStartedAt) / 1000;
    const sustain = this.getParameterValue('sustain') as number;
    if (this.stage === 'attack') {
      const duration = this.getParameterValue('attack') as number;
      this.currentValue =
        this.stageStartValue +
        (1 - this.stageStartValue) * Math.min(1, elapsed / duration);
      if (elapsed >= duration) this.enterStage('decay');
    } else if (this.stage === 'decay') {
      const duration = this.getParameterValue('decay') as number;
      this.currentValue = 1 + (sustain - 1) * Math.min(1, elapsed / duration);
      if (elapsed >= duration) this.enterStage('sustain');
    } else if (this.stage === 'sustain') {
      this.currentValue = sustain;
    } else if (this.stage === 'release') {
      const duration = this.getParameterValue('release') as number;
      this.currentValue =
        this.stageStartValue * (1 - Math.min(1, elapsed / duration));
      if (elapsed >= duration) this.enterStage('idle');
    } else {
      this.currentValue = 0;
    }
    this.outputPorts.envelope.next(
      this.currentValue * (this.getParameterValue('amount') as number)
    );
  }

  public dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    super.dispose();
  }
}
