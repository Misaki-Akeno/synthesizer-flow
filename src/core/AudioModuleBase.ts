/* eslint-disable @typescript-eslint/no-explicit-any */
import { ModuleBase, PortType, ModuleInterface } from './ModuleBase';
import { moduleInitManager } from './ModuleInitManager';
import { AudioInputHandler } from './AudioInputHandler';
import { BehaviorSubject } from 'rxjs';

/**
 * 音频模块基类，提供Tone.js初始化和音频处理的通用方法
 */
export abstract class AudioModuleBase extends ModuleBase {
  // Tone.js实例
  protected Tone: any;
  // 初始化完成标志
  protected initialized: boolean = false;
  // 默认渐变时间，用于避免爆破音
  protected fadeTime: number = 0.01;
  // 较长的渐变时间，用于某些参数的平滑变化
  protected smoothTime: number = 0.05;
  // 待处理的音频输入队列
  protected pendingAudioInputs: Array<{
    sourceModuleId: string;
    sourcePortName: string;
    audioInput: any;
  }> = [];
  // 音频处理器对象
  protected audioInputHandler: AudioInputHandler | null = null;
  
  // 模块启用状态（新增）
  public enabled: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(true);

  constructor(
    moduleType: string,
    id: string,
    name: string,
    parameters: { [key: string]: any } = {},
    inputPorts: { [key: string]: { type: PortType; value: ModuleInterface } } = {},
    outputPorts: { [key: string]: { type: PortType; value: ModuleInterface } } = {},
    initialEnabled: boolean = true // 新增初始启用状态参数
  ) {
    super(moduleType, id, name, parameters, inputPorts, outputPorts);

    // 初始化启用状态
    this.enabled.next(initialEnabled);

    // 监听启用状态变化
    this.handleEnabledChange();

    // 注册为待初始化模块
    moduleInitManager.registerPendingModule(this.id);

    // 仅在浏览器环境下初始化Tone.js
    if (typeof window !== 'undefined') {
      this.initializeTone();
    }
  }

  /**
   * 获取模块启用状态
   */
  public isEnabled(): boolean {
    return this.enabled.getValue();
  }

  /**
   * 设置模块启用状态
   */
  public setEnabled(value: boolean): void {
    if (this.enabled.getValue() !== value) {
      this.enabled.next(value);
    }
  }

  /**
   * 切换模块启用状态
   */
  public toggleEnabled(): void {
    this.enabled.next(!this.enabled.getValue());
  }

  /**
   * 处理模块启用状态变化
   * 子类可以重写此方法以实现特定的启用/禁用行为
   */
  protected handleEnabledChange(): void {
    const enabledSubscription = this.enabled.subscribe(enabled => {
      this.onEnabledStateChanged(enabled);
    });
    this.addInternalSubscription(enabledSubscription);
  }

  /**
   * 当模块启用状态改变时的回调
   * 子类应该重写此方法以实现特定的启用/禁用行为
   */
  protected onEnabledStateChanged(_enabled: boolean): void {
    // 默认实现为空，由子类覆盖
  }

  /**
   * 动态加载Tone.js库
   */
  protected async initializeTone(): Promise<void> {
    try {
      const ToneModule = await import('tone');
      this.Tone = ToneModule;
      
      // 执行子类特定的初始化
      await this.initializeAudio();
      
      // 标记初始化完成
      this.initialized = true;
      moduleInitManager.markModuleAsInitialized(this.id);
      
      // 处理待处理的音频输入
      this.processPendingInputs();
    } catch (error) {
      console.error(`[${this.moduleType}Module ${this.id}] Failed to initialize Tone.js:`, error);
    }
  }

  /**
   * 子类必须实现的音频初始化方法
   */
  protected abstract initializeAudio(): Promise<void>;

  /**
   * 处理待处理的音频输入
   */
  protected processPendingInputs(): void {
    if (!this.initialized || !this.audioInputHandler) return;
    
    // 处理所有待处理的输入
    this.pendingAudioInputs.forEach(({sourceModuleId, sourcePortName, audioInput}) => {
      this.audioInputHandler?.handleInput(audioInput, sourceModuleId, sourcePortName);
    });
    
    // 清空队列
    this.pendingAudioInputs = [];
  }

  /**
   * 启动音频上下文
   */
  protected startAudioContext(): void {
    if (this.Tone && this.Tone.context.state !== 'running') {
      try {
        this.Tone.start();
      } catch (error) {
        console.warn(
          `[${this.moduleType}Module ${this.id}] Error starting audio context:`,
          error
        );
      }
    }
  }

  /**
   * 将分贝值转换为线性增益值
   */
  protected dbToLinear(dbValue: number): number {
    return Math.pow(10, dbValue / 20);
  }

  /**
   * 应用平滑的参数变化
   * @param audioParam 音频参数（如gain.gain）
   * @param value 目标值
   * @param rampTime 渐变时间
   * @param immediate 是否立即设置（跳过渐变）
   */
  protected applyParameterRamp(
    audioParam: any, 
    value: number, 
    rampTime: number = this.fadeTime,
    immediate: boolean = false
  ): void {
    if (!audioParam || !this.Tone) return;
    
    try {
      if (immediate) {
        audioParam.value = value;
        return;
      }
      
      // 检查当前值是否已经很接近目标值，如果是则不需要渐变
      const currentValue = audioParam.value !== undefined ? audioParam.value : (typeof audioParam.getValue === 'function' ? audioParam.getValue() : null);
      if (currentValue !== null && Math.abs(currentValue - value) < 0.001) {
        return;
      }
      
      audioParam.cancelScheduledValues(this.Tone.now());
      
      // 检查是否支持 rampTo 方法
      if (typeof audioParam.rampTo === 'function') {
        audioParam.rampTo(value, rampTime);
      } 
      // 检查是否支持 linearRampToValueAtTime 方法（原生 Web Audio API）
      else if (typeof audioParam.linearRampToValueAtTime === 'function') {
        const now = this.Tone.now();
        audioParam.linearRampToValueAtTime(value, now + rampTime);
      } 
      // 如果以上方法都不支持，则使用 setValueAtTime 和 linearRampToValueAtTime 组合
      else if (typeof audioParam.setValueAtTime === 'function' && typeof audioParam.linearRampToValueAtTime === 'function') {
        const now = this.Tone.now();
        audioParam.setValueAtTime(audioParam.value, now);
        audioParam.linearRampToValueAtTime(value, now + rampTime);
      } 
      // 最后的备选方案：直接设置值
      else {
        audioParam.value = value;
      }
    } catch (error) {
      console.warn(`[${this.moduleType}Module ${this.id}] Error applying parameter ramp:`, error);
      // 如果渐变失败，尝试直接设置值
      try {
        audioParam.value = value;
      } catch (innerError) {
        console.error(`[${this.moduleType}Module ${this.id}] Failed to set parameter value:`, innerError);
      }
    }
  }

  /**
   * 重写音频输入处理方法
   */
  protected handleAudioInput(
    inputPortName: string,
    audioInput: any,
    sourceModuleId: string,
    sourcePortName: string
  ): void {
    if (!this.initialized) {
      // 将音频输入添加到待处理队列
      this.pendingAudioInputs.push({
        sourceModuleId,
        sourcePortName,
        audioInput
      });
      // 更新输入端口状态
      this.inputPorts[inputPortName].next(audioInput);
      return;
    }
    
    if (this.audioInputHandler) {
      this.audioInputHandler.handleInput(audioInput, sourceModuleId, sourcePortName);
    }
    
    // 更新输入端口状态
    this.inputPorts[inputPortName].next(audioInput);
  }
  
  /**
   * 重写音频断开连接处理方法
   */
  protected handleAudioDisconnect(
    inputPortName: string,
    sourceModuleId?: string,
    sourcePortName?: string
  ): void {
    if (!this.audioInputHandler) {
      console.warn(`[${this.moduleType}Module ${this.id}] Cannot handle audio disconnect: AudioInputHandler not initialized`);
      return;
    }
    
    // 使用音频输入处理器处理断开连接
    this.audioInputHandler.handleDisconnect(sourceModuleId, sourcePortName);
  }

  /**
   * 释放音频资源
   * @param audioNodes 要释放的音频节点列表
   */
  protected disposeAudioNodes(audioNodes: any[]): void {
    audioNodes.forEach(node => {
      if (node) {
        try {
          if (typeof node.stop === 'function') {
            node.stop();
          }
          if (typeof node.dispose === 'function') {
            node.dispose();
          }
        } catch (error) {
          console.warn(`[${this.moduleType}Module ${this.id}] Error disposing audio node:`, error);
        }
      }
    });
  }

  /**
   * 扩展的资源清理方法
   */
  public dispose(): void {
    // 清理音频输入处理器
    if (this.audioInputHandler) {
      this.audioInputHandler.dispose();
      this.audioInputHandler = null;
    }

    // 标记模块已销毁
    import('./ModuleInitManager').then(({ moduleInitManager }) => {
      moduleInitManager.recordDisposal(this.id);
    });

    // 如果存在Tone实例，释放相关资源
    if (this.initialized && this.Tone) {
      try {
        // 子类可能有特定的资源清理逻辑，在基类dispose之前已执行
        // 释放Tone.js上下文资源
        if (this.Tone.context && typeof this.Tone.context.dispose === 'function') {
          // 只有当没有其他模块使用Tone上下文时才释放
          const activeModules = moduleInitManager.getInitializedModules().length;
          if (activeModules <= 1) { // 只有当前模块时释放上下文
            this.Tone.context.dispose();
          }
        }
      } catch (error) {
        console.error(`[${this.moduleType}Module ${this.id}] Error disposing Tone resources:`, error);
      }
    }

    // 调用父类的dispose方法清理基础资源
    super.dispose();
  }
}
