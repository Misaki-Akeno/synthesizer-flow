/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 序列化节点数据
 */
export interface SerializedNode {
  id: string;
  position: { x: number; y: number };
  data: {
    type: string;
    label?: string;
    parameters?: { [key: string]: number | boolean | string };
    [key: string]: unknown;
  };
}

/**
 * 序列化边数据
 */
export interface SerializedEdge {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

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
  nodes: SerializedNode[];
  edges: SerializedEdge[];
  metadata?: Record<string, any>;
}

/**
 * 内置预设项目接口
 */
export interface BuiltInProject {
  id: string;
  name: string;
  canvasData: SerializedCanvas;
}

