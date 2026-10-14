import type { ClientOperation } from '@/agent/core/types';

export interface CanvasResponseBinding {
  projectId: string;
  revision: number;
}

export function isCanvasResponseCurrent(
  expected: CanvasResponseBinding,
  current: CanvasResponseBinding
): boolean {
  return (
    expected.projectId === current.projectId &&
    expected.revision === current.revision
  );
}

export interface ClientOperationBatchAdapter {
  begin(): void;
  commit(): void;
  cancel(): void;
  hasNode(id: string): boolean;
  getNodeType(id: string): string | undefined;
  add(operation: Extract<ClientOperation, { type: 'ADD_MODULE' }>): void;
  delete(operation: Extract<ClientOperation, { type: 'DELETE_MODULE' }>): void;
  update(
    operation: Extract<ClientOperation, { type: 'UPDATE_MODULE_PARAM' }>
  ): void;
  readParameter(id: string, key: string): unknown;
  hasConnection(
    operation: Extract<
      ClientOperation,
      { type: 'CONNECT_MODULES' | 'DISCONNECT_MODULES' }
    >
  ): boolean;
  connect(
    operation: Extract<ClientOperation, { type: 'CONNECT_MODULES' }>
  ): void;
  disconnect(
    operation: Extract<ClientOperation, { type: 'DISCONNECT_MODULES' }>
  ): void;
}

/**
 * 将一个 Agent operation 批次视为一个用户可撤销动作。每一步都验证运行时
 * 结果；任何失败都回滚到批次开始前的画布快照。
 */
export function applyClientOperationsAtomically(
  operations: ClientOperation[],
  adapter: ClientOperationBatchAdapter
): void {
  if (operations.length === 0) return;

  adapter.begin();
  try {
    operations.forEach((operation) => {
      switch (operation.type) {
        case 'ADD_MODULE':
          if (adapter.hasNode(operation.data.id)) {
            if (
              adapter.getNodeType(operation.data.id) !== operation.data.type
            ) {
              throw new Error(`模块 ID 冲突: ${operation.data.id}`);
            }
            return;
          }
          adapter.add(operation);
          if (!adapter.hasNode(operation.data.id)) {
            throw new Error(`未能添加模块: ${operation.data.id}`);
          }
          return;
        case 'DELETE_MODULE':
          if (!adapter.hasNode(operation.data.id)) return;
          adapter.delete(operation);
          if (adapter.hasNode(operation.data.id)) {
            throw new Error(`未能删除模块: ${operation.data.id}`);
          }
          return;
        case 'UPDATE_MODULE_PARAM':
          if (!adapter.hasNode(operation.data.id)) {
            throw new Error(`模块不存在: ${operation.data.id}`);
          }
          adapter.update(operation);
          if (
            adapter.readParameter(operation.data.id, operation.data.key) !==
            operation.data.value
          ) {
            throw new Error(
              `未能更新参数: ${operation.data.id}.${operation.data.key}`
            );
          }
          return;
        case 'CONNECT_MODULES':
          if (adapter.hasConnection(operation)) return;
          adapter.connect(operation);
          if (!adapter.hasConnection(operation)) {
            throw new Error(
              `未能创建连接: ${operation.data.source} -> ${operation.data.target}`
            );
          }
          return;
        case 'DISCONNECT_MODULES':
          if (!adapter.hasConnection(operation)) return;
          adapter.disconnect(operation);
          if (adapter.hasConnection(operation)) {
            throw new Error(
              `未能断开连接: ${operation.data.source} -> ${operation.data.target}`
            );
          }
          return;
        case 'ERROR':
          throw new Error(operation.data.message);
      }
    });
    adapter.commit();
  } catch (error) {
    adapter.cancel();
    throw error;
  }
}
