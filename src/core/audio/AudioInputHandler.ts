/* eslint-disable @typescript-eslint/no-explicit-any */
import { Gain } from 'tone';

/**
 * 音频输入处理器 - 用于管理多个音频输入的连接和混合
 */
export class AudioInputHandler {
  // 存储所有连接的音频输入
  private audioInputs: Map<string, any> = new Map();
  // 混合器节点，用于将多个输入混合成一个输出
  private mixer: Gain | null = null;
  // 目标处理节点
  private targetNode: any;
  // Tone.js实例
  private Tone: any;

  /**
   * 创建音频输入处理器
   * @param targetNode 目标处理节点（如混响、滤波器等）
   * @param Tone Tone.js实例
   */
  constructor(targetNode: any, Tone: any) {
    this.targetNode = targetNode;
    this.Tone = Tone;
    this.setupMixer();
  }

  /**
   * 设置混合器
   */
  private setupMixer(): void {
    if (!this.Tone) {
      console.warn(
        '[AudioInputHandler] Cannot setup mixer: Tone.js instance not available'
      );
      return;
    }

    // 创建增益节点作为混合器
    this.mixer = new this.Tone.Gain(1);
    // 将混合器连接到目标节点
    this.mixer!.connect(this.targetNode);
  }

  /**
   * 处理音频输入
   * @param audioInput 音频输入
   * @param sourceModuleId 源模块ID
   * @param sourcePortName 源端口名
   * @returns 是否成功连接
   */
  public handleInput(
    audioInput: any,
    sourceModuleId: string,
    sourcePortName: string
  ): boolean {
    if (!this.mixer) {
      console.warn(
        '[AudioInputHandler] Cannot handle input: mixer not initialized'
      );
      return false;
    }

    const connectionKey = `${sourceModuleId}:${sourcePortName}`;

    // 检查连接是否已存在且相同
    if (this.audioInputs.has(connectionKey)) {
      const existingInput = this.audioInputs.get(connectionKey);
      if (existingInput === audioInput) {
        return true; // 连接已存在，无需重新连接
      }

      // 断开旧连接
      try {
        existingInput.disconnect(this.mixer);
      } catch (error) {
        console.warn(
          `[AudioInputHandler] Error disconnecting previous audio:`,
          error
        );
      }
    }

    // 如果新的音频输入有效，则连接它
    if (audioInput) {
      try {
        audioInput.connect(this.mixer);
        this.audioInputs.set(connectionKey, audioInput);
        return true;
      } catch (error) {
        console.error(
          `[AudioInputHandler] Error connecting audio from ${connectionKey}:`,
          error
        );
        return false;
      }
    } else {
      // 如果输入为null，从Map中移除
      this.audioInputs.delete(connectionKey);
      return true;
    }
  }

  /**
   * 处理音频断开连接
   * @param sourceModuleId 可选的源模块ID
   * @param sourcePortName 可选的源端口名
   */
  public handleDisconnect(
    sourceModuleId?: string,
    sourcePortName?: string
  ): void {
    if (!this.mixer) return;

    // 如果指定了源模块和端口，只断开特定连接
    if (sourceModuleId && sourcePortName) {
      const connectionKey = `${sourceModuleId}:${sourcePortName}`;
      if (this.audioInputs.has(connectionKey)) {
        try {
          const audioInput = this.audioInputs.get(connectionKey);
          if (audioInput) {
            audioInput.disconnect(this.mixer);
          }
          this.audioInputs.delete(connectionKey);
        } catch (error) {
          console.warn(`[AudioInputHandler] Error disconnecting audio:`, error);
        }
      }
    }
    // 如果只指定了源模块，断开来自该模块的所有连接
    else if (sourceModuleId) {
      const keysToRemove: string[] = [];
      this.audioInputs.forEach((audioInput, key) => {
        if (key.startsWith(`${sourceModuleId}:`)) {
          try {
            audioInput.disconnect(this.mixer);
            keysToRemove.push(key);
          } catch (error) {
            console.warn(
              `[AudioInputHandler] Error disconnecting audio:`,
              error
            );
          }
        }
      });

      keysToRemove.forEach((key) => this.audioInputs.delete(key));
    }
    // 如果没有指定源，断开所有连接
    else {
      this.audioInputs.forEach((audioInput, _key) => {
        try {
          audioInput.disconnect(this.mixer);
        } catch (error) {
          console.warn(`[AudioInputHandler] Error disconnecting audio:`, error);
        }
      });

      this.audioInputs.clear();
    }
  }

  /**
   * 获取音频输入数量
   */
  public getInputCount(): number {
    return this.audioInputs.size;
  }

  /**
   * 获取混合器输出
   */
  public getMixerOutput(): any {
    return this.mixer;
  }

  /**
   * 释放资源
   */
  public dispose(): void {
    this.handleDisconnect();

    if (this.mixer) {
      try {
        this.mixer.dispose();
      } catch (error) {
        console.warn('[AudioInputHandler] Error disposing mixer', error);
      }
      this.mixer = null;
    }
  }
}
