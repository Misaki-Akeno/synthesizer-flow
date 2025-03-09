import { create } from 'zustand';

/**
 * 调制系统状态管理
 */
const useModulationStore = create((set, get) => ({
  // 调制连接映射 {connectionId: connectionData}
  connections: {},

  // 调制值缓存 {nodeId:paramKey: value}
  modulationValues: {},

  // 是否处于活动状态
  isActive: false,

  // 初始化调制系统
  initialize: () => {
    const { startModulationTimer } = get();
    set({ isActive: true });
    startModulationTimer();
  },

  // 清理资源
  cleanup: () => {
    const { stopModulationTimer } = get();
    stopModulationTimer();
    set({ isActive: false });
  },

  // 启动调制更新定时器
  startModulationTimer: () => {
    if (get().updateInterval) clearInterval(get().updateInterval);

    const updateInterval = setInterval(() => {
      const { updateModulationValues } = get();
      updateModulationValues();
    }, 100); // 100ms 更新一次

    set({ updateInterval });
  },

  // 停止调制更新定时器
  stopModulationTimer: () => {
    if (get().updateInterval) {
      clearInterval(get().updateInterval);
      set({ updateInterval: null });
    }
  },

  // 添加调制连接
  addConnection: (connectionId, connectionData) => {
    set((state) => ({
      connections: {
        ...state.connections,
        [connectionId]: connectionData,
      },
    }));
  },

  // 移除调制连接
  removeConnection: (connectionId) => {
    set((state) => {
      const newConnections = { ...state.connections };
      delete newConnections[connectionId];
      return { connections: newConnections };
    });
  },

  // 更新调制连接的调制范围
  updateConnectionRange: (targetParam, range) => {
    set((state) => {
      const connections = { ...state.connections };

      // 找到针对这个参数的所有连接
      Object.keys(connections).forEach((id) => {
        const connection = connections[id];
        const connectionTarget = `${connection.target}:${connection.paramKey}`;

        if (connectionTarget === targetParam) {
          connections[id] = {
            ...connection,
            range: range,
          };
        }
      });

      return { connections };
    });
  },

  // 更新调制连接深度
  updateConnectionDepth: (connectionId, depth) => {
    set((state) => ({
      connections: {
        ...state.connections,
        [connectionId]: {
          ...state.connections[connectionId],
          depth,
        },
      },
    }));
  },

  // 更新所有调制值
  updateModulationValues: () => {
    const { connections } = get();

    // 使用当前时间计算模拟调制信号
    const currentTime = Date.now() / 10000;
    const modulationValues = {};

    // 为每个调制连接计算调制值
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Object.entries(connections).forEach(([connectionId, connection]) => {
      const { target, paramKey, depth = 1.0, bipolar = true } = connection;

      // 在真实系统中，这里应该是从调制源获取调制信号值
      // 目前使用简单的正弦波模拟
      const modulationSignal = Math.sin(currentTime * 2 * Math.PI);

      // 计算调制值 (范围 -1 到 1 或 0 到 1)
      const modulationValue = bipolar
        ? modulationSignal * depth
        : (modulationSignal * 0.5 + 0.5) * depth;

      // 存储调制值
      const valueKey = `${target}:${paramKey}`;
      modulationValues[valueKey] = modulationValue;
    });

    set({ modulationValues });
  },

  // 获取特定节点参数的调制值
  getModulationValue: (nodeId, paramKey) => {
    const key = `${nodeId}:${paramKey}`;
    return get().modulationValues[key] || null;
  },

  // 应用调制值到节点
  applyModulationToNodes: (nodes) => {
    const { getModulationValue } = get();

    return nodes.map((node) => {
      const { id, data } = node;
      const { parameters } = data;

      // 检查每个参数是否有调制
      const updatedParams = {};
      let hasUpdates = false;

      Object.entries(parameters).forEach(([key, param]) => {
        if (param.isModulated) {
          const modulationValue = getModulationValue(id, key);

          // 如果存在调制值
          if (modulationValue !== null) {
            const minMod = param.modRange ? param.modRange[0] : param.min;
            const maxMod = param.modRange ? param.modRange[1] : param.max;
            const modValue =
              minMod + (maxMod - minMod) * (modulationValue * 0.5 + 0.5);
            const mmodValue = Math.min(
              param.max,
              Math.max(param.min, modValue)
            );
            // 更新参数
            updatedParams[key] = {
              ...param,
              displayValue: mmodValue.toFixed(2),
            };

            hasUpdates = true;
          }
        }
      });

      // 如果有参数更新，返回更新的节点
      if (hasUpdates) {
        return {
          ...node,
          data: {
            ...data,
            parameters: {
              ...parameters,
              ...updatedParams,
            },
          },
        };
      }

      return node;
    });
  },
}));

export default useModulationStore;
