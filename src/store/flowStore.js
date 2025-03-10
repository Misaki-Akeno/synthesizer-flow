import { nanoid } from 'nanoid';
import { addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import { createNode } from '../services/node-factory';

const createFlowStore = (set, get) => ({
  // 状态
  nodes: [],
  edges: [],
  selectedNodes: [],
  selectedEdges: [],

  // Actions
  initializeFlow: async () => {
    // 初始化流程图
    console.log('初始化流程图子系统');
    set({ nodes: [], edges: [] });
  },

  cleanupFlow: () => {
    set({ nodes: [], edges: [] });
  },

  // 节点操作
  addNode: (type, position, moduleId, data = {}) => {
    const nodeId = nanoid();
    const newNode = createNode(
      type,
      nodeId,
      position,
      moduleId,
      data,
      (nodeId, updateData) => {
        get().updateNodeParameter(nodeId, updateData);
      }
    );

    set((state) => ({ nodes: [...state.nodes, newNode] }));
    return nodeId;
  },

  updateNode: (nodeId, updates) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, ...updates } : node
      ),
    }));
  },

  updateNodeParameter: (nodeId, updateData) => {
    if (updateData.type === 'PARAMETER_CHANGE') {
      set((state) => ({
        nodes: state.nodes.map((node) => {
          if (node.id === nodeId) {
            const { parameterKey, parameterValue, isModulated } = updateData;
            // 更新参数值
            const updatedParams = {
              ...node.data.parameters,
              [parameterKey]: {
                ...node.data.parameters[parameterKey],
                value: parameterValue,
                displayValue: parameterValue,
                // 重要：确保正确设置 isModulated 标记
                isModulated:
                  isModulated !== undefined
                    ? isModulated
                    : node.data.parameters[parameterKey]?.isModulated || false,
              },
            };

            // 通知音频引擎参数已更改
            get().updateAudioParameter(nodeId, parameterKey, parameterValue);

            return {
              ...node,
              data: {
                ...node.data,
                parameters: updatedParams,
              },
            };
          }
          return node;
        }),
      }));
    } else if (updateData.type === 'MOD_RANGE_CHANGE') {
      set((state) => ({
        nodes: state.nodes.map((node) => {
          if (node.id === nodeId) {
            const { parameterKey, modRange } = updateData;
            // 更新调制范围
            const updatedParams = {
              ...node.data.parameters,
              [parameterKey]: {
                ...node.data.parameters[parameterKey],
                modRange,
                // 设置了调制范围，则参数必然被调制
                isModulated: true,
              },
            };

            // 通知调制系统范围已更改
            get().updateModulationRange(`${nodeId}:${parameterKey}`, modRange);

            return {
              ...node,
              data: {
                ...node.data,
                parameters: updatedParams,
              },
            };
          }
          return node;
        }),
      }));
    }
  },

  removeNode: (nodeId) => {
    // 移除相关的边
    const relatedEdges = get().edges.filter(
      (edge) => edge.source === nodeId || edge.target === nodeId
    );

    relatedEdges.forEach((edge) => {
      get().removeEdge(edge.id);
    });

    // 从音频引擎中移除
    get().removeAudioNode(nodeId);

    // 移除节点
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== nodeId),
    }));
  },

  // 边操作
  addEdge: (connection) => {
    const { source, sourceHandle, target, targetHandle } = connection;
    const edgeId = `${source}_${sourceHandle}->${target}_${targetHandle}`;

    // 检查是否为调制连接
    if (targetHandle && targetHandle.startsWith('mod_')) {
      const [_, _paramModuleId, paramKey] = targetHandle.split('_');

      console.log(`创建调制连接: ${source} -> ${target}:${paramKey}`);

      // 将调制连接添加到调制系统
      get().addModulationConnection(edgeId, {
        source,
        sourceHandle,
        target,
        targetHandle,
        paramKey,
        depth: 1.0,
        bipolar: true,
      });

      // 标记目标节点的参数为被调制
      const targetNode = get().nodes.find((node) => node.id === target);
      if (targetNode && targetNode.data.parameters[paramKey]) {
        const param = targetNode.data.parameters[paramKey];
        const currentValue = param.value;
        const min = param.min;
        const max = param.max;

        // 计算默认调制范围
        const minMod = Math.max(min, currentValue - (max - min) * 0.2);
        const maxMod = Math.min(max, currentValue + (max - min) * 0.2);

        // 重要：先设置调制状态，确保 isModulated 标记为 true
        set((state) => ({
          nodes: state.nodes.map((node) => {
            if (node.id === target) {
              return {
                ...node,
                data: {
                  ...node.data,
                  parameters: {
                    ...node.data.parameters,
                    [paramKey]: {
                      ...node.data.parameters[paramKey],
                      isModulated: true,
                    },
                  },
                },
              };
            }
            return node;
          }),
        }));

        // 然后设置调制范围
        get().updateNodeParameter(target, {
          type: 'MOD_RANGE_CHANGE',
          parameterKey: paramKey,
          modRange: [minMod, maxMod],
        });
      }
    } else {
      // 常规音频或控制连接
      get().createAudioConnection(source, sourceHandle, target, targetHandle);
    }

    // 添加实际的边
    set((state) => ({
      edges: addEdge({ ...connection, id: edgeId }, state.edges),
    }));

    return edgeId;
  },

  removeEdge: (edgeId) => {
    const edge = get().edges.find((e) => e.id === edgeId);

    if (edge) {
      const { source, sourceHandle, target, targetHandle } = edge;

      // 检查是否为调制连接
      if (targetHandle && targetHandle.startsWith('mod_')) {
        const [_, _paramModuleId, paramKey] = targetHandle.split('_');

        // 从调制系统移除连接
        get().removeModulationConnection(edgeId);

        // 更新目标节点参数状态
        get().updateNodeParameter(target, {
          type: 'PARAMETER_CHANGE',
          parameterKey: paramKey,
          parameterValue: get().nodes.find((n) => n.id === target)?.data
            .parameters[paramKey]?.value,
          isModulated: false,
        });
      } else {
        // 移除音频连接
        get().removeAudioConnection(source, sourceHandle, target, targetHandle);
      }
    }

    // 移除边
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== edgeId),
    }));
  },

  // ReactFlow 交互处理
  onNodesChange: (changes) => {
    // 使用 React Flow 的 applyNodeChanges 函数来处理所有变化
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    }));
  },

  onEdgesChange: (changes) => {
    // 使用 React Flow 的 applyEdgeChanges 函数来处理所有变化
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },

  // 选择相关
  selectNodes: (nodeIds) => {
    set({ selectedNodes: nodeIds });
  },

  selectEdges: (edgeIds) => {
    set({ selectedEdges: edgeIds });
  },
});

export default createFlowStore;
