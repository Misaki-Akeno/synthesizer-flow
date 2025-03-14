import { eventBus } from '../events/EventBus';
import { useModulesStore } from '../store/useModulesStore';
import { nanoid } from 'nanoid';
import { container } from '../di/Container';

/**
 * 连接服务
 * 负责处理模块之间的连接相关功能
 */
export class ConnectionService {
  // 跟踪已断开的连接，避免重复断开
  private brokenConnections = new Set<string>();

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

    // 监听连接断开事件
    eventBus.on('CONNECTION.BROKEN', this.handleConnectionBroken.bind(this));
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

      // 发出连接建立事件 - ConnectionService应该是事件的唯一源
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
   * 处理连接断开事件
   */
  private handleConnectionBroken(event: {
    connectionId: string;
    sourceId: string;
    targetId: string;
    sourceHandle?: string;
    targetHandle?: string;
  }): void {
    const { sourceId, targetId, sourceHandle, targetHandle } = event;

    // 创建唯一的连接跟踪键
    const connectionKey = `${sourceId}:${sourceHandle || 'default'}->${targetId}:${targetHandle || 'default'}`;

    // 如果这个连接已经断开过，不重复处理
    if (this.brokenConnections.has(connectionKey)) {
      console.log(`跳过重复断开的连接: ${connectionKey}`);
      return;
    }

    try {
      // 标记此连接已断开
      this.brokenConnections.add(connectionKey);

      // 获取模块实例
      const sourceModule = useModulesStore.getState().getModule(sourceId);
      const targetModule = useModulesStore.getState().getModule(targetId);

      if (sourceModule && targetModule) {
        // 断开音频连接
        try {
          sourceModule.disconnect(targetModule, sourceHandle, targetHandle);
        } catch (disconnectError) {
          // 如果是InvalidAccessError，说明连接可能已经断开，我们可以忽略此错误
          if (
            disconnectError instanceof Error &&
            disconnectError.name === 'InvalidAccessError'
          ) {
            console.log(`连接可能已经断开: ${sourceId} -> ${targetId}`);
          } else {
            // 重新抛出其他错误
            throw disconnectError;
          }
        }
      } else {
        console.warn(`无法找到模块进行断开连接: ${sourceId} -> ${targetId}`);
      }

      // 从存储中确保移除连接
      const storeConnection = useModulesStore
        .getState()
        .getAllConnections()
        .find(
          (conn) =>
            conn.sourceId === sourceId &&
            conn.targetId === targetId &&
            conn.sourceHandle === sourceHandle &&
            conn.targetHandle === targetHandle
        );

      if (storeConnection) {
        useModulesStore.getState().removeConnection(storeConnection.id);
      }

      // 5秒后从跟踪集合中移除此连接，以允许将来可能的重新连接
      setTimeout(() => {
        this.brokenConnections.delete(connectionKey);
      }, 5000);
    } catch (error) {
      console.error('断开连接失败:', error);
      // 即使发生错误，也从跟踪中移除，以避免卡住
      setTimeout(() => {
        this.brokenConnections.delete(connectionKey);
      }, 5000);
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
      // 从存储中移除连接
      useModulesStore.getState().removeConnection(connectionId);

      // 发出连接断开事件，这将触发 handleConnectionBroken 方法
      const { sourceId, targetId, sourceHandle, targetHandle } = connection;
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
