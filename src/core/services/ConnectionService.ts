import { eventBus } from '../events/EventBus';
import { useModulesStore } from '../store/useModulesStore';
import { nanoid } from 'nanoid';
import { container } from '../di/Container';

/**
 * 连接服务
 * 负责处理模块之间的连接相关功能
 */
export class ConnectionService {
  constructor() {
    // 将自身注册到容器
    container.register('connectionService', this);
  }

  /**
   * 初始化连接服务
   */
  async initialize(): Promise<void> {
    // 监听连接请求
    eventBus.on(
      'CONNECTION.REQUESTED',
      this.handleConnectionRequest.bind(this)
    );
  }

  /**
   * 处理连接请求
   */
  private handleConnectionRequest(event: {
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
  }): void {
    const { source, target, sourceHandle, targetHandle } = event;

    try {
      // 获取模块实例
      const sourceModule = useModulesStore.getState().getModule(source);
      const targetModule = useModulesStore.getState().getModule(target);

      if (!sourceModule || !targetModule) {
        throw new Error('Source or target module not found');
      }

      // 建立连接
      sourceModule.connect(targetModule, sourceHandle, targetHandle);

      // 生成连接ID
      const connectionId = nanoid();

      // 将连接添加到存储中
      useModulesStore.getState().addConnection({
        id: connectionId,
        sourceId: source,
        targetId: target,
        sourceHandle,
        targetHandle,
      });

      // 发出连接建立事件
      eventBus.emit('CONNECTION.ESTABLISHED', {
        connectionId,
        sourceId: source,
        targetId: target,
        sourceHandle,
        targetHandle,
      });
    } catch (error) {
      console.error('Failed to establish connection:', error);

      // 发出连接失败事件
      eventBus.emit('SYSTEM.ERROR', {
        message: '连接模块失败',
        error: {
          code: 'CONNECTION_ERROR',
          message: `Failed to connect modules: ${(error as Error).message}`,
        },
      });
    }
  }

  /**
   * 创建两个模块之间的连接
   */
  createConnection(
    sourceId: string,
    targetId: string,
    sourceHandle?: string,
    targetHandle?: string
  ): void {
    eventBus.emit('CONNECTION.REQUESTED', {
      source: sourceId,
      target: targetId,
      sourceHandle,
      targetHandle,
    });
  }

  /**
   * 删除连接
   */
  removeConnection(connectionId: string): void {
    const connection = useModulesStore
      .getState()
      .getAllConnections()
      .find((conn) => conn.id === connectionId);

    if (!connection) {
      console.warn(`Connection ${connectionId} not found`);
      return;
    }

    try {
      const { sourceId, targetId, sourceHandle, targetHandle } = connection;
      const sourceModule = useModulesStore.getState().getModule(sourceId);

      if (sourceModule) {
        sourceModule.disconnect(
          useModulesStore.getState().getModule(targetId),
          sourceHandle,
          targetHandle
        );
      }

      // 从存储中移除连接
      useModulesStore.getState().removeConnection(connectionId);

      // 发出连接断开事件
      eventBus.emit('CONNECTION.BROKEN', {
        connectionId,
        sourceId,
        targetId,
        sourceHandle,
        targetHandle,
      });
    } catch (error) {
      console.error('Failed to remove connection:', error);
    }
  }
}
