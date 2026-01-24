import { SimpleOscillatorModule } from './audio/OscillatorModule';
import { AdvancedOscillatorModule } from './audio/AdvancedOscillatorModule';
import { LFOModule } from './modulation/LFOModule';
import { MIDIInputModule } from './input/MIDIInputModule';
import { KeyboardInputModule } from './input/KeyboardInputModule';
import { ReverbModule } from './audio/ReverbModule';
import { SpeakerModule } from './audio/SpeakerModule';
import { TrumpetModule } from './audio/TrumpetModule';
import { SequencerModule } from './input/SequencerModule';
import { NumberInputModule } from './logic/NumberInputModule';
import { CalculatorModule } from './logic/CalculatorModule';
import { ModuleBase, ModuleMetadata } from '../base/ModuleBase';

// 导出所有模块类
export {
  SimpleOscillatorModule,
  AdvancedOscillatorModule,
  LFOModule,
  MIDIInputModule,
  KeyboardInputModule,
  ReverbModule,
  SpeakerModule,
  TrumpetModule,
  SequencerModule,
  NumberInputModule,
  CalculatorModule,
};

// 定义一个映射表，将模块类型名与对应的模块类关联
export const moduleClassMap: Record<
  string,
  { new(...args: string[]): ModuleBase } & { metadata: ModuleMetadata }
> = {
  simpleoscillator: SimpleOscillatorModule,
  advancedoscillator: AdvancedOscillatorModule,
  lfo: LFOModule,
  midiinput: MIDIInputModule,
  keyboardinput: KeyboardInputModule,
  reverb: ReverbModule,
  speaker: SpeakerModule,
  trumpet: TrumpetModule,
  sequencer: SequencerModule,
  numberinput: NumberInputModule,
  calculator: CalculatorModule,
};

// 获取所有模块类的元数据
export const moduleMetadataMap: Record<string, ModuleMetadata> = Object.entries(
  moduleClassMap
).reduce(
  (acc, [key, moduleClass]) => {
    acc[key] = moduleClass.metadata;
    return acc;
  },
  {} as Record<string, ModuleMetadata>
);

// 根据模块类型获取元数据的辅助函数
export function getModuleMetadata(type: string): ModuleMetadata | undefined {
  return moduleMetadataMap[type.toLowerCase()];
}

// 根据模块类型获取描述的辅助函数
export function getModuleDescription(type: string): string {
  const metadata = getModuleMetadata(type.toLowerCase());
  return (
    `${metadata?.label || type} | ${metadata?.description || ''}` ||
    `${type} 模块`
  );
}
