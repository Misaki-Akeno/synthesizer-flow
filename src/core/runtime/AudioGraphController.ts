import { emptyAudioGraphDocument } from '@/core/graph/document';
import {
  getAudioConnectionKey,
  reconcileAudioGraph,
} from '@/core/graph/reconciler';
import type { AudioGraphDocument, GraphCommitResult } from '@/core/graph/types';
import { audioGraphRuntime, type AudioGraphRuntime } from './AudioGraphRuntime';

/**
 * 声明图与命令式音频运行时之间的提交边界。
 */
export class AudioGraphController {
  private document: AudioGraphDocument = emptyAudioGraphDocument();

  constructor(private readonly runtime: AudioGraphRuntime) {}

  getDocument(): AudioGraphDocument {
    return this.document;
  }

  commit(nextDocument: AudioGraphDocument): GraphCommitResult {
    const patches = reconcileAudioGraph(this.document, nextDocument);
    const runtimeResult = this.runtime.applyPatches(patches);
    const failedKeys = new Set(
      runtimeResult.failedConnections.map(getAudioConnectionKey)
    );
    const appliedDocument = failedKeys.size
      ? {
          ...nextDocument,
          connections: nextDocument.connections.filter(
            (connection) => !failedKeys.has(getAudioConnectionKey(connection))
          ),
        }
      : nextDocument;

    this.document = appliedDocument;
    return {
      ...runtimeResult,
      document: appliedDocument,
    };
  }

  /**
   * 仅在运行时已经与文档一致时更新基线，例如新模块创建后补齐默认参数。
   */
  adoptDocument(document: AudioGraphDocument): void {
    this.document = document;
  }

  reset(): void {
    this.runtime.dispose();
    this.document = emptyAudioGraphDocument();
  }
}

export const audioGraphController = new AudioGraphController(audioGraphRuntime);
