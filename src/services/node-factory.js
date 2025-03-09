/**
 * 节点工厂服务 - 用于创建各种类型的节点
 */

// 生成唯一ID
// const generateId = () => `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

// 创建节点的工厂函数
export const createNode = (type, id, position, customData = {}) => {
  // 根据节点类型提供默认数据
  const defaultData = {
    input: {
      label: `输入节点 ${id}`,
      ports: { inputs: [], outputs: ['output'] },
    },
    default: {
      label: `处理节点 ${id}`,
      ports: { inputs: ['input'], outputs: ['output'] },
    },
    output: {
      label: `输出节点 ${id}`,
      ports: { inputs: ['input'], outputs: [] },
    },
    custom: {
      label: `自定义节点 ${id}`,
      ports: { inputs: ['input1', 'input2'], outputs: ['output1', 'output2'] },
    },
  };

  // 合并默认数据和自定义数据
  const data = {
    ...(defaultData[type] || {
      label: `节点 ${id}`,
      ports: { inputs: ['input'], outputs: ['output'] },
    }),
    ...customData,
  };

  // 为不同节点类型设置不同样式
  const getNodeStyle = () => {
    switch (type) {
      case 'input':
        return { borderColor: '#0041d0', backgroundColor: '#f6fafd' };
      case 'output':
        return { borderColor: '#ff0072', backgroundColor: '#fff6f9' };
      case 'custom':
        return { borderColor: '#00a650', backgroundColor: '#f6fffa' };
      default:
        return { borderColor: '#1a192b', backgroundColor: '#f8f8f8' };
    }
  };

  // 返回节点配置
  return {
    id: `node-${id}`,
    type: type,
    position,
    data,
    style: {
      border: '1px solid',
      padding: 10,
      borderRadius: 5,
      ...getNodeStyle(),
    },
  };
};

/**
 * 创建连接两个节点的边
 */
export const createEdge = (sourceId, targetId) => {
  return {
    id: `edge-${sourceId}-${targetId}`,
    source: sourceId,
    target: targetId,
    // 可以添加边的样式设置
    type: 'smoothstep', // 使用平滑曲线
    animated: false, // 是否有动画效果
  };
};
