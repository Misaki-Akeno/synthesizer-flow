'use client';

import type { Edge } from '@xyflow/react';
import type { FlowNode, RuntimeModuleSnapshot } from '@/core/graph/types';
import type {
  SerializedCanvas,
  SerializedEdge,
  SerializedModule,
  SerializedNode,
} from '@/core/types/SerializationTypes';
import {
  validateAndParseJson,
  validateSerializedCanvas,
  validateSerializedModule,
} from '@/core/types/SerializationValidator';
import { moduleClassMap } from '@/core/modules';
import { legacyStepsToMidiClip, normalizeMidiClip } from '@/core/midi/utils';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('SerializationManager');

function migrateModuleParameters(
  moduleType: string,
  parameters: Record<string, unknown>
): Record<string, number | boolean | string> {
  if (moduleType.toLowerCase() !== 'sequencer') {
    return parameters as Record<string, number | boolean | string>;
  }

  const migrated = { ...parameters };
  if (
    typeof migrated.clip !== 'string' &&
    typeof migrated.sequence === 'string'
  ) {
    try {
      const legacySteps = JSON.parse(migrated.sequence);
      if (Array.isArray(legacySteps)) {
        migrated.clip = JSON.stringify(legacyStepsToMidiClip(legacySteps));
      }
    } catch {
      migrated.clip = JSON.stringify(normalizeMidiClip(undefined));
    }
  }

  delete migrated.sequence;
  return migrated as Record<string, number | boolean | string>;
}

/**
 * 纯数据序列化器。禁止在这里创建、读取或销毁音频运行时实例。
 */
export class SerializationManager {
  serializeModule(
    node: FlowNode,
    snapshot?: RuntimeModuleSnapshot
  ): SerializedModule {
    return {
      moduleType: node.data.type,
      id: node.id,
      name: node.data.label,
      parameters: { ...node.data.parameters },
      inputPortTypes: snapshot ? { ...snapshot.inputPortTypes } : {},
      outputPortTypes: snapshot ? { ...snapshot.outputPortTypes } : {},
      customUI: snapshot?.customUI
        ? {
            type: snapshot.customUI.type,
            props: { ...snapshot.customUI.props },
          }
        : undefined,
      enabled: node.data.enabled,
    };
  }

  serializeModuleToJson(
    node: FlowNode,
    snapshot?: RuntimeModuleSnapshot
  ): string {
    return JSON.stringify(this.serializeModule(node, snapshot));
  }

  deserializeModule(data: SerializedModule): FlowNode | null {
    const validationResult = validateSerializedModule(data);
    if (!validationResult.success) {
      logger.error('模块数据验证失败，无法反序列化', validationResult.error);
      return null;
    }

    if (!moduleClassMap[data.moduleType.toLowerCase()]) {
      logger.error('未知模块类型，无法反序列化', {
        type: data.moduleType,
      });
      return null;
    }

    return {
      id: data.id,
      type: 'default',
      position: { x: 100, y: 100 },
      dragHandle: '.node-drag-handle',
      data: {
        type: data.moduleType,
        label: data.name,
        parameters: migrateModuleParameters(data.moduleType, data.parameters),
        enabled: data.enabled ?? true,
      },
    };
  }

  deserializeModuleFromJson(jsonString: string): FlowNode | null {
    const result = validateAndParseJson<SerializedModule>(
      jsonString,
      validateSerializedModule
    );
    return result.success && result.data
      ? this.deserializeModule(result.data)
      : null;
  }

  serializeCanvas(
    nodes: FlowNode[],
    edges: Edge[],
    metadata?: Record<string, unknown>
  ): SerializedCanvas {
    const serializedNodes: SerializedNode[] = nodes.map((node) => ({
      id: node.id,
      position: { x: node.position.x, y: node.position.y },
      data: {
        type: node.data.type,
        label: node.data.label,
        parameters: { ...node.data.parameters },
        enabled: node.data.enabled,
      },
    }));
    const serializedEdges: SerializedEdge[] = edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || undefined,
      targetHandle: edge.targetHandle || undefined,
    }));

    return {
      version: '2.0',
      timestamp: Date.now(),
      nodes: serializedNodes,
      edges: serializedEdges,
      metadata,
    };
  }

  serializeCanvasToJson(
    nodes: FlowNode[],
    edges: Edge[],
    metadata?: Record<string, unknown>
  ): string {
    return JSON.stringify(this.serializeCanvas(nodes, edges, metadata));
  }

  deserializeCanvas(canvasData: SerializedCanvas): {
    nodes: FlowNode[];
    edges: Edge[];
  } {
    const validationResult = validateSerializedCanvas(canvasData);
    if (!validationResult.success) {
      logger.error('画布数据验证失败，无法反序列化', validationResult.error);
      return { nodes: [], edges: [] };
    }

    const nodes: FlowNode[] = canvasData.nodes.map((node) => ({
      id: node.id,
      type: 'default',
      position: { ...node.position },
      dragHandle: '.node-drag-handle',
      data: {
        type: node.data.type,
        label: node.data.label || node.id,
        parameters: migrateModuleParameters(
          node.data.type,
          node.data.parameters ?? {}
        ),
        enabled:
          typeof node.data.enabled === 'boolean' ? node.data.enabled : true,
      },
    }));
    const edges: Edge[] = canvasData.edges.map((edge) => ({
      id: this.generateEdgeId(
        edge.source,
        edge.target,
        edge.sourceHandle,
        edge.targetHandle
      ),
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    }));

    return { nodes, edges };
  }

  deserializeCanvasFromJson(jsonString: string): {
    nodes: FlowNode[];
    edges: Edge[];
  } {
    const result = validateAndParseJson<SerializedCanvas>(
      jsonString,
      validateSerializedCanvas
    );
    return result.success && result.data
      ? this.deserializeCanvas(result.data)
      : { nodes: [], edges: [] };
  }

  private generateEdgeId(
    source: string,
    target: string,
    sourceHandle?: string,
    targetHandle?: string
  ): string {
    const sourceKey = sourceHandle ? `${source}-${sourceHandle}` : source;
    const targetKey = targetHandle ? `${target}-${targetHandle}` : target;
    return `edge_${sourceKey}_to_${targetKey}`;
  }
}

export const serializationManager = new SerializationManager();
