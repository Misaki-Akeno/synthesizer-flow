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

  // 跟踪连接状态
  private connectionTracking = new Map<
    string,
    {
      uiConnectionId: string;
      systemConnectionId: string;
      lastBrokenTime: number;
    }
  >();

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

    // 监听连接建立事件
    eventBus.on(
      'CONNECTION.ESTABLISHED',
      this.handleConnectionEstablished.bind(this)
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
   * 处理连接建立事件
   */
  private handleConnectionEstablished(event: {
    connectionId: string;
    sourceId: string;
    targetId: string;
    sourceHandle?: string;
    targetHandle?: string;
  }): void {
    const { connectionId, sourceId, targetId, sourceHandle, targetHandle } =
      event;

    // 创建唯一的连接跟踪键
    const connectionKey = `${sourceId}:${sourceHandle || 'default'}->${targetId}:${targetHandle || 'default'}`;

    // 从断开连接集合中移除，因为现在已经建立了新连接
    this.brokenConnections.delete(connectionKey);

    // 记录此连接的信息
    this.connectionTracking.set(connectionKey, {
      uiConnectionId: '', // 将在UI.CONNECTION.CREATED事件中更新
      systemConnectionId: connectionId,
      lastBrokenTime: 0,
    });

    // 调试日志
    console.debug(`连接已建立: ${connectionKey}, 系统连接ID: ${connectionId}`);
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
    const { connectionId, sourceId, targetId, sourceHandle, targetHandle } =
      event;

    // 创建唯一的连接跟踪键
    const connectionKey = `${sourceId}:${sourceHandle || 'default'}->${targetId}:${targetHandle || 'default'}`;

    // 检查当前的物理连接状态
    const connectionInfo = this.connectionTracking.get(connectionKey);
    const currentTime = Date.now();

    // 如果此连接在短时间内已经断开过，并且尝试断开的是UI连接而非系统连接，则跳过
    if (
      connectionInfo &&
      connectionInfo.uiConnectionId === connectionId &&
      connectionInfo.uiConnectionId !== connectionInfo.systemConnectionId &&
      currentTime - connectionInfo.lastBrokenTime < 5000
    ) {
      console.debug(`UI连接 ${connectionId} 已被处理，跳过重复处理`);
      return;
    }

    try {
      // 获取模块实例
      const sourceModule = useModulesStore.getState().getModule(sourceId);
      const targetModule = useModulesStore.getState().getModule(targetId);

      if (sourceModule && targetModule) {
        // 断开音频连接
        try {
          sourceModule.disconnect(targetModule, sourceHandle, targetHandle);
          console.debug(`成功断开连接: ${connectionKey}`);
        } catch (disconnectError) {
          // 如果是InvalidAccessError，说明连接可能已经断开，我们可以忽略此错误
          if (
            disconnectError instanceof Error &&
            disconnectError.name === 'InvalidAccessError'
          ) {
            console.debug(`连接可能已经断开: ${sourceId} -> ${targetId}`);
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

      // 更新连接跟踪信息
      if (connectionInfo) {
        connectionInfo.lastBrokenTime = currentTime;
        if (connectionId.startsWith('edge-')) {
          connectionInfo.uiConnectionId = connectionId;
        }
        this.connectionTracking.set(connectionKey, connectionInfo);
      } else {
        this.connectionTracking.set(connectionKey, {
          uiConnectionId: connectionId.startsWith('edge-') ? connectionId : '',
          systemConnectionId: connectionId.startsWith('edge-')
            ? ''
            : connectionId,
          lastBrokenTime: currentTime,
        });
      }

      // 暂时将连接添加到broken集合
      this.brokenConnections.add(connectionKey);

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

  /**
   * 更新UI连接ID
   */
  updateUIConnectionId(
    sourceId: string,
    targetId: string,
    uiConnectionId: string,
    sourceHandle?: string,
    targetHandle?: string
  ): void {
    const connectionKey = `${sourceId}:${sourceHandle || 'default'}->${targetId}:${targetHandle || 'default'}`;
    const connectionInfo = this.connectionTracking.get(connectionKey);

    if (connectionInfo) {
      connectionInfo.uiConnectionId = uiConnectionId;
      this.connectionTracking.set(connectionKey, connectionInfo);
    } else {
      this.connectionTracking.set(connectionKey, {
        uiConnectionId,
        systemConnectionId: '',
        lastBrokenTime: 0,
      });
    }
  }
}
