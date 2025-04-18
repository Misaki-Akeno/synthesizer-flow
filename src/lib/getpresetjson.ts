//这是一个临时方法，暂时存储预设项目

import { SerializedCanvas } from '../core/types/SerializationTypes';

// 预设序列化数据
const presets: SerializedCanvas[] = [
    {"version":"1.0","timestamp":1744964783560,"nodes":[{"id":"mainOscillator","position":{"x":300,"y":200},"data":{"type":"simpleoscillator","label":"主振荡器(C4)","parameters":{"gain":1,"freq":523,"waveform":"sine","freqModDepth":2,"gainModDepth":0.5}}},{"id":"reverbEffect","position":{"x":600,"y":200},"data":{"type":"reverb","label":"混响效果器","parameters":{"decay":2.5,"wet":0.8,"preDelay":0.01}}},{"id":"mainSpeaker","position":{"x":900,"y":200},"data":{"type":"speaker","label":"扬声器","parameters":{"level":-12}}},{"id":"modulationLFO","position":{"x":0,"y":200},"data":{"type":"lfo","label":"低频调制器","parameters":{"rate":1,"depth":0.5,"waveform":"sine"}}},{"id":"thirdHarmonicOsc","position":{"x":300,"y":550},"data":{"type":"simpleoscillator","label":"三度音(E4)","parameters":{"gain":1,"freq":659,"waveform":"sine","freqModDepth":2,"gainModDepth":0.5}}},{"id":"fifthHarmonicOsc","position":{"x":300,"y":900},"data":{"type":"simpleoscillator","label":"五度音(G4)","parameters":{"gain":1,"freq":784,"waveform":"sine","freqModDepth":2,"gainModDepth":0.5}}},{"id":"bassOscillator","position":{"x":300,"y":1250},"data":{"type":"simpleoscillator","label":"低八度(C3)","parameters":{"gain":1,"freq":262,"waveform":"sine","freqModDepth":2,"gainModDepth":0.5}}}],"edges":[{"source":"mainOscillator","target":"reverbEffect","sourceHandle":"audioout","targetHandle":"input"},{"source":"reverbEffect","target":"mainSpeaker","sourceHandle":"output","targetHandle":"audioIn"},{"source":"modulationLFO","target":"mainOscillator","sourceHandle":"signal","targetHandle":"freqMod"},{"source":"modulationLFO","target":"thirdHarmonicOsc","sourceHandle":"signal","targetHandle":"freqMod"},{"source":"thirdHarmonicOsc","target":"reverbEffect","sourceHandle":"audioout","targetHandle":"input"},{"source":"modulationLFO","target":"fifthHarmonicOsc","sourceHandle":"signal","targetHandle":"freqMod"},{"source":"fifthHarmonicOsc","target":"reverbEffect","sourceHandle":"audioout","targetHandle":"input"},{"source":"modulationLFO","target":"bassOscillator","sourceHandle":"signal","targetHandle":"freqMod"},{"source":"bassOscillator","target":"reverbEffect","sourceHandle":"audioout","targetHandle":"input"}]},
    {"version":"1.0","timestamp":1744964800320,"nodes":[{"id":"midiInput","position":{"x":200,"y":200},"data":{"type":"midiinput","label":"MIDI控制器输入","parameters":{"channel":0,"inputDevice":"","transpose":0,"velocitySensitivity":1}}},{"id":"polyOsc","position":{"x":500,"y":200},"data":{"type":"advancedoscillator","label":"复音振荡器","parameters":{"detune":0,"octave":0,"semi":0,"gainDb":0,"waveform":"sine","voiceCount":8,"attackVelSens":0.8,"attack":0.2,"decay":0.5,"sustain":0.7,"sustainTime":0,"release":0.8}}},{"id":"reverbEffect","position":{"x":800,"y":200},"data":{"type":"reverb","label":"混响效果器","parameters":{"decay":1.8,"wet":0.35,"preDelay":0.01}}},{"id":"speaker","position":{"x":1100,"y":200},"data":{"type":"speaker","label":"扬声器","parameters":{"level":-12}}}],"edges":[{"source":"midiInput","target":"polyOsc","sourceHandle":"activeNotes","targetHandle":"notes"},{"source":"midiInput","target":"polyOsc","sourceHandle":"activeVelocities","targetHandle":"velocities"},{"source":"polyOsc","target":"reverbEffect","sourceHandle":"audioout","targetHandle":"input"},{"source":"reverbEffect","target":"speaker","sourceHandle":"output","targetHandle":"audioIn"}]}
];

/**
 * 根据索引获取特定预设
 * @param index 预设索引
 * @returns 预设数据或null
 */
export function getPresetByIndex(index: number): SerializedCanvas | null {
  if (index >= 0 && index < presets.length) {
    return presets[index];
  }
  return null;
}

/**
 * 获取所有预设
 * @returns 所有预设数据
 */
export function getAllPresets(): SerializedCanvas[] {
  return presets;
}

/**
 * 获取指定ID的内置预设
 * @param id 预设ID (例如: 'builtin-preset-0')
 * @returns 预设数据或null
 */
export function getPresetById(id: string): SerializedCanvas | null {
  const indexMatch = id.match(/builtin-preset-(\d+)/);
  if (indexMatch) {
    const index = parseInt(indexMatch[1]);
    return getPresetByIndex(index);
  }
  return null;
}

/**
 * 按名称获取预设
 * @param name 预设名称
 * @returns 预设数据或null
 */
export function getPresetByName(name: string): SerializedCanvas | null {
  return presets.find(preset => {
    const firstNode = preset.nodes[0];
    return firstNode?.data?.label === name;
  }) || null;
}