import { Parameter, ParameterType } from '@/interfaces/parameter';
import { ParameterValue } from '@/interfaces/event';
import { eventBus } from '../events/EventBus';

/**
 * 可观察参数类，优化参数值变化的处理
 */
export class ObservableParameter implements Parameter {
  private _listeners: Array<(value: ParameterValue) => void> = [];

  constructor(
    public id: string,
    public name: string,
    public type: ParameterType | string,
    private _value: string | number,
    public defaultValue: ParameterValue,
    public modulationAmount: number = 0,
    public modulationSource: string | null = null,
    public min?: number,
    public max?: number,
    public step?: number,
    public unit?: string,
    public options?: Array<string | number>,
    public modulatable?: boolean,
    public visibleWhen?: {
      parameter: string;
      equals: ParameterValue | ParameterValue[];
    }
  ) {}

  /**
   * 获取参数当前值
   */
  get value(): string | number {
    return this._value;
  }

  /**
   * 设置参数值
   */
  set value(newValue: string | number) {
    const oldValue = this._value;
    this._value = newValue;
    this._notifyListeners(newValue);

    // 检查类型是否为音频参数，触发不同类型的事件
    if (this.type === ParameterType.NUMBER && this.unit) {
      eventBus.emit('PARAMETER.AUDIO_CHANGED', {
        parameterId: this.id,
        value: newValue,
        previousValue: oldValue,
        unit: this.unit,
      });
    }
  }

  /**
   * 使用调制源更新值
   */
  updateWithModulation(baseValue: number): string | number {
    if (!this.modulationSource || this.modulationAmount === 0) {
      return baseValue;
    }

    // 这里可以实现基于调制源和调制量的计算逻辑
    // 作为示例，简单地添加调制量
    if (typeof baseValue === 'number') {
      const modulated = baseValue + this.modulationAmount;
      return Math.max(
        this.min ?? -Infinity,
        Math.min(modulated, this.max ?? Infinity)
      );
    }

    return baseValue;
  }

  /**
   * 监听值变化
   */
  onChange(callback: (value: ParameterValue) => void): () => void {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter((l) => l !== callback);
    };
  }

  private _notifyListeners(value: ParameterValue): void {
    for (const listener of this._listeners) {
      listener(value);
    }
  }
}
