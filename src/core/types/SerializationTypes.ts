/* eslint-disable @typescript-eslint/no-explicit-any */
import { PresetNode, PresetEdge } from '../PresetManager';

/**
 * 序列化后的模块数据
 */
export interface SerializedModule {
  moduleType: string;
  id: string;
  name: string;
  parameters: Record<string, any>;
  inputPortTypes: Record<string, string>;
  outputPortTypes: Record<string, string>;
  customUI?: {
    type: string;
    props: Record<string, unknown>;
  };
  enabled?: boolean;
}

/**
 * 序列化后的画布数据
 */
export interface SerializedCanvas {
  version: string;
  timestamp: number;
  nodes: PresetNode[];
  edges: PresetEdge[];
  metadata?: Record<string, any>;
}

/**
 * 模块序列化格式
 */
export type ModuleSerializationFormat = 'json' | 'base64';

/**
 * 压缩级别
 */
export enum CompressionLevel {
  NONE = 0,
  MEDIUM = 1,
  HIGH = 2
}