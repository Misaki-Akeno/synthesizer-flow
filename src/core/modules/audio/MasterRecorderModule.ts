/* eslint-disable @typescript-eslint/no-explicit-any */
import { AudioInputHandler } from '@/core/audio/AudioInputHandler';
import { encodeAudioBufferToWav } from '@/core/audio/wav';
import { AudioModuleBase } from '@/core/base/AudioModuleBase';
import {
  ModuleMetadata,
  ParameterType,
  PortType,
} from '@/core/base/ModuleBase';

export class MasterRecorderModule extends AudioModuleBase {
  public static metadata: ModuleMetadata = {
    type: 'masterrecorder',
    label: '主录音机',
    description: '录制主总线并导出 16-bit WAV，同时保持音频直通',
    category: '输出',
    iconType: 'Speaker',
  };

  private passthrough: any = null;
  private recorder: any = null;
  private recording = false;

  constructor(id: string, name = '主录音机') {
    super(
      'masterrecorder',
      id,
      name,
      {
        fileName: {
          type: ParameterType.STRING,
          value: 'synthesizer-flow-take',
          uiOptions: { label: '文件名' },
        },
      },
      { input: { type: PortType.AUDIO, value: null } },
      { output: { type: PortType.AUDIO, value: null } },
      true
    );
  }

  protected async initializeAudio(): Promise<void> {
    this.passthrough = new this.Tone.Gain(1);
    this.recorder = new this.Tone.Recorder();
    this.passthrough.connect(this.recorder);
    this.audioInputHandler = new AudioInputHandler(this.passthrough, this.Tone);
    this.outputPorts.output.next(this.passthrough);
  }

  public getCustomUI() {
    return {
      type: 'RecorderControls',
      props: {
        recording: this.recording,
        startRecording: () => this.startRecording(),
        stopAndExport: () => this.stopAndExport(),
      },
    };
  }

  private async startRecording(): Promise<void> {
    if (!this.recorder || this.recording) return;
    this.recording = true;
    try {
      await this.recorder.start();
    } catch (error) {
      this.recording = false;
      throw error;
    }
  }

  private async stopAndExport(): Promise<void> {
    if (!this.recorder || !this.recording) return;
    const recording = await this.recorder.stop();
    this.recording = false;

    const encoded = await recording.arrayBuffer();
    const rawContext = this.Tone.getContext().rawContext;
    const audioBuffer = await rawContext.decodeAudioData(encoded.slice(0));
    const wav = encodeAudioBufferToWav(audioBuffer);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const baseName = String(this.getParameterValue('fileName'))
      .trim()
      .replace(/[^a-zA-Z0-9-_\u4e00-\u9fff]+/g, '-');
    anchor.href = url;
    anchor.download = `${baseName || 'synthesizer-flow-take'}.wav`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  public dispose(): void {
    if (this.recording && this.recorder) {
      void Promise.resolve(this.recorder.stop()).catch(() => undefined);
    }
    this.recording = false;
    this.disposeAudioNodes([this.recorder, this.passthrough]);
    super.dispose();
  }
}
