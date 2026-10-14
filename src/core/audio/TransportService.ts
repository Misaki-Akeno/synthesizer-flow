import { TRANSPORT_PPQ } from '@/core/transport/types';

interface ToneTransportLike {
  state: string;
  start: () => void;
  pause?: () => void;
  stop: () => void;
  position?: number | string;
  ticks?: number;
  bpm?: { value: number };
  PPQ?: number;
  loop?: boolean;
  loopStart?: number | string;
  loopEnd?: number | string;
  getTicksAtTime?: (time: number) => number;
}

interface ToneLike {
  Transport: ToneTransportLike;
  immediate?: () => number;
  getContext?: () => ToneContextLike;
  context?: ToneContextLike;
}

interface ToneContextLike {
  rawContext?: { outputLatency?: number; baseLatency?: number };
}

interface LoopConfig {
  enabled: boolean;
  startTicks: number;
  endTicks: number;
}

/** 输出延迟异常大时（部分蓝牙设备）只补偿到这个上限，避免播放头明显落后。 */
const MAX_OUTPUT_LATENCY_SECONDS = 0.5;

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
  private paused = false;
  private bpm: number | null = null;
  private loopConfig: LoopConfig = { enabled: false, startTicks: 0, endTicks: 0 };

  public start(clientId: string, tone: ToneLike): void {
    this.tone = tone;
    this.activeClients.add(clientId);
    this.applyLoop();
    if (this.paused) return;
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
    this.paused = false;
    this.tone = null;
  }

  /** 暂停全局时钟但保留活动片段和当前位置。 */
  public pause(): void {
    if (!this.tone || this.activeClients.size === 0) return;
    this.paused = true;
    if (this.tone.Transport.state === 'started') {
      this.tone.Transport.pause?.();
    }
  }

  /** 从暂停位置恢复全局时钟。 */
  public resume(): void {
    this.paused = false;
    if (!this.tone || this.activeClients.size === 0) return;
    if (this.tone.Transport.state !== 'started') {
      this.tone.Transport.start();
    }
  }

  public seekTicks(ticks: number): void {
    if (!this.tone || !('ticks' in this.tone.Transport)) return;
    this.tone.Transport.ticks =
      (Math.max(0, ticks) * this.getTonePpq()) / TRANSPORT_PPQ;
  }

  /**
   * 记录项目 BPM。停止状态下也要保存：Transport 由片段启动时才可用，
   * 若只在运行中同步，Tone 会沿用旧速度，播放头随之按旧 BPM 前进。
   */
  public setBpm(bpm: number): void {
    if (!Number.isFinite(bpm) || bpm <= 0) return;
    this.bpm = bpm;
    if (this.tone) this.syncTempo(this.tone);
  }

  /**
   * 在创建 Tone.Part 之前调用。Part 按创建时的 Transport BPM 把秒换算成
   * tick，速度不一致会让声音和播放头各走各的。
   */
  public syncTempo(tone: ToneLike): void {
    if (this.bpm !== null && tone.Transport.bpm) {
      tone.Transport.bpm.value = this.bpm;
    }
  }

  /**
   * 使用 Tone Transport 自身的循环。循环点由音频时钟精确处理，循环起点上的
   * 事件（如折回 tick 0 的 note-off）不会因为界面帧晚于调度而被跳过。
   */
  public setLoop(enabled: boolean, startTicks: number, endTicks: number): void {
    this.loopConfig = {
      enabled: enabled && endTicks > startTicks,
      startTicks: Math.max(0, startTicks),
      endTicks: Math.max(0, endTicks),
    };
    this.applyLoop();
  }

  /**
   * 仅在 Tone Transport 已被片段激活时返回权威播放位置。
   * Transport.ticks 按包含预调度时间的 now() 计算，会比实际听到的声音提前；
   * 这里换算到当前音频时间并扣除输出延迟，让播放头与发声对齐。
   */
  public getPositionTicks(): number | undefined {
    const transport = this.tone?.Transport;
    if (!transport) return undefined;
    const audibleTime = this.getAudibleTime();
    const ticks =
      audibleTime !== undefined && transport.getTicksAtTime
        ? transport.getTicksAtTime(audibleTime)
        : transport.ticks;
    return Number.isFinite(ticks)
      ? ((ticks as number) * TRANSPORT_PPQ) / this.getTonePpq()
      : undefined;
  }

  private getAudibleTime(): number | undefined {
    const now = this.tone?.immediate?.();
    if (now === undefined || !Number.isFinite(now)) return undefined;
    const raw = (this.tone?.getContext?.() ?? this.tone?.context)?.rawContext;
    const latency = Math.min(
      MAX_OUTPUT_LATENCY_SECONDS,
      Math.max(0, (raw?.outputLatency ?? 0) + (raw?.baseLatency ?? 0))
    );
    return Math.max(0, now - latency);
  }

  private applyLoop(): void {
    const transport = this.tone?.Transport;
    if (!transport || !('loop' in transport)) return;
    const { enabled, startTicks, endTicks } = this.loopConfig;
    if (enabled) {
      const ppq = this.getTonePpq();
      // Tone 的 tick 记法："<n>i"
      transport.loopStart = `${Math.round((startTicks * ppq) / TRANSPORT_PPQ)}i`;
      transport.loopEnd = `${Math.round((endTicks * ppq) / TRANSPORT_PPQ)}i`;
    }
    transport.loop = enabled;
  }

  public getActiveClientCount(): number {
    return this.activeClients.size;
  }

  public reset(): void {
    this.activeClients.clear();
    this.bpm = null;
    this.paused = false;
    this.tone = null;
  }

  private getTonePpq(): number {
    const ppq = this.tone?.Transport.PPQ;
    return typeof ppq === 'number' && Number.isFinite(ppq) && ppq > 0
      ? ppq
      : TRANSPORT_PPQ;
  }
}

export const transportService = new TransportService();
