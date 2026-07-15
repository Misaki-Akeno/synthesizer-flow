interface ToneTransportLike {
  state: string;
  start: () => void;
  stop: () => void;
  position?: number | string;
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

  public start(clientId: string, tone: ToneLike): void {
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

    if (tone.Transport.state === 'started') {
      tone.Transport.stop();
    }
    if ('position' in tone.Transport) {
      tone.Transport.position = 0;
    }
  }

  public getActiveClientCount(): number {
    return this.activeClients.size;
  }

  public reset(): void {
    this.activeClients.clear();
  }
}

export const transportService = new TransportService();
