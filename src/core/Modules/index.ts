import { SimpleOscillatorModule } from './OscillatorModule';
import { AdvancedOscillatorModule } from './AdvancedOscillatorModule';
import { LFOModule } from './LFOModule';
import { MIDIInputModule } from './MIDIInputModule';
import { KeyboardInputModule } from './KeyboardInputModule';
import { ReverbModule } from './ReverbModule';
import { SpeakerModule } from './SpeakerModule';
import { ModuleBase, ModuleMetadata } from '../ModuleBase';

// 导出所有模块类
export {
  SimpleOscillatorModule,
  AdvancedOscillatorModule,
  LFOModule,
  MIDIInputModule,
  KeyboardInputModule,
  ReverbModule,
  SpeakerModule,
};

// 定义一个映射表，将模块类型名与对应的模块类关联
export const moduleClassMap: Record<
  string,
  { new (...args: string[]): ModuleBase } & { metadata: ModuleMetadata }
> = {
  simpleoscillator: SimpleOscillatorModule,
  advancedoscillator: AdvancedOscillatorModule,
  lfo: LFOModule,
  midiinput: MIDIInputModule,
  keyboardinput: KeyboardInputModule,
  reverb: ReverbModule,
  speaker: SpeakerModule,
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
