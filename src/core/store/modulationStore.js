/**
 * 调制系统状态管理
 */
const createModulationStore = (set, get) => ({
  // 状态
  modulationConnections: {}, // {connectionId: connectionData}
  modulationValues: {}, // {nodeId:paramKey: value}
  modulationUpdateInterval: null,

  // Actions
  initializeModulation: () => {
    console.log('初始化调制子系统');

    // 启动调制更新定时器
    const updateInterval = setInterval(() => {
      get().updateModulationValues();
    }, 100); // 100ms 更新一次

    set({
      modulationConnections: {},
      modulationValues: {},
      modulationUpdateInterval: updateInterval,
    });

    return true;
  },

  cleanupModulation: () => {
    // 清理调制系统资源
    if (get().modulationUpdateInterval) {
      clearInterval(get().modulationUpdateInterval);
    }

    set({
      modulationConnections: {},
      modulationValues: {},
      modulationUpdateInterval: null,
    });
  },

  // 调制连接管理
  addModulationConnection: (connectionId, connectionData) => {
    set((state) => ({
      modulationConnections: {
        ...state.modulationConnections,
        [connectionId]: connectionData,
      },
    }));
  },

  removeModulationConnection: (connectionId) => {
    set((state) => {
      const newConnections = { ...state.modulationConnections };
      delete newConnections[connectionId];

      return { modulationConnections: newConnections };
    });
  },

  updateModulationRange: (targetParam, range) => {
    set((state) => {
      const connections = { ...state.modulationConnections };

      // 找到针对这个参数的所有连接
      Object.keys(connections).forEach((id) => {
        const connection = connections[id];
        const connectionTarget = `${connection.target}:${connection.paramKey}`;

        if (connectionTarget === targetParam) {
          connections[id] = {
            ...connection,
            range,
          };
        }
      });

      return { modulationConnections: connections };
    });
  },

  // 调制值计算与应用
  updateModulationValues: () => {
    const { modulationConnections } = get();

    // 使用当前时间计算模拟调制信号
    const currentTime = Date.now() / 1000; // 更改时间缩放，让调制更明显
    const modulationValues = {};

    // 为每个调制连接计算调制值
    Object.entries(modulationConnections).forEach(
      ([connectionId, connection]) => {
        const {
          _source,
          target,
          paramKey,
          depth = 1.0,
          bipolar = true,
        } = connection;

        // 使用简单的正弦波模拟调制源
        // 给每个连接一个略微不同的频率，让效果更明显
        const uniqueFrequency = connectionId.charCodeAt(0) / 250 + 0.5;
        const modulationSignal = Math.sin(currentTime * uniqueFrequency);

        // 计算调制值 (范围 -1 到 1 或 0 到 1)
        const modulationValue = bipolar
          ? modulationSignal * depth
          : (modulationSignal * 0.5 + 0.5) * depth;

        // 存储调制值
        const valueKey = `${target}:${paramKey}`;
        modulationValues[valueKey] = modulationValue;
      }
    );

    // 更新调制值状态
    set({ modulationValues });
  },

  // 应用调制到节点
  applyModulationToNodes: (nodes) => {
    const { modulationValues } = get();
    let hasAnyUpdates = false;

    // 处理每个节点
    const updatedNodes = nodes.map((node) => {
      const { id, data } = node;
      if (!data || !data.parameters) return node;

      const { parameters } = data;

      // 检查每个参数是否有调制
      const updatedParams = {};
      let hasNodeUpdates = false;

      Object.entries(parameters).forEach(([key, param]) => {
        // 检查此节点和参数是否在调制值列表中
        const valueKey = `${id}:${key}`;
        const modulationValue = modulationValues[valueKey];

        // 如果参数标记为被调制但没有调制值，需要修复
        if (param.isModulated && modulationValue === undefined) {
          console.warn(`参数标记为已调制但没有调制值: ${valueKey}`);
          return;
        }

        // 如果有调制值，更新显示值
        if (param.isModulated && modulationValue !== undefined) {
          const minMod = param.modRange ? param.modRange[0] : param.min;
          const maxMod = param.modRange ? param.modRange[1] : param.max;

          // 将调制值映射到参数范围
          // modulationValue 范围是 -1 到 1，将其映射到 0 到 1
          const normalizedValue = (modulationValue + 1) / 2;
          const modulatedValue = minMod + (maxMod - minMod) * normalizedValue;
          const clampedValue = Math.min(
            param.max,
            Math.max(param.min, modulatedValue)
          );

          updatedParams[key] = {
            ...param,
            displayValue: clampedValue.toFixed(2),
          };

          // 直接更新音频参数
          get().updateAudioParameter(id, key, clampedValue);

          hasNodeUpdates = true;
          hasAnyUpdates = true;
        }
      });

      // 如果有参数更新，返回更新的节点
      if (hasNodeUpdates) {
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

    // 只有在有更新时才返回新数组
    return hasAnyUpdates ? updatedNodes : nodes;
  },

  // 获取特定节点参数的调制值
  getModulationValue: (nodeId, paramKey) => {
    const key = `${nodeId}:${paramKey}`;
    return get().modulationValues[key] || null;
  },
});

export default createModulationStore;
