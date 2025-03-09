/**
 * 调制服务 - 处理节点间的调制信号
 */
class ModulationService {
  constructor() {
    this.modulationConnections = {};
    this.modulationValues = {};
    this.updateInterval = null;
  }

  /**
   * 初始化调制服务
   */
  initialize() {
    // 设置周期性更新调制值的定时器
    this.updateInterval = setInterval(() => this.updateModulationValues(), 100);
  }

  /**
   * 清理资源
   */
  cleanup() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * 添加调制连接
   * @param {string} connectionId 连接ID
   * @param {Object} connectionData 连接数据
   */
  addModulationConnection(connectionId, connectionData) {
    this.modulationConnections[connectionId] = connectionData;
  }

  /**
   * 移除调制连接
   * @param {string} connectionId 连接ID
   */
  removeModulationConnection(connectionId) {
    if (this.modulationConnections[connectionId]) {
      delete this.modulationConnections[connectionId];
    }
  }

  /**
   * 更新调制连接深度
   * @param {string} connectionId 连接ID
   * @param {number} depth 调制深度
   */
  updateModulationDepth(connectionId, depth) {
    if (this.modulationConnections[connectionId]) {
      this.modulationConnections[connectionId].depth = depth;
    }
  }

  /**
   * 更新调制连接的调制范围
   * @param {string} targetParam 目标参数 "nodeId:paramKey"
   * @param {Array<number>} range 调制范围 [min, max]
   */
  updateModulationRange(targetParam, range) {
    // 找到所有针对这个参数的调制连接
    Object.keys(this.modulationConnections).forEach((connectionId) => {
      const connection = this.modulationConnections[connectionId];
      const connectionTarget = `${connection.target}:${connection.paramKey}`;

      if (connectionTarget === targetParam) {
        // 更新连接的调制范围
        this.modulationConnections[connectionId].range = range;
      }
    });
  }

  /**
   * 获取节点参数的实时调制值
   * @param {string} nodeId 节点ID
   * @param {string} paramKey 参数键
   * @returns {number|null} 调制值或null（如果不存在调制）
   */
  getModulationValue(nodeId, paramKey) {
    const key = `${nodeId}:${paramKey}`;
    return this.modulationValues[key] || null;
  }

  /**
   * 计算所有调制值的系统方法
   * 在音频引擎处理循环中调用
   */
  updateModulationValues() {
    // 在实际系统中，这个方法应该从音频引擎获取实时的调制源值
    // 并应用它们到目标参数

    // 当前仅模拟一些调制值
    const currentTime = Date.now() / 10000;

    // 为每个调制连接计算调制值
    Object.entries(this.modulationConnections).forEach(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ([connectionId, connection]) => {
        const { target, paramKey, depth, bipolar } = connection;

        // 在真实系统中，这里应该是从调制源获取调制信号值
        // 现在先使用一个简单的正弦波模拟
        const modulationSignal = Math.sin(currentTime * 2 * Math.PI);
        // 计算调制值
        const modulationValue = bipolar
          ? modulationSignal * depth
          : (modulationSignal * 0.5 + 0.5) * depth;

        // 存储调制值
        const valueKey = `${target}:${paramKey}`;
        this.modulationValues[valueKey] = modulationValue;
      }
    );
  }

  /**
   * 应用调制值到节点参数
   * @param {Array} nodes React Flow节点数组
   * @returns {Array} 更新后的节点
   */
  applyModulationToNodes(nodes) {
    return nodes.map((node) => {
      const { id, data } = node;
      const { parameters } = data;

      // 检查每个参数是否有调制
      const updatedParams = {};
      let hasUpdates = false;

      Object.entries(parameters).forEach(([key, param]) => {
        if (param.isModulated) {
          const modulationValue = this.getModulationValue(id, key);

          // 如果存在调制值
          if (modulationValue !== null) {
            // 使用用户设置的调制范围
            const [minMod, maxMod] = param.modRange || [param.min, param.max];
            // const range = maxMod - minMod;

            // 基准值仍然是参数本身的值
            const baseValue = param.value;

            // 计算调制后的实际值
            // 将-1到1的调制信号映射到用户设置的调制范围内
            // 从对称调制变为使用用户设置的调制范围
            let modValue;

            if (modulationValue >= 0) {
              // 正向调制：从基准值到上限
              modValue = baseValue + (maxMod - baseValue) * modulationValue;
            } else {
              // 负向调制：从基准值到下限
              modValue = baseValue + (baseValue - minMod) * modulationValue;
            }

            // 确保值在参数的有效范围内
            modValue = Math.min(param.max, Math.max(param.min, modValue));

            // 更新参数
            updatedParams[key] = {
              ...param,
              displayValue: modValue.toFixed(2), // 使用显示值而不改变基础值
            };

            hasUpdates = true;
          }
        }
      });

      // 如果有参数更新，创建新的节点数据
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
  }
}

// 创建单例
const modulationService = new ModulationService();
export default modulationService;
