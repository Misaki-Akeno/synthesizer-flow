import * as Tone from 'tone';
import moduleService from '../services/moduleService';

const createAudioStore = (set, get) => ({
  // 状态
  audioNodes: {}, // 存储所有音频节点实例 {nodeId: audioInstance}
  audioConnections: [], // 存储所有连接 [{source, target, ...}]
  audioStarted: false,

  // Actions
  initializeAudio: async () => {
    console.log('初始化音频子系统');

    // 初始化 moduleService
    await moduleService.initialize();

    set({ audioNodes: {}, audioConnections: [], audioStarted: false });
    return true;
  },

  startAudio: async () => {
    try {
      await Tone.start();
      set({ audioStarted: true });
      console.log('音频上下文已启动');
      return true;
    } catch (error) {
      console.error('启动音频失败:', error);
      return false;
    }
  },

  cleanupAudio: () => {
    // 释放所有音频资源
    Object.values(get().audioNodes).forEach((node) => {
      if (
        node &&
        node.instance &&
        typeof node.instance.dispose === 'function'
      ) {
        node.instance.dispose();
      }
    });

    Tone.Transport.stop();
    set({ audioNodes: {}, audioConnections: [], audioStarted: false });
  },

  // 音频节点操作
  createAudioNode: (nodeId, moduleId, initialParams = {}) => {
    try {
      // 通过 moduleService 创建实际的音频节点
      const audioNode = moduleService.createToneInstance(
        moduleId,
        initialParams
      );

      set((state) => ({
        audioNodes: {
          ...state.audioNodes,
          [nodeId]: audioNode,
        },
      }));

      return true;
    } catch (error) {
      console.error(`创建音频节点失败: ${nodeId}`, error);
      return false;
    }
  },

  removeAudioNode: (nodeId) => {
    const state = get();
    const audioNode = state.audioNodes[nodeId];

    if (audioNode && audioNode.instance) {
      // 断开所有连接
      state.audioConnections
        .filter((conn) => conn.source === nodeId || conn.target === nodeId)
        .forEach((conn) => {
          get().removeAudioConnection(
            conn.source,
            conn.sourceHandle,
            conn.target,
            conn.targetHandle
          );
        });

      // 释放资源
      if (typeof audioNode.instance.dispose === 'function') {
        audioNode.instance.dispose();
      }

      // 从状态中移除
      set((state) => {
        const newAudioNodes = { ...state.audioNodes };
        delete newAudioNodes[nodeId];
        return { audioNodes: newAudioNodes };
      });
    }
  },

  updateAudioParameter: (nodeId, paramKey, value) => {
    const audioNode = get().audioNodes[nodeId];
    if (!audioNode || !audioNode.instance) return;

    try {
      // 根据参数类型更新音频节点
      if (typeof audioNode.instance[paramKey] !== 'undefined') {
        if (
          typeof audioNode.instance[paramKey] === 'object' &&
          audioNode.instance[paramKey].value !== undefined
        ) {
          // 参数是 AudioParam
          audioNode.instance[paramKey].value = value;
        } else {
          // 常规属性
          audioNode.instance[paramKey] = value;
        }
      }
    } catch (error) {
      console.error(`更新音频参数失败: ${nodeId}.${paramKey}`, error);
    }
  },

  // 音频连接管理
  createAudioConnection: (sourceId, sourceHandle, targetId, targetHandle) => {
    const sourceNode = get().audioNodes[sourceId];
    const targetNode = get().audioNodes[targetId];

    if (!sourceNode || !targetNode) return false;

    try {
      // 连接音频节点
      // 这里需要根据 Tone.js 的具体 API 和节点类型进行适当的连接
      // 这是一个简化的示例
      sourceNode.instance.connect(targetNode.instance);

      // 记录连接
      set((state) => ({
        audioConnections: [
          ...state.audioConnections,
          {
            source: sourceId,
            sourceHandle,
            target: targetId,
            targetHandle,
            audioConnection: {
              from: sourceNode.instance,
              to: targetNode.instance,
            },
          },
        ],
      }));

      return true;
    } catch (error) {
      console.error('创建音频连接失败', error);
      return false;
    }
  },

  removeAudioConnection: (sourceId, sourceHandle, targetId, targetHandle) => {
    const sourceNode = get().audioNodes[sourceId];
    const targetNode = get().audioNodes[targetId];

    if (!sourceNode || !targetNode) return false;

    try {
      // 断开音频连接
      sourceNode.instance.disconnect(targetNode.instance);

      // 更新连接状态
      set((state) => ({
        audioConnections: state.audioConnections.filter(
          (conn) =>
            !(
              conn.source === sourceId &&
              conn.sourceHandle === sourceHandle &&
              conn.target === targetId &&
              conn.targetHandle === targetHandle
            )
        ),
      }));

      return true;
    } catch (error) {
      console.error('移除音频连接失败', error);
      return false;
    }
  },
});

export default createAudioStore;
