interface ToneTransportLike {
  state: string;
  start: () => void;
  pause?: () => void;
  stop: () => void;
  position?: number | string;
  ticks?: number;
  bpm?: { value: number };
}

interface ToneLike {
  Transport: ToneTransportLike;
}

/**
 * 应用级 Transport 协调器。
 *
 * Tone.Transport 是全局单例，不能让某个 Sequencer 在其他片段仍播放时
 * 随意停止它。服务用活动客户端集合统一管理启动和停止；各片段的 BPM
 * 仍通过自身的秒级事件时间计算，因此不会互相覆盖全局 BPM。
 */
class TransportService {
  private activeClients = new Set<string>();
  private tone: ToneLike | null = null;

  public start(clientId: string, tone: ToneLike): void {
    this.tone = tone;
    this.activeClients.add(clientId);
    if (tone.Transport.state !== 'started') {
      tone.Transport.start();
    }
  }

  public stop(clientId: string, tone?: ToneLike): void {
    this.activeClients.delete(clientId);
    if (this.activeClients.size > 0 || !tone) {
      return;
    }

    if (tone.Transport.state !== 'stopped') {
      tone.Transport.stop();
    }
    if ('position' in tone.Transport) {
      tone.Transport.position = 0;
    }
    this.tone = null;
  }

  /** 暂停全局时钟但保留活动片段和当前位置。 */
  public pause(): void {
    if (this.tone?.Transport.state !== 'started') return;
    this.tone.Transport.pause?.();
  }

  /** 从暂停位置恢复全局时钟。 */
  public resume(): void {
    if (!this.tone || this.activeClients.size === 0) return;
    if (this.tone.Transport.state !== 'started') {
      this.tone.Transport.start();
    }
  }

  public seekTicks(ticks: number): void {
    if (!this.tone || !('ticks' in this.tone.Transport)) return;
    this.tone.Transport.ticks = Math.max(0, ticks);
  }

  public setBpm(bpm: number): void {
    if (this.tone?.Transport.bpm) {
      this.tone.Transport.bpm.value = bpm;
    }
  }

  /** 仅在 Tone Transport 已被片段激活时返回权威播放位置。 */
  public getPositionTicks(): number | undefined {
    const ticks = this.tone?.Transport.ticks;
    return Number.isFinite(ticks) ? ticks : undefined;
  }

  public getActiveClientCount(): number {
    return this.activeClients.size;
  }

  public reset(): void {
    this.activeClients.clear();
    this.tone = null;
  }
}

export const transportService = new TransportService();
